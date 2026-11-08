import { useEffect, useRef } from 'react';
import { getEngine } from '../engine/Engine';
import { sound } from '../engine/audio';
import { hero } from '../engine/shots';
import { V3, ramp, easeOut3, easeInOut3, easeOutExpo, spline, add } from '../engine/math';
import { SoundIcon, Icon } from '../components/ui';
import { useMuted } from '../components/Nav';

const END = 11.8;
const OLD = 'DHANUSH'.split('');
const NEW = 'DEVA'.split('');
const FLY_ROLL = [0, 0.14, -0.12, 0];

export default function Intro({ onDone }: { onDone: () => void }) {
  const muted = useMuted();
  const oldRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const newRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const group = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLParagraphElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const finish = useRef<() => void>(() => {});

  useEffect(() => {
    const e = getEngine();
    const reduced = e.reduced;
    e.controller = null;
    e.camDamp = 6;
    e.setShot([0, 2.2, 46], [0, 2.6, 0], 0, 1.7, true);
    e.setLook({ fade: 0, burst: 0, dim: 0, emblem: 0, flash: 0, smoke: 1.5, accent: 0.25, shake: 0 }, true);

    const H = hero();
    const FLY_POS: V3[] = [[0, 2.2, 46 - 8.4 * 0.55 - 3], [-3.2, 6.2, 28], [2.6, 3.4, 17], H.pos];
    const FLY_TGT: V3[] = [[0, 2.5, 0], [0, 3, 0], [0, 3, 0], H.tgt];
    const shards = OLD.map(() => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.65) * 2, r: (Math.random() - 0.5) * 120 }));
    let dx = 0;
    const measure = () => {
      const a = oldRefs.current[0]?.getBoundingClientRect(), b = newRefs.current[0]?.getBoundingClientRect();
      dx = a && b ? b.left - a.left : 0;
    };
    measure();
    const cues = new Set<string>();
    const cue = (k: string, f: () => void) => { if (!cues.has(k)) { cues.add(k); f(); } };
    let raf = 0, done = false;
    // Clock advances by clamped frame deltas, so a slow first frame (shader compile) never skips the story.
    let t = 0, last = -1;

    const apply = (t: number) => {
      // ---- 3D world -------------------------------------------------------------
      const burst = t < 4.35 ? 0 : Math.exp(-(t - 4.4) * 2.2) * ramp(t, 4.35, 4.45);
      const flash = t < 4.38 ? 0 : Math.exp(-(t - 4.4) * 7) * ramp(t, 4.38, 4.42);
      const tension = ramp(t, 3.6, 4.38) * (t < 4.4 ? 1 : 0);
      e.setLook({
        fade: t < 8.4 ? ramp(t, 0.6, 3.2) * 0.62 + 0.18 * burst : 0.62 + 0.38 * ramp(t, 8.4, 9.6),
        smoke: 1.5 - 0.5 * ramp(t, 8.4, 11),
        accent: 0.25 + 0.75 * ramp(t, 4.4, 5.6),
        emblem: easeOut3(ramp(t, 8.8, 10.6)),
        burst: reduced ? 0 : burst,
        flash: reduced ? flash * 0.3 : flash,
        shake: reduced ? 0 : burst * 0.9 + tension * 0.12,
      }, true);
      if (t < 8.4) {
        const push = easeOutExpo(ramp(t, 4.4, 5.6)) * 3;
        const z = 46 - t * 0.55 - push;
        const roll = t > 4.4 ? Math.sin((t - 4.4) * 9) * Math.exp(-(t - 4.4) * 3) * 0.06 : 0;
        e.setShot([0, 2.2, z], [0, 2.6 + push * 0.1, 0], roll, 1.7, true);
        e.burstC = add(e.pos, [0, 0, -7]);
      } else if (!reduced) {
        const u = easeInOut3(ramp(t, 8.4, 11.4));
        const p = spline(FLY_POS, u);
        const g = spline(FLY_TGT, u);
        const i = Math.min(2, Math.floor(u * 3)), f = u * 3 - i;
        e.setShot(p, g, FLY_ROLL[i] + (FLY_ROLL[i + 1] - FLY_ROLL[i]) * f, 1.7 + Math.sin(u * Math.PI) * 0.25, true);
      } else {
        e.setShot(H.pos, H.tgt, 0, 1.7, true);
      }

      // ---- typography ------------------------------------------------------------
      const m = reduced ? 0 : 1;
      const rev = easeOut3(ramp(t, 1.2, 2.8));
      oldRefs.current.forEach((el, i) => {
        if (!el) return;
        if (i === 0) {
          const mv = easeInOut3(ramp(t, 4.7, 5.7));
          const glow = ramp(t, 3.8, 4.4) * (1 - ramp(t, 6.4, 7.4));
          el.style.transform = `translateX(${dx * mv}px)`;
          el.style.opacity = String(rev);
          el.style.filter = `blur(${(1 - rev) * 12}px) drop-shadow(0 0 ${glow * 26}px rgba(225,27,43,${glow}))`;
          return;
        }
        const p = easeOut3(ramp(t, 4.4, 5.3));
        const jit = tension * 3 * m;
        el.style.opacity = String(rev * (1 - p));
        el.style.transform = `translate(${shards[i].x * p * 46 * m + (Math.random() - 0.5) * jit}vw, ${shards[i].y * p * 30 * m + (Math.random() - 0.5) * jit}vh) rotate(${shards[i].r * p * m}deg) scale(${1 + p * 0.8 * m})`;
        el.style.filter = `blur(${(1 - rev) * 12 + p * 10}px)`;
      });
      newRefs.current.forEach((el, i) => {
        if (!el) return;
        if (i === 0) { el.style.opacity = '0'; return; }
        const p = easeOut3(ramp(t, 5.3 + i * 0.16, 6.3 + i * 0.16));
        el.style.opacity = String(p);
        el.style.transform = `translateY(${(1 - p) * 40 * m}px) scale(${1 + (1 - p) * 0.35 * m})`;
        el.style.filter = `blur(${(1 - p) * 14}px)`;
      });
      oldRefs.current.forEach((el) => el?.classList.toggle('sweep', t > 1.4));
      const tg = easeOut3(ramp(t, 6.9, 8.1));
      if (tag.current) { tag.current.style.opacity = String(tg); tag.current.style.letterSpacing = `${0.42 + (1 - tg) * 0.8 * m}em`; }
      if (line.current) line.current.style.transform = `scaleX(${easeInOut3(ramp(t, 7.0, 8.1))})`;
      if (group.current) {
        const out = easeInOut3(ramp(t, 8.4, 9.4));
        group.current.style.opacity = String(1 - out);
        group.current.style.transform = `scale(${1 + out * 1.8 * m})`;
        group.current.style.filter = `blur(${out * 8}px)`;
      }
      if (root.current) root.current.style.setProperty('--veil', String(1 - ramp(t, 10.6, END)));

      // ---- sound cues -----------------------------------------------------------
      if (t > 3.5) cue('riser', () => sound.riser(0.9));
      if (t > 4.4) cue('impact', () => sound.impact());
      if (t > 8.3) cue('whoosh', () => sound.whoosh(3));
    };

    const end = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const h = hero();
      e.setShot(h.pos, h.tgt, 0, 1.7, true);
      e.setLook({ fade: 1, burst: 0, flash: 0, shake: 0, emblem: 1, smoke: 1, accent: 1, dim: 0 }, true);
      e.camDamp = 2.4;
      onDone();
    };
    finish.current = end;
    const tick = (now: number) => {
      if (last < 0) last = now;
      t += Math.min(0.25, (now - last) / 1000);
      last = now;
      apply(t);
      if (t >= END) end(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    addEventListener('resize', measure);
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') end(); };
    addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', measure); removeEventListener('keydown', onKey); };
  }, [onDone]);

  return (
    <div className="intro" ref={root} role="dialog" aria-label="Intro: DHANUSH becomes DEVA">
      <div className="intro-title" ref={group}>
        <div className="word-stack">
          <h1 className="word old" aria-label="DHANUSH">{OLD.map((c, i) => <span key={i} ref={(el) => { oldRefs.current[i] = el; }} className="metal ch" aria-hidden="true">{c}</span>)}</h1>
          <p className="word new" aria-label="DEVA">{NEW.map((c, i) => <span key={i} ref={(el) => { newRefs.current[i] = el; }} className="metal ch" aria-hidden="true">{c}</span>)}</p>
        </div>
        <div className="intro-line" ref={line} />
        <p className="intro-tag" ref={tag}>THE TRANSFORMATION</p>
      </div>
      <div className="intro-ctrl">
        <button className="icon-btn" onClick={sound.toggle} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}><SoundIcon on={!muted} /></button>
        <button className="btn ghost small" onClick={() => finish.current()}>Skip intro<Icon.right /></button>
      </div>
      {muted && <p className="intro-hint">Sound off · tap the speaker for the full experience</p>}
    </div>
  );
}

