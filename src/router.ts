import { useSyncExternalStore } from 'react';

export type Route = 'home' | 'dashboard' | 'fuel' | 'training' | 'challenge' | 'progress' | 'settings';
export const ROUTES: Route[] = ['home', 'dashboard', 'fuel', 'training', 'challenge', 'progress', 'settings'];

const read = (): Route => {
  const r = location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return ROUTES.includes(r) ? r : 'home';
};
const sub = (f: () => void) => { addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); };
export const useRoute = () => useSyncExternalStore(sub, read);
export const navigate = (r: Route) => { location.hash = r === 'home' ? '/' : `/${r}`; };
export const currentRoute = read;
