# Mnemochrome

> See a color, then summon it back.

Play: https://nickcason.github.io/mnemochrome/

## What it is

Mnemochrome is a mobile-first PWA color-memory game. A random target color fills the screen for a few seconds, then disappears. You rebuild it from memory with a touch picker and lock in, and the game shows the target next to your guess with a percentage score and a hue / saturation / lightness breakdown. Rounds are endless. Your best score and the average of your last 10 rounds are kept on the device.

It is plain TypeScript built with Vite, with no UI framework and no backend of its own. It is meant to be played on a phone, installed to the home screen.

## What it does

- **Reveal.** The target fills the screen while an outline traces the screen edge and retracts as a countdown, with one of 100 short hint phrases at the top. View time is a slider on the title screen, 1.0 to 10.0 seconds in 0.5 steps (default 3.0).
- **Match.** The top half is a live swatch of your pick with an HSL readout. Below it are a hue strip showing the whole spectrum (drag, flick or tap; it snaps to whole degrees) and a saturation-by-lightness pad. A lens above the strip shows the hue while you drag. Where the browser supports vibration, the controls tick at each whole value, more strongly every 10.
- **Grade.** Target on top, your pick below, and a card on the split that counts up to the headline percentage, then Hue, Sat and Light closeness. Swatches are labelled with hex and HSL. 90% or more pulses the card; 100% flares the number.
- **Share.** A 1080 x 1920 share image is drawn on an offscreen canvas and passed to the Web Share API. It falls back to text-only sharing, then to downloading the image and copying the text.
- **Motion.** Bloom, shutter, wash and lock-in transitions between scenes, and a short splash on cold launch. The reduced-motion setting skips the splash and the count-ups.
- **PWA.** vite-plugin-pwa generates a standalone, portrait manifest and a self-updating service worker for offline play. The fonts (Fraunces, Inter) are bundled. The title screen shows the build's git short SHA.

## Scoring

Targets are random HSL colors with saturation 10 to 100 and lightness 15 to 85. Each axis gets a closeness from 0 to 100: hue is 100 minus the shortest distance around the wheel as a share of 180 degrees, and saturation and lightness are 100 minus the absolute difference.

The headline is a weighted mean of the three. Hue is weighted by the two colors' average saturation, so a near-gray target does not punish hue precision; saturation and lightness are weighted 1 each. If either color is nearly gray (saturation under about 1.5%), hue counts as 100, and if both are, only lightness is used. An earlier design scored with ΔE2000; `src/color.ts` explains why that was dropped (the headline now agrees with the breakdown the player sees). culori is still used for color conversion.

## Perfect-score ping

When a round scores 100% and the page is served from the project's live GitHub Pages host, the app sends a fire-and-forget POST to a small Cloudflare Worker (`worker/`). The worker forwards a Pushover notification to the developer with the target and guess colors, personal best, round count, view time and build version, plus coarse request details: country, region, city, network name and browser/OS. It accepts POSTs only from a configured origin and rate-limits per IP, and the Pushover credentials are worker secrets. Local development never triggers it. The app has no setting to turn it off.

## How it works

`src/main.ts` is a small scene router: title, reveal, match, grade, then reveal again. Each scene in `src/scenes/` is a `mount...` function that builds its DOM and returns a cleanup function; `src/ui/transitions.ts` animates the swap.

- `src/color.ts`: HSL and hex conversion (culori), target generation, per-axis closeness, the headline score.
- `src/state.ts`: localStorage under `mnemo:pb`, `mnemo:last10`, `mnemo:total` and `mnemo:settings` (view time, haptics flag).
- `src/ui/picker/`: the hue strip, saturation-by-lightness pad, lens and haptics, wired together by `index.ts`. The pure helpers are unit-tested.

## How to run it

```bash
npm install
npm run dev          # Vite on 0.0.0.0:5173, reachable from other devices on the local network
npm run build        # builds the icons (sharp), type-checks (tsc -b), then vite build into dist/
npm run preview      # serve the build, also on 0.0.0.0
npm test             # vitest run (jsdom); npm run test:watch for watch mode
```

The app is served under the base path `/mnemochrome/`. Pushes to `main` build and deploy `dist/` to GitHub Pages through `.github/workflows/deploy.yml`. To deploy the worker, run `npx wrangler@latest deploy` in `worker/`, then set its secrets with `npx wrangler@latest secret put PUSHOVER_USER` and the same for `PUSHOVER_TOKEN`.

## Configuration

- `vite.config.ts`: the base path, dev server host and port, the PWA manifest and workbox options, and `__BUILD_SHA__` (the git short SHA, or `dev` outside a checkout).
- Worker variables in `worker/wrangler.toml`: `ALLOWED_ORIGIN`, `RATE_LIMIT_PER_MINUTE`, `PUSHOVER_SOUND`. Worker secrets: `PUSHOVER_USER`, `PUSHOVER_TOKEN`.
- `OLLAMA_HOST` overrides the host used by `scripts/steeLL-v1.mjs` (see Co-authorship).

## Layout

```
src/main.ts, state.ts, color.ts, reveal-phrases.ts, styles.css
src/scenes/         splash, title, reveal, match, grade
src/ui/             transitions, countdown, share-card, perfect-ping, picker/
public/icons/       source.svg (the PNG icons are generated from it by scripts/build-icons.mjs)
scripts/            build-icons.mjs, steeLL-v1.mjs, steeLL-v1-task.sh
worker/             Cloudflare Worker (README, wrangler.toml, src/worker.js)
docs/superpowers/   design specs and implementation plans
```

## Status

The deploy workflow publishes `main` to GitHub Pages at the URL above. There are 77 commits from 2026-05-11 to 2026-05-13; the last replaced the picker with the current hue strip and saturation-by-lightness pad. 68 unit tests cover the color maths, state, splash timing and the picker helpers.

Loose ends:

- The settings object has a haptics flag and `resetStats()` exists, but nothing in the UI changes the flag or calls the reset, so haptics are always on where supported.
- `pourTransition` is defined and not used.
- The documents in `docs/superpowers/` describe earlier versions of the scoring (ΔE2000) and the picker (a hue-by-saturation pad, then three vertical tapes). The code described above is current.

## Co-authorship

Small, well-scoped tasks were generated by a local AI co-author named "steeLL-v1" (qwen2.5-coder:7b via Ollama) with Claude reviewing every output before commit. Commits where steeLL-v1 contributed carry a Co-Authored-By trailer. `scripts/steeLL-v1.mjs` sends a spec to the model, runs up to two self-review passes and writes the result to a file; `steeLL-v1-task.sh` wraps it.

## License

MIT.
