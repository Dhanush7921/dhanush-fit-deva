import { useState } from 'react';
import { useStore, setLog, emptyLog } from '../store/store';
import { challenge, checksDone, isComplete, dayTotals, splitFor, workoutProgress } from '../store/derive';
import { today, fmt, dow, DAY_SHORT } from '../store/dates';
import { Panel, Check } from '../components/ui';

export default function Challenge() {
  const s = useStore();
  const ch = challenge(s);
  const t = today();
  const [sel, setSel] = useState(ch.days.includes(t) ? t : ch.days[0]);
  const st = s.settings;
  const lead = (dow(ch.days[0]) + 6) % 7; // Monday-first grid
  const lg = s.logs[sel] ?? emptyLog(sel);
  const tot = dayTotals(s, sel);
  const wp = workoutProgress(s, sel);
  const pct = Math.round((ch.completed / ch.total) * 100);

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="kicker">{fmt(st.challengeStart, { day: 'numeric', month: 'long' })} — {fmt(st.challengeEnd, { day: 'numeric', month: 'long', year: 'numeric' })}</p><h1 className="page-title">The {ch.total}-day challenge</h1></div>
        <div className="head-stats">
          <div className="pill-stat"><strong className="num">{ch.completed}</strong><span>complete</span></div>
          <div className="pill-stat"><strong className="num">{pct}%</strong><span>completion</span></div>
        </div>
      </header>

      <div className="grid challenge">
        <Panel className="cal-panel">
          <div className="cal" role="grid" aria-label="Challenge calendar">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-h" role="columnheader">{d}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
            {ch.days.map((d, i) => {
              const n = checksDone(s, d), done = isComplete(s, d);
              const cls = [d === t ? 'today' : '', d > t ? 'future' : '', done ? 'done' : n ? 'partial' : d < t ? 'missed' : '', d === sel ? 'sel' : ''].join(' ');
              return (
                <button key={d} role="gridcell" className={`cal-d ${cls}`} onClick={() => setSel(d)} aria-label={`Day ${i + 1}, ${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${n} of 3 checks`} aria-pressed={d === sel}>
                  <span className="cal-n num">{i + 1}</span>
                  <span className="cal-date">{fmt(d)}</span>
                  <span className="pips" aria-hidden="true">{[0, 1, 2].map((k) => <i key={k} className={k < n ? 'on' : ''} />)}</span>
                </button>
              );
            })}
          </div>
          <div className="legend"><span><i className="lg done" />Complete</span><span><i className="lg partial" />Partial</span><span><i className="lg missed" />Missed</span><span><i className="lg today" />Today</span></div>
        </Panel>

        <Panel kicker={`Day ${ch.days.indexOf(sel) + 1} · ${DAY_SHORT[dow(sel)]}`} title={fmt(sel, { day: 'numeric', month: 'long' })}>
          {sel > t && <p className="muted">Future day — you can plan, but checks are for days you've lived.</p>}
          <div className="checks">
            <Check checked={lg.nutritionDone} onChange={(v) => setLog(sel, { nutritionDone: v })} label="Nutrition on target" hint={`${Math.round(tot.kcal)} kcal · ${Math.round(tot.protein)} g protein`} />
            <Check checked={lg.stepsDone} onChange={(v) => setLog(sel, { stepsDone: v })} label={`${(st.steps / 1000).toFixed(0)}k steps`} hint={`${lg.steps.toLocaleString()} logged`} />
            <Check checked={lg.trainingDone} onChange={(v) => setLog(sel, { trainingDone: v })} label={splitFor(s, sel).training ? `Strength · ${splitFor(s, sel).title}` : 'Active recovery'} hint={`${lg.strengthMin} min · ${wp.done}/${wp.total} items`} />
          </div>
          {lg.notes && <p className="note">“{lg.notes}”</p>}
        </Panel>
      </div>
    </div>
  );
}
