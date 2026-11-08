"""Decompose the official DHANUSH -> DEVA poster into animation layers.
Outputs (public/intro/):
  poster.webp  - the untouched master poster
  plate.webp   - the poster with emblem / title / tagline / barbell removed (smoke fill)
  mask.png     - RGBA layer mattes: R emblem, G "DHANUSH", B arrow+"DEVA", A tagline+heartbeat+barbell
At full reveal the shader composites back to exactly the original poster pixels.
Usage: python3 scripts/make_intro_assets.py path/to/poster.png
"""
import sys, cv2, numpy as np
from PIL import Image

src = sys.argv[1]
img = cv2.cvtColor(np.array(Image.open(src).convert('RGB')), cv2.COLOR_RGB2BGR).astype(np.float32)
H, W = img.shape[:2]
sx, sy = W / 1672, H / 941
R = lambda x0, y0, x1, y1: (int(x0 * sx), int(y0 * sy), int(x1 * sx), int(y1 * sy))

b, g, r = cv2.split(img)
mx = np.maximum(np.maximum(r, g), b)
red = (r - np.maximum(g, b))
ink = ((mx > 62) | (red > 38)).astype(np.uint8)

def region(rect, close=5, dil=4, fill=False, minarea=120):
    x0, y0, x1, y1 = R(*rect)
    m = np.zeros((H, W), np.uint8)
    m[y0:y1, x0:x1] = ink[y0:y1, x0:x1]
    if close: m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close)))
    if fill:
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = [c for c in cnts if cv2.contourArea(c) > 400]
        m = np.zeros_like(m); cv2.drawContours(m, cnts, -1, 1, -1)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < minarea * sx * sy: m[lab == i] = 0
    if dil: m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dil * 2 + 1, dil * 2 + 1)))
    return m

ink[:int(335 * sy), :int(515 * sx)] = 0  # keep cliff smoke out of the emblem matte (cape starts lower)
emblem = region((270, 30, 1255, 528), close=31, dil=6, fill=True)
dhanush = region((110, 528, 908, 698), close=7, dil=4)
deva = region((905, 520, 1540, 680), close=7, dil=4)
tag = region((200, 682, 1410, 724), close=3, dil=3, minarea=8)
beat = region((440, 728, 1210, 815), close=5, dil=4)
dhanush[emblem > 0] = 0  # D tip belongs to the emblem
dhanush[tag > 0] = 0; deva[tag > 0] = 0
hole = np.clip(emblem + dhanush + deva + tag + beat, 0, 1).astype(np.float32)

# Clean plate: normalised-convolution fill (fills holes with surrounding smoke), large blur for emblem.
def fill(im, m, sigma):
    keep = 1 - m
    num = cv2.GaussianBlur(im * keep[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(keep, (0, 0), sigma)[..., None] + 1e-4
    return num / den
small = fill(img, hole, 9)
big = fill(img, hole, 38)
mix = cv2.GaussianBlur(emblem.astype(np.float32), (0, 0), 6)[..., None]
filled = small * (1 - mix) + big * mix
rng = np.random.default_rng(7)
grain = cv2.GaussianBlur(rng.normal(0, 6, (H, W)).astype(np.float32), (0, 0), 1.2)[..., None]
filled = filled + grain
soft = cv2.GaussianBlur(hole, (0, 0), 2.5)[..., None]
plate = np.clip(img * (1 - soft) + filled * soft, 0, 255).astype(np.uint8)

def matte(m, s=1.6):
    return np.clip(cv2.GaussianBlur(m.astype(np.float32), (0, 0), s) * 1.15, 0, 1)
masks = np.dstack([matte(emblem, 3), matte(dhanush), matte(deva), matte(np.clip(tag + beat, 0, 1))])

out = sys.argv[2] if len(sys.argv) > 2 else 'public/intro'
Image.fromarray(cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2RGB)).save(f'{out}/poster.webp', quality=90, method=6)
Image.fromarray(cv2.cvtColor(plate, cv2.COLOR_BGR2RGB)).save(f'{out}/plate.webp', quality=82, method=6)
chans = [Image.fromarray((masks[..., i] * 255).astype(np.uint8), 'L').resize((W // 2, H // 2), Image.LANCZOS) for i in range(4)]  # per-channel: RGBA resize would premultiply
Image.merge('RGBA', chans).save(f'{out}/mask.png', optimize=True)
Image.fromarray(cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2RGB)).resize((1200, 675), Image.LANCZOS).save(f'{out}/poster-1200.jpg', quality=84, optimize=True, progressive=True)
print('ok', W, H)

# Brand assets cut from the poster (logo kept exactly as designed): emblem with alpha, nav mark, favicon.
x0, y0, x1, y1 = R(262, 22, 1262, 536)
alpha = (np.clip(cv2.GaussianBlur(emblem.astype(np.float32), (0, 0), 2.2) * 1.1, 0, 1) * 255).astype(np.uint8)
rgba = np.dstack([cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2RGB), alpha])[y0:y1, x0:x1]
Image.fromarray(rgba, 'RGBA').save(f'{out}/emblem.webp', quality=88, method=6)
dx0, dy0, dx1, dy1 = R(535, 38, 1255, 530)
mark = Image.fromarray(rgba[dy0 - y0:dy1 - y0, dx0 - x0:dx1 - x0], 'RGBA')
mark.resize((int(96 * mark.width / mark.height), 96), Image.LANCZOS).save(f'{out}/mark-96.webp', quality=90)
sq = Image.new('RGBA', (192, 192), (11, 10, 10, 255)); m2 = mark.resize((int(170 * mark.width / mark.height), 170), Image.LANCZOS)
m2 = m2.crop(((m2.width - 186) // 2, 0, (m2.width - 186) // 2 + 186, 170)) if m2.width > 186 else m2
sq.alpha_composite(m2, ((192 - m2.width) // 2, 11)); sq.convert('RGB').quantize(96, method=Image.Quantize.MEDIANCUT).save(f'{out}/../logo/favicon-192.png', optimize=True)
print('brand ok')
