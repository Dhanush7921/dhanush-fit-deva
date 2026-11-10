import { useState, type FormEvent } from 'react';
import { useStore, updateSettings, usePrefs, setPrefs, resetLocal, importBackup, getState, DEFAULT_SETTINGS } from '../store/store';
import { useSyncStatus, connect, disconnect, syncNow, sheetUrl, isConnected, pendingCount } from '../sync/sheets';
import { Panel, NumField, Check, toast } from '../components/ui';
import { DAY_NAMES } from '../store/dates';
import type { Settings as S } from '../store/types';

type Num = keyof Pick<S, 'startWeight' | 'kcalMin' | 'kcalMax' | 'protein' | 'fats' | 'carbs' | 'fiber' | 'steps' | 'strengthMin'>;
const FIELDS: { k: Num; label: string; suffix: string; step?: number }[] = [
  { k: 'startWeight', label: 'Starting weight', suffix: 'kg', step: 0.1 },
  { k: 'kcalMin', label: 'Calories min', suffix: 'kcal' }, { k: 'kcalMax', label: 'Calories max', suffix: 'kcal' },
  { k: 'protein', label: 'Protein', suffix: 'g', step: 0.1 }, { k: 'carbs', label: 'Carbs', suffix: 'g', step: 0.1 },
  { k: 'fats', label: 'Fats', suffix: 'g', step: 0.1 }, { k: 'fiber', label: 'Fiber', suffix: 'g', step: 0.1 },
  { k: 'steps', label: 'Daily steps', suffix: 'steps', step: 500 }, { k: 'strengthMin', label: 'Strength session', suffix: 'min', step: 5 },
];

