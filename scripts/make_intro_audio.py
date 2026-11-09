"""Analyse + mix the intro music and derive the animation's sync markers from the audio itself.
Clip A (~8.2 s) is the opening build. It turns out to be an edit of clip B: from A=4.8 s on, A == B shifted by ~2.745 s.
So the mix continues A into B *sample-aligned* (same groove, no tempo/beat change), with B level/EQ-matched to A,
an equal-power crossfade in the quiet gap before A's final kick, then B runs to the next phrase downbeat and fades.

Outputs:
  audio-master/intro-mix.wav        44.1 kHz / 24-bit master
  public/intro/intro-mix.webm       Opus 128 kb/s (Chrome, Firefox, Edge, Android)
  public/intro/intro-mix.m4a        AAC 160 kb/s (Safari)
  src/intro/music.json              markers (seconds) used by the animation timeline
Usage: python3 scripts/make_intro_audio.py A.mpeg B.mpeg
"""
import json, subprocess, sys, os
import numpy as np
from scipy import signal

SR = 44100
A_PATH, B_PATH = sys.argv[1], sys.argv[2]

def decode(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)

A, B = decode(A_PATH), decode(B_PATH)
mono = lambda x: x.mean(1)
print(f'A {len(A)/SR:.3f}s  B {len(B)/SR:.3f}s')
if len(A) / SR > len(B) / SR: A, B = B, A  # A must be the ~8 s clip

# ---- 1. sample-accurate alignment of A's groove section inside B ---------------------------------
def band(x, lo, hi):
    sos = signal.butter(4, [lo, hi] if lo else hi, 'bandpass' if lo else 'lowpass', fs=SR, output='sos')
    return signal.sosfiltfilt(sos, x)
def env(x, hop=441):
    n = len(x) // hop
    return np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1))

ea, eb = env(mono(A)), env(mono(B[:SR * 40]))
seg = ea[int(4.8 * 100):int(8.0 * 100)]; seg = (seg - seg.mean()) / seg.std()
corr = np.array([np.mean(seg * ((w := eb[o:o + len(seg)]) - w.mean()) / (w.std() + 1e-9)) for o in range(len(eb) - len(seg))])
coarse = corr.argmax() / 100 - 4.8                     # B_time = A_time + coarse
a0, a1 = int(5.0 * SR), int(7.6 * SR)
xa = mono(A)[a0:a1]
search = int(0.03 * SR)
b0 = a0 + int(coarse * SR) - search
xb = mono(B)[b0:b0 + len(xa) + 2 * search]
c = signal.correlate(xb, xa, mode='valid', method='fft')
lag = b0 + c.argmax() - a0                             # B sample = A sample + lag
offset = lag / SR
match = np.corrcoef(xa, mono(B)[a0 + lag:a1 + lag])[0, 1]
print(f'alignment: B = A + {offset:.5f}s (envelope corr {corr.max():.3f}, waveform corr {match:.3f})')

# ---- 2. loudness + tonal match of B to A over the shared section ----------------------------------
ov_a = A[a0:a1]; ov_b = B[a0 + lag:a1 + lag]
f, Pa = signal.welch(mono(ov_a), SR, nperseg=4096)
_, Pb = signal.welch(mono(ov_b), SR, nperseg=4096)
ratio_db = 10 * np.log10((Pa + 1e-12) / (Pb + 1e-12))
# smooth to ~1/3 octave and clamp: gentle corrective EQ, not a re-voicing
oct_idx = np.log2(np.maximum(f, 20) / 20)
smooth = np.array([ratio_db[np.abs(oct_idx - o) < 1 / 6].mean() for o in oct_idx])
gain_db = np.median(smooth[(f > 80) & (f < 8000)])
eq_db = np.clip(smooth - gain_db, -4, 4); eq_db[f < 30] = eq_db[f >= 30][0]; eq_db[f > 16000] = 0
fir = signal.firwin2(2049, f / (SR / 2), 10 ** ((eq_db) / 20))
Bm = np.stack([signal.fftconvolve(B[:, ch], fir, mode='same') for ch in range(2)], 1) * 10 ** (gain_db / 20)
rms = lambda x: np.sqrt(np.mean(x ** 2))
print(f'B gain {gain_db:+.2f} dB, EQ range {eq_db[(f>40)&(f<12000)].min():+.1f}..{eq_db[(f>40)&(f<12000)].max():+.1f} dB, '
      f'overlap RMS A {20*np.log10(rms(ov_a)):.2f} dB vs B(matched) {20*np.log10(rms(Bm[a0+lag:a1+lag])):.2f} dB')

# ---- 3. musical analysis on A (onsets) ------------------------------------------------------------
def hits(x, lo, hi, jump=6.0, floor=12.0):
    """Energy-jump detector: (time, rise dB over ~60 ms, level dB) for transients in a band."""
    e = 20 * np.log10(env(band(x, lo, hi), 441) + 1e-7)          # 10 ms frames
    rise = np.zeros_like(e); rise[2:-6] = e[8:] - e[:-8]
    rise = np.maximum(rise, 0)
    pk, _ = signal.find_peaks(rise, height=jump, distance=18)
    out = []
    es = np.convolve(e, np.ones(3) / 3, 'same')
    for p in pk:
        q = p + int(es[p:p + 15].argmax())            # local peak of the hit
        o = q
        while o > p - 4 and es[o - 1] > es[q] - 12: o -= 1   # onset: where it rises out of the floor
        if es[q] > e.max() - floor: out.append((round(o * 0.01, 3), round(float(rise[p]), 1), round(float(es[q]), 1)))
    return out
