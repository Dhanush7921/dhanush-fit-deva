import type { State, DaySplit } from './types';
import { addDays, diffDays, dow, today, range } from './dates';

export const r1 = (n: number) => Math.round(n * 10) / 10;

export function dayMeals(s: State, date: string) {
  return Object.values(s.meals).filter((m) => m.date === date && !m.deleted).sort((a, b) => a.time.localeCompare(b.time));
}
export function dayTotals(s: State, date: string) {
  const t = { kcal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, count: 0 };
  for (const m of dayMeals(s, date)) { t.kcal += m.kcal; t.protein += m.protein; t.carbs += m.carbs; t.fats += m.fats; t.fiber += m.fiber; t.count++; }
  return t;
}
export const splitFor = (s: State, date: string): DaySplit => s.settings.split[String(dow(date))];
export const log = (s: State, date: string) => s.logs[date];
export function workoutProgress(s: State, date: string) {
  const sp = splitFor(s, date);
  const done = sp.exercises.filter((ex) => s.workouts[`${date}|${ex}`]?.done).length;
  return { done, total: sp.exercises.length, split: sp };
}
export function isComplete(s: State, date: string) {
  const l = s.logs[date];
  return !!l && l.nutritionDone && l.stepsDone && l.trainingDone;
}
export function checksDone(s: State, date: string) {
  const l = s.logs[date];
  return l ? Number(l.nutritionDone) + Number(l.stepsDone) + Number(l.trainingDone) : 0;
}
export function nutritionOnTarget(s: State, date: string) {
  const t = dayTotals(s, date), st = s.settings;
  return t.kcal >= st.kcalMin * 0.97 && t.kcal <= st.kcalMax * 1.02 && t.protein >= st.protein * 0.9;
}
export function streaks(s: State) {
  const t = today();
  let cur = 0;
  let d = isComplete(s, t) ? t : addDays(t, -1);
  while (isComplete(s, d)) { cur++; d = addDays(d, -1); }
  let best = 0, run = 0;
  const dates = Object.keys(s.logs).sort();
  if (dates.length) for (const x of range(dates[0], t)) { if (isComplete(s, x)) { run++; best = Math.max(best, run); } else run = 0; }
  return { current: cur, best: Math.max(best, cur) };
}
export function challenge(s: State) {
  const { challengeStart: a, challengeEnd: b } = s.settings;
  const total = diffDays(a, b) + 1;
  const day = diffDays(a, today()) + 1;
  const days = range(a, b);
  const completed = days.filter((d) => isComplete(s, d)).length;
  return { total, day, clampedDay: Math.max(0, Math.min(total, day)), days, completed, started: day >= 1, ended: day > total };
}
export function weightSeries(s: State) {
  return Object.values(s.weights).filter((w) => !w.deleted && w.kg > 0).sort((a, b) => a.date.localeCompare(b.date));
}
export function latestWeight(s: State) {
  const w = weightSeries(s);
  return w.length ? w[w.length - 1] : null;
}
export function lastNDays(n: number, end = today()) {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}
