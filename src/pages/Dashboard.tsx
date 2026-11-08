import { useState } from 'react';
import { useStore, setLog, setWeight, emptyLog } from '../store/store';
import { dayTotals, workoutProgress, streaks, challenge, latestWeight, lastNDays, nutritionOnTarget, r1 } from '../store/derive';
import { today, fmt, DAY_NAMES, dow } from '../store/dates';
import { Panel, Ring, Bar, Check, Icon, toast, useCountUp } from '../components/ui';
import { WeekBars } from '../components/charts';
import { navigate } from '../router';

export default function Dashboard() {
  const s = useStore();
  const d = today();
  const st = s.settings;
  const t = dayTotals(s, d);
  const lg = s.logs[d] ?? emptyLog(d);
  const wp = workoutProgress(s, d);
  const sk = streaks(s);
  const ch = challenge(s);
  const lw = latestWeight(s);
  const [kg, setKg] = useState<number | ''>(s.weights[d] && !s.weights[d].deleted ? s.weights[d].kg : '');
  const [stepIn, setStepIn] = useState<number | ''>('');
  const steps = useCountUp(lg.steps);
  const onTarget = nutritionOnTarget(s, d);

  const addSteps = (n: number) => { setLog(d, { steps: Math.max(0, lg.steps + n) }); toast(`+${n.toLocaleString()} steps`); };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">{DAY_NAMES[dow(d)]} · {fmt(d, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="page-title">{ch.started && !ch.ended ? <>Day {ch.day}<em> / {ch.total}</em></> : ch.ended ? 'Challenge complete' : `Starts ${fmt(st.challengeStart)}`}</h1>
        </div>
        <div className="head-stats">
          <div className="pill-stat"><Icon.flame /><strong className="num">{sk.current}</strong><span>streak</span></div>
          <div className="pill-stat"><strong className="num">{ch.completed}</strong><span>days complete</span></div>
        </div>
      </header>
      <div className="progress-line" aria-hidden="true"><i style={{ width: `${(ch.clampedDay / ch.total) * 100}%` }} /></div>

      <div className="grid dash">
        <Panel kicker="Fuel" title="Today's nutrition" action={<button className="btn small" onClick={() => navigate('fuel')}><Icon.plus /> Add food</button>}>
          <div className="fuel-body">
            <Ring value={t.kcal} max={st.kcalMax} band={[st.kcalMin, st.kcalMax]} label={Math.round(t.kcal).toLocaleString()} sub={`of ${st.kcalMin}–${st.kcalMax} kcal`} />
            <div className="bars">
              <Bar label="Protein" value={t.protein} target={st.protein} />
              <Bar label="Carbs" value={t.carbs} target={st.carbs} decimals={1} />
              <Bar label="Fats" value={t.fats} target={st.fats} decimals={1} />
              <Bar label="Fiber" value={t.fiber} target={st.fiber} decimals={1} />
            </div>
          </div>
        </Panel>

        <Panel kicker="Movement" title="Steps">
          <div className="steps-body">
            <Ring value={lg.steps} max={st.steps} label={Math.round(steps).toLocaleString()} sub={`of ${st.steps.toLocaleString()}`} />
            <div className="step-actions">
              {[500, 1000, 2500, 5000].map((n) => <button key={n} className="btn small" onClick={() => addSteps(n)}>+{n >= 1000 ? `${n / 1000}k` : n}</button>)}
              <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (stepIn !== '') { setLog(d, { steps: Math.max(0, Math.round(stepIn)) }); setStepIn(''); toast('Steps updated'); } }}>
                <input type="number" inputMode="numeric" min={0} placeholder="Set total" value={stepIn} onChange={(e) => setStepIn(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Set total steps" />
                <button className="btn small" type="submit">Set</button>
              </form>
            </div>
          </div>
        </Panel>

        <Panel kicker="The Forge" title={wp.split.title} action={<button className="btn small" onClick={() => navigate('training')}>Open</button>}>
          {wp.split.training ? (
            <>
              <Bar label="Exercises" value={wp.done} target={wp.total} unit="" />
              <Bar label="Strength time" value={lg.strengthMin} target={st.strengthMin} unit=" min" />
            </>
          ) : <p className="muted">Recovery day — keep the steps, loosen the body.</p>}
        </Panel>

        <Panel kicker="Discipline" title="Today's checklist">
          <div className="checks">
            <Check checked={lg.nutritionDone} onChange={(v) => setLog(d, { nutritionDone: v })} label="Nutrition on target" hint={onTarget ? 'Your log says you are on target' : `${Math.round(t.kcal)} kcal · ${Math.round(t.protein)} g protein logged`} />
            <Check checked={lg.stepsDone} onChange={(v) => setLog(d, { stepsDone: v })} label={`${(st.steps / 1000).toFixed(0)}k steps`} hint={`${lg.steps.toLocaleString()} logged`} />
            <Check checked={lg.trainingDone} onChange={(v) => setLog(d, { trainingDone: v })} label={wp.split.training ? `Strength session · ${st.strengthMin} min` : 'Active recovery'} hint={wp.split.training ? `${lg.strengthMin} min · ${wp.done}/${wp.total} lifts` : wp.split.exercises.join(' · ')} />
          </div>
        </Panel>

        <Panel kicker="Body" title="Weight">
          <div className="weight-body">
            <div>
              <span className="num big">{lw ? r1(lw.kg) : st.startWeight}<em>kg</em></span>
              <p className="muted">{lw ? `${r1(lw.kg - st.startWeight) > 0 ? '+' : ''}${r1(lw.kg - st.startWeight)} kg since start · ${fmt(lw.date)}` : `Starting weight`}</p>
            </div>
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (kg !== '' && kg > 20 && kg < 400) { setWeight(d, Math.round(kg * 10) / 10); toast('Weight logged'); } else toast('Enter a weight in kg', 'err'); }}>
              <input type="number" step="0.1" inputMode="decimal" placeholder="Today (kg)" value={kg} onChange={(e) => setKg(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Today's weight in kg" />
              <button className="btn small" type="submit">Log</button>
            </form>
          </div>
        </Panel>

        <Panel kicker="Week" title="Calories, last 7 days" className="wide">
          <WeekBars W={1100} title="Daily calories vs target band" unit="kcal" band={[st.kcalMin, st.kcalMax]} data={lastNDays(7).map((x) => ({ date: x, value: dayTotals(s, x).kcal }))} />
        </Panel>
      </div>
    </div>
  );
}
