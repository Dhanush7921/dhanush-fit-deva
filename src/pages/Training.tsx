import { useEffect, useRef, useState } from 'react';
import { useStore, setLog, setWorkout, emptyLog } from '../store/store';
import { workoutProgress } from '../store/derive';
import { today, fmt, DAY_NAMES, dow, pad } from '../store/dates';
import { Panel, Bar, Check, DateNav, toast } from '../components/ui';
import { navigate } from '../router';

const TKEY = 'deva.timer.v1';
type Timer = { date: string; startedAt: number } | null;
const readTimer = (): Timer => { try { return JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch { return null; } };

export default function Training() {
  const s = useStore();
  const [date, setDate] = useState(today());
  const st = s.settings;
  const wp = workoutProgress(s, date);
  const lg = s.logs[date] ?? emptyLog(date);
  const [timer, setTimer] = useState<Timer>(readTimer);
  const [now, setNow] = useState(Date.now());
  const [mins, setMins] = useState<number | ''>('');
  const tick = useRef(0);

  useEffect(() => {
    if (!timer) return;
    tick.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick.current);
  }, [timer]);

  const elapsed = timer ? Math.max(0, Math.floor((now - timer.startedAt) / 1000)) : 0;
  const start = () => { const t = { date, startedAt: Date.now() }; localStorage.setItem(TKEY, JSON.stringify(t)); setTimer(t); setNow(Date.now()); toast('Session started'); };
  const stop = () => {
    if (!timer) return;
    const add = Math.max(1, Math.round(elapsed / 60));
    const cur = s.logs[timer.date]?.strengthMin ?? 0;
    setLog(timer.date, { strengthMin: cur + add });
    localStorage.removeItem(TKEY); setTimer(null);
    toast(`${add} min added to ${fmt(timer.date)}`);
  };
  const allDone = wp.done === wp.total && wp.total > 0;

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="kicker">The Forge · {DAY_NAMES[dow(date)]}</p><h1 className="page-title">{wp.split.title}</h1></div>
        <DateNav date={date} onChange={setDate} />
      </header>

      <div className="grid train">
        <Panel kicker={wp.split.training ? `${wp.done} of ${wp.total} complete` : 'Recovery protocol'} title="Exercise checklist" className="tall">
          <div className="checks">
            {wp.split.exercises.map((ex, i) => {
              const done = !!s.workouts[`${date}|${ex}`]?.done;
              return <Check key={ex} checked={done} label={<><span className="ex-n num">{pad(i + 1)}</span>{ex}</>} onChange={(v) => {
                setWorkout(date, ex, wp.split.title, v);
                if (v && wp.done + 1 === wp.total) { setLog(date, { trainingDone: true }); toast('Session complete. Forged.'); }
              }} />;
            })}
          </div>
          {wp.split.exercises.length === 0 && <p className="empty">No exercises set for this day. <button className="link" onClick={() => navigate('settings')}>Edit the split</button></p>}
        </Panel>

        <Panel kicker="Strength duration" title={wp.split.training ? `${st.strengthMin} minute target` : 'Optional on recovery days'}>
          <div className="timer">
            <span className="num timer-face" aria-live="off">{pad(Math.floor(elapsed / 3600))}:{pad(Math.floor((elapsed % 3600) / 60))}:{pad(elapsed % 60)}</span>
            {timer ? <button className="btn primary" onClick={stop}>Stop &amp; save</button> : <button className="btn primary" onClick={start}>Start session</button>}
          </div>
          {timer && timer.date !== date && <p className="muted">Timer is running for {fmt(timer.date)}.</p>}
          <Bar label="Logged today" value={lg.strengthMin} target={st.strengthMin} unit=" min" />
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (mins !== '') { setLog(date, { strengthMin: Math.max(0, Math.round(mins)) }); setMins(''); toast('Duration saved'); } }}>
            <input type="number" min={0} max={600} inputMode="numeric" placeholder="Set minutes" value={mins} onChange={(e) => setMins(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Set strength minutes" />
            <button className="btn small" type="submit">Set</button>
          </form>
        </Panel>

        <Panel kicker="Sign-off" title="Daily completion">
          <div className="checks">
            <Check checked={lg.trainingDone} onChange={(v) => setLog(date, { trainingDone: v })} label={wp.split.training ? 'Strength session done' : 'Active recovery done'} hint={allDone ? 'All lifts checked' : undefined} />
            <Check checked={lg.stepsDone} onChange={(v) => setLog(date, { stepsDone: v })} label={`${(st.steps / 1000).toFixed(0)}k steps`} hint={`${lg.steps.toLocaleString()} logged`} />
          </div>
          <label className="field wide notes"><span>Session notes</span>
            <textarea rows={3} value={lg.notes} maxLength={500} placeholder="PRs, weights, how it felt…" onChange={(e) => setLog(date, { notes: e.target.value })} />
          </label>
        </Panel>
      </div>
    </div>
  );
}
