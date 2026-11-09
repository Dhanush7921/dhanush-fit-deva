import { useEffect, useRef, useState } from 'react';
import { getEngine } from '../engine/Engine';
import { sound } from '../engine/audio';
import { hero } from '../engine/shots';
import { easeInOut3, easeOut3, lerp } from '../engine/math';
import { SoundIcon, Icon } from '../components/ui';
import { useMuted } from '../components/Nav';
import { PosterIntro, type Uniforms } from './PosterIntro';
import M from './music.json';

// Every timestamp below comes from the score itself (scripts/make_intro_audio.py → music.json):
// build boom → emblem burns in · ring hit → ring ignites · sweep hit → metal sweep · swell → DHANUSH
// crash → arrow/slide · IMPACT (drop) → DEVA · kicks → aftershock/heartbeat · reveal kick → full poster
// fly kick → dive into the D · next phrase downbeat (land) → the website.
const END = M.land + 0.05;
type Ease = (x: number) => number;
const easeIn3: Ease = (x) => x * x * x;
const lin: Ease = (x) => x;
type Key = [number, number, Ease?];
function tr(keys: Key[], t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1, e = easeInOut3] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, e((t - t0) / (t1 - t0 || 1)));
  }
  return keys[keys.length - 1][1];
}
const pulseAt = (t: number, at: number, k: number) => (t < at ? 0 : Math.exp(-(t - at) * k));
const lastKick = (t: number) => { let k = -1; for (const x of M.kicks) if (x <= t) k = x; return k; };

const { build, ring, sweep, swell, crash, impact, reveal, fly, land } = M;
const next = M.kicks[0]; // first kick after the drop
const CX: Key[] = [[0, 836], [swell, 833], [swell + 0.25, 836], [fly, 836], [land, 905, easeIn3]];
const CY: Key[] = [[0, 430], [build, 420], [swell, 300], [swell + 0.25, 610], [crash, 610], [impact + 0.3, 560], [next + 0.3, 470], [fly, 470], [land, 252, easeIn3]];
const CZ: Key[] = [[0, 1.04], [build, 1.1], [swell, 1.42], [swell + 0.25, 1.32], [crash, 1.36], [impact + 0.3, 1.1], [next + 0.3, 1.0], [fly, 1.09], [land, 6.5, easeIn3]];