low_a = hits(mono(A), 0, 140, jump=4.0, floor=14.0)
high_a = hits(mono(A), 2500, 12000, jump=7)
print('A low hits', low_a); print('A high hits', high_a)
# beat: B's groove repeats every 16 beats; autocorrelate B's low-band onset envelope over a long window
lb = env(band(mono(B[int(2 * SR):int(80 * SR)]), 0, 140), 220)
ld = np.maximum(np.diff(np.log(lb + 1e-6)), 0)
ac = signal.correlate(ld - ld.mean(), ld - ld.mean(), 'full', method='fft')[len(ld) - 1:]
lags = np.arange(len(ac)) * 0.005
m = (lags > 6.6) & (lags < 7.9)
cycle = lags[m][ac[m].argmax()]
beat = cycle / 16
print(f'tempo {60/beat:.2f} BPM (16-beat cycle {cycle:.3f}s)')

def biggest(lst, t0, t1):
    c = [o for o in lst if t0 <= o[0] <= t1]
    return max(c, key=lambda o: o[1])[0] if c else None
big = [o for o in low_a if o[1] >= 12 and o[2] > max(l for _, _, l in low_a) - 10]                       # structural hits only
build = next(t for t, r, l in big if t > 1.0)
ring = next(t for t, r, l in big if t > build + 0.4)
sweep = next(t for t, r, l in big if t > ring + 0.25)
swell = max((o for o in big if sweep < o[0] < sweep + 1.0), key=lambda o: o[2])[0]
crash = biggest(high_a, 4.0, 4.8)
# impact = onset of the loudest low-band boom after the crash (walk back from its peak to where it rises out of the floor)
_el = 20 * np.log10(env(band(mono(A), 0, 140), 441) + 1e-7)
_el = np.convolve(_el, np.ones(3) / 3, 'same')
_i0, _i1 = int((crash + 0.2) * 100), int((crash + 0.9) * 100)
_pk = _i0 + _el[_i0:_i1].argmax()
_on = _pk
while _on > _i0 - 15 and _el[_on - 1] > _el[_pk] - 12: _on -= 1
impact = round(_on * 0.01, 3)
b_low = [o for o in hits(mono(B[:SR * 30]), 0, 140, jump=4.0, floor=10.0) if o[1] >= 12]
kicks = sorted({round(t, 3) for t, r, l in big if t > impact + 0.2} | {round(t - offset, 3) for t, r, l in b_low if t - offset > len(A) / SR - 0.35})
kicks = [k for i, k in enumerate(kicks) if i == 0 or k - kicks[i - 1] > 0.15]
print('kicks (A time)', kicks)
reveal = next(k for k in kicks if k >= impact + 2.0)
fly = next(k for k in kicks if k >= reveal + 2.0)
land_est = impact + 16 * beat
land = min(kicks, key=lambda k: abs(k - land_est)) if min(abs(k - land_est) for k in kicks) < 0.12 else land_est
fade_len = 8 * beat
end = land + fade_len
markers = dict(build=build, ring=ring, sweep=sweep, swell=swell, crash=crash, impact=impact, reveal=reveal, fly=fly, land=round(land, 3),
               end=round(end, 3), beat=round(beat, 4), kicks=[k for k in kicks if k <= land + 0.05], offsetB=round(offset, 5))
print('markers', json.dumps(markers))

# ---- 4. the mix ----------------------------------------------------------------------------------
# crossfade centre: quietest low-band point between A's last two kicks, before A's (truncated) end
la = env(band(mono(A), 0, 140), 220)
k_last = max(t for t, r, l in low_a if t < len(A) / SR - 0.1)
w0, w1 = int((k_last - 0.45) / 0.005), int((k_last - 0.08) / 0.005)
xc = (w0 + la[w0:w1].argmin()) * 0.005
xl = 0.12
n_out = int(end * SR)
out = np.zeros((n_out, 2))
i0, i1 = int((xc - xl / 2) * SR), int((xc + xl / 2) * SR)
out[:i0] = A[:i0]
ph = np.linspace(0, np.pi / 2, i1 - i0)[:, None]
out[i0:i1] = A[i0:i1] * np.cos(ph) + Bm[i0 + lag:i1 + lag] * np.sin(ph)
out[i1:] = Bm[i1 + lag:n_out + lag]
nl = int(land * SR)
fade = np.cos(np.linspace(0, np.pi / 2, n_out - nl)) ** 1.5
out[nl:] *= fade[:, None]
out[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
print(f'crossfade {xc - xl/2:.3f}-{xc + xl/2:.3f}s (equal power), fade-out {land:.3f}-{end:.3f}s, peak before master {np.abs(out).max():.3f}')

os.makedirs('audio-master', exist_ok=True)
tmp = 'audio-master/_pre.f32'
out.astype(np.float32).tofile(tmp)
pre = ['-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', tmp]
# two-pass EBU R128 loudness to -14 LUFS, -1.5 dBTP (linear gain; no pumping), then a safety limiter
meas = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'info', *pre, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1])
af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
      f"measured_thresh={j['input_thresh']}:offset={j['target_offset']},alimiter=limit=0.84:attack=1:release=60:level=disabled,aresample={SR}")
subprocess.run(['ffmpeg', '-v', 'error', '-y', *pre, '-af', af, '-c:a', 'pcm_s24le', 'audio-master/intro-mix.wav'], check=True)
os.remove(tmp)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'audio-master/intro-mix.wav', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', 'public/intro/intro-mix.webm'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'audio-master/intro-mix.wav', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'public/intro/intro-mix.m4a'], check=True)
with open('src/intro/music.json', 'w') as fp: json.dump(markers, fp, indent=1)
print('input loudness', j['input_i'], 'LUFS; done')
