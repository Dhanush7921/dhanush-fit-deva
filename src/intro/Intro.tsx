import { useEffect, useRef, useState } from 'react';
import { getEngine } from '../engine/Engine';
import { sound } from '../engine/audio';
import { hero } from '../engine/shots';
import { easeInOut3, easeOut3, lerp } from '../engine/math';
import { SoundIcon, Icon } from '../components/ui';
import { useMuted } from '../components/Nav';
import { PosterIntro, type Uniforms } from './PosterIntro';

const END = 12;
type Ease = (x: number) => number;
const easeIn3: Ease = (x) => x * x * x;
type Key = [number, number, Ease?];
/** Keyframe track: value at time t, each segment eased by the ease on its end key (default in-out). */
function tr(keys: Key[], t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1, e = easeInOut3] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, e((t - t0) / (t1 - t0 || 1)));
  }
  return keys[keys.length - 1][1];
}
const lin: Ease = (x) => x;
const pulseAt = (t: number, at: number, k: number) => (t < at ? 0 : Math.exp(-(t - at) * k));
const IMPACT = 5.17;

const CX: Key[] = [[0, 836], [3.9, 833], [4.2, 836], [9, 836], [12, 905, easeIn3]];
const CY: Key[] = [[0, 430], [2, 420], [3.9, 300], [4.2, 610], [4.95, 610], [5.3, 560], [6.2, 470], [9, 470], [12, 252, easeIn3]];
const CZ: Key[] = [[0, 1.04], [2, 1.1], [3.9, 1.42], [4.2, 1.32], [4.95, 1.36], [5.3, 1.1], [6.2, 1.0], [9, 1.09], [12, 6.5, easeIn3]];

