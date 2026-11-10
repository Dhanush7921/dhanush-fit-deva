import { useSyncExternalStore } from 'react';
import type { State, Settings, Meal, DailyLog, WorkoutItem, Weight, Table, Prefs, DaySplit } from './types';

declare const __GOOGLE_CLIENT_ID__: string;
declare const __ALLOWED_EMAIL__: string;
declare const __SHEET_ID__: string;

const KEY = 'deva.state.v1';
const PREFS = 'deva.prefs.v1';

const sp = (title: string, exercises: string[], training = true): DaySplit => ({ title, exercises, training });
export const DEFAULT_SETTINGS: Settings = {
  startWeight: 95, challengeStart: '2026-11-09', challengeEnd: '2026-12-20',
  kcalMin: 1500, kcalMax: 1600, protein: 173, fats: 31.3, carbs: 140.6, fiber: 17.2,
  steps: 20000, strengthMin: 90,
  split: {
    '1': sp('Back + Triceps + Traps', ['Deadlift', 'Lat Pulldown', 'Barbell Row', 'Seated Cable Row', 'Rope Pushdown', 'Overhead Triceps Extension', 'Barbell Shrugs']),
    '2': sp('Chest + Biceps', ['Flat Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Weighted Dips', 'Barbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl']),
    '3': sp('Shoulders + Legs', ['Overhead Press', 'Lateral Raise', 'Rear Delt Fly', 'Back Squat', 'Romanian Deadlift', 'Leg Press', 'Standing Calf Raise']),
    '4': sp('Back + Shoulders + Traps', ['Pull-ups', 'T-Bar Row', 'Single-arm Dumbbell Row', 'Arnold Press', 'Cable Lateral Raise', 'Face Pull', 'Dumbbell Shrugs']),
    '5': sp('Chest + Arms + Legs', ['Incline Bench Press', 'Machine Chest Press', 'EZ-bar Curl', 'Skull Crushers', 'Walking Lunges', 'Lying Leg Curl', 'Leg Extension']),
    '6': sp('Recovery', ['Mobility flow — 15 min', 'Full-body stretching', 'Foam rolling'], false),
    '0': sp('Recovery', ['Mobility flow — 15 min', 'Full-body stretching', 'Foam rolling'], false),
  },
  updatedAt: 0,
};

const fresh = (): State => ({
  v: 1, settings: structuredClone(DEFAULT_SETTINGS), meals: {}, logs: {}, workouts: {}, weights: {},
  dirty: { meals: [], logs: [], workouts: [], weights: [], settings: false }, sync: {},
});

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw) as State;
    if (s.v !== 1) return fresh();
    const f = fresh();
    return { ...f, ...s, settings: { ...f.settings, ...s.settings }, dirty: { ...f.dirty, ...s.dirty }, sync: s.sync ?? {} };
  } catch { return fresh(); }
}