export default function Settings() {
  const s = useStore();
  const prefs = usePrefs();
  const st = useSyncStatus();
  const [draft, setDraft] = useState(() => ({ ...s.settings }));
  const [splitTxt, setSplitTxt] = useState(() => Object.fromEntries(Object.entries(s.settings.split).map(([k, v]) => [k, v.exercises.join('\n')])));
  const [cid, setCid] = useState(prefs.clientId);
  const [email, setEmail] = useState(prefs.allowedEmail);
  const [sheet, setSheet] = useState(prefs.sheetId);
  const [busy, setBusy] = useState(false);
  const [armReset, setArmReset] = useState(false);
  const url = sheetUrl();
  const pending = pendingCount(s);

  const saveTargets = (e: FormEvent) => {
    e.preventDefault();
    if (draft.kcalMin > draft.kcalMax) return toast('Calories min must be ≤ max', 'err');
    if (draft.challengeStart > draft.challengeEnd) return toast('Challenge start must be before end', 'err');
    const split = Object.fromEntries(Object.entries(draft.split).map(([k, v]) => [k, { ...v, exercises: (splitTxt[k] ?? '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20) }]));
    updateSettings({ ...draft, split });
    toast('Targets saved');
  };
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); } catch (e: any) { toast(e.message || 'Something went wrong', 'err'); } finally { setBusy(false); }
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `deva-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="page">
      <header className="page-head"><div><p className="kicker">Settings</p><h1 className="page-title">Calibrate</h1></div></header>
      <div className="grid settings">
        <Panel kicker="Google Sheets" title="Cloud sync" className="wide">
          <div className={`sync-status s-${st.state}`}><span className="dot" /><div><strong>{st.msg}</strong>
            <small>{s.sync.email ? `Account: ${s.sync.email}` : 'Not connected'}{s.sync.lastSync ? ` · last sync ${new Date(s.sync.lastSync).toLocaleString('en-IN')}` : ''}{pending ? ` · ${pending} change${pending > 1 ? 's' : ''} waiting` : ''}</small></div></div>
          <div className="sync-grid">
            <label className="field wide"><span>OAuth Client ID (public — not a secret)</span><input value={cid} onChange={(e) => setCid(e.target.value.trim())} placeholder="1234-abc.apps.googleusercontent.com" spellCheck={false} /></label>
            <label className="field wide"><span>Authorised Google account</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="you@gmail.com" /></label>
            <label className="field wide"><span>Spreadsheet link or ID (leave empty to create a new one)</span><input value={sheet} onChange={(e) => setSheet(e.target.value.trim())} placeholder="https://docs.google.com/spreadsheets/d/…" spellCheck={false} /></label>
          </div>
          <div className="form-actions">
            <button className="btn ghost" onClick={() => { setPrefs({ clientId: cid, allowedEmail: email, sheetId: sheet }); toast('Saved on this device'); }}>Save</button>
            {!isConnected() ? (
              <button className="btn primary" disabled={busy || !cid} onClick={() => { setPrefs({ clientId: cid, allowedEmail: email, sheetId: sheet }); run(() => connect(), 'Connected to Google Sheets'); }}>{s.sync.spreadsheetId ? 'Reconnect Google' : 'Connect Google'}</button>
            ) : (
              <>
                <button className="btn primary" disabled={busy} onClick={() => run(syncNow, 'Synced')}>Sync now</button>
                <button className="btn ghost" onClick={() => { disconnect(); toast('Disconnected', 'info'); }}>Disconnect</button>
              </>
            )}
            {url && <a className="btn ghost" href={url} target="_blank" rel="noopener noreferrer">Open spreadsheet ↗</a>}
          </div>
          <Check checked={prefs.autoSync} onChange={(v) => setPrefs({ autoSync: v })} label="Sync automatically after each change" />
          <p className="fineprint">Your data lives in one Google spreadsheet in your own Drive (tabs: DailyLogs, Meals, Workouts, WeightProgress, Settings). Sign in with the same Google account on any laptop, PC or phone and everything you saved appears there. The app asks only for Google Sheets access and your email; access tokens stay in memory, and nothing secret is stored here or in the code. Entries also save on this device first, so it works offline and uploads when you're back. Keep the spreadsheet's sharing set to <strong>Restricted</strong> so only you can open it.</p>
        </Panel>

        <Panel kicker="Targets" title="Daily targets" className="wide">
          <form onSubmit={saveTargets}>
            <div className="target-grid">
              {FIELDS.map((f) => <NumField key={f.k} id={`t-${f.k}`} label={f.label} suffix={f.suffix} step={f.step ?? 1} value={draft[f.k]} onChange={(v) => setDraft({ ...draft, [f.k]: v === '' ? 0 : v })} />)}
              <label className="field"><span>Challenge start</span><input type="date" value={draft.challengeStart} onChange={(e) => setDraft({ ...draft, challengeStart: e.target.value })} /></label>
              <label className="field"><span>Challenge end</span><input type="date" value={draft.challengeEnd} onChange={(e) => setDraft({ ...draft, challengeEnd: e.target.value })} /></label>
            </div>
            <h3 className="sub-h">Workout split</h3>
            <div className="split-edit">
              {['1', '2', '3', '4', '5', '6', '0'].map((k) => (
                <div key={k} className="split-day-edit">
                  <div className="split-day-top">
                    <strong>{DAY_NAMES[Number(k)]}</strong>
                    <label className="mini-check"><input type="checkbox" checked={draft.split[k].training} onChange={(e) => setDraft({ ...draft, split: { ...draft.split, [k]: { ...draft.split[k], training: e.target.checked } } })} /> Training day</label>
                  </div>
                  <input aria-label={`${DAY_NAMES[Number(k)]} title`} value={draft.split[k].title} onChange={(e) => setDraft({ ...draft, split: { ...draft.split, [k]: { ...draft.split[k], title: e.target.value } } })} />
                  <textarea aria-label={`${DAY_NAMES[Number(k)]} exercises, one per line`} rows={5} value={splitTxt[k]} onChange={(e) => setSplitTxt({ ...splitTxt, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit">Save targets</button>
              <button className="btn ghost" type="button" onClick={() => { setDraft({ ...DEFAULT_SETTINGS, updatedAt: draft.updatedAt }); setSplitTxt(Object.fromEntries(Object.entries(DEFAULT_SETTINGS.split).map(([k, v]) => [k, v.exercises.join('\n')]))); }}>Restore defaults</button>
            </div>
          </form>
        </Panel>

        <Panel kicker="Experience" title="Preferences">
          <Check checked={prefs.playIntro} onChange={(v) => setPrefs({ playIntro: v })} label="Play the cinematic intro on launch" />
          <p className="fineprint">Respects your system's reduced-motion setting. Add <code>?q=low</code> to the URL to force light 3D, <code>?perf=1</code> to show FPS.</p>
        </Panel>

        <Panel kicker="Data" title="Backup">
          <div className="form-actions">
            <button className="btn ghost" onClick={exportJson}>Export JSON</button>
            <label className="btn ghost file-btn">Import JSON<input type="file" accept="application/json" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { importBackup(await f.text()); toast('Backup imported'); } catch (err: any) { toast(err.message, 'err'); } e.target.value = ''; }} /></label>
            <button className={`btn ${armReset ? 'danger' : 'ghost'}`} onClick={() => { if (armReset) { resetLocal(); setArmReset(false); toast('Local data cleared', 'info'); } else { setArmReset(true); setTimeout(() => setArmReset(false), 4000); } }}>{armReset ? 'Tap again to clear this device' : 'Clear local data'}</button>
          </div>
          <p className="fineprint">Clearing only affects this device. Your Google Sheet is untouched.</p>
        </Panel>
      </div>
    </div>
  );
}