export default function Intro({ onDone, onPreload }: { onDone: () => void; onPreload?: () => void }) {
  const muted = useMuted();
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const finish = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const e = getEngine();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speed = reduced ? 1.5 : 1;
    const dprCap = matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5;
    const H = hero();
    // The 3D world idles (no GPU cost) until the hand-off, already framed on the hero shot.
    e.stop();
    e.controller = null;
    e.setShot(H.pos, H.tgt, 0, 1.7, true);
    e.setLook({ fade: 1, burst: 0, flash: 0, shake: 0, emblem: 0, smoke: 1, accent: 1, dim: 0 }, true);

    let intro: PosterIntro | null = null;
    try { intro = new PosterIntro(canvas.current!, './intro/'); } catch { intro = null; }
    let ready = false;
    intro?.ready.then(() => { ready = true; canvas.current?.setAttribute('data-ready', '1'); }).catch(() => setFallback(true));
    if (!intro) setFallback(true);

    let t = 0, last = -1, raf = 0, holdStart = -1, done = false, worldOn = false, preloaded = false;
    const cues = new Set<string>();
    const cue = (k: string, at: number, f: () => void) => { if (t >= at && !cues.has(k)) { cues.add(k); f(); } };

    const end = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      e.setShot(H.pos, H.tgt, 0, 1.7, true);
      e.start();
      onDone();
    };
    finish.current = end;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (last < 0) last = now;
      const dt = Math.min(0.25, (now - last) / 1000) * speed;
      (window as any).__introT = t;
      last = now;
      // hold in the darkness until the poster layers are decoded (max ~5 s, then fall back)
      if (!ready && t >= 1.4) { if (holdStart < 0) holdStart = now; else if (now - holdStart > 5000) setFallback(true); }
      else t += dt;
      if (t >= 3 && !preloaded) { preloaded = true; onPreload?.(); }
      if (t >= 8.8 && !worldOn) { worldOn = true; e.start(); }
      if (root.current && t > 9.4) root.current.style.background = 'transparent';

      const shock = t > IMPACT && t < IMPACT + 0.9 ? (t - IMPACT) / 0.9 : 0;
      const shakeAmp = reduced ? 0 : pulseAt(t, IMPACT, 5) * 14 + (t > 4.75 && t < IMPACT ? 2.5 : 0);
      const still = reduced && t < 9;
      const u: Uniforms = {
        uTime: t,
        uCam: still ? [836, 470, 1.0] : [tr(CX, t), tr(CY, t), tr(CZ, t)],
        uShake: [(Math.random() - 0.5) * shakeAmp, (Math.random() - 0.5) * shakeAmp],
        uFade: tr([[0, 0], [0.5, 0], [2.0, 0.75], [3.0, 1]], t),
        uBg: tr([[0, 0], [0.6, 0], [2.0, 0.38], [3.8, 0.5], [5.2, 0.6], [6.4, 1]], t),
        uSmoke: tr([[0, 1.1], [3, 0.8], [6.4, 0.18], [9, 0.12], [11, 0.5]], t),
        uEmbers: tr([[0, 0], [1, 0.8], [5, 1], [9, 0.9]], t),
        uEmb: tr([[0, 0], [2.0, 0], [3.7, 1, lin]], t),
        uRing: tr([[0, 0], [2.3, 0], [3.2, 1, easeOut3]], t),
        uSweepE: t < 6 ? tr([[3.3, 150], [4.1, 1450, lin]], t) : tr([[7.6, 150], [8.6, 1450, lin]], t),
        uDh: tr([[0, 0], [4.15, 0], [4.75, 1, lin]], t),
        uDhOff: still ? 0 : tr([[0, 326], [4.95, 326], [5.25, 0, easeInOut3]], t),
        uArrow: tr([[0, 0], [5.0, 0], [IMPACT, 1, lin]], t),
        uDeva: tr([[0, 0], [IMPACT, 0], [5.9, 1, easeOut3]], t),
        uSweepT: t < 5.5 ? tr([[4.6, 250], [5.1, 1200, lin]], t) : tr([[6.0, 250], [6.9, 1750, lin]], t),
        uTag: tr([[0, 0], [6.3, 0], [7.1, 1]], t),
        uBar: tr([[0, 0], [7.0, 0], [7.45, 1, easeOut3]], t),
        uBeat: tr([[0, 0], [7.3, 0], [8.1, 1, lin]], t),
        uPulse: t > 8.1 ? ((t - 8.1) / 1.1) % 1 : 0,
        uFlash: (reduced ? 0.3 : 1) * (pulseAt(t, IMPACT, 7) + pulseAt(t, 2.3, 9) * 0.25),
        uShock: reduced ? 0 : shock,
        uShockC: [1010, 602],
        uBurst: pulseAt(t, IMPACT, 1.5),
        uMotion: reduced ? 0 : 1,
        uHole: tr([[0, 0], [9.9, 0], [11.7, 1.7]], t),
      };
      intro?.render(u, dprCap);

      cue('ring', 2.3, () => sound.whoosh(1.2));
      cue('rise', 4.0, () => sound.riser(1.1));
      cue('impact', IMPACT, () => sound.impact());
      for (const b of [7.3, 7.62, 8.1, 8.42]) cue(`hb${b}`, b, () => sound.heartbeat());
      cue('enter', 9.0, () => sound.whoosh(2.8));
      if (t >= END) end();
    };
    raf = requestAnimationFrame(frame);
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') end(); };
    addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); removeEventListener('keydown', onKey); intro?.dispose(); if (!done) e.start(); };
  }, [onDone, onPreload]);

  useEffect(() => {
    if (!fallback) return;
    const id = setTimeout(() => finish.current(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 2500 : 6000);
    return () => clearTimeout(id);
  }, [fallback]);

  return (
    <div className="intro" ref={root} role="dialog" aria-label="Intro: DHANUSH becomes DEVA — The Transformation">
      <canvas ref={canvas} className="intro-canvas" aria-hidden="true" />
      {fallback && <img className="intro-fallback" src="./intro/poster-1200.jpg" alt="DHANUSH → DEVA — The Transformation" />}
      <h1 className="sr">DHANUSH → DEVA — The Transformation</h1>
      <div className="intro-ctrl">
        <button className="icon-btn" onClick={sound.toggle} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}><SoundIcon on={!muted} /></button>
        <button className="btn ghost small" onClick={() => finish.current()}>Skip intro<Icon.right /></button>
      </div>
      {muted && <p className="intro-hint">Sound off · tap the speaker for the full experience</p>}
    </div>
  );
}
