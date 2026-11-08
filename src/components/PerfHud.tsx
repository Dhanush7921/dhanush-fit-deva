import { useEffect, useState } from 'react';
import { getEngine } from '../engine/Engine';

/** ?perf=1 → live FPS / render scale / raymarch steps. Used for measuring, hidden otherwise. */
export default function PerfHud() {
  const on = new URLSearchParams(location.search).has('perf');
  const [v, setV] = useState('');
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => { const e = getEngine(); setV(`${e.fps.toFixed(0)} fps · ${e.tier} · scale ${e.scale.toFixed(2)} · ${e.steps} steps`); (window as any).__devaPerf = { fps: e.fps, scale: e.scale, steps: e.steps, tier: e.tier }; }, 500);
    return () => clearInterval(id);
  }, [on]);
  return on ? <div className="perf-hud" data-testid="perf">{v}</div> : null;
}
