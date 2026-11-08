import { SCENE_VS, SCENE_FS, PART_VS, PART_FS } from './shaders';
import { V3, basis, viewProj, lerp, lerp3, add, mul } from './math';

export type Tier = 'high' | 'mid' | 'low';
const TIERS: Record<Tier, { maxScale: number; dprCap: number; steps: number; particles: number }> = {
  high: { maxScale: 1, dprCap: 1.25, steps: 80, particles: 2200 },
  mid: { maxScale: 0.8, dprCap: 1.25, steps: 68, particles: 1300 },
  low: { maxScale: 0.6, dprCap: 1, steps: 46, particles: 500 },
};

export interface Look { fade: number; burst: number; dim: number; emblem: number; flash: number; smoke: number; accent: number; shake: number }
export type Controller = (time: number, dt: number, e: Engine) => void;

function detectTier(): Tier {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'high' || q === 'mid' || q === 'low') return q;
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
  const mem = (navigator as any).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse) return mem >= 6 && cores >= 8 ? 'mid' : 'low';
  return cores >= 8 ? 'high' : 'mid';
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader error');
    return s;
  };
  const p = gl.createProgram()!;
  const a = mk(gl.VERTEX_SHADER, vs), b = mk(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, a); gl.attachShader(p, b);
  gl.bindAttribLocation(p, 0, 'aSeed');
  gl.linkProgram(p);
  gl.deleteShader(a); gl.deleteShader(b);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link error');
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i)!; u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export class Engine {
  ok = false;
  tier: Tier;
  reduced: boolean;
  scale: number;
  steps: number;
  fps = 60;
  time = 0;
  controller: Controller | null = null;

  pos: V3 = [0, 2.2, 46]; tgt: V3 = [0, 2.6, 0]; roll = 0; fl = 1.7;
  private gPos: V3 = [0, 2.2, 46]; private gTgt: V3 = [0, 2.6, 0]; private gRoll = 0; private gFl = 1.7;
  look: Look = { fade: 0, burst: 0, dim: 0, emblem: 0, flash: 0, smoke: 1.4, accent: 0.3, shake: 0 };
  private gLook: Look = { ...this.look };
  camDamp = 2.4;
  burstC: V3 = [0, 2.4, 0];

  private gl!: WebGL2RenderingContext;
  private scene!: ReturnType<typeof compile>;
  private parts!: ReturnType<typeof compile>;
  private vaoEmpty!: WebGLVertexArrayObject;
  private vaoParts!: WebGLVertexArrayObject;
  private buf!: WebGLBuffer;
  private count = 0;
  private vp = new Float32Array(16);
  private raf = 0;
  private last = 0;
  private acc = 0; private frames = 0;
  private mouse = [0, 0]; private mouseS = [0, 0];
  private w = 0; private h = 0;
  private cfg: (typeof TIERS)[Tier];
  private onHidden = () => { if (document.hidden) this.stop(); else this.start(); };
  private onMove = (e: PointerEvent) => { this.mouse[0] = (e.clientX / innerWidth) * 2 - 1; this.mouse[1] = -((e.clientY / innerHeight) * 2 - 1); };
  private onLost = (e: Event) => { e.preventDefault(); this.stop(); this.ok = false; document.body.classList.add('no-webgl'); };

  constructor(private canvas: HTMLCanvasElement) {
    this.tier = detectTier();
    this.cfg = TIERS[this.tier];
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scale = this.cfg.maxScale;
    this.steps = this.cfg.steps;
    try {
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      if (!gl) throw new Error('WebGL2 unavailable');
      this.gl = gl;
      this.scene = compile(gl, SCENE_VS, SCENE_FS);
      this.parts = compile(gl, PART_VS, PART_FS);
      this.vaoEmpty = gl.createVertexArray()!;
      this.count = this.reduced ? Math.round(this.cfg.particles * 0.5) : this.cfg.particles;
      const seeds = new Float32Array(this.count * 4);
      for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
      this.vaoParts = gl.createVertexArray()!;
      gl.bindVertexArray(this.vaoParts);
      this.buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.ok = true;
    } catch (err) {
      console.warn('[DEVA] 3D disabled:', err);
      document.body.classList.add('no-webgl');
    }
    addEventListener('pointermove', this.onMove, { passive: true });
    document.addEventListener('visibilitychange', this.onHidden);
    canvas.addEventListener('webglcontextlost', this.onLost);
  }

  setShot(pos: V3, tgt: V3, roll = 0, fl = 1.7, instant = false) {
    this.gPos = pos; this.gTgt = tgt; this.gRoll = roll; this.gFl = fl;
    if (instant) { this.pos = [...pos]; this.tgt = [...tgt]; this.roll = roll; this.fl = fl; }
  }
  setLook(l: Partial<Look>, instant = false) {
    Object.assign(this.gLook, l);
    if (instant) Object.assign(this.look, l);
  }

  start() {
    if (!this.ok || this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.frame(now); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  private resize() {
    const pr = Math.min(devicePixelRatio || 1, this.cfg.dprCap) * this.scale;
    const w = Math.max(2, Math.round(innerWidth * pr)), h = Math.max(2, Math.round(innerHeight * pr));
    if (w !== this.w || h !== this.h) { this.w = this.canvas.width = w; this.h = this.canvas.height = h; }
  }

  private adapt(dt: number) {
    this.acc += dt; this.frames++;
    if (this.acc < 1) return;
    const ms = (this.acc / this.frames) * 1000;
    this.fps = 1000 / ms;
    const min = this.cfg.maxScale * 0.4;
    if (ms > 18) {
      if (this.scale > min) this.scale = Math.max(min, this.scale * (ms > 28 ? 0.72 : 0.84));
      if ((ms > 28 || this.scale <= min) && this.steps > 36) this.steps -= 8;
    } else if (ms < 13.5) {
      if (this.steps < this.cfg.steps) this.steps += 4;
      else if (this.scale < this.cfg.maxScale) this.scale = Math.min(this.cfg.maxScale, this.scale * 1.05);
    }
    this.acc = 0; this.frames = 0;
  }

  private frame(now: number) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.time += dt * (this.reduced ? 0.4 : 1);
    this.controller?.(this.time, dt, this);

    const k = 1 - Math.exp(-dt * this.camDamp);
    this.pos = lerp3(this.pos, this.gPos, k);
    this.tgt = lerp3(this.tgt, this.gTgt, k);
    this.roll = lerp(this.roll, this.gRoll, k);
    this.fl = lerp(this.fl, this.gFl, k);
    const kl = 1 - Math.exp(-dt * 3.2);
    for (const key in this.look) (this.look as any)[key] = lerp((this.look as any)[key], (this.gLook as any)[key], kl);
    const km = 1 - Math.exp(-dt * 4);
    this.mouseS[0] = lerp(this.mouseS[0], this.mouse[0], km);
    this.mouseS[1] = lerp(this.mouseS[1], this.mouse[1], km);

    this.resize();
    this.adapt(dt);

    const L = this.look;
    let pos = this.pos;
    const sh = this.reduced ? 0 : L.shake;
    if (sh > 0.001) pos = add(pos, [(Math.random() - 0.5) * sh * 0.5, (Math.random() - 0.5) * sh * 0.5, 0]);
    let b = basis(pos, this.tgt, this.roll);
    const par = this.reduced ? 0 : 1;
    const tgt = add(add(this.tgt, mul(b.r, this.mouseS[0] * 0.55 * par)), mul(b.u, this.mouseS[1] * 0.3 * par));
    b = basis(pos, tgt, this.roll);

    const gl = this.gl;
    gl.viewport(0, 0, this.w, this.h);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.depthFunc(gl.ALWAYS);
    gl.disable(gl.BLEND);

    const near = 0.1, far = 140;
    const S = this.scene.u;
    gl.useProgram(this.scene.p);
    gl.bindVertexArray(this.vaoEmpty);
    gl.uniform2f(S.uRes, this.w, this.h);
    gl.uniform1f(S.uTime, this.time);
    gl.uniform3fv(S.uCam, pos);
    gl.uniform3fv(S.uF, b.f); gl.uniform3fv(S.uR, b.r); gl.uniform3fv(S.uU, b.u);
    gl.uniform1f(S.uFl, this.fl); gl.uniform1f(S.uNear, near); gl.uniform1f(S.uFar, far);
    gl.uniform1f(S.uFade, L.fade); gl.uniform1f(S.uBurst, L.burst); gl.uniform1f(S.uDim, L.dim);
    gl.uniform1f(S.uEmblem, L.emblem); gl.uniform1f(S.uFlash, L.flash); gl.uniform1f(S.uSmoke, L.smoke);
    gl.uniform1f(S.uAccent, L.accent);
    gl.uniform1i(S.uSteps, this.steps);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const aspect = this.w / this.h;
    viewProj(pos, b, this.fl, aspect, near, far, this.vp);
    const P = this.parts.u;
    gl.useProgram(this.parts.p);
    gl.bindVertexArray(this.vaoParts);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniformMatrix4fv(P.uVP, false, this.vp);
    gl.uniform3fv(P.uCam, pos);
    gl.uniform3fv(P.uBurstC, this.burstC);
    gl.uniform1f(P.uTime, this.time);
    gl.uniform1f(P.uBurst, L.burst);
    gl.uniform1f(P.uPx, this.h * 0.5 * this.fl);
    gl.uniform1f(P.uAspect, aspect);
    gl.uniform1f(P.uDim, L.dim);
    gl.uniform1f(P.uFade, L.fade);
    gl.uniform2f(P.uMouse, this.mouseS[0], this.mouseS[1]);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
  }

  dispose() {
    this.stop();
    removeEventListener('pointermove', this.onMove);
    document.removeEventListener('visibilitychange', this.onHidden);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    if (!this.ok) return;
    const gl = this.gl;
    gl.deleteProgram(this.scene.p); gl.deleteProgram(this.parts.p);
    gl.deleteBuffer(this.buf); gl.deleteVertexArray(this.vaoParts); gl.deleteVertexArray(this.vaoEmpty);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.ok = false;
  }
}

let instance: Engine | null = null;
export function getEngine(): Engine {
  if (!instance) instance = new Engine(document.getElementById('world') as HTMLCanvasElement);
  return instance;
}
