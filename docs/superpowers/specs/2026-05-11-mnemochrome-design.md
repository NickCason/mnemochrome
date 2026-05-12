# Mnemochrome — Design Spec (V1)

A mobile-first PWA color-memory game. See a color, then summon it back.

## Premise

The screen fills with a target color for a short time. The color vanishes; a touch-centric picker appears. You dial in your best guess. When you lock in, the game grades how close you got, side-by-side, as a percentage.

Difficulty lives in the **color** (how subtle the target is), not in your speed at using the UI. There is no match-phase timer.

## Game loop

1. **Title** — "Tap to play". Below: a view-time slider (1.0s – 10.0s, default 3.0s), personal best %, and best-of-last-10 average. Settings cog (haptics on/off, reset stats).
2. **Reveal** — entire screen is the target color for the view-time. A thin countdown ring around the screen edge ticks down. No other chrome.
3. **Match** — picker scene. Entire background is the current selection (so the phone *is* your guess). Picker controls float on top. Single "Lock In" button at the bottom. **No timer.**
4. **Grade** — split screen: target color on top half, your guess on bottom half. Big centered percentage. Buttons: **Next**, **Share**.
5. **Endless** — Next loops back to Reveal. Personal best and rolling average update live.

## Picker

- **2D pad** (~70% of screen height): horizontal axis = hue (0–360°), vertical axis = saturation (0–100%). Tap anywhere to jump; drag to refine. Crosshair indicator on current position.
- **Lightness slider** (wide, ~10% of screen height): single horizontal bar showing the lightness gradient at the current hue/sat. Drag the thumb or tap to jump.
- **Whole-page background** = current HSL selection. The picker pad and slider sit over a subtle frosted-glass surface so they remain legible against any background color.
- Pointer Events (works on touch + mouse). One pointer at a time.

## Scoring

- Target and guess are both in sRGB.
- Convert both to **CIE Lab** and compute **ΔE2000** (perceptually-uniform color distance).
- Map to percentage:
  ```
  pct = clamp(0, 100, round(100 * (1 - ΔE / 50)))
  ```
  - ΔE ≈ 1 → ~98% (imperceptible match)
  - ΔE ≈ 10 → 80% (close)
  - ΔE ≈ 25 → 50% (in the neighborhood)
  - ΔE ≥ 50 → 0%
- The constant `50` is a single tunable in `color.ts` — adjust after playtest if the curve feels wrong.
- Grade is displayed as **percentage only** (e.g. "94%"). No letter grade.

## Difficulty model

- Single user-facing knob: **view-time** (1.0–10.0s). Lower = harder.
- Target color is uniformly random across HSL space each round (full hue range, saturation 10–100%, lightness 15–85% — avoids near-blacks and near-whites that are trivial).
- No tiered palettes in V1; the score curve naturally rewards effort on any color.

## Theme & visual identity

### Premise

Mnemochrome should feel like a quiet specimen book for the eye: warm-paper neutrals, classical type, restrained ornament. When a color is on screen, nothing in the chrome competes with it.

Dark mode only — light chrome would tint perception of every target color and undermine the game.

### Palette (chrome only — never applied to gameplay surfaces)

| Token | Value | Usage |
|---|---|---|
| `--ink` | `#0E0E10` | Primary background; default surface for title, grade card, settings |
| `--paper` | `#ECE6DA` | Primary text, countdown ring, icon glyphs |
| `--mute` | `#7A7670` | Secondary text, 1px dividers |
| `--accent` | `#C2185B` | Brand color: wordmark "o" tint, primary button fill, app icon |
| `--glass` | `rgba(14, 14, 16, 0.55)` over `backdrop-filter: blur(18px) saturate(140%)` | Floating panels over a live color (picker controls, grade card) |

All declared as CSS custom properties on `:root` in `styles.css`.

### Typography

- **Display serif:** `Fraunces` (variable, optical-size axis). Used for wordmark and the large grade percentage.
- **UI sans:** `Inter` (variable). Used for buttons, labels, stats, settings.
- Self-hosted as `.woff2` in `public/fonts/`. No CDN dependency at runtime.
- Type scale: 13 / 15 / 18 / 24 / 48 / 96 px (UI body / UI emphasis / labels / section / wordmark / grade number).