let state: State = load();
const subs = new Set<() => void>();
const changeHooks = new Set<() => void>();
let saveErr = false;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); saveErr = false; }
  catch { if (!saveErr) console.warn('[DEVA] local storage full or blocked'); saveErr = true; }
}
export const getState = () => state;
export function setState(fn: (s: State) => State, local = true) {
  state = fn(state);
  persist();
  subs.forEach((f) => f());
  if (local) changeHooks.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const onLocalChange = (f: () => void) => { changeHooks.add(f); return () => { changeHooks.delete(f); }; };
export const useStore = () => useSyncExternalStore(subscribe, getState);

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const mark = (s: State, t: Table, id: string) => (s.dirty[t].includes(id) ? s.dirty[t] : [...s.dirty[t], id]);

// ---- mutations -------------------------------------------------------------
export function upsertMeal(m: Omit<Meal, 'id' | 'updatedAt' | 'deleted'> & { id?: string }) {
  const id = m.id ?? uid();
  setState((s) => ({ ...s, meals: { ...s.meals, [id]: { ...m, id, deleted: false, updatedAt: Date.now() } as Meal }, dirty: { ...s.dirty, meals: mark(s, 'meals', id) } }));
  return id;
}
export function deleteMeal(id: string) {
  setState((s) => s.meals[id] ? ({ ...s, meals: { ...s.meals, [id]: { ...s.meals[id], deleted: true, updatedAt: Date.now() } }, dirty: { ...s.dirty, meals: mark(s, 'meals', id) } }) : s);
}
export const emptyLog = (date: string): DailyLog => ({ id: date, date, steps: 0, strengthMin: 0, nutritionDone: false, stepsDone: false, trainingDone: false, notes: '', updatedAt: 0 });
export function setLog(date: string, patch: Partial<DailyLog>) {
  setState((s) => {
    const cur = s.logs[date] ?? emptyLog(date);
    const next: DailyLog = { ...cur, ...patch, id: date, date, updatedAt: Date.now() };
    if (patch.steps !== undefined && next.steps >= s.settings.steps) next.stepsDone = true;
    if (patch.strengthMin !== undefined && next.strengthMin >= s.settings.strengthMin) next.trainingDone = true;
    return { ...s, logs: { ...s.logs, [date]: next }, dirty: { ...s.dirty, logs: mark(s, 'logs', date) } };
  });
}
export const workoutId = (date: string, exercise: string) => `${date}|${exercise}`;
export function setWorkout(date: string, exercise: string, group: string, done: boolean) {
  const id = workoutId(date, exercise);
  setState((s) => ({ ...s, workouts: { ...s.workouts, [id]: { id, date, exercise, group, done, updatedAt: Date.now() } as WorkoutItem }, dirty: { ...s.dirty, workouts: mark(s, 'workouts', id) } }));
}
export function setWeight(date: string, kg: number | null) {
  setState((s) => {
    const w: Weight = { id: date, date, kg: kg ?? 0, deleted: kg === null, updatedAt: Date.now() };
    return { ...s, weights: { ...s.weights, [date]: w }, dirty: { ...s.dirty, weights: mark(s, 'weights', date) } };
  });
}
export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch, updatedAt: Date.now() }, dirty: { ...s.dirty, settings: true } }));
}
export function resetLocal() { localStorage.removeItem(KEY); state = fresh(); persist(); subs.forEach((f) => f()); }
export function importBackup(json: string) {
  const d = JSON.parse(json) as Partial<State>;
  if (!d || d.v !== 1 || typeof d.meals !== 'object') throw new Error('Not a DEVA backup file');
  const now = Date.now();
  setState((s) => {
    const n = { ...s, settings: { ...s.settings, ...d.settings, updatedAt: now }, dirty: { meals: [] as string[], logs: [] as string[], workouts: [] as string[], weights: [] as string[], settings: true } };
    for (const t of ['meals', 'logs', 'workouts', 'weights'] as Table[]) {
      const src = (d[t] ?? {}) as Record<string, any>;
      const out = { ...(s[t] as Record<string, any>) };
      for (const [id, rec] of Object.entries(src)) { out[id] = { ...rec, updatedAt: now }; n.dirty[t].push(id); }
      (n as any)[t] = out;
    }
    return n;
  });
}

const TABLE_LIST: Table[] = ['meals', 'logs', 'workouts', 'weights'];
/** Merge records carried over from another device/origin. Newest edit wins per id, so repeating it never duplicates. */
export function mergeTransfer(d: Partial<State>): number {
  if (!d || d.v !== 1) throw new Error('Not DEVA data');
  let n = 0;
  setState((s) => {
    const out: State = { ...s, dirty: { ...s.dirty } };
    for (const t of TABLE_LIST) {
      const src = (d[t] ?? {}) as Record<string, any>;
      const cur = { ...(s[t] as Record<string, any>) };
      let dirty = s.dirty[t];
      for (const [id, rec] of Object.entries(src)) {
        if (!rec || typeof rec !== 'object' || rec.id !== id) continue;
        if (cur[id] && cur[id].updatedAt >= (Number(rec.updatedAt) || 0)) continue;
        cur[id] = rec; n++;
        if (!dirty.includes(id)) dirty = [...dirty, id];
      }
      (out as any)[t] = cur; out.dirty[t] = dirty;
    }
    if (d.settings && (Number(d.settings.updatedAt) || 0) > s.settings.updatedAt) { out.settings = { ...s.settings, ...d.settings }; out.dirty.settings = true; n++; }
    return out;
  });
  return n;
}
/** Queue every local record for upload (used when the target spreadsheet changes). */
export function markAllDirty() {
  setState((s) => ({ ...s, dirty: { meals: Object.keys(s.meals), logs: Object.keys(s.logs), workouts: Object.keys(s.workouts), weights: Object.keys(s.weights), settings: s.settings.updatedAt > 0 } }), false);
}

// ---- local-only preferences (never synced) ----------------------------------
const defPrefs: Prefs = { clientId: __GOOGLE_CLIENT_ID__, sheetId: __SHEET_ID__, allowedEmail: __ALLOWED_EMAIL__, playIntro: true, autoSync: true };
let prefs: Prefs = (() => { try { return { ...defPrefs, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { return defPrefs; } })();
if (!prefs.clientId) prefs.clientId = defPrefs.clientId;
if (!prefs.sheetId) prefs.sheetId = defPrefs.sheetId;
if (!prefs.allowedEmail) prefs.allowedEmail = defPrefs.allowedEmail;
const psubs = new Set<() => void>();
export const getPrefs = () => prefs;
export function setPrefs(p: Partial<Prefs>) { prefs = { ...prefs, ...p }; try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* ignore */ } psubs.forEach((f) => f()); }
export const usePrefs = () => useSyncExternalStore((f) => { psubs.add(f); return () => { psubs.delete(f); }; }, getPrefs);
