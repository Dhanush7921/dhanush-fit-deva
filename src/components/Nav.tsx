import { useSyncExternalStore, type MouseEvent } from 'react';
import { Logo, Icon, SoundIcon } from './ui';
import { navigate, type Route } from '../router';
import { sound } from '../engine/audio';
import { useSyncStatus } from '../sync/sheets';

const LINKS: { r: Route; label: string; icon: typeof Icon.home }[] = [
  { r: 'home', label: 'World', icon: Icon.home },
  { r: 'dashboard', label: 'Command', icon: Icon.dash },
  { r: 'fuel', label: 'Fuel', icon: Icon.fuel },
  { r: 'training', label: 'Forge', icon: Icon.train },
  { r: 'challenge', label: '42 Days', icon: Icon.cal },
  { r: 'progress', label: 'Progress', icon: Icon.chart },
];

export function useMuted() { return useSyncExternalStore(sound.subscribe, sound.getMuted); }

export default function Nav({ route, onReplay }: { route: Route; onReplay: () => void }) {
  const muted = useMuted();
  const st = useSyncStatus();
  const go = (r: Route) => (e: MouseEvent) => { e.preventDefault(); navigate(r); };
  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand" onClick={go('home')} aria-label="DHANUSH to DEVA — home">
          <Logo size={30} />
          <span className="brand-word"><span className="brand-old">DHANUSH</span><span className="brand-arrow">→</span><span>DEVA</span></span>
        </a>
        <nav className="links" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.r} href={`#/${l.r === 'home' ? '' : l.r}`} onClick={go(l.r)} className={route === l.r ? 'active' : ''} aria-current={route === l.r ? 'page' : undefined}>{l.label}</a>
          ))}
        </nav>
        <div className="top-actions">
          <button className={`sync-pill s-${st.state}`} onClick={() => navigate('settings')} title={st.msg} aria-label={`Sync status: ${st.msg}`}>
            <span className="dot" /><span className="sync-txt">{label(st.state)}</span>
          </button>
          <a className="icon-btn portfolio-link" href={location.hostname.endsWith('github.io') ? 'https://kalladhanush.in/' : '../'} aria-label="Back to Kalla Dhanush portfolio" title="kalladhanush.in"><Icon.left /></a>
          <button className="icon-btn" onClick={onReplay} aria-label="Replay intro" title="Replay intro"><Icon.replay /></button>
          <button className="icon-btn" onClick={sound.toggle} aria-pressed={!muted} aria-label={muted ? 'Sound off — turn on' : 'Sound on — turn off'} title="Sound"><SoundIcon on={!muted} /></button>
          <a href="#/settings" onClick={go('settings')} className={`icon-btn ${route === 'settings' ? 'active' : ''}`} aria-label="Settings" title="Settings"><Icon.gear /></a>
        </div>
      </header>
      <nav className="tabbar" aria-label="Sections">
        {LINKS.map((l) => (
          <a key={l.r} href={`#/${l.r === 'home' ? '' : l.r}`} onClick={go(l.r)} className={route === l.r ? 'active' : ''} aria-current={route === l.r ? 'page' : undefined}>
            <l.icon /><span>{l.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}

function label(s: string) {
  return ({ local: 'Local', connecting: 'Connecting', syncing: 'Syncing', saved: 'Synced', offline: 'Offline', error: 'Sync error', auth: 'Reconnect' } as Record<string, string>)[s] ?? s;
}