### Wordmark

- Pure type. No separate graphical mark.
- Text: lowercase `mnemochrome`, Fraunces 400, letter-spacing `-0.01em`.
- Both `o` glyphs (positions 5 and 9 of "mnemochrome") are rendered in `--accent`; all other glyphs are `--paper`. From a distance the word reads as a single warm cream; up close, the two colored vowels register as a pair — a quiet visual echo of target-and-guess.
- Rendered as inline HTML/CSS (not an SVG asset) so it scales perfectly and the accent color can update if we ever theme it.

### App icon

- **Concept:** the afterimage. A solid square of `--accent` with a translucent duplicate offset down-and-right behind it, on `--ink`. The mechanic, frozen as a still.
- **Geometry (512×512 reference grid):**
  - Canvas: 512×512, fill `--ink`.
  - Ghost square: 240×240, fill `--accent` at 35% opacity, centered at (276, 276).
  - Foreground square: 240×240, fill `--accent` at 100%, centered at (236, 236).
  - Both squares have 8px corner radius.
  - All content stays within the central 410×410 safe-zone (maskable spec).
- **Source asset:** single SVG at `public/icons/source.svg`.
- **Generated sizes** (via a small `scripts/build-icons.mjs` using `sharp`, run during `npm run build`):
  - `icon-192.png`, `icon-512.png` (manifest)
  - `icon-512-maskable.png` (manifest, `purpose: "maskable"`)
  - `apple-touch-icon.png` (180×180)
  - `favicon-32.png`, `favicon-16.png`
  - `favicon.ico` (multi-resolution)

### Per-scene chrome rules

- **Title:** `--ink` background, wordmark centered ~1/3 from top, 1px `--mute` rule below it, then view-time slider, then stats (PB and avg in `--paper`, labels in `--mute`).
- **Reveal:** zero chrome. The screen is the color. A 2px `--paper` ring traces the screen edge as a countdown — starts as a full rectangle outline, retracts clockwise from the top center.
- **Match:** the background is the live color. Picker pad and lightness slider sit on `--glass` panels with 16px corner radius. The pad crosshair is a 12px `--paper` ring with a 1px `--ink` outer stroke (legible against any hue). "Lock In" button is a full-width `--glass` panel at the bottom with `--paper` text.
- **Grade:** screen split horizontally — target on top half, guess on bottom half, both edge-to-edge. The percentage sits on a centered `--glass` card straddling the split line, Fraunces 96px in `--paper`. Below the card: "Next" (filled `--accent`, `--paper` text) and "Share" (text-only `--paper`).

### Microinteractions

- Picker pad / slider: background-color updates throttled to animation frames; no CSS transition on the live color (must feel instant).
- Scene transitions: 200ms cross-fade through `--ink`.
- Grade number: counts up from 0 to final value over 600ms, `ease-out`. One controlled flourish, not a slot machine.
- Haptics (where available via Vibration API): 10ms tick on lock-in, 30ms tick on grade reveal. Off by default; toggle in settings.

## Persistence

- `localStorage` only. No backend, no accounts.
- Stored:
  - `mnemo:pb` — personal best single-round percentage
  - `mnemo:last10` — rolling array of last 10 round percentages (for avg)
  - `mnemo:total` — total rounds played
  - `mnemo:settings` — view-time, haptics on/off
- "Reset stats" in settings clears all `mnemo:*` keys.

## Tech stack

- **Vite + TypeScript**, no UI framework.
- **vite-plugin-pwa** — generates manifest + service worker; installable on iOS/Android once served over HTTPS.
- **culori** — sRGB↔Lab, ΔE2000 (battle-tested, tiny, tree-shakes well).
- **sharp** (dev-only) — generates PNG icon sizes from `public/icons/source.svg` during build.
- Pointer Events for all touch input.
- Web Share API for the Share button (graceful fallback: copy a data URL to clipboard).

## File layout

