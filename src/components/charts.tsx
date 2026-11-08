import { fmt } from '../store/dates';

const H = 200, PAD = { l: 36, r: 10, t: 14, b: 26 };

export function WeekBars({ data, target, band, unit, title, W = 560 }: { data: { date: string; value: number }[]; target?: number; band?: [number, number]; unit: string; title: string; W?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value), target ?? 0, band?.[1] ?? 0) * 1.12;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const bw = (iw / data.length) * 0.56;
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${data.map((d) => `${fmt(d.date)} ${Math.round(d.value)} ${unit}`).join(', ')}`}>
        {[0, 0.5, 1].map((k) => <g key={k}><line x1={PAD.l} x2={W - PAD.r} y1={y(max * k / 1.12)} y2={y(max * k / 1.12)} className="grid" /><text x={PAD.l - 6} y={y(max * k / 1.12) + 4} className="axis" textAnchor="end">{fmtK(max * k / 1.12)}</text></g>)}
        {band && <rect x={PAD.l} width={iw} y={y(band[1])} height={Math.max(1, y(band[0]) - y(band[1]))} className="band" />}
        {target !== undefined && <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} className="target" />}
        {data.map((d, i) => {
          const x = PAD.l + (iw / data.length) * i + (iw / data.length - bw) / 2;
          const hit = band ? d.value >= band[0] && d.value <= band[1] : target ? d.value >= target : false;
          return (
            <g key={d.date}>
              <rect x={x} y={y(d.value)} width={bw} height={Math.max(0, PAD.t + ih - y(d.value))} rx={3} className={hit ? 'bar-hit' : 'bar-miss'}>
                <title>{`${fmt(d.date)}: ${Math.round(d.value).toLocaleString()} ${unit}`}</title>
              </rect>
              <text x={x + bw / 2} y={H - 8} className="axis" textAnchor="middle">{fmt(d.date, { weekday: 'short' })}</text>
            </g>
          );
        })}
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
}

export function WeightLine({ points, start, title, W = 1000 }: { points: { date: string; kg: number }[]; start: number; title: string; W?: number }) {
  if (!points.length) return <div className="empty">Log your first weigh-in to start the trend line.</div>;
  const all = [start, ...points.map((p) => p.kg)];
  const lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1);
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const n = Math.max(1, points.length - 1);
  const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (iw * i) / n);
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((p) => `${fmt(p.date)} ${p.kg} kg`).join(', ')}`}>
        {[lo, (lo + hi) / 2, hi].map((v) => <g key={v}><line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" /><text x={PAD.l - 6} y={y(v) + 4} className="axis" textAnchor="end">{v.toFixed(0)}</text></g>)}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(start)} y2={y(start)} className="target" />
        <text x={W - PAD.r} y={y(start) - 6} className="axis" textAnchor="end">start {start} kg</text>
        <path d={`${path} L${x(points.length - 1)},${PAD.t + ih} L${x(0)},${PAD.t + ih} Z`} className="area" />
        <path d={path} className="line" />
        {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.kg)} r={4} className="dot"><title>{`${fmt(p.date)}: ${p.kg} kg`}</title></circle>)}
        {points.length > 1 && [0, points.length - 1].map((i) => <text key={i} x={x(i)} y={H - 8} className="axis" textAnchor={i ? 'end' : 'start'}>{fmt(points[i].date)}</text>)}
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
}

const fmtK = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`);
