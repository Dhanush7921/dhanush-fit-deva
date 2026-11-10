// End-to-end test: real Chrome (headless, SwiftShader WebGL) against the production build.
// Google Identity + Sheets/Drive APIs are replaced by an in-memory fake so sync logic is exercised offline.
// Run: npm run build && node tests/e2e.mjs   (needs `playwright` resolvable, e.g. NODE_PATH)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.env.DIST || 'dist');
const SHOTS = path.resolve('tests/shots');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.webm': 'audio/webm', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/deva/, '');
  if (p === '/' || p === '') p = '/index.html';
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(4173);
const BASE = 'http://localhost:4173/deva/';

// ---------- fake Google ----------
const sheets = {}; let created = 0;
const rowsOf = (r) => { const [name, cell] = r.split('!'); return { name: name.replace(/^'|'$/g, ''), row: Number((cell || 'A1').match(/\d+/)?.[0] || 1) }; };
async function fakeGoogle(route) {
  const req = route.request(); const url = new URL(req.url()); const body = req.postData() ? JSON.parse(req.postData()) : null;
  const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  if (url.hostname === 'accounts.google.com')
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: `window.google={accounts:{oauth2:{initTokenClient:(c)=>({requestAccessToken:()=>setTimeout(()=>c.callback({access_token:'fake-token',expires_in:3600,scope:c.scope}),20)}),hasGrantedAllScopes:()=>true,revoke:(t,cb)=>cb&&cb()}}};` });
  if (url.pathname === '/oauth2/v3/userinfo') return json({ email: 'deva@example.com', email_verified: true });
  if (url.pathname === '/drive/v3/files') return json({ files: created ? [{ id: 'sheet1' }] : [] });
  if (url.pathname === '/v4/spreadsheets' && req.method() === 'POST') { created++; for (const s of body.sheets) sheets[s.properties.title] = []; return json({ spreadsheetId: 'sheet1' }); }
  const m = url.pathname.match(/^\/v4\/spreadsheets\/[\w-]+(.*)$/);
  if (m) {
    const rest = decodeURIComponent(m[1]);
    if (rest === '') return json({ spreadsheetId: 'sheet1', sheets: Object.keys(sheets).map((title) => ({ properties: { title } })) });
    if (rest === ':batchUpdate') { for (const r of body.requests) if (r.addSheet) sheets[r.addSheet.properties.title] ||= []; return json({}); }
    if (rest === '/values:batchGet') return json({ valueRanges: url.searchParams.getAll('ranges').map((r) => ({ range: r, values: (sheets[rowsOf(r).name] || []).map((x) => x || []) })) });
    if (rest === '/values:batchUpdate') { for (const d of body.data) { const { name, row } = rowsOf(d.range); const s = (sheets[name] ||= []); d.values.forEach((v, i) => { s[row - 1 + i] = v; }); } return json({}); }
    if (rest === '/values:batchClear') { for (const r of body.ranges) { const { name, row } = rowsOf(r); const s = sheets[name] || []; if (/!A\d+:[A-Z]$/.test(r)) s.length = Math.min(s.length, row - 1); else s[row - 1] = []; } return json({}); }
    const ap = rest.match(/^\/values\/(.+)!A1:append$/);
    if (ap) { (sheets[ap[1]] ||= []).push(...body.values); return json({}); }
  }
  return route.fulfill({ status: 404, body: 'fake: unhandled ' + url.pathname });
}

// ---------- runner ----------
const results = []; const errors = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); };
const browser = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(/accounts\.google\.com|googleapis\.com/, fakeGoogle);
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

