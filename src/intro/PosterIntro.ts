// Cinematic intro renderer: the official poster, decomposed into layers (see scripts/make_intro_assets.py),
// re-assembled live in one WebGL2 pass with a virtual camera, dissolves, metal sweeps, ring fire,
// shockwave, smoke, embers and a radial hand-off into the 3D world. At full reveal it equals the poster.

const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uPoster, uPlate, uMask;
uniform vec2 uRes, uView, uShake, uShockC;
uniform vec3 uCam;
uniform float uTime, uFade, uBg, uEmb, uDh, uDhOff, uArrow, uDeva, uTag, uBeat, uBar, uRing, uSweepE, uSweepT,
  uFlash, uShock, uSmoke, uEmbers, uBurst, uHole, uPulse, uMotion;
out vec4 o;
const vec2 SIZE = vec2(1672.0, 941.0);
const vec2 RC = vec2(833.0, 311.0);

float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 tex(sampler2D s, vec2 px){ return texture(s, px / SIZE).rgb; }

void main(){
  vec2 f = gl_FragCoord.xy / uRes;
  vec2 p = uCam.xy + vec2(f.x - 0.5, 0.5 - f.y) * uView / uCam.z + uShake;
  // shockwave
  if(uShock > 0.0 && uShock < 1.0){
    vec2 d = p - uShockC; float L = length(d); float R = uShock * 1500.0;
    float k = exp(-pow((L - R) / 70.0, 2.0)) * (1.0 - uShock);
    p -= d / (L + 1e-3) * k * 34.0 * uMotion;
  }
  vec2 uv = p / SIZE;
  float edge = smoothstep(-0.02, 0.07, uv.y) * smoothstep(1.02, 0.93, uv.y) * smoothstep(-0.01, 0.03, uv.x) * smoothstep(1.01, 0.97, uv.x);
  vec4 m = texture(uMask, uv);
  vec3 poster = tex(uPoster, p);
  vec3 col = tex(uPlate, p) * uBg;

  // smoke drifting through the plate (and filling space beyond the poster on tall screens)
  float sm = fbm(p * 0.0032 + vec2(uTime * 0.035, -uTime * 0.02)); sm *= sm * 1.6;
  vec3 smokeCol = vec3(0.16, 0.145, 0.14) * (0.6 + 0.8 * sm);
  col = mix(smokeCol * 0.5 * max(uFade, 0.0), col, edge);

  // light rays from the top-right source
  vec2 rd = p - vec2(1690.0, -60.0); float ra = atan(rd.y, rd.x);
  float rays = n2(vec2(ra * 26.0, uTime * 0.25)) * smoothstep(1500.0, 200.0, length(rd)) * smoothstep(1.2, 2.3, ra);
  col += vec3(0.95, 0.78, 0.55) * rays * 0.16 * uBg * edge;

  // ---- emblem: ember-burn dissolve + metal sweep
  float nE = (m.r > 0.001 && uEmb < 0.999) ? fbm(uv * 9.0 + 2.0) : 0.5;
  float thE = uEmb * 1.25 - 0.15;
  float aE = m.r * (1.0 - smoothstep(thE - 0.05, thE + 0.05, nE));
  float eE = m.r * exp(-pow((nE - thE) / 0.035, 2.0)) * step(uEmb, 0.999);
  float sw = exp(-pow((p.x * 0.8 + p.y * 0.6 - uSweepE) / 70.0, 2.0)) * smoothstep(0.35, 0.8, lum(poster));
  vec3 emb = poster * (1.0 + sw * 0.9 * m.r);
  col = mix(col, emb, aE);
  col += vec3(1.0, 0.42, 0.1) * eE * 1.6;

  // ---- ring fire: animated orange-red arc along the poster's ring
  vec2 rp = p - RC; float rl = length(rp); float ang = degrees(atan(-rp.y, rp.x));
  float drawn = 178.0 - uRing * 150.0;
  float arc = smoothstep(drawn - 6.0, drawn + 2.0, ang) * smoothstep(182.0, 176.0, ang) * step(32.0, ang);
  float ringD = rl - 269.0;
  float hot = exp(-pow((ang - (178.0 - fract(uTime * 0.22) * 146.0)) / 9.0, 2.0));
  float breathe = 0.65 + 0.35 * sin(uTime * 2.1) * sin(uTime * 0.7 + 1.0);
  col += vec3(1.0, 0.38, 0.08) * arc * (exp(-ringD * ringD / 200.0) * (0.55 * breathe + hot * 0.9) + exp(-ringD * ringD / 4000.0) * 0.22) * uRing;

  // ---- "DHANUSH": slides in centred, wipe-in with hot edge, metal sweep
  vec2 pd = p - vec2(uDhOff, 0.0);
  float mD = texture(uMask, pd / SIZE).g;
  vec3 cD = tex(uPoster, pd);
  float xw = 110.0 + uDh * 860.0;
  float aD = mD * smoothstep(xw, xw - 40.0, pd.x);
  float swT = exp(-pow((pd.x * 0.85 + pd.y * 0.5 - uSweepT) / 60.0, 2.0)) * smoothstep(0.3, 0.75, lum(cD));
  col = mix(col, cD * (1.0 + swT * 1.1), aD);
  col += vec3(1.0, 0.75, 0.5) * mD * exp(-pow((pd.x - xw + 20.0) / 14.0, 2.0)) * step(uDh, 0.999) * 1.4;

  // ---- arrow (wipe) + "DEVA" (fire burn)
  float isArrow = step(p.x, 1012.0);
  float aA = m.b * isArrow * smoothstep(905.0 + uArrow * 130.0, 885.0 + uArrow * 130.0, p.x);
  float nV = (m.b > 0.001 && uDeva < 0.999) ? fbm(uv * 14.0 + 9.0) : 0.5;
  float thV = uDeva * 1.2 - 0.1;
  float aV = m.b * (1.0 - isArrow) * (1.0 - smoothstep(thV - 0.04, thV + 0.04, nV));
  float eV = m.b * (1.0 - isArrow) * exp(-pow((nV - thV) / 0.03, 2.0)) * step(uDeva, 0.999);
  float swV = exp(-pow((p.x * 0.85 + p.y * 0.5 - uSweepT) / 60.0, 2.0)) * smoothstep(0.3, 0.75, lum(poster));
  col = mix(col, poster * (1.0 + swV * 1.1), max(aA, aV));
  col += vec3(1.0, 0.35, 0.08) * eV * 2.2;
  col += vec3(1.0, 0.3, 0.1) * m.b * isArrow * exp(-pow((p.x - 905.0 - uArrow * 130.0) / 10.0, 2.0)) * step(uArrow, 0.999) * 2.0;

  // ---- tagline (centre-out), barbell (pop), heartbeat (centre-out + travelling pulse)
  vec2 bc = vec2(832.0, 772.0);
  float s = mix(1.5, 1.0, uBar);
  vec2 pb = bc + (p - bc) / s;
  float isTag = step(p.y, 727.0);
  float inBar = step(abs(p.x - 832.0), 108.0) * (1.0 - isTag);
  float aT = m.a * isTag * smoothstep(uTag * 640.0, uTag * 640.0 - 30.0, abs(p.x - 805.0));
  float mB = texture(uMask, pb / SIZE).a * step(abs(pb.x - 832.0), 108.0) * step(727.0, pb.y);
  vec3 cB = tex(uPoster, pb);
  float aL = m.a * (1.0 - isTag) * (1.0 - inBar) * smoothstep(uBeat * 400.0, uBeat * 400.0 - 25.0, abs(p.x - 832.0));
  col = mix(col, poster, max(aT, aL));
  col = mix(col, cB, mB * uBar);
  float pulse = exp(-pow((abs(p.x - 832.0) - uPulse * 420.0) / 22.0, 2.0)) * step(0.001, uPulse) * step(uPulse, 0.999);
  col += vec3(1.0, 0.2, 0.12) * m.a * (1.0 - isTag) * (1.0 - inBar) * pulse * 2.5;

  // ---- embers / sparks rising
  float emb2 = 0.0;
  for(int k = 0; k < 2; k++){
    float cell = k == 0 ? 46.0 : 23.0;
    vec2 q = p / cell + vec2(sin(uTime * 0.6 + float(k)) * 0.3, uTime * (k == 0 ? 0.9 : 1.6));
    vec2 id = floor(q); vec2 g = fract(q) - 0.5;
    float r = h21(id + float(k) * 17.0);
    vec2 o2 = vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5;
    float d = length(g - o2 * 0.7);
    float tw = 0.5 + 0.5 * sin(uTime * (3.0 + r * 5.0) + r * 40.0);
    emb2 += smoothstep(0.09 - float(k) * 0.03, 0.0, d) * step(0.9 - uBurst * 0.25, r) * tw;
  }
  col += vec3(1.0, 0.45, 0.12) * emb2 * uEmbers;

  col = mix(col, smokeCol, clamp(sm * uSmoke, 0.0, 0.9));
  col += vec3(1.0, 0.55, 0.35) * uFlash * 0.55 + uFlash * 0.3;
  vec2 q = gl_FragCoord.xy / uRes;
  col *= mix(0.55, 1.0, pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.2));
  col += (h21(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) * 0.025;
  col *= uFade;
  // radial hand-off to the 3D world
  float dist = length((f - 0.5) * vec2(uRes.x / uRes.y, 1.0));
  float alpha = smoothstep(uHole - 0.28, uHole, dist); // transparent inside the growing hole
  col += vec3(1.0, 0.72, 0.45) * exp(-pow((dist - uHole + 0.1) / 0.09, 2.0)) * step(0.001, uHole) * 0.9; // light rim on the portal
  o = vec4(max(col, 0.0) * alpha, alpha);
}`;

export type Uniforms = Record<string, number | number[]>;

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error(`load ${url}`)); i.src = url; });
}

export class PosterIntro {
  ok = false;
  ready: Promise<void>;
  private gl!: WebGL2RenderingContext;
  private prog!: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private vao!: WebGLVertexArrayObject;
  private texs: WebGLTexture[] = [];
  private w = 0; private h = 0;
  private scale = 1; private acc = 0; private n = 0; private lastT = 0;

  constructor(private canvas: HTMLCanvasElement, base: string) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
    if (!gl) { this.ready = Promise.reject(new Error('no webgl2')); return; }
    this.gl = gl;
    const sh = (t: number, s: string) => { const x = gl.createShader(t)!; gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x) || 'shader'); return x; };
    const p = (this.prog = gl.createProgram()!);
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i)!; this.loc[u.name] = gl.getUniformLocation(p, u.name); }
    this.vao = gl.createVertexArray()!;
    this.ready = Promise.all(['poster.webp', 'plate.webp', 'mask.png'].map((f) => load(base + f))).then((imgs) => {
      imgs.forEach((img, i) => {
        const t = gl.createTexture()!;
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.texs.push(t);
      });
      gl.useProgram(p);
      gl.uniform1i(this.loc.uPoster, 0); gl.uniform1i(this.loc.uPlate, 1); gl.uniform1i(this.loc.uMask, 2);
      this.ok = true;
    });
  }

  /** Poster-pixel view size: covers wide screens, keeps the full logo on tall/portrait screens. */
  view(): [number, number] {
    const a = this.w / this.h, P = 1672 / 941;
    const vw = a >= P ? 1672 : Math.max(1450, 941 * a);
    return [vw, vw / a];
  }

  render(u: Uniforms, dprCap: number) {
    if (!this.ok) return;
    const gl = this.gl;
    // adaptive resolution: keep frame time low on weak GPUs, return to full sharpness when there's headroom
    const now = performance.now();
    if (this.lastT) { this.acc += now - this.lastT; this.n++; }
    this.lastT = now;
    if (this.acc > 500) {
      const ms = this.acc / this.n;
      if (ms > 22 && this.scale > 0.45) this.scale = Math.max(0.45, this.scale * 0.8);
      else if (ms < 14 && this.scale < 1) this.scale = Math.min(1, this.scale * 1.1);
      this.acc = 0; this.n = 0;
    }
    const pr = Math.min(devicePixelRatio || 1, dprCap) * this.scale;
    const w = Math.round(innerWidth * pr), h = Math.round(innerHeight * pr);
    if (w !== this.w || h !== this.h) { this.w = this.canvas.width = w; this.h = this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.loc.uRes, w, h);
    const [vw, vh] = this.view();
    gl.uniform2f(this.loc.uView, vw, vh);
    for (const [k, v] of Object.entries(u)) {
      const l = this.loc[k]; if (!l) continue;
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
      else gl.uniform3f(l, v[0], v[1], v[2]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    if (!this.gl) return;
    const gl = this.gl;
    this.texs.forEach((t) => gl.deleteTexture(t));
    gl.deleteProgram(this.prog); gl.deleteVertexArray(this.vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.ok = false;
  }
}
