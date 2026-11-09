# DHANUSH → DEVA — THE TRANSFORMATION

A cinematic 3D personal fitness tracker. A raymarched WebGL2 world (an industrial quarry in backlit haze, with smoke, god rays, embers and a metallic 3D bow-"D" emblem) runs behind a 42-day transformation dashboard. Your data lives in **your own private Google Sheet**: there is no backend and no database.

**Live:** https://dhanush7921.github.io/dhanush-fit-deva/

## What's inside

| Area | Details |
|---|---|
| Cinematic intro | The official poster, brought to life in real time with WebGL2 (`src/intro/PosterIntro.ts`). The poster is split into layers by `scripts/make_intro_assets.py`: the emblem, DHANUSH, the arrow and DEVA, the tagline, the heartbeat and barbell, and a clean background plate. The intro runs about 12 seconds: darkness, smoke and embers → the D emblem burns in as the ring ignites, with a metal light sweep → DHANUSH, the arrow fires, and on impact a shockwave and flash burn DEVA in → the full poster appears, with THE TRANSFORMATION, the barbell pop and a heartbeat pulse → the camera pushes into the D and a light portal opens onto the live 3D site, with no loading screen. At full reveal the image matches the poster pixel-for-pixel. Skip, Replay (↻) and Sound controls are included; sound is muted by default and is procedural, with no film audio. Reduced-motion is respected, the render resolution adapts to the device, and dashboard chunks preload while the intro plays. |
| 3D world | Custom WebGL2 engine (`src/engine`): a raymarched SDF scene, depth-correct GPU particles (dust and embers, pushed away by the cursor), fog, smoke, god rays and a film grade. The camera flight follows your scroll on the home page, and each dashboard page gets its own camera move. |
| Performance | Quality tiers (high/mid/low) are picked by device. The render scale and raymarch step count adapt from the measured frame time. The pixel ratio is capped, the particle count is controlled, the engine pauses when the tab is hidden, and WebGL resources are cleaned up. Reduced-motion is supported, and there's a CSS fallback when WebGL2 is unavailable. Pages are code-split. Add `?perf=1` to the URL to see live FPS, or `?q=low|mid|high` to force a tier. |
| Fitness | Nutrition log (kcal, protein, carbs, fats, fiber) with meal history, quick re-add and edit/delete · steps with quick-add and auto-tick at 20k · workout split and exercise checklist · strength-session timer and minutes · 42-day calendar with daily completion checks · weight log and trend · weekly charts · streaks · editable targets and split. |
| Storage | Local-first (works offline) and syncs to Google Sheets with the tabs `DailyLogs`, `Meals`, `Workouts`, `WeightProgress` and `Settings`. Rows are upserted by stable id, the newer edit wins, duplicate rows are collapsed, and changes are queued while offline. |

Defaults: 95 kg start · 9 Nov – 20 Dec 2026 · 1,500–1,600 kcal · 173 g protein · 31.3 g fats · 140.6 g carbs · 17.2 g fiber · 20,000 steps · 90 min strength Mon–Fri. All of these can be changed in **Settings**. Pace figures describe your own logs and are not predictions.

## Connect Google Sheets (one-time, ~5 minutes)

1. Go to https://console.cloud.google.com/ and create a project (for example `deva-fitness`).
2. Open **APIs & Services → Library** and enable the **Google Sheets API** and the **Google Drive API**.
3. Open **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding / Audience):
   - User type **External**. Fill in the app name and your email.
   - Leave publishing status on **Testing**, and under **Test users** add **only your Gmail address**. Google will then refuse sign-in from every other account.
4. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://dhanush7921.github.io` (add `http://localhost:5173` for local dev)
   - You don't need a redirect URI or a client secret, because the app uses the browser token flow.
5. Copy the **Client ID** (`…apps.googleusercontent.com`). Then either:
   - paste it into **Settings → Cloud sync** on the site, together with your Gmail address as the authorised account, or
   - make it the default for every device: go to GitHub repo **Settings → Secrets and variables → Actions → Variables**, add `GOOGLE_CLIENT_ID` (and optionally `ALLOWED_EMAIL`), and re-run the deploy workflow.
6. Press **Connect Google**. On first connect the app creates a private spreadsheet called *DHANUSH → DEVA · Transformation Log* in your Drive.

### Security model
- Only the scopes `drive.file` + `userinfo.email` are requested. With `drive.file` the app can only see files it created, so it cannot read the rest of your Drive.
- The spreadsheet lives in your own Drive and is private to you.
- Sign-in is limited three ways: the consent screen is in Testing mode, you are the only test user, and the app's own allowed-account check signs out any other email.
- The OAuth Client ID is public by design. No client secret, private key or token is in the repo. The access token is kept in memory only.
- A strict Content-Security-Policy allows only this site, Google sign-in and the Google APIs.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (esbuild watch + serve)
npm run build      # → dist/
npm test           # Playwright end-to-end run against dist/ (fakes Google APIs)
```

Stack: React 19 + TypeScript, bundled with esbuild, plus a hand-written WebGL2/GLSL engine with no Three.js. Hash routing and relative asset URLs mean it works at any GitHub Pages base path without extra configuration. Deployment runs through `.github/workflows/deploy.yml`: each push to `main` builds and publishes to the `gh-pages` branch.

## Intro score
`scripts/make_intro_audio.py A.mpeg B.mpeg` builds the soundtrack and the sync map:
- Clip A (8.2 s) is the opening. FFmpeg analysis showed that from 4.8 s on it is the same recording as clip B, offset by 2.745 s (waveform correlation 0.976). So the mix continues A into B **sample-aligned** at the same 130.9 BPM groove. B is gain- and EQ-matched to A (−3.1 dB, ±3 dB corrective EQ), with a 120 ms equal-power crossfade in the gap before A's last kick. B then runs to the next phrase downbeat and fades over two bars.
- The master is normalised to −13.6 LUFS with a −1.7 dBFS peak and no clipping. Outputs: `audio-master/intro-mix.wav` (24-bit master), `public/intro/intro-mix.webm` (Opus) and `.m4a` (AAC, for Safari).
- `src/intro/music.json` holds the detected hits: build 1.79 s · ring 2.71 · sweep 3.22 · swell 3.60 · crash 4.51 · **impact 4.98** · kicks · reveal 7.27 · fly 9.57 · land 12.31. Every animation event is keyed to these times.
- When sound is on, each frame takes its time from the WebAudio playback clock (output-latency compensated), so the animation can't drift from the music. Sound starts muted. Turning it on mid-intro starts the score at the current position, and Skip fades it out over 0.6 s.

## Logo
The official DHANUSH → DEVA poster is the master brand asset. `scripts/make_intro_assets.py <poster.png>` produces everything in `public/intro/`: `poster.webp`, `plate.webp`, `mask.png` (layer mattes), `emblem.webp` (the D emblem with transparency, shown in the hero), `mark-96.webp` (nav logo) and `public/logo/favicon-192.png`. Re-run it if the poster changes.

Inspired by the mood of dark industrial action cinema. All geometry, shaders, sound and artwork are original, and no film footage or soundtrack is used.
