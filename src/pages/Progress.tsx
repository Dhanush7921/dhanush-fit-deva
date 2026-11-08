import { useState } from 'react';
import { useStore, setWeight } from '../store/store';
import { weightSeries, dayTotals, lastNDays, streaks, challenge, r1 } from '../store/derive';
import { today, fmt, diffDays } from '../store/dates';
import { Panel, Icon, toast } from '../components/ui';
import { WeekBars, WeightLine } from '../components/charts';

export default function Progress() {
  const s = useStore();
  const st = s.settings;
  const ws = weightSeries(s);
  const sk = streaks(s);
  const ch = challenge(s);
  const [date, setDate] = useState(today());
  const [kg, setKg] = useState<number | ''>('');
  const week = lastNDays(7);
  const last = ws[ws.length - 1];
  const lowest = ws.length ? Math.min(...ws.map((w) => w.kg)) : null;
  const span = ws.length > 1 ? diffDays(ws[0].date, last.date) : 0;
  const perWeek = span >= 7 ? ((last.kg - ws[0].kg) / span) * 7 : null;
  const avg = (f: (d: string) => number) => Math.round(week.reduce((a, d) => a + f(d), 0) / 7);

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="kicker">Progress</p><h1 className="page-title">The evidence</h1></div>
      </header>

      <div className="stat-tiles">
        <div className="tile"><span>Current</span><strong className="num">{last ? r1(last.kg) : '—'}<em>kg</em></strong></div>
        <div className="tile"><span>Change from {st.startWeight} kg</span><strong className="num">{last ? `${last.kg - st.startWeight > 0 ? '+' : ''}${r1(last.kg - st.startWeight)}` : '—'}<em>kg</em></strong></div>
        <div className="tile"><span>Lowest logged</span><strong className="num">{lowest ? r1(lowest) : '—'}<em>kg</em></strong></div>
        <div className="tile"><span>Observed pace</span><strong className="num">{perWeek !== null ? `${perWeek > 0 ? '+' : ''}${r1(perWeek)}` : '—'}<em>kg/wk</em></strong></div>
        <div className="tile"><span>Streak · best</span><strong className="num">{sk.current}<em> / {sk.best}</em></strong></div>
        <div className="tile"><span>Days complete</span><strong className="num">{ch.completed}<em> / {ch.total}</em></strong></div>
      </div>

      <div className="grid progress">
        <Panel kicker="Body weight" title="Weight trend" className="wide">
          <WeightLine title="Logged body weight" points={ws} start={st.startWeight} />
          <p className="fineprint">Pace is calculated from your own logs. It describes the past, it doesn't predict the future — daily weight swings with water, salt and sleep.</p>
        </Panel>

        <Panel kicker="Log weight" title="Weigh-in">
          <form className="food-form" onSubmit={(e) => { e.preventDefault(); if (kg !== '' && kg > 20 && kg < 400) { setWeight(date, Math.round(kg * 10) / 10); setKg(''); toast('Weigh-in saved'); } else toast('Enter a weight in kg', 'err'); }}>
            <label className="field"><span>Date</span><input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
            <label className="field"><span>Weight</span><div className="field-in"><input type="number" step="0.1" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value === '' ? '' : Number(e.target.value))} /><em>kg</em></div></label>
            <div className="form-actions wide"><button className="btn primary" type="submit">Save weigh-in</button></div>
          </form>
          <ul className="wlist">
            {[...ws].reverse().slice(0, 8).map((w) => (
              <li key={w.date}><span>{fmt(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span><strong className="num">{r1(w.kg)} kg</strong>
                <button className="icon-btn danger" aria-label={`Delete weigh-in ${fmt(w.date)}`} onClick={() => { setWeight(w.date, null); toast('Weigh-in removed', 'info'); }}><Icon.x /></button></li>
            ))}
          </ul>
        </Panel>

        <Panel kicker={`7-day avg ${avg((d) => dayTotals(s, d).kcal)} kcal`} title="Calories">
          <WeekBars title="Calories vs target band" unit="kcal" band={[st.kcalMin, st.kcalMax]} data={week.map((d) => ({ date: d, value: dayTotals(s, d).kcal }))} />
        </Panel>
        <Panel kicker={`7-day avg ${avg((d) => dayTotals(s, d).protein)} g`} title="Protein">
          <WeekBars title="Protein vs target" unit="g" target={st.protein} data={week.map((d) => ({ date: d, value: dayTotals(s, d).protein }))} />
        </Panel>
        <Panel kicker={`7-day avg ${avg((d) => s.logs[d]?.steps ?? 0).toLocaleString()}`} title="Steps">
          <WeekBars title="Steps vs target" unit="steps" target={st.steps} data={week.map((d) => ({ date: d, value: s.logs[d]?.steps ?? 0 }))} />
        </Panel>
        <Panel kicker={`7-day total ${week.reduce((a, d) => a + (s.logs[d]?.strengthMin ?? 0), 0)} min`} title="Strength minutes">
          <WeekBars title="Strength minutes vs target" unit="min" target={st.strengthMin} data={week.map((d) => ({ date: d, value: s.logs[d]?.strengthMin ?? 0 }))} />
        </Panel>
      </div>
    </div>
  );
}
