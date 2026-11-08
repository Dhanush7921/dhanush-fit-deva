import { useEffect, useRef } from 'react';
import { getEngine } from '../engine/Engine';
import { homeController } from '../engine/shots';
import { useStore } from '../store/store';
import { challenge, latestWeight, streaks, r1 } from '../store/derive';
import { fmt, DAY_SHORT } from '../store/dates';
import { navigate } from '../router';

export default function Home({ active }: { active: boolean }) {
  const s = useStore();
  const ch = challenge(s);
  const st = s.settings;
  const lw = latestWeight(s);
  const sk = streaks(s);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const e = getEngine();
    let prog = 0;
    const onScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; prog = max > 0 ? scrollY / max : 0; };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    e.camDamp = 2.4;
    e.controller = homeController(() => prog);
    // reveal-on-scroll for sections
    const io = new IntersectionObserver((es) => es.forEach((x) => x.isIntersecting && x.target.classList.add('in')), { threshold: 0.2 });
    root.current?.querySelectorAll('.reveal').forEach((n) => io.observe(n));
    return () => { removeEventListener('scroll', onScroll); io.disconnect(); };
  }, [active]);

  const order = ['1', '2', '3', '4', '5', '6', '0'];
  return (
    <div className="home" ref={root}>
      <section className="hero">
        <img className="hero-emblem" src="./intro/emblem.webp" alt="" aria-hidden="true" decoding="async" />
        <p className="kicker reveal in">{fmt(st.challengeStart, { day: '2-digit', month: 'short' })} — {fmt(st.challengeEnd, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        <h1 className="hero-title metal">DEVA</h1>
        <p className="hero-sub"><span className="crimson-rule" />The Transformation<span className="crimson-rule" /></p>
        <p className="hero-copy">Every name has a before. {ch.total} days to forge the after.</p>
        <div className="hero-cta">
          <button className="btn primary" onClick={() => navigate('dashboard')}>Enter the Command</button>
          <button className="btn ghost" onClick={() => navigate('fuel')}>Log a meal</button>
        </div>
        <div className="scroll-hint" aria-hidden="true"><span>Scroll to fly</span><i /></div>
      </section>

      <section className="chapter reveal">
        <p className="kicker">Chapter I · The Before</p>
        <h2 className="chapter-title">DHANUSH<br /><span className="dim">started at {st.startWeight} kg.</span></h2>
        <p className="chapter-copy">A number is a starting line, not a verdict. The plan is simple, the execution is daily: hit the fuel, walk the miles, lift the iron — and write it down.</p>
        <div className="stat-row">
          <div className="stat"><span className="num big">{ch.started ? (ch.ended ? ch.total : ch.day) : 0}<em>/{ch.total}</em></span><span>Challenge day</span></div>
          <div className="stat"><span className="num big">{sk.current}</span><span>Day streak</span></div>
          <div className="stat"><span className="num big">{lw ? r1(lw.kg) : st.startWeight}<em>kg</em></span><span>{lw ? `Last weigh-in · ${fmt(lw.date)}` : 'Starting weight'}</span></div>
        </div>
      </section>

      <section className="chapter reveal right">
        <p className="kicker">Chapter II · The Code</p>
        <h2 className="chapter-title">Daily targets</h2>
        <div className="code-grid">
          <div><span className="num">{st.kcalMin.toLocaleString()}–{st.kcalMax.toLocaleString()}</span><em>kcal</em></div>
          <div><span className="num">{st.protein}</span><em>g protein</em></div>
          <div><span className="num">{st.carbs}</span><em>g carbs</em></div>
          <div><span className="num">{st.fats}</span><em>g fats</em></div>
          <div><span className="num">{st.fiber}</span><em>g fiber</em></div>
          <div><span className="num">{(st.steps / 1000).toFixed(0)}k</span><em>steps</em></div>
          <div><span className="num">{st.strengthMin}</span><em>min iron · Mon–Fri</em></div>
        </div>
        <p className="fineprint">Targets are editable in Settings. Results vary by person — this tracks effort, it doesn't promise outcomes.</p>
      </section>

      <section className="chapter reveal">
        <p className="kicker">Chapter III · The Split</p>
        <h2 className="chapter-title">Seven days of iron</h2>
        <ol className="split-list">
          {order.map((d) => (
            <li key={d} className={st.split[d].training ? '' : 'rest'}>
              <span className="split-day">{DAY_SHORT[Number(d)]}</span>
              <span className="split-title">{st.split[d].title}</span>
              <span className="split-n">{st.split[d].training ? `${st.split[d].exercises.length} lifts` : 'Steps + mobility'}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="chapter final reveal">
        <p className="kicker">Chapter IV · The After</p>
        <h2 className="chapter-title metal">Become DEVA.</h2>
        <div className="strip" aria-label={`${ch.completed} of ${ch.total} days complete`}>
          {ch.days.map((d, i) => <span key={d} className={`${i < ch.day - 1 ? 'past' : ''} ${i === ch.day - 1 ? 'today' : ''} ${s.logs[d]?.nutritionDone && s.logs[d]?.stepsDone && s.logs[d]?.trainingDone ? 'done' : ''}`} />)}
        </div>
        <button className="btn primary" onClick={() => navigate('challenge')}>Open the 42-day calendar</button>
      </section>
    </div>
  );
}
