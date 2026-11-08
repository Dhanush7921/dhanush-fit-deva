export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const easeOut3 = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut3 = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

export interface Basis { f: V3; r: V3; u: V3 }
export function basis(pos: V3, tgt: V3, roll = 0): Basis {
  const f = norm(sub(tgt, pos));
  let r = norm(cross(f, [0, 1, 0]));
  let u = cross(r, f);
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const r2 = add(mul(r, c), mul(u, s));
    u = add(mul(u, c), mul(r, -s));
    r = r2;
  }
  return { f, r, u };
}

/** Column-major view-projection matching the raymarch camera (rd = f*fl + r*uv.x + u*uv.y). */
export function viewProj(pos: V3, b: Basis, fl: number, aspect: number, near: number, far: number, out: Float32Array) {
  const v = [
    b.r[0], b.u[0], -b.f[0], 0,
    b.r[1], b.u[1], -b.f[1], 0,
    b.r[2], b.u[2], -b.f[2], 0,
    -dot(b.r, pos), -dot(b.u, pos), dot(b.f, pos), 1,
  ];
  const p = [fl / aspect, 0, 0, 0, 0, fl, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += p[k * 4 + r] * v[c * 4 + k];
      out[c * 4 + r] = s;
    }
  return out;
}

/** Centripetal-ish Catmull-Rom through keyframes at parameter u in [0,1]. */
export function spline(keys: V3[], u: number): V3 {
  const n = keys.length - 1;
  const x = clamp01(u) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const t = x - i;
  const p0 = keys[Math.max(i - 1, 0)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(i + 2, n)];
  const t2 = t * t, t3 = t2 * t;
  const out: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++)
    out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  return out;
}