```
mnemochrome/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   ├── icons/
│   │   ├── source.svg          # single source for all icon sizes
│   │   └── (generated PNGs at build time)
│   └── fonts/                  # Fraunces + Inter woff2
├── scripts/
│   └── build-icons.mjs         # sharp-based PNG generation from source.svg
├── src/
│   ├── main.ts         # bootstraps, mounts root, owns scene switcher
│   ├── state.ts        # game state + localStorage adapter
│   ├── color.ts        # HSL↔RGB↔Lab, ΔE2000, score math, random target
│   ├── scenes/
│   │   ├── title.ts
│   │   ├── reveal.ts
│   │   ├── match.ts
│   │   └── grade.ts
│   ├── ui/
│   │   ├── picker.ts   # 2D pad + lightness slider component
│   │   └── countdown.ts# edge-ring countdown component
│   └── styles.css
└── .github/workflows/deploy.yml
```

Each scene is a function that takes a root element and a callback for "scene done → go to next". `main.ts` owns the transitions. Scenes can be unit-tested in isolation.

## Deployment

- **Production:** GitHub Pages, HTTPS, deployed via GitHub Actions (no `gh-pages` branch). Workflow on push to `main`:
  1. `npm ci`
  2. `npm run build` (Vite outputs to `dist/`)
  3. `actions/upload-pages-artifact` from `dist/`
  4. `actions/deploy-pages` publishes the artifact
- Pages source in repo settings: "GitHub Actions" (not "Deploy from a branch").
- **Vite base path:** `/mnemochrome/` for Pages.
- **Dev:** `npm run dev` runs `vite --host 0.0.0.0`. Accessible across the tailnet at `http://nicks-macbook-air.taild99f50.ts.net:5173`. (HTTP-only in dev — PWA install requires HTTPS, so install-testing happens against the deployed Pages URL.)

## Repo

- `nickcason/mnemochrome` — **public**.
- Description: "Mobile color-memory game. See it, then summon it back."
- License: MIT (consistent with personal projects).

## Collaboration

A local AI co-developer participates on appropriately-scoped tasks.

- **Co-author name (commit trailer):** `steeLL-v1`
- **Model:** `qwen2.5-coder:7b` via Ollama
- **Host:** node8 of personal tailnet — `http://100.122.121.18:11434`
- **Access:** SSH passwordless, sudo passwordless

**Authorship rule:** any commit where steeLL-v1 wrote or substantively edited the code includes a `Co-Authored-By: steeLL-v1 <steeLL-v1@local.ai>` trailer alongside the standard Claude trailer.

**Suitable for steeLL-v1** (small, well-scoped, deterministic specs, single-file):
- Hex↔HSL↔RGB conversion helpers (pure functions, easy to test)
- Boilerplate config files (vite.config.ts, tsconfig.json, package scripts)
- CSS custom-property declarations from the palette table
- HTML scaffolding for individual scenes
- Test stubs for pure functions
- README skeleton

**Not suitable for steeLL-v1** (requires architecture, correctness-critical math, or feel):
- ΔE2000 scoring — use `culori`, not a reimplementation
- Service worker / PWA caching strategy
- Pointer Event handling with touch quirks (Safari edge cases)
- Scene transition orchestration
- Microinteraction timing / haptics integration
- Cross-file refactors
- GitHub Actions workflow

**Self-review loop:** for each steeLL-v1 task — (1) generate code from the spec excerpt, (2) re-prompt the same model with the spec + its output asking for defects and edits, (3) up to 2 iterations, (4) Claude reviews the final output before commit and may reject or edit (the co-author trailer survives in either case).

Per-task assignment lives in the implementation plan, not here.

## Out of scope for V1

(Call out anything from here to pull into scope.)

- Additional game modes (palette match, gradient match, grayscale)
- Online leaderboards / accounts / sync
- Sound effects, music
- Difficulty tiers or palette presets
- Color blindness modes
- Custom themes for game chrome
- Animation polish beyond essentials (scene crossfades, grade reveal)

## Open questions

None outstanding. Spec is implementation-ready.
