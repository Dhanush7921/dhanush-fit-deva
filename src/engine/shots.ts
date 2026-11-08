import { V3, spline } from './math';
import type { Engine } from './Engine';

/** Hero framing: on wide screens the emblem sits right of centre, leaving room for the title. */
export function hero() {
  const a = innerWidth / innerHeight;
  const off = a > 1.15 ? Math.min(3.6, (a - 1) * 6) : 0;
  return { pos: [off * 0.2, 1.1, 8.5] as V3, tgt: [-off, 3.4, 0] as V3 };
}
const HOME_POS: V3[] = [[0, 0, 0], [4.2, 2.6, 2.5], [-2.2, 5, -12], [1.2, 9, -30], [0, 2, -48]];
const HOME_TGT: V3[] = [[0, 0, 0], [0, 2.4, -6], [0, 4, -40], [0, 3, -60], [0, 6.5, -80]];
const HOME_ROLL = [0, -0.06, 0.05, -0.04, 0];

/** Scroll-linked flight through the world on the home page. */
export function homeController(getProgress: () => number) {
  let s = 0;
  return (time: number, dt: number, e: Engine) => {
    s += (getProgress() - s) * (1 - Math.exp(-dt * 3));
    const h = hero(); HOME_POS[0] = h.pos; HOME_TGT[0] = h.tgt;
    const p = spline(HOME_POS, s), t = spline(HOME_TGT, s);
    const i = Math.min(3, Math.floor(s * 4)), f = s * 4 - i;
    const roll = HOME_ROLL[i] + (HOME_ROLL[i + 1] - HOME_ROLL[i]) * f;
    const bob = e.reduced ? 0 : Math.sin(time * 0.6) * 0.08;
    e.setShot([p[0], p[1] + bob, p[2]], t, roll, 1.7);
    e.setLook({ fade: 1, dim: Math.min(0.35, s * 0.6), emblem: 0, smoke: 1, accent: 1, burst: 0, flash: 0, shake: 0 });
  };
}

const PAGE: Record<string, { y: number; x: number; z: number; ty: number; roll: number }> = {
  dashboard: { x: 0, y: 4.2, z: -20, ty: 3.2, roll: 0 },
  fuel: { x: -3.5, y: 2.2, z: -26, ty: 4.5, roll: 0.03 },
  training: { x: 3.4, y: 1.4, z: -34, ty: 6.5, roll: -0.04 },
  challenge: { x: 0, y: 9.4, z: -44, ty: 3, roll: 0 },
  progress: { x: -2, y: 5.5, z: -52, ty: 4, roll: 0.02 },
  settings: { x: 0, y: 2.6, z: -60, ty: 3, roll: 0 },
};

/** Slow forward drift for data pages: the world keeps moving behind the UI, dimmed for legibility. */
export function pageController(page: string, startTime: number) {
  const c = PAGE[page] ?? PAGE.dashboard;
  return (time: number, _dt: number, e: Engine) => {
    const z = c.z - (time - startTime) * 0.35;
    e.setShot([c.x, c.y, z], [c.x * 0.3, c.ty, z - 40], c.roll, 1.7);
    e.setLook({ fade: 1, dim: 0.55, emblem: 0, smoke: 0.8, accent: 0.6, burst: 0, flash: 0, shake: 0 });
  };
}
