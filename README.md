# DHANUSH → DEVA — THE TRANSFORMATION

A cinematic 3D personal fitness tracker. A raymarched WebGL2 world (an industrial quarry in backlit haze, with smoke, god rays, embers and a metallic 3D bow-"D" emblem) runs behind a 42-day transformation dashboard. Your data lives in **your own private Google Sheet**: there is no backend and no database.

**Live:** https://dhanush7921.github.io/dhanush-fit-deva/

## What's inside

| Area | Details |
|---|---|
| Cinematic intro | Black screen → smoke and light → metallic **DHANUSH** → shatter (the shared **D** survives) → **DEVA** → *THE TRANSFORMATION* → a 3D camera flight into the world. Skip, Replay (↻ in the top bar) and Sound controls are included. Sound is muted by default, and all audio is procedural and original. |
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

## Logo
Original mark in `public/logo/`. *Dhanush* means bow: the bowstring forms the stem of the **D**, the drawn bow forms its curve, and a crimson arrow cuts through. Files: `deva-mark.svg` (symbol), `dhanush-deva-logo.svg` (full lockup), `favicon.svg`. The same mark exists as a live 3D object in the WebGL scene (`sdEmblem` in `src/engine/shaders.ts`).

Inspired by the mood of dark industrial action cinema. All geometry, shaders, sound and artwork are original, and no film footage or soundtrack is used.
