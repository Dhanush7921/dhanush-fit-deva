import { useMemo, useState, type FormEvent } from 'react';
import { useStore, upsertMeal, deleteMeal } from '../store/store';
import { dayMeals, dayTotals, lastNDays, r1 } from '../store/derive';
import { today, fmt, nowTime } from '../store/dates';
import { Panel, Bar, Ring, NumField, Icon, DateNav, toast } from '../components/ui';
import type { Meal } from '../store/types';

const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Pre-workout', 'Post-workout'];
type Draft = { name: string; meal: string; kcal: number | ''; protein: number | ''; carbs: number | ''; fats: number | ''; fiber: number | '' };
const blank = (): Draft => ({ name: '', meal: guessMeal(), kcal: '', protein: '', carbs: '', fats: '', fiber: '' });
function guessMeal() { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 18 ? 'Snack' : 'Dinner'; }

export default function Fuel() {
  const s = useStore();
  const [date, setDate] = useState(today());
  const [f, setF] = useState<Draft>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const st = s.settings;
  const meals = dayMeals(s, date);
  const t = dayTotals(s, date);

  const recent = useMemo(() => {
    const seen = new Map<string, Meal>();
    Object.values(s.meals).filter((m) => !m.deleted).sort((a, b) => b.updatedAt - a.updatedAt).forEach((m) => { const k = m.name.trim().toLowerCase(); if (!seen.has(k)) seen.set(k, m); });
    return [...seen.values()].slice(0, 10);
  }, [s.meals]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || f.kcal === '') { toast('Food name and calories are required', 'err'); return; }
    const n = (v: number | '') => (v === '' ? 0 : Math.max(0, Number(v)));
    const prev = editing ? s.meals[editing] : null;
    upsertMeal({ id: editing ?? undefined, date, time: prev?.time ?? nowTime(), meal: f.meal, name: f.name.trim(), kcal: n(f.kcal), protein: n(f.protein), carbs: n(f.carbs), fats: n(f.fats), fiber: n(f.fiber) });
    toast(editing ? 'Food updated' : `${f.name.trim()} added`);
    setF({ ...blank(), meal: f.meal }); setEditing(null);
  };
  const reAdd = (m: Meal) => { upsertMeal({ date, time: nowTime(), meal: guessMeal(), name: m.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fats: m.fats, fiber: m.fiber }); toast(`${m.name} added`); };
  const edit = (m: Meal) => { setEditing(m.id); setF({ name: m.name, meal: m.meal, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fats: m.fats, fiber: m.fiber }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const set = (k: keyof Draft) => (v: number | '') => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="kicker">Fuel</p><h1 className="page-title">Nutrition log</h1></div>
        <DateNav date={date} onChange={setDate} />
      </header>

      <div className="grid fuel">
        <Panel kicker={editing ? 'Editing' : 'Add food'} title={editing ? 'Update entry' : 'What did you eat?'}>
          <form className="food-form" onSubmit={submit}>
            <label className="field wide"><span>Food</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Chicken breast 200 g" maxLength={80} required /></label>
            <label className="field"><span>Meal</span><select value={f.meal} onChange={(e) => setF({ ...f, meal: e.target.value })}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
            <NumField label="Calories" value={f.kcal} onChange={set('kcal')} suffix="kcal" />
            <NumField label="Protein" value={f.protein} onChange={set('protein')} step={0.1} suffix="g" />
            <NumField label="Carbs" value={f.carbs} onChange={set('carbs')} step={0.1} suffix="g" />
            <NumField label="Fats" value={f.fats} onChange={set('fats')} step={0.1} suffix="g" />
            <NumField label="Fiber" value={f.fiber} onChange={set('fiber')} step={0.1} suffix="g" />
            <div className="form-actions wide">
              <button className="btn primary" type="submit">{editing ? 'Save changes' : 'Add to log'}</button>
              {editing && <button type="button" className="btn ghost" onClick={() => { setEditing(null); setF(blank()); }}>Cancel</button>}
            </div>
          </form>
          {recent.length > 0 && !editing && (
            <div className="recent">
              <p className="kicker">Quick add from history</p>
              <div className="chips">{recent.map((m) => <button key={m.id} className="chip" onClick={() => reAdd(m)} title={`${m.kcal} kcal · ${m.protein} g protein`}><Icon.plus />{m.name}</button>)}</div>
            </div>
          )}
        </Panel>

        <Panel kicker={fmt(date, { weekday: 'long', day: 'numeric', month: 'short' })} title="Totals">
          <div className="fuel-body">
            <Ring value={t.kcal} max={st.kcalMax} band={[st.kcalMin, st.kcalMax]} label={Math.round(t.kcal).toLocaleString()} sub={`${Math.max(0, Math.round(st.kcalMax - t.kcal))} kcal left`} />
            <div className="bars">
              <Bar label="Protein" value={t.protein} target={st.protein} />
              <Bar label="Carbs" value={t.carbs} target={st.carbs} decimals={1} />
              <Bar label="Fats" value={t.fats} target={st.fats} decimals={1} />
              <Bar label="Fiber" value={t.fiber} target={st.fiber} decimals={1} />
            </div>
          </div>
        </Panel>

        <Panel kicker="Meal history" title={`${meals.length} ${meals.length === 1 ? 'entry' : 'entries'}`} className="wide">
          {meals.length === 0 ? <p className="empty">Nothing logged for this day yet.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Time</th><th>Food</th><th>Meal</th><th className="r">kcal</th><th className="r">P</th><th className="r">C</th><th className="r">F</th><th className="r">Fi</th><th><span className="sr">Actions</span></th></tr></thead>
                <tbody>
                  {meals.map((m) => (
                    <tr key={m.id}>
                      <td className="num">{m.time}</td><td>{m.name}</td><td className="muted">{m.meal}</td>
                      <td className="r num">{Math.round(m.kcal)}</td><td className="r num">{r1(m.protein)}</td><td className="r num">{r1(m.carbs)}</td><td className="r num">{r1(m.fats)}</td><td className="r num">{r1(m.fiber)}</td>
                      <td className="r actions">
                        <button className="link" onClick={() => edit(m)}>Edit</button>
                        <button className="icon-btn danger" aria-label={`Delete ${m.name}`} onClick={() => { deleteMeal(m.id); toast('Entry removed', 'info'); }}><Icon.x /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel kicker="Past 14 days" title="Daily totals" className="wide">
          <div className="history">
            {lastNDays(14, today()).reverse().map((x) => {
              const tt = dayTotals(s, x);
              const ok = tt.kcal >= st.kcalMin && tt.kcal <= st.kcalMax;
              return (
                <button key={x} className={`hist ${x === date ? 'sel' : ''} ${tt.count ? (ok ? 'ok' : 'off') : ''}`} onClick={() => setDate(x)}>
                  <span>{fmt(x, { weekday: 'short', day: 'numeric' })}</span>
                  <strong className="num">{tt.count ? Math.round(tt.kcal) : '—'}</strong>
                  <em>{tt.count ? `${Math.round(tt.protein)} g P` : 'no log'}</em>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
