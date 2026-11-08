import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { addDays } from '../store/dates';

export function Logo({ size = 32, title = 'DEVA' }: { size?: number; title?: string }) {
  return <img src="./intro/mark-96.webp" height={size} width={Math.round(size * 1.46)} alt={title} className="logo-mark" decoding="async" />;
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  home: () => <svg viewBox="0 0 24 24" {...P}><path d="M3 11 12 4l9 7M5 10v10h14V10" /></svg>,
  dash: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 13a8 8 0 1 1 16 0M12 13l4-4M4 19h16" /></svg>,
  fuel: () => <svg viewBox="0 0 24 24" {...P}><path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 6 0 8v10" /></svg>,
  train: () => <svg viewBox="0 0 24 24" {...P}><path d="M2 12h3M19 12h3M5 8v8M19 8v8M8 6v12M16 6v12M8 12h8" /></svg>,
  cal: () => <svg viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  chart: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-7" /></svg>,
  gear: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>,
  replay: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" /></svg>,
  plus: () => <svg viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>,
  x: () => <svg viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  left: () => <svg viewBox="0 0 24 24" {...P}><path d="M15 5l-7 7 7 7" /></svg>,
  right: () => <svg viewBox="0 0 24 24" {...P}><path d="M9 5l7 7-7 7" /></svg>,
  check: () => <svg viewBox="0 0 24 24" {...P}><path d="M5 12.5l4.5 4.5L19 7" /></svg>,
  flame: () => <svg viewBox="0 0 24 24" {...P}><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5" /></svg>,
  cloud: () => <svg viewBox="0 0 24 24" {...P}><path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18Z" /></svg>,
};

export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" />
      {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="m16 10 4 4m0-4-4 4" />}
    </svg>
  );
}

export function Panel({ title, kicker, children, className = '', action }: { title?: string; kicker?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`plate ${className}`}>
      {(title || kicker) && (
        <header className="plate-head">
          <div>{kicker && <p className="kicker">{kicker}</p>}{title && <h2 className="plate-title">{title}</h2>}</div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Ring({ value, max, size = 132, stroke = 10, label, sub, band }: { value: number; max: number; size?: number; stroke?: number; label: ReactNode; sub?: ReactNode; band?: [number, number] }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.min(1, max ? value / max : 0);
  const over = band ? value > band[1] : false;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.07)" strokeWidth={stroke} fill="none" />
        {band && <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(236,230,223,.25)" strokeWidth={stroke + 4} fill="none" strokeDasharray={`2 ${c}`} strokeDashoffset={-c * (band[0] / max)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
        <circle cx={size / 2} cy={size / 2} r={r} stroke={over ? '#ff7a45' : 'url(#ringGrad)'} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }} />
        <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff3b3f" /><stop offset="1" stopColor="#8d0b14" /></linearGradient></defs>
      </svg>
      <div className="ring-label"><strong className="num">{label}</strong>{sub && <span>{sub}</span>}</div>
    </div>
  );
}

export function Bar({ label, value, target, unit = 'g', decimals = 0 }: { label: string; value: number; target: number; unit?: string; decimals?: number }) {
  const pct = target ? Math.min(1.15, value / target) : 0;
  return (
    <div className="bar">
      <div className="bar-row"><span>{label}</span><span className="num">{value.toFixed(decimals)}<em> / {target}{unit}</em></span></div>
      <div className="bar-track" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={target}>
        <div className={`bar-fill ${pct > 1.05 ? 'over' : ''}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  );
}

export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`check ${checked ? 'on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="box" aria-hidden="true"><Icon.check /></span>
      <span className="check-text">{label}{hint && <small>{hint}</small>}</span>
    </label>
  );
}

export function NumField({ label, value, onChange, step = 1, min = 0, suffix, id }: { label: string; value: number | ''; onChange: (v: number | '') => void; step?: number; min?: number; suffix?: string; id?: string }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <div className="field-in">
        <input id={id} type="number" inputMode="decimal" step={step} min={min} value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

// ---- toasts --------------------------------------------------------------------
type Toast = { id: number; msg: string; kind: 'ok' | 'err' | 'info' };
let toasts: Toast[] = [];
const tsubs = new Set<() => void>();
export function toast(msg: string, kind: Toast['kind'] = 'ok') {
  const t = { id: Date.now() + Math.random(), msg, kind };
  toasts = [...toasts, t]; tsubs.forEach((f) => f());
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); tsubs.forEach((f) => f()); }, 3200);
}
export function Toasts() {
  const list = useSyncExternalStore((f) => { tsubs.add(f); return () => { tsubs.delete(f); }; }, () => toasts);
  return <div className="toasts" role="status" aria-live="polite">{list.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>;
}

export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(target);
  useEffect(() => {
    const from = v, start = performance.now();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0;
    const tick = (now: number) => { const k = Math.min(1, (now - start) / ms); setV(from + (target - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}

export function DateNav({ date, onChange, min, max }: { date: string; onChange: (d: string) => void; min?: string; max?: string }) {
  const shift = (n: number) => onChange(addDays(date, n));
  return (
    <div className="datenav">
      <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous day" disabled={!!min && date <= min}><Icon.left /></button>
      <input type="date" value={date} min={min} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Date" />
      <button className="icon-btn" onClick={() => shift(1)} aria-label="Next day" disabled={!!max && date >= max}><Icon.right /></button>
    </div>
  );
}
