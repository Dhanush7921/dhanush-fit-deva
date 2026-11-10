// Local-first sync with a private Google Sheet.
// - Every record has a stable id + updatedAt; rows are upserted by id (no duplicates).
// - Newest updatedAt wins per record; records edited during a sync stay dirty.
// - Duplicate rows (e.g. from two devices racing) are collapsed, keeping the newest.
// - Offline: edits stay in localStorage (the outbox) and sync when back online.
import { useSyncExternalStore } from 'react';
import { getState, setState, getPrefs, onLocalChange, markAllDirty } from '../store/store';
import type { State, Table, Settings } from '../store/types';
import { gapi, requestToken, hasToken, signOut, AuthError } from './google';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const TITLE = 'DHANUSH → DEVA · Transformation Log';

type Col = { k: string; t: 's' | 'n' | 'b' };
const S = (k: string): Col => ({ k, t: 's' }), N = (k: string): Col => ({ k, t: 'n' }), B = (k: string): Col => ({ k, t: 'b' });
const TABLES: Record<Table, { sheet: string; cols: Col[] }> = {
  logs: { sheet: 'DailyLogs', cols: [S('id'), S('date'), N('steps'), N('strengthMin'), B('nutritionDone'), B('stepsDone'), B('trainingDone'), S('notes'), N('updatedAt')] },
  meals: { sheet: 'Meals', cols: [S('id'), S('date'), S('time'), S('meal'), S('name'), N('kcal'), N('protein'), N('carbs'), N('fats'), N('fiber'), B('deleted'), N('updatedAt')] },
  workouts: { sheet: 'Workouts', cols: [S('id'), S('date'), S('exercise'), S('group'), B('done'), N('updatedAt')] },
  weights: { sheet: 'WeightProgress', cols: [S('id'), S('date'), N('kg'), B('deleted'), N('updatedAt')] },
};
const ORDER: Table[] = ['logs', 'meals', 'workouts', 'weights'];
const SETTINGS_SHEET = 'Settings';

const toRow = (t: Table, rec: any) => TABLES[t].cols.map((c) => (c.t === 'b' ? !!rec[c.k] : c.t === 'n' ? Number(rec[c.k]) || 0 : String(rec[c.k] ?? '')));
function fromRow(t: Table, row: any[]) {
  const o: any = {};
  TABLES[t].cols.forEach((c, i) => {
    const v = row[i];
    o[c.k] = c.t === 'b' ? v === true || v === 'TRUE' || v === 'true' : c.t === 'n' ? Number(v) || 0 : v == null ? '' : String(v);
  });
  return o;
}
const colLetter = (n: number) => String.fromCharCode(64 + n);

// ---- status ------------------------------------------------------------------
export type SyncState = 'local' | 'connecting' | 'syncing' | 'saved' | 'offline' | 'error' | 'auth';
export interface Status { state: SyncState; msg: string; at?: number }
let status: Status = { state: 'local', msg: 'Saved on this device' };
const subs = new Set<() => void>();
const setStatus = (s: Status) => { status = s; subs.forEach((f) => f()); };
export const useSyncStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => status);
export const isConnected = hasToken;

// ---- connect -------------------------------------------------------------------
export async function connect(selectAccount = false) {
  const prefs = getPrefs();
  setStatus({ state: 'connecting', msg: 'Connecting to Google…' });
  try {
    await requestToken(prefs.clientId, getState().sync.email, selectAccount ? 'select_account' : '');
    const me = await gapi<{ email: string; email_verified: boolean }>('https://www.googleapis.com/oauth2/v3/userinfo');
    const allowed = prefs.allowedEmail.trim().toLowerCase();
    if (allowed && me.email.toLowerCase() !== allowed) {
      signOut();
      throw new Error(`${me.email} is not the authorised account.`);
    }
    if (getState().sync.email && getState().sync.email !== me.email) setState((s) => ({ ...s, sync: { email: me.email } }), false);
    else setState((s) => ({ ...s, sync: { ...s.sync, email: me.email } }), false);
    await ensureSpreadsheet();
    await syncNow();
  } catch (e: any) {
    setStatus({ state: e instanceof AuthError ? 'auth' : 'error', msg: e.message || String(e) });
    throw e;
  }
}
export function disconnect() { signOut(); setStatus({ state: 'local', msg: 'Disconnected — saving on this device' }); }

const REQUIRED = [...ORDER.map((t) => TABLES[t].sheet), SETTINGS_SHEET];
export const parseSheetId = (v: string) => (v.match(/\/d\/([\w-]{20,})/)?.[1] ?? (/^[\w-]{20,}$/.test(v.trim()) ? v.trim() : ''));

