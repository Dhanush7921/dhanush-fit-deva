import { lazy, Suspense, useCallback, useEffect, useState, type LazyExoticComponent, type ComponentType } from 'react';
import Nav from './components/Nav';
import { Toasts } from './components/ui';
import Home from './pages/Home';
import Intro from './intro/Intro';
import { useRoute, navigate, type Route } from './router';
import { getEngine } from './engine/Engine';
import { pageController } from './engine/shots';
import { getPrefs } from './store/store';
import PerfHud from './components/PerfHud';
import Moved from './components/Moved';
import { toast } from './components/ui';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Fuel = lazy(() => import('./pages/Fuel'));
const Training = lazy(() => import('./pages/Training'));
const Challenge = lazy(() => import('./pages/Challenge'));
const Progress = lazy(() => import('./pages/Progress'));
const Settings = lazy(() => import('./pages/Settings'));
/** Warm the dashboard chunks while the intro plays, so the hand-off is instant. */
const preloadPages = () => { void import('./pages/Dashboard'); void import('./pages/Fuel'); void import('./pages/Training'); void import('./pages/Challenge'); void import('./pages/Progress'); };
const PAGES: Record<Exclude<Route, 'home'>, LazyExoticComponent<ComponentType>> = { dashboard: Dashboard, fuel: Fuel, training: Training, challenge: Challenge, progress: Progress, settings: Settings };

export default function App() {
  const route = useRoute();
  const [intro, setIntro] = useState(() => route === 'home' && getPrefs().playIntro && !new URLSearchParams(location.search).has('nointro'));
  const done = useCallback(() => setIntro(false), []);

  useEffect(() => {
    if (intro) return;
    window.scrollTo(0, 0);
    if (route !== 'home') {
      const e = getEngine();
      e.camDamp = 1.6;
      e.controller = pageController(route, e.time);
    }
    document.title = route === 'home' ? 'DHANUSH → DEVA — The Transformation' : `${route[0].toUpperCase()}${route.slice(1)} · DEVA`;
  }, [route, intro]);

  useEffect(() => {
    const e = getEngine();
    e.start();
    if (!intro && route === 'home') e.setLook({ fade: 1, emblem: 0, accent: 1, smoke: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let note: string | null = null;
    try { note = sessionStorage.getItem('deva.imported'); sessionStorage.removeItem('deva.imported'); } catch { /* ignore */ }
    if (note === 'err') toast('That data link could not be read', 'err');
    else if (note !== null) toast(Number(note) ? `${note} entries carried over — connect Google to save them to your Sheet` : 'Everything was already here');
  }, []);

  const Page = route === 'home' ? null : PAGES[route];
  return (
    <>
      {intro && <Intro onDone={done} onPreload={preloadPages} />}
      <div className={`shell ${intro ? 'behind' : 'live'}`} aria-hidden={intro}>
        <Nav route={route} onReplay={() => { navigate('home'); window.scrollTo(0, 0); setIntro(true); }} />
        <main id="main" key={route} className={`view view-${route}`}>
          {route === 'home' ? <Home active={!intro} /> : Page && (
            <Suspense fallback={<div className="page"><div className="loading-bar" /></div>}><Page /></Suspense>
          )}
        </main>
        <Toasts />
      </div>
      <Moved />
      <PerfHud />
    </>
  );
}
