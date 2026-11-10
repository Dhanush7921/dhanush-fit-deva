// Google Identity Services (browser token flow). No client secret, no backend.
// The access token lives in memory only — never in localStorage, never in the repo.
declare const google: any;

export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email openid';

export class AuthError extends Error { constructor(m = 'Google session expired — reconnect') { super(m); } }

let token: { value: string; exp: number } | null = null;
let gisPromise: Promise<void> | null = null;

function loadGis() {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise)
    gisPromise = new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => res();
      s.onerror = () => { gisPromise = null; rej(new Error('Could not load Google sign-in. Check your connection.')); };
      document.head.appendChild(s);
    });
  return gisPromise;
}

export async function requestToken(clientId: string, hint?: string, prompt: '' | 'consent' | 'select_account' = ''): Promise<string> {
  if (!clientId) throw new Error('Add your Google OAuth Client ID in Settings first.');
  await loadGis();
  return new Promise((res, rej) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt,
      hint,
      callback: (r: any) => {
        if (r.error) return rej(new Error(r.error_description || r.error));
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, 'https://www.googleapis.com/auth/spreadsheets'))
          return rej(new Error('Google Sheets permission was not granted.'));
        token = { value: r.access_token, exp: Date.now() + (Number(r.expires_in) - 60) * 1000 };
        res(r.access_token);
      },
      error_callback: (e: any) => rej(new Error(e?.type === 'popup_closed' ? 'Sign-in window closed.' : e?.message || 'Sign-in failed.')),
    });
    client.requestAccessToken();
  });
}

export const hasToken = () => !!token && token.exp > Date.now();
export function signOut() {
  if (token && (window as any).google?.accounts?.oauth2) google.accounts.oauth2.revoke(token.value, () => {});
  token = null;
}

export async function gapi<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  if (!hasToken()) throw new AuthError();
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token!.value}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (r.status === 401) { token = null; throw new AuthError(); }
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = await r.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
    throw new Error(`Google API: ${msg}`);
  }
  return r.status === 204 ? (null as T) : r.json();
}