/** Adds any of the five required tabs that the spreadsheet does not have yet. Existing tabs are never touched. */
async function ensureTabs(id: string) {
  const meta = await gapi<{ sheets?: { properties: { title: string } }[] }>(`${SHEETS}/${id}?fields=sheets.properties.title`);
  const have = new Set((meta.sheets ?? []).map((x) => x.properties.title));
  const missing = REQUIRED.filter((t) => !have.has(t));
  if (missing.length)
    await gapi(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }) });
}

async function ensureSpreadsheet() {
  const prev = getState().sync.spreadsheetId;
  let id = parseSheetId(getPrefs().sheetId) || prev;
  if (id) {
    try { await ensureTabs(id); }
    catch (e: any) {
      if (e instanceof AuthError) throw e;
      throw new Error(`Could not open the spreadsheet with ${getState().sync.email || 'this account'} — it must own or be able to edit it. (${e.message})`);
    }
  } else {
    const sheets = REQUIRED.map((title) => ({ properties: { title, gridProperties: { frozenRowCount: 1 } } }));
    const created = await gapi<{ spreadsheetId: string }>(SHEETS, { method: 'POST', body: JSON.stringify({ properties: { title: TITLE }, sheets }) });
    id = created.spreadsheetId;
  }
  if (prev && prev !== id) markAllDirty(); // different spreadsheet: everything on this device must be uploaded to it
  setState((s) => ({ ...s, sync: { ...s.sync, spreadsheetId: id } }), false);
  return id;
}
export const sheetUrl = () => { const id = getState().sync.spreadsheetId; return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null; };

// ---- sync ----------------------------------------------------------------------
let running: Promise<void> | null = null;
let again = false;
export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  const job = async () => {
    try {
      const lock = (navigator as any).locks;
      if (lock) await lock.request('deva-sheets-sync', () => doSync());
      else await doSync();
    } finally {
      running = null;
      if (again) { again = false; void syncNow().catch(() => {}); }
    }
  };
  running = job();
  return running;
}