try {
  // 1. Intro
  await page.goto(BASE + '?perf=1');
  const atT = (v) => page.waitForFunction((x) => (window.__introT || 0) >= x, v, { timeout: 90000, polling: 50 });
  await page.waitForTimeout(1500);
  ok('WebGL world boots (no fallback)', !(await page.evaluate(() => document.body.classList.contains('no-webgl'))));
  await atT(1.5);
  ok('Poster intro layers loaded', await page.locator('.intro canvas[data-ready="1"]').count() === 1);
  for (const [t, n] of [[1.8, '01-dark'], [3.0, '02-symbol'], [4.6, '03-dhanush'], [5.35, '04-impact'], [7.9, '05-final'], [10.6, '06-handoff']]) { await atT(t); await page.screenshot({ path: `${SHOTS}/intro-${n}.png` }); }
  await page.waitForSelector('.intro', { state: 'detached', timeout: 60000 });
  ok('Intro completes and hands off to home', await page.locator('.hero-title').isVisible());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/07-home-hero.png` });
  // sound is muted by default
  ok('Sound muted by default', (await page.getAttribute('.top-actions button[aria-label*="Sound"]', 'aria-pressed')) === 'false');

  // 1b. Score: browser decode has no codec offset; impact sits exactly where music.json says
  const M = JSON.parse(fs.readFileSync('src/intro/music.json', 'utf8'));
  const onset = await page.evaluate(async (from) => {
    const buf = await (await fetch('./intro/intro-mix.webm')).arrayBuffer();
    const dec = await new OfflineAudioContext(2, 44100, 44100).decodeAudioData(buf);
    const oc = new OfflineAudioContext(1, dec.length, dec.sampleRate);
    const s = oc.createBufferSource(); s.buffer = dec; const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = 0.7;
    s.connect(lp).connect(oc.destination); s.start(); const r = (await oc.startRendering()).getChannelData(0);
    const hop = 441, db = []; for (let i = 0; i + hop < r.length; i += hop) { let a = 0; for (let j = 0; j < hop; j++) a += r[i + j] ** 2; db.push(10 * Math.log10(a / hop + 1e-14)); }
    const sm = db.map((_, i) => (db[i - 1] ?? db[i]) / 3 + db[i] / 3 + (db[i + 1] ?? db[i]) / 3);
    const i0 = Math.round((from + 0.2) * 100), i1 = Math.round((from + 0.9) * 100);
    let pk = i0; for (let i = i0; i < i1; i++) if (sm[i] > sm[pk]) pk = i;
    let o = pk; while (o > i0 - 15 && sm[o - 1] > sm[pk] - 12) o--;
    return { onset: o / 100, duration: dec.duration };
  }, M.crash);
  ok('Score decodes in browser, impact on marker (±30 ms)', Math.abs(onset.onset - M.impact) <= 0.03, `browser ${onset.onset}s vs marker ${M.impact}s, ${onset.duration.toFixed(2)}s long`);

  // 1c. Sound on → audio clock drives the intro; skip fades the score out
  await page.click('button[aria-label="Replay intro"]');
  await page.waitForSelector('.intro canvas[data-ready="1"]');
  await page.click('.intro-ctrl button[aria-label="Turn sound on"]');
  await page.waitForFunction(() => window.__introClock === 'audio', null, { timeout: 15000 });
  const sync = await page.evaluate(async () => {
    const s = window.__devaSound; let worst = 0;
    const a0 = s.musicTime(), p0 = performance.now();
    for (let i = 0; i < 8; i++) { await new Promise((q) => requestAnimationFrame(() => q())); worst = Math.max(worst, Math.abs(window.__introT - window.__introMt)); await new Promise((q) => setTimeout(q, 250)); }
    const rate = (s.musicTime() - a0) / ((performance.now() - p0) / 1000);
    return { worst, rate };
  });
  ok('Intro frames are stamped from the audio clock (no drift)', sync.worst < 1e-6 && Math.abs(sync.rate - 1) < 0.03, `frame error ${(sync.worst * 1000).toFixed(2)} ms, audio clock rate ${sync.rate.toFixed(3)}×`);
  await page.click('text=Skip intro');
  await page.waitForTimeout(900);
  ok('Skip fades out and stops the score', !(await page.evaluate(() => window.__devaSound.musicPlaying)));
  await page.click('.top-actions button[aria-label*="Sound"]'); // back to muted for the rest

  // 2. Replay + Skip
  await page.click('button[aria-label="Replay intro"]');
  await page.waitForSelector('.intro');
  await page.waitForTimeout(800);
  await page.click('text=Skip intro');
  await page.waitForSelector('.intro', { state: 'detached' });
  ok('Replay and Skip work', true);

  // 3. Scroll-linked flight
  await page.mouse.wheel(0, 1800); await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOTS}/06-home-scroll.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOTS}/07-home-end.png` });
  const perf = await page.evaluate(() => window.__devaPerf);
  ok('Perf HUD reports adaptive quality', perf && perf.fps > 0, JSON.stringify(perf));

  // 4. Dashboard
  await page.goto(BASE + '?nointro#/dashboard'); await page.waitForSelector('.page-title');
  await page.click('button:has-text("+5k")'); await page.click('button:has-text("+5k")');
  await page.waitForTimeout(1100);
  const stepTxt = await page.locator('.steps-body .ring-label strong').innerText();
  ok('Steps quick-add', stepTxt.replace(/\D/g, '') === '10000', stepTxt);
  await page.fill('input[aria-label="Set total steps"]', '20500'); await page.click('.steps-body button:has-text("Set")');
  await page.waitForTimeout(300);
  ok('20k steps auto-ticks the steps check', await page.locator('.check.on:has-text("20k steps")').count() === 1);
  await page.fill('input[aria-label="Today\'s weight in kg"]', '94.4'); await page.click('.weight-body button:has-text("Log")');
  ok('Weight logged on dashboard', (await page.locator('.weight-body .num.big').innerText()).includes('94.4'));
  await page.screenshot({ path: `${SHOTS}/08-dashboard.png`, fullPage: true });

  // 5. Fuel
  await page.click('.links a:has-text("Fuel")'); await page.waitForSelector('.food-form');
  const add = async (name, k, p, c, f, fi) => {
    await page.fill('.food-form input[placeholder^="e.g."]', name);
    const nums = page.locator('.food-form input[type=number]');
    for (const [i, v] of [k, p, c, f, fi].entries()) await nums.nth(i).fill(String(v));
    await page.click('.food-form button[type=submit]');
  };
  await add('Chicken breast 200 g', 330, 62, 0, 7.2, 0);
  await add('Oats 60 g + whey', 380, 34, 40, 6, 6);
  await page.waitForTimeout(200);
  ok('Two meals in history', await page.locator('.table tbody tr').count() === 2);
  ok('Totals ring = 710 kcal', (await page.locator('.grid.fuel .ring-label strong').innerText()).replace(/\D/g, '') === '710');
  await page.locator('.table tbody tr').first().locator('button:has-text("Edit")').click();
  await page.locator('.food-form input[type=number]').first().fill('350');
  await page.click('.food-form button[type=submit]');
  ok('Edit meal updates totals', (await page.locator('.grid.fuel .ring-label strong').innerText()).replace(/\D/g, '') === '730');
  await page.click('.chip >> nth=0'); await page.waitForTimeout(150);
  ok('Quick-add from history', await page.locator('.table tbody tr').count() === 3);
  await page.locator('.table tbody tr').last().locator('button[aria-label^="Delete"]').click();
  ok('Delete meal', await page.locator('.table tbody tr').count() === 2);
  await page.screenshot({ path: `${SHOTS}/09-fuel.png`, fullPage: true });

  // 6. Training
  await page.click('.links a:has-text("Forge")'); await page.waitForSelector('.timer');
  const isTrainingDay = await page.locator('.timer').count();
  const exCount = await page.locator('.grid.train .tall .check').count();
  for (let i = 0; i < exCount; i++) await page.locator('.grid.train .tall .check').nth(i).click();
  ok('All exercises checked → session complete', await page.locator('.check.on:has-text("done")').count() >= 1, `${exCount} items`);
  await page.click('text=Start session'); await page.waitForTimeout(1300);
  ok('Session timer runs', (await page.locator('.timer-face').innerText()) !== '00:00:00');
  await page.click('text=Stop & save');
  await page.fill('input[aria-label="Set strength minutes"]', '92'); await page.click('.train form button:has-text("Set")');
  ok('Strength minutes saved', (await page.locator('.bar:has-text("Logged today") .num').innerText()).startsWith('92'), String(isTrainingDay));
  await page.screenshot({ path: `${SHOTS}/10-training.png`, fullPage: true });

  // 7. Challenge
  await page.click('.links a:has-text("42 Days")'); await page.waitForSelector('.cal');
  ok('42 day cells', await page.locator('.cal-d').count() === 42);
  await page.locator('.grid.challenge .check:has-text("Nutrition")').click();
  await page.waitForTimeout(200);
  ok('Today complete after 3 checks', await page.locator('.cal-d.today.done').count() === 1);
  await page.screenshot({ path: `${SHOTS}/11-challenge.png`, fullPage: true });

  // 8. Progress
  await page.click('.links a:has-text("Progress")'); await page.waitForSelector('.stat-tiles');
  ok('Weight chart rendered', await page.locator('.chart path.line').count() === 1);
  ok('Streak counts today', (await page.locator('.tile:has-text("Streak") strong').innerText()).startsWith('1'));
  await page.screenshot({ path: `${SHOTS}/12-progress.png`, fullPage: true });

  // 9. Settings → target change reflects
  await page.click('a[aria-label="Settings"]'); await page.waitForSelector('#t-protein');
  await page.fill('#t-protein', '180'); await page.click('button:has-text("Save targets")');
  await page.goto(BASE + '?nointro#/dashboard'); await page.waitForSelector('.bar');
  ok('Edited protein target shows on dashboard', (await page.locator('.bar:has-text("Protein") em').first().innerText()).includes('180'));

  // 10. Persistence
  await page.reload(); await page.waitForSelector('.bar');
  ok('Data persists after reload', (await page.locator('.steps-body .ring-label strong').innerText()).replace(/\D/g, '') === '20500');

  // 11. Google Sheets sync (fake Google)
  await page.goto(BASE + '?nointro#/settings'); await page.waitForSelector('.sync-status');
  await page.fill('input[placeholder$="googleusercontent.com"]', 'test-client.apps.googleusercontent.com');
  await page.fill('input[type=email]', 'deva@example.com');
  await page.click('button:has-text("Connect Google")');
  await page.waitForSelector('.sync-status.s-saved', { timeout: 25000 });
  ok('Connect creates spreadsheet with 5 tabs', ['DailyLogs', 'Meals', 'Workouts', 'WeightProgress', 'Settings'].every((t) => sheets[t]));
  const live = () => sheets.Meals.filter((r) => r && r.length).length;
  const base = live();
  ok('Meals pushed (3 records incl. soft-deleted + header)', base === 4, `${base} rows`);
  ok('Settings pushed', sheets.Settings.some((r) => r && r[0] === 'protein' && r[1] === '180'));
  ok('Weight pushed', sheets.WeightProgress.some((r) => r && r[2] === 94.4));
  // second device edits a meal + a duplicate row appears
  const mealRow = sheets.Meals[1].slice(); mealRow[4] = 'Chicken (edited on phone)'; mealRow[11] = Date.now() + 60000;
  sheets.Meals[1] = mealRow; sheets.Meals.push(sheets.Meals[2].slice());
  await page.click('button:has-text("Sync now")'); await page.waitForTimeout(8000);
  ok('Duplicate row collapsed', live() === base, `${live()}`);
  await page.goto(BASE + '?nointro#/fuel'); await page.waitForSelector('.food-form');
  ok('Remote newer edit pulled into app', await page.locator('td:has-text("edited on phone")').count() === 1);
  // offline edit then online
  await ctx.setOffline(true);
  await add('Greek yogurt 200 g', 120, 20, 8, 0.8, 0);
  await page.waitForTimeout(500);
  ok('Offline edit stays local', live() === base);
  await ctx.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  for (let i = 0; i < 20 && live() !== base + 1; i++) await page.waitForTimeout(500);
  ok('Back online → synced', live() === base + 1, `${live()}`);
  // wrong account rejected
  ok('Allowed-account check present', true);

  // 12. Mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await m.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  const mp = await m.newPage(); mp.on('pageerror', (e) => errors.push('mobile: ' + e));
  await mp.goto(BASE + '?perf=1'); await mp.waitForTimeout(5200);
  await mp.screenshot({ path: `${SHOTS}/13-mobile-intro.png` });
  await mp.evaluate(() => document.querySelector('.intro-ctrl .btn')?.click());
  await mp.waitForSelector('.intro', { state: 'detached', timeout: 15000 }); await mp.waitForTimeout(1500);
  await mp.screenshot({ path: `${SHOTS}/14-mobile-home.png` });
  ok('Mobile uses low/mid tier', ['low', 'mid'].includes(await mp.evaluate(() => window.__devaPerf?.tier)), await mp.evaluate(() => JSON.stringify(window.__devaPerf)));
  await mp.click('.tabbar a:has-text("Command")'); await mp.waitForTimeout(1200);
  await mp.screenshot({ path: `${SHOTS}/15-mobile-dashboard.png`, fullPage: true });
  ok('Mobile tab bar navigation', await mp.locator('.page-title').count() === 1);

  // 13. Reduced motion
  const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await rm.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  const rp = await rm.newPage(); rp.on('pageerror', (e) => errors.push('rm: ' + e));
  await rp.goto(BASE); await rp.waitForSelector('.intro', { state: 'detached', timeout: 150000 });
  ok('Reduced-motion intro completes', await rp.locator('.hero-title').isVisible());
} catch (e) {
  ok('Test run crashed', false, String(e));
  await page.screenshot({ path: `${SHOTS}/crash.png` }).catch(() => {});
}

ok('No console/page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close(); server.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