export default function Intro({ onDone, onPreload }: { onDone: () => void; onPreload?: () => void }) {
  const muted = useMuted();
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const finish = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const e = getEngine();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dprCap = matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5;
    const H = hero();
    e.stop();
    e.controller = null;
    e.setShot(H.pos, H.tgt, 0, 1.7, true);
    e.setLook({ fade: 1, burst: 0, flash: 0, shake: 0, emblem: 0, smoke: 1, accent: 1, dim: 0 }, true);
    sound.prefetchMusic('./intro/');
    sound.stopMusic(0.2);

    let intro: PosterIntro | null = null;
    try { intro = new PosterIntro(canvas.current!, './intro/'); } catch { intro = null; }
    let ready = false;
    intro?.ready.then(() => { ready = true; canvas.current?.setAttribute('data-ready', '1'); }).catch(() => setFallback(true));
    if (!intro) setFallback(true);

    let t = 0, last = -1, raf = 0, holdStart = -1, done = false, worldOn = false, preloaded = false;
    let starting = false, musicFailed = false;
    const cues = new Set<string>();
    const cue = (k: string, at: number, f: () => void) => { if (t >= at && !cues.has(k)) { cues.add(k); f(); } };
    // Sound on → start the score at the current story time; from then on the audio clock is the master clock.
    const syncMusic = () => {
      if (sound.muted || done || starting || sound.musicPlaying || musicFailed || !ready || t >= END) return;
      starting = true;
      sound.playMusic(t).then((ok) => { starting = false; if (!ok) musicFailed = true; });
    };
    const unsub = sound.subscribe(syncMusic);

    const end = (skipped: boolean) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      if (skipped) sound.stopMusic(0.6); // natural end: the score's own fade-out tail plays under the site
      e.setShot(H.pos, H.tgt, 0, 1.7, true);
      e.start();
      onDone();
    };
    finish.current = () => end(true);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (last < 0) last = now;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const mt = sound.musicPlaying ? sound.musicTime() : -1;
      if (mt >= 0) t = Math.max(0, mt);                 // audio clock: no drift
      else if (!ready && t >= 1.0) { if (holdStart < 0) holdStart = now; else if (now - holdStart > 5000) setFallback(true); }
      else t += dt;                                                 // visual clock while muted
      (window as any).__introT = t; (window as any).__introMt = mt;
      (window as any).__introClock = mt >= 0 ? 'audio' : 'visual';
      if (ready) syncMusic();
      if (t >= 3 && !preloaded) { preloaded = true; onPreload?.(); }
      if (t >= fly - 0.5 && !worldOn) { worldOn = true; e.start(); }
      if (root.current && t > fly + 0.3) root.current.style.background = 'transparent';

      const lk = lastKick(t);
      const shock = t > impact && t < impact + 0.9 ? (t - impact) / 0.9 : 0;
      const shakeAmp = reduced ? 0 : pulseAt(t, impact, 5) * 14 + pulseAt(t, next, 7) * 5 + (t > crash && t < impact ? 2.5 : 0);
      const still = reduced && t < fly;
      const kickFlash = t > reveal && t < fly ? pulseAt(t, lk, 10) * 0.12 : 0;
      const u: Uniforms = {
        uTime: t,
        uCam: still ? [836, 470, 1.0] : [tr(CX, t), tr(CY, t), tr(CZ, t)],
        uShake: [(Math.random() - 0.5) * shakeAmp, (Math.random() - 0.5) * shakeAmp],
        uFade: tr([[0, 0], [0.3, 0], [build, 0.6], [ring, 1]], t),
        uBg: tr([[0, 0], [0.4, 0], [build, 0.32], [swell, 0.5], [impact, 0.6], [next + 0.4, 1]], t),
        uSmoke: tr([[0, 1.1], [ring, 0.8], [next + 0.4, 0.18], [fly, 0.12], [land - 1, 0.5]], t),
        uEmbers: tr([[0, 0], [build, 0.8], [impact, 1], [fly, 0.9]], t),
        uEmb: tr([[0, 0], [build, 0], [swell, 1, lin]], t),
        uRing: tr([[0, 0], [ring, 0], [ring + 0.6, 1, easeOut3]], t),
        uSweepE: t < reveal - 1 ? tr([[sweep, 150], [sweep + 0.8, 1450, lin]], t) : tr([[reveal, 150], [reveal + 0.9, 1450, lin]], t),
        uDh: tr([[0, 0], [swell + 0.02, 0], [crash - 0.2, 1, lin]], t),
        uDhOff: still ? 0 : tr([[0, 326], [crash, 326], [impact, 0, easeInOut3]], t),
        uArrow: tr([[0, 0], [crash + 0.2, 0], [impact, 1, lin]], t),
        uDeva: tr([[0, 0], [impact, 0], [impact + 0.7, 1, easeOut3]], t),
        uSweepT: t < impact ? tr([[crash - 0.55, 250], [crash - 0.05, 1200, lin]], t) : tr([[next, 250], [next + 0.9, 1750, lin]], t),
        uTag: tr([[0, 0], [next, 0], [next + 0.9, 1]], t),
        uBar: tr([[0, 0], [reveal, 0], [reveal + 0.4, 1, easeOut3]], t),
        uBeat: tr([[0, 0], [reveal, 0], [M.kicks.find((k) => k > reveal + 0.3) ?? reveal + 0.7, 1, lin]], t),
        uPulse: lk >= reveal ? Math.min(1, (t - lk) / 0.9) : 0,
        uFlash: (reduced ? 0.3 : 1) * (pulseAt(t, impact, 7) + pulseAt(t, ring, 9) * 0.22 + pulseAt(t, build, 9) * 0.15 + pulseAt(t, next, 9) * 0.2 + kickFlash),
        uShock: reduced ? 0 : shock,
        uShockC: [1010, 602],
        uBurst: pulseAt(t, impact, 1.5),
        uMotion: reduced ? 0 : 1,
        uHole: tr([[0, 0], [fly + 0.68, 0], [land, 1.7]], t),
      };
      intro?.render(u, dprCap);

      // procedural fallback cues only when the score isn't available (or sound was enabled mid-way and failed)
      if (musicFailed && !sound.muted) {
        cue('impact', impact, () => sound.impact());
        cue('enter', fly, () => sound.whoosh(2.8));
      }
      if (t >= END) end(false);
    };
    raf = requestAnimationFrame(frame);
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') end(true); };
    addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); unsub(); removeEventListener('keydown', onKey); intro?.dispose(); if (!done) { sound.stopMusic(0.3); e.start(); } };
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