async function doSync() {
  if (!navigator.onLine) { setStatus({ state: 'offline', msg: 'Offline — changes saved on this device' }); return; }
  if (!hasToken()) { setStatus({ state: getState().sync.spreadsheetId ? 'auth' : 'local', msg: getState().sync.spreadsheetId ? 'Reconnect Google to sync' : 'Saved on this device' }); return; }
  const id = getState().sync.spreadsheetId;
  if (!id) return;
  setStatus({ state: 'syncing', msg: 'Syncing with Google Sheets…' });
  try {
    const ranges = [...ORDER.map((t) => `${TABLES[t].sheet}!A1:${colLetter(TABLES[t].cols.length)}`), `${SETTINGS_SHEET}!A1:C`];
    const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
    const got = await gapi<{ valueRanges: { values?: any[][] }[] }>(`${SHEETS}/${id}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE`);
    const snap = getState();
    const incoming: Partial<Record<Table, Record<string, any>>> = {};
    const updates: { range: string; values: any[][] }[] = [];
    const appends: { t: Table; rows: any[][] }[] = [];
    const clears: string[] = [];
    const pushed: Record<Table, Map<string, number>> = { logs: new Map(), meals: new Map(), workouts: new Map(), weights: new Map() };

    ORDER.forEach((t, ti) => {
      const { sheet, cols } = TABLES[t];
      const rows = got.valueRanges[ti]?.values ?? [];
      if (!rows.length) updates.push({ range: `${sheet}!A1`, values: [cols.map((c) => c.k)] });
      const remote = new Map<string, { row: number; rec: any }>();
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i]?.[0]) continue;
        const rec = fromRow(t, rows[i]);
        const prev = remote.get(rec.id);
        if (prev) {
          if (rec.updatedAt > prev.rec.updatedAt) { clears.push(`${sheet}!A${prev.row + 1}:${colLetter(cols.length)}${prev.row + 1}`); remote.set(rec.id, { row: i, rec }); }
          else clears.push(`${sheet}!A${i + 1}:${colLetter(cols.length)}${i + 1}`);
        } else remote.set(rec.id, { row: i, rec });
      }
      const local = snap[t] as Record<string, any>;
      const inc: Record<string, any> = {};
      for (const [rid, { rec }] of remote) if (!local[rid] || rec.updatedAt > local[rid].updatedAt) inc[rid] = rec;
      incoming[t] = inc;
      const add: any[][] = [];
      for (const did of snap.dirty[t]) {
        const rec = local[did];
        if (!rec) continue;
        const r = remote.get(did);
        if (r && r.rec.updatedAt > rec.updatedAt) continue; // remote is newer: it wins
        if (r) updates.push({ range: `${sheet}!A${r.row + 1}`, values: [toRow(t, rec)] });
        else add.push(toRow(t, rec));
        pushed[t].set(did, rec.updatedAt);
      }
      if (add.length) appends.push({ t, rows: add });
    });

    // settings: key/value rows, whole-object last-write-wins
    const srows = got.valueRanges[ORDER.length]?.values ?? [];
    let remoteSettings: Partial<Settings> | null = null; let remoteAt = 0;
    for (let i = 1; i < srows.length; i++) {
      const [k, v, at] = srows[i] ?? [];
      if (!k) continue;
      try { (remoteSettings ??= {} as any)[k] = JSON.parse(String(v)); } catch { /* skip bad cell */ }
      remoteAt = Math.max(remoteAt, Number(at) || 0);
    }
    let pushSettings = false;
    if (snap.dirty.settings && snap.settings.updatedAt >= remoteAt) {
      pushSettings = true;
      const entries = Object.entries(snap.settings).filter(([k]) => k !== 'updatedAt');
      clears.push(`${SETTINGS_SHEET}!A2:C`);
      updates.push({ range: `${SETTINGS_SHEET}!A1`, values: [['key', 'value', 'updatedAt'], ...entries.map(([k, v]) => [k, JSON.stringify(v), snap.settings.updatedAt])] });
    }
    if (!srows.length && !pushSettings) updates.push({ range: `${SETTINGS_SHEET}!A1`, values: [['key', 'value', 'updatedAt']] });
    const pullSettings = !!remoteSettings && remoteAt > snap.settings.updatedAt && !pushSettings;

    if (clears.length) await gapi(`${SHEETS}/${id}/values:batchClear`, { method: 'POST', body: JSON.stringify({ ranges: clears }) });
    if (updates.length) await gapi(`${SHEETS}/${id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: updates }) });
    for (const a of appends)
      await gapi(`${SHEETS}/${id}/values/${encodeURIComponent(`${TABLES[a.t].sheet}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: a.rows }) });

    setState((s: State) => {
      const n: State = { ...s, dirty: { ...s.dirty }, sync: { ...s.sync, lastSync: Date.now() } };
      for (const t of ORDER) {
        const inc = incoming[t] ?? {};
        const cur = { ...(s[t] as Record<string, any>) };
        for (const [rid, rec] of Object.entries(inc)) if (!cur[rid] || rec.updatedAt > cur[rid].updatedAt) cur[rid] = rec;
        (n as any)[t] = cur;
        n.dirty[t] = s.dirty[t].filter((did) => {
          if (inc[did] && inc[did].updatedAt >= (s[t] as any)[did]?.updatedAt) return false;
          const at = pushed[t].get(did);
          return at === undefined || (s[t] as any)[did]?.updatedAt !== at;
        });
      }
      if (pushSettings && s.settings.updatedAt === snap.settings.updatedAt) n.dirty.settings = false;
      if (pullSettings) { n.settings = { ...s.settings, ...remoteSettings, updatedAt: remoteAt }; n.dirty.settings = false; }
      return n;
    }, false);
    setStatus({ state: 'saved', msg: 'Saved to Google Sheets', at: Date.now() });
  } catch (e: any) {
    setStatus({ state: e instanceof AuthError ? 'auth' : navigator.onLine ? 'error' : 'offline', msg: e.message || String(e) });
    if (!(e instanceof AuthError)) throw e;
  }
}

// ---- triggers ------------------------------------------------------------------
let timer = 0;
export function scheduleSync(delay = 2500) {
  clearTimeout(timer);
  if (!getPrefs().autoSync || !hasToken()) {
    const pending = ORDER.some((t) => getState().dirty[t].length) || getState().dirty.settings;
    if (!hasToken() && getState().sync.spreadsheetId && pending) setStatus({ state: 'auth', msg: 'Saved locally — reconnect Google to sync' });
    return;
  }
  timer = window.setTimeout(() => { void syncNow().catch(() => {}); }, delay);
}
onLocalChange(() => scheduleSync());
addEventListener('online', () => scheduleSync(500));
addEventListener('offline', () => setStatus({ state: 'offline', msg: 'Offline — changes saved on this device' }));
// Re-check the cloud whenever the tab is looked at again, and once a minute while it stays open.
const wake = () => { if (document.visibilityState === 'visible' && hasToken()) scheduleSync(400); };
addEventListener('focus', wake);
document.addEventListener('visibilitychange', wake);
setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine && hasToken()) scheduleSync(0); }, 60000);
export const pendingCount = (s: State) => ORDER.reduce((n, t) => n + s.dirty[t].length, 0) + (s.dirty.settings ? 1 : 0);
