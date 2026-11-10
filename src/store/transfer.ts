// One-tap carry-over of locally saved entries from the old address (dhanush7921.github.io) to kalladhanush.in/deva/.
// localStorage is per-origin, so the old site hands its records over in the URL fragment (never sent to any server).
import { getState, mergeTransfer } from './store';

export const NEW_HOME = 'https://kalladhanush.in/deva/';
export const isOldHost = () => location.hostname.endsWith('github.io');

const enc = (s: string) => { const b = new TextEncoder().encode(s); let o = ''; for (let i = 0; i < b.length; i++) o += String.fromCharCode(b[i]); return btoa(o).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const dec = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export function transferUrl() {
  const { v, settings, meals, logs, workouts, weights } = getState();
  return `${NEW_HOME}#/import=${enc(JSON.stringify({ v, settings, meals, logs, workouts, weights }))}`;
}
export const localRecordCount = () => { const s = getState(); return Object.keys(s.meals).length + Object.keys(s.logs).length + Object.keys(s.workouts).length + Object.keys(s.weights).length; };

/** Runs before the app renders: if the URL carries records, merge them and clean the URL. */
export function consumeTransfer() {
  const m = location.hash.match(/^#\/?import=([A-Za-z0-9_-]+)/);
  if (!m) return;
  let note = 'err';
  try { note = String(mergeTransfer(JSON.parse(dec(m[1])))); } catch { /* malformed link */ }
  try { sessionStorage.setItem('deva.imported', note); } catch { /* ignore */ }
  history.replaceState(null, '', `${location.pathname}${location.search}#/dashboard`);
}
// Same-tab case (link pasted into an already open app): merge, then let the router re-read the cleaned URL.
addEventListener('hashchange', () => {
  if (!/^#\/?import=/.test(location.hash)) return;
  consumeTransfer();
  dispatchEvent(new HashChangeEvent('hashchange'));
});
