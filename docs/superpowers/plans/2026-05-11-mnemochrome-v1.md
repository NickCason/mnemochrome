# Mnemochrome V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first PWA called Mnemochrome — see a target color full-screen for N seconds, then dial it in on a touch picker, get graded as a percentage. Deployed to GitHub Pages (HTTPS, installable). Tailscale dev for phone playtest.

**Architecture:** Vite + TypeScript, no UI framework. Scene-based: each scene is `(root: HTMLElement, done: (result?) => void) => () => void` where the returned function is a cleanup. `main.ts` owns the transition between scenes. Pure logic (color math, scoring, state) lives in standalone modules with Vitest tests. UI components (picker, countdown) are framework-free DOM modules.

**Tech Stack:** Vite 5+, TypeScript 5+, vite-plugin-pwa, culori (color math), sharp (build-time icon generation), Vitest (tests). Deploy via GitHub Actions → Pages.

**Co-author:** Each task is tagged with `[claude]`, `[steeLL-v1]`, or `[mixed]` indicating which model produces the bulk of the code. steeLL-v1 = `qwen2.5-coder:7b` on Ollama at `http://100.122.121.18:11434` (node8 of personal tailnet, passwordless SSH). steeLL-v1 commits include a `Co-Authored-By: steeLL-v1 <steeLL-v1@local.ai>` trailer. Claude reviews steeLL-v1 output before commit. The invocation script set up in Task 0 implements the 2-iteration self-review loop.

**Working directory:** `/Users/nickcason/DevSpace/Personal/mnemochrome`

---

## Task 0: steeLL-v1 invocation script `[claude]`

Implements `scripts/steeLL-v1.mjs` and `scripts/steeLL-v1-task.sh`. The Node script POSTs to `http://100.122.121.18:11434/api/generate` (or `$OLLAMA_HOST`) with `qwen2.5-coder:7b`, temperature 0.2, runs up to 2 self-review iterations stopping early on convergence, and writes the extracted code to the output file. Shell wrapper uses `set -euo pipefail` and pipes stdin through. Both chmod +x. Git initialized on `main`. Smoke-tested with a simple "write an add function" prompt.

✅ **Completed.** See commits `aaddf6c` (initial) and `3baf857` (review fixes: guarded `d.response`, multiline-fence extraction, 120s fetch timeout).

---

## Task 1: Vite scaffold + dependencies `[claude]`

Runs `npm create vite@latest . -- --template vanilla-ts`. Installs runtime deps `culori @fontsource-variable/fraunces @fontsource-variable/inter`, dev deps `vite-plugin-pwa vitest @vitest/ui sharp typescript @types/node jsdom`. Replaces `index.html` with PWA-ready viewport meta and theme-color, `src/main.ts` with a placeholder, package.json scripts (`dev`, `build`, `preview`, `test`, `test:watch`). `.gitignore` adds `node_modules/`, `dist/`, `.superpowers/`.

✅ **Completed.** See commit `7bb1f6b`.

---

## Task 2: tsconfig + vite.config.ts `[steeLL-v1]`

**Files:**
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Generate `tsconfig.json` via steeLL-v1**

```bash
scripts/steeLL-v1-task.sh tsconfig tsconfig.json <<'EOF'
Write a strict TypeScript tsconfig.json for a Vite browser project.
Requirements:
- target: ES2022
- module: ESNext
- moduleResolution: bundler
- strict: true
- noUnusedLocals: true
- noUnusedParameters: true
- noFallthroughCasesInSwitch: true
- lib: ["ES2022", "DOM", "DOM.Iterable"]
- include: ["src", "scripts"]
- isolatedModules: true
- skipLibCheck: true
Output JSON only.
EOF
```

- [ ] **Step 2: Generate `vite.config.ts` via steeLL-v1**

```bash
scripts/steeLL-v1-task.sh vite-config vite.config.ts <<'EOF'
Write a vite.config.ts for a TypeScript project.
- Default export from defineConfig (import from 'vite')
- Set `base: '/mnemochrome/'` (for GitHub Pages)
- Set `server: { host: '0.0.0.0', port: 5173 }`
- Add a vitest reference comment at the top: /// <reference types="vitest" />
- Add `test: { environment: 'jsdom' }` for localStorage tests
- No plugins yet — vite-plugin-pwa will be added in Task 15
EOF
```

- [ ] **Step 3: Claude review** — read both files. Verify tsconfig has `strict: true` and `bundler` resolution; vite.config has correct base path, host, and test env. Edit if defective.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds. If TS errors on placeholder main.ts, fix them minimally.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json vite.config.ts
git commit -m "$(cat <<'EOF'
chore: tsconfig + vite base config

Co-Authored-By: steeLL-v1 <steeLL-v1@local.ai>
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: CSS tokens & base styles `[steeLL-v1]`

**Files:**
- Create: `src/styles.css` (replacing any template `src/style.css` — note naming).

- [ ] **Step 1: Generate `src/styles.css` via steeLL-v1**

```bash
scripts/steeLL-v1-task.sh styles src/styles.css <<'EOF'
Write a CSS file with:

1. CSS custom properties on :root:
   --ink: #0E0E10
   --paper: #ECE6DA
   --mute: #7A7670
   --accent: #C2185B
   --glass-bg: rgba(14, 14, 16, 0.55)

2. * { box-sizing: border-box; margin: 0; padding: 0; }

3. html, body { height: 100%; overflow: hidden; overscroll-behavior: none; touch-action: manipulation; -webkit-user-select: none; user-select: none; }

4. body { background: var(--ink); color: var(--paper); font-family: 'Inter Variable', system-ui, sans-serif; }

5. #app { width: 100vw; height: 100dvh; position: relative; }

6. .glass utility: background: var(--glass-bg); backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%); border-radius: 16px;

7. .wordmark: font-family: 'Fraunces Variable', Georgia, serif; font-weight: 400; letter-spacing: -0.01em; font-size: 48px; color: var(--paper);

8. .wordmark .o { color: var(--accent); }

9. .btn-primary: background: var(--accent); color: var(--paper); border: none; border-radius: 12px; padding: 16px 24px; font: inherit; font-weight: 600;

10. .btn-ghost: background: transparent; color: var(--paper); border: none; padding: 16px 24px; font: inherit;

CSS only, no commentary.
EOF
```

- [ ] **Step 2: Delete any Vite-template `src/style.css` if different from `src/styles.css`** (template uses singular; spec uses plural — keep plural).

- [ ] **Step 3: Import styles and fonts in `src/main.ts`**

Replace `src/main.ts` contents:
```ts
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.textContent = 'mnemochrome (scaffold)';
```

- [ ] **Step 4: Claude review** — read styles.css. Verify all selectors and values present and correctly formatted.

- [ ] **Step 5: Verify dev server renders**

```bash
timeout 5 npm run dev 2>&1 | head -20 || true
```
Open in browser briefly to confirm dark background, paper-colored text "mnemochrome (scaffold)".

- [ ] **Step 6: Commit**

```bash
git add src/styles.css src/main.ts
git rm -f src/style.css 2>/dev/null || true
git add -A
git commit -m "$(cat <<'EOF'
feat: design tokens and base styles

Co-Authored-By: steeLL-v1 <steeLL-v1@local.ai>
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Color math — `src/color.ts` with TDD `[mixed]`

**Files:**
- Create: `src/color.ts`
- Create: `src/color.test.ts`

Claude writes the scoring function; steeLL-v1 writes the simple conversion wrappers. Both covered by tests.

- [ ] **Step 1: Write `src/color.test.ts`** (Claude — defines the contract)

```ts
import { describe, it, expect } from 'vitest';
import { hslToHex, hexToRgb, scoreMatch, randomTarget, type HSL } from './color';

describe('hslToHex', () => {
  it('pure red', () => expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#ff0000'));
  it('pure white', () => expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe('#ffffff'));
  it('pure black', () => expect(hslToHex({ h: 0, s: 0, l: 0 })).toBe('#000000'));
  it('round-trip via hex', () => {
    const hex = hslToHex({ h: 210, s: 60, l: 45 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('hexToRgb', () => {
  it('parses lowercase', () => expect(hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 }));
  it('parses uppercase', () => expect(hexToRgb('#FF8800')).toEqual({ r: 255, g: 136, b: 0 }));
});

describe('scoreMatch', () => {
  it('identical colors → 100', () => expect(scoreMatch('#ff0000', '#ff0000')).toBe(100));
  it('opposite extremes → 0', () => expect(scoreMatch('#000000', '#ffffff')).toBe(0));
  it('very close colors → >= 95', () => {
    expect(scoreMatch('#ff0000', '#fe0101')).toBeGreaterThanOrEqual(95);
  });
  it('moderately distant colors → between 30 and 80', () => {
    const s = scoreMatch('#ff0000', '#ff8800');
    expect(s).toBeGreaterThan(30);
    expect(s).toBeLessThan(80);
  });
  it('always returns integer 0..100', () => {
    const s = scoreMatch('#123456', '#abcdef');
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe('randomTarget', () => {
  it('returns valid HSL in target ranges', () => {
    for (let i = 0; i < 50; i++) {
      const c: HSL = randomTarget();
      expect(c.h).toBeGreaterThanOrEqual(0);
      expect(c.h).toBeLessThan(360);
      expect(c.s).toBeGreaterThanOrEqual(10);
      expect(c.s).toBeLessThanOrEqual(100);
      expect(c.l).toBeGreaterThanOrEqual(15);
      expect(c.l).toBeLessThanOrEqual(85);
    }
  });
});
```

- [ ] **Step 2: Run tests — expect ALL FAIL** (module not found)

```bash
npx vitest run src/color.test.ts
```

- [ ] **Step 3: Generate the simple parts via steeLL-v1**

```bash
scripts/steeLL-v1-task.sh color-utils /tmp/color-utils.ts <<'EOF'
Write TypeScript helpers (NO scoreMatch yet). Use the `culori` npm package.

Export:
- type HSL = { h: number; s: number; l: number };  // h in [0,360), s and l in [0,100]
- type RGB = { r: number; g: number; b: number };  // each in [0,255]
- function hslToHex(c: HSL): string  // returns lowercase '#rrggbb'
- function hexToRgb(hex: string): RGB  // accepts '#rrggbb' or '#RRGGBB'
- function randomTarget(): HSL  // h uniform [0,360), s uniform [10,100], l uniform [15,85]

Hints:
- Use culori's `formatHex({ mode: 'hsl', h, s: s/100, l: l/100 })` for hslToHex.
- Parse the 6 hex chars manually for hexToRgb.

Output only the TypeScript file contents.
EOF
cat /tmp/color-utils.ts
```

Claude reviews and copies to `src/color.ts`, then appends `scoreMatch` below.

- [ ] **Step 4: Append `scoreMatch` to `src/color.ts`** (Claude)

```ts
import { differenceCiede2000, parse } from 'culori';

const deltaE = differenceCiede2000();

export function scoreMatch(targetHex: string, guessHex: string): number {
  const a = parse(targetHex);
  const b = parse(guessHex);
  if (!a || !b) return 0;
  const d = deltaE(a, b);
  const pct = 100 * (1 - d / 50);
  return Math.max(0, Math.min(100, Math.round(pct)));
}
```

Merge the culori imports with steeLL-v1's existing import at the top of the file.

- [ ] **Step 5: Run tests — expect ALL PASS**

```bash
npx vitest run src/color.test.ts
```
Expected: 11 tests pass. If the "moderately distant" test fails, the `/ 50` divisor in scoreMatch needs adjustment.

- [ ] **Step 6: Commit**

```bash
git add src/color.ts src/color.test.ts
git commit -m "$(cat <<'EOF'
feat: color math (HSL/hex conversions, ΔE2000 scoring, random target)

Co-Authored-By: steeLL-v1 <steeLL-v1@local.ai>
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Game state + localStorage — `src/state.ts` with TDD `[claude]`

**Files:**
- Create: `src/state.ts`
- Create: `src/state.test.ts`

- [ ] **Step 1: Write `src/state.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, recordRound, resetStats, updateSettings } from './state';

beforeEach(() => localStorage.clear());

describe('state', () => {
  it('fresh load returns defaults', () => {
    const s = loadState();
    expect(s.pb).toBe(0);
    expect(s.last10).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.settings.viewTimeMs).toBe(3000);
    expect(s.settings.haptics).toBe(true);
  });

  it('recordRound updates pb, last10, total', () => {
    recordRound(82);
    recordRound(91);
    const s = loadState();
    expect(s.pb).toBe(91);
    expect(s.last10).toEqual([82, 91]);
    expect(s.total).toBe(2);
  });

  it('last10 caps at 10 entries', () => {
    for (let i = 1; i <= 12; i++) recordRound(i * 5);
    const s = loadState();
    expect(s.last10).toHaveLength(10);
    expect(s.last10[0]).toBe(15);
    expect(s.last10[9]).toBe(60);
  });

  it('updateSettings persists', () => {
    updateSettings({ viewTimeMs: 1500, haptics: false });
    expect(loadState().settings).toEqual({ viewTimeMs: 1500, haptics: false });
  });

  it('resetStats clears everything', () => {
    recordRound(50);
    updateSettings({ viewTimeMs: 5000, haptics: false });
    resetStats();
    const s = loadState();
    expect(s.pb).toBe(0);
    expect(s.last10).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.settings.viewTimeMs).toBe(3000);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/state.test.ts
```

- [ ] **Step 3: Implement `src/state.ts`**

```ts
export type Settings = { viewTimeMs: number; haptics: boolean };
export type State = { pb: number; last10: number[]; total: number; settings: Settings };

const KEY_PB = 'mnemo:pb';
const KEY_LAST10 = 'mnemo:last10';
const KEY_TOTAL = 'mnemo:total';
const KEY_SETTINGS = 'mnemo:settings';

const DEFAULT_SETTINGS: Settings = { viewTimeMs: 3000, haptics: true };

function readInt(key: string, fallback: number): number {
  const v = localStorage.getItem(key);
  return v === null ? fallback : Number.parseInt(v, 10) || fallback;
}

function readJSON<T>(key: string, fallback: T): T {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

export function loadState(): State {
  return {
    pb: readInt(KEY_PB, 0),
    last10: readJSON<number[]>(KEY_LAST10, []),
    total: readInt(KEY_TOTAL, 0),
    settings: { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>(KEY_SETTINGS, {}) },
  };
}

export function recordRound(pct: number): void {
  const s = loadState();
  if (pct > s.pb) localStorage.setItem(KEY_PB, String(pct));
  const next = [...s.last10, pct].slice(-10);
  localStorage.setItem(KEY_LAST10, JSON.stringify(next));
  localStorage.setItem(KEY_TOTAL, String(s.total + 1));
}

export function updateSettings(patch: Partial<Settings>): void {
  const cur = loadState().settings;
  localStorage.setItem(KEY_SETTINGS, JSON.stringify({ ...cur, ...patch }));
}

export function resetStats(): void {
  ['mnemo:pb', 'mnemo:last10', 'mnemo:total', 'mnemo:settings'].forEach(k => localStorage.removeItem(k));
}

export function avgLast10(last10: number[]): number {
  if (last10.length === 0) return 0;
  return Math.round(last10.reduce((a, b) => a + b, 0) / last10.length);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/state.test.ts
```
Expected: 5 tests pass. If env errors, confirm `test: { environment: 'jsdom' }` is set in vite.config.ts (Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/state.ts src/state.test.ts
git commit -m "$(cat <<'EOF'
feat: game state with localStorage persistence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Countdown ring — `src/ui/countdown.ts` `[claude]`

**Files:**
- Create: `src/ui/countdown.ts`

- [ ] **Step 1: Implement**

```ts
// src/ui/countdown.ts
// Renders a thin paper-colored countdown ring inside `parent` that retracts
// over `durationMs` and calls `onDone` when finished. Returns a cleanup fn.

export function mountCountdown(
  parent: HTMLElement,
  durationMs: number,
  onDone: () => void
): () => void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '1');
  rect.setAttribute('y', '1');
  rect.setAttribute('width', '98');
  rect.setAttribute('height', '98');
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', 'var(--paper)');
  rect.setAttribute('stroke-width', '0.6');
  rect.setAttribute('vector-effect', 'non-scaling-stroke');
  rect.setAttribute('pathLength', '1000');
  rect.setAttribute('stroke-dasharray', '1000');
  rect.setAttribute('stroke-dashoffset', '0');
  rect.style.transition = `stroke-dashoffset ${durationMs}ms linear`;

  svg.appendChild(rect);
  parent.appendChild(svg);

  let raf = requestAnimationFrame(() => {
    rect.setAttribute('stroke-dashoffset', '1000');
  });

  const timer = window.setTimeout(onDone, durationMs);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    svg.remove();
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/countdown.ts
git commit -m "$(cat <<'EOF'
feat: edge-ring countdown component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Touch picker — `src/ui/picker.ts` `[claude]`

**Files:**
- Create: `src/ui/picker.ts`

- [ ] **Step 1: Implement**

```ts
// src/ui/picker.ts
// 2D pad (hue × saturation) + lightness slider. Updates the parent's background
// to the current HSL on every change. Calls onChange with hex string.

import type { HSL } from '../color';
import { hslToHex } from '../color';

export interface PickerHandle {
  getHex: () => string;
  getHSL: () => HSL;
  destroy: () => void;
}

export function mountPicker(
  parent: HTMLElement,
  initial: HSL,
  onChange: (hex: string) => void
): PickerHandle {
  const state: HSL = { ...initial };

  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:24px;gap:16px;padding-bottom:calc(24px + env(safe-area-inset-bottom));padding-top:calc(24px + env(safe-area-inset-top));';

  const pad = document.createElement('div');
  pad.className = 'glass';
  pad.style.cssText = 'flex:1;position:relative;touch-action:none;overflow:hidden;';
  const padCross = document.createElement('div');
  padCross.style.cssText = 'position:absolute;width:24px;height:24px;border:2px solid var(--paper);outline:1px solid var(--ink);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;';
  pad.appendChild(padCross);

  const slider = document.createElement('div');
  slider.className = 'glass';
  slider.style.cssText = 'height:64px;position:relative;touch-action:none;';
  const sliderThumb = document.createElement('div');
  sliderThumb.style.cssText = 'position:absolute;top:50%;width:36px;height:36px;border:2px solid var(--paper);outline:1px solid var(--ink);border-radius:50%;background:transparent;transform:translate(-50%,-50%);pointer-events:none;';
  slider.appendChild(sliderThumb);

  root.appendChild(pad);
  root.appendChild(slider);
  parent.appendChild(root);

  function render() {
    const hex = hslToHex(state);
    parent.style.background = hex;
    const padRect = pad.getBoundingClientRect();
    padCross.style.left = `${(state.h / 360) * padRect.width}px`;
    padCross.style.top = `${(1 - state.s / 100) * padRect.height}px`;
    const sRect = slider.getBoundingClientRect();
    sliderThumb.style.left = `${(state.l / 100) * sRect.width}px`;
    onChange(hex);
  }

  function attachDrag(el: HTMLElement, handler: (x: number, y: number, w: number, h: number) => void) {
    let activeId: number | null = null;
    const update = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      handler(x, y, rect.width, rect.height);
    };
    el.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      update(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId) return;
      update(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  attachDrag(pad, (x, y, w, h) => {
    state.h = (x / w) * 360;
    state.s = (1 - (y / h)) * 100;
    render();
  });
  attachDrag(slider, (x, _y, w) => {
    state.l = (x / w) * 100;
    render();
  });

  requestAnimationFrame(render);

  return {
    getHex: () => hslToHex(state),
    getHSL: () => ({ ...state }),
    destroy: () => root.remove(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/picker.ts
git commit -m "$(cat <<'EOF'
feat: touch color picker (2D pad + lightness slider)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Title scene `[steeLL-v1]`

**Files:**
- Create: `src/scenes/title.ts`

- [ ] **Step 1: Generate via steeLL-v1**

```bash
scripts/steeLL-v1-task.sh title-scene src/scenes/title.ts <<'EOF'
Write a TypeScript module for the title scene of a color-matching game.

Imports:
- import { loadState, updateSettings, avgLast10 } from '../state';

Export ONE function:
  export function mountTitle(root: HTMLElement, onPlay: () => void): () => void

Behavior:
- Clear root and set its background to var(--ink).
- Build inside root:
  - A centered column layout (flex column, justify-center, align-center, gap 32px, padding 24px).
  - <h1 class="wordmark"> with inner content: 'mnem' + <span class="o">o</span> + 'chr' + <span class="o">o</span> + 'me'
  - A 1px wide 80px-long horizontal line with background var(--mute).
  - A view-time slider section:
      label "view time" (uppercase, letter-spacing 0.1em, font-size 11px, color var(--mute))
      <input type="range" min="1.0" max="10.0" step="0.5"> initial value = loadState().settings.viewTimeMs / 1000
      Live readout "3.0s" next to slider.
      On input: updateSettings({ viewTimeMs: Math.round(value * 1000) }) and update readout.
  - A stats row: "BEST <pb>%" and "AVG10 <avg>%" (use avgLast10 from state); labels uppercase letter-spaced in var(--mute), values var(--paper).
  - A button class "btn-primary" reading "Tap to play". On click: onPlay().

Return cleanup that empties root.

TypeScript only, no commentary.
EOF
```

- [ ] **Step 2: Claude review** — verify imports, structure, slider state updates, onPlay wiring.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/title.ts
git commit -m "$(cat <<'EOF'
feat: title scene

Co-Authored-By: steeLL-v1 <steeLL-v1@local.ai>
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Reveal scene `[claude]`

**Files:**
- Create: `src/scenes/reveal.ts`

- [ ] **Step 1: Implement**

```ts
// src/scenes/reveal.ts
import { mountCountdown } from '../ui/countdown';
import { hslToHex, randomTarget, type HSL } from '../color';
import { loadState } from '../state';

export function mountReveal(
  root: HTMLElement,
  onDone: (target: HSL, targetHex: string) => void
): () => void {
  root.innerHTML = '';
  const target = randomTarget();
  const targetHex = hslToHex(target);
  root.style.background = targetHex;
  const cleanupCountdown = mountCountdown(
    root,
    loadState().settings.viewTimeMs,
    () => onDone(target, targetHex)
  );
  return () => {
    cleanupCountdown();
    root.innerHTML = '';
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/reveal.ts
git commit -m "$(cat <<'EOF'
feat: reveal scene with countdown

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Match scene `[claude]`

**Files:**
- Create: `src/scenes/match.ts`

- [ ] **Step 1: Implement**

```ts
// src/scenes/match.ts
import { mountPicker } from '../ui/picker';
import { loadState } from '../state';

export function mountMatch(
  root: HTMLElement,
  onLockIn: (guessHex: string) => void
): () => void {
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const picker = mountPicker(root, { h: 0, s: 0, l: 50 }, () => {});

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Lock In';
  btn.style.cssText = 'position:absolute;left:24px;right:24px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:10;';
  btn.addEventListener('click', () => {
    if (loadState().settings.haptics && 'vibrate' in navigator) navigator.vibrate(10);
    onLockIn(picker.getHex());
  });
  root.appendChild(btn);

  return () => {
    picker.destroy();
    btn.remove();
    root.innerHTML = '';
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/match.ts
git commit -m "$(cat <<'EOF'
feat: match scene composing picker + lock-in

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Grade scene `[claude]`

**Files:**
- Create: `src/scenes/grade.ts`

- [ ] **Step 1: Implement**

```ts
// src/scenes/grade.ts
import { scoreMatch } from '../color';
import { loadState, recordRound } from '../state';

export function mountGrade(
  root: HTMLElement,
  targetHex: string,
  guessHex: string,
  onNext: () => void
): () => void {
  root.innerHTML = '';
  const pct = scoreMatch(targetHex, guessHex);
  recordRound(pct);
  if (loadState().settings.haptics && 'vibrate' in navigator) navigator.vibrate(30);

  const top = document.createElement('div');
  top.style.cssText = `position:absolute;top:0;left:0;right:0;height:50%;background:${targetHex};`;
  const bot = document.createElement('div');
  bot.style.cssText = `position:absolute;bottom:0;left:0;right:0;height:50%;background:${guessHex};`;

  const card = document.createElement('div');
  card.className = 'glass';
  card.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:24px 40px;text-align:center;min-width:200px;';

  const num = document.createElement('div');
  num.style.cssText = "font-family:'Fraunces Variable',Georgia,serif;font-weight:400;font-size:96px;color:var(--paper);line-height:1;";
  num.textContent = '0%';
  card.appendChild(num);

  const next = document.createElement('button');
  next.className = 'btn-primary';
  next.textContent = 'Next';
  next.style.cssText = 'position:absolute;left:24px;right:24px;bottom:calc(24px + env(safe-area-inset-bottom));';
  next.addEventListener('click', onNext);

  const share = document.createElement('button');
  share.className = 'btn-ghost';
  share.textContent = 'Share';
  share.style.cssText = 'position:absolute;right:24px;top:calc(24px + env(safe-area-inset-top));';
  share.addEventListener('click', async () => {
    const text = `Mnemochrome — ${pct}% match (target ${targetHex} → guess ${guessHex})`;
    if ('share' in navigator) {
      try { await (navigator as any).share({ text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); } catch {}
    }
  });

  root.appendChild(top);
  root.appendChild(bot);
  root.appendChild(card);
  root.appendChild(next);
  root.appendChild(share);

  const start = performance.now();
  const DUR = 600;
  let raf = 0;
  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / DUR);
    const eased = 1 - Math.pow(1 - p, 3);
    num.textContent = `${Math.round(eased * pct)}%`;
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    root.innerHTML = '';
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/grade.ts
git commit -m "$(cat <<'EOF'
feat: grade scene with split target/guess + count-up

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Scene switcher in `src/main.ts` `[claude]`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace `src/main.ts` contents**

```ts
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles.css';
import { mountTitle } from './scenes/title';
import { mountReveal } from './scenes/reveal';
import { mountMatch } from './scenes/match';
import { mountGrade } from './scenes/grade';

const root = document.querySelector<HTMLDivElement>('#app')!;
let cleanup: () => void = () => {};
let isFirst = true;

function go(fn: () => () => void) {
  if (isFirst) {
    isFirst = false;
    cleanup = fn();
    return;
  }
  const old = cleanup;
  root.style.transition = 'opacity 100ms linear';
  root.style.opacity = '0';
  setTimeout(() => {
    old();
    cleanup = fn();
    root.style.transition = 'none';
    root.style.opacity = '0';
    requestAnimationFrame(() => {
      root.style.transition = 'opacity 100ms linear';
      root.style.opacity = '1';
    });
  }, 100);
}

function title() { go(() => mountTitle(root, () => reveal())); }
function reveal() { go(() => mountReveal(root, (_t, targetHex) => match(targetHex))); }
function match(targetHex: string) { go(() => mountMatch(root, (guess) => grade(targetHex, guess))); }
function grade(targetHex: string, guess: string) { go(() => mountGrade(root, targetHex, guess, () => reveal())); }

title();
```

- [ ] **Step 2: Run dev server and walk the full loop**

```bash
npm run dev
```
Phone playtest. One full round.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "$(cat <<'EOF'
feat: scene switcher and full game loop

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Icon source SVG `[claude]`

**Files:**
- Create: `public/icons/source.svg`

- [ ] **Step 1: Write**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0E0E10"/>
  <rect x="156" y="156" width="240" height="240" rx="8" fill="#C2185B" fill-opacity="0.35"/>
  <rect x="116" y="116" width="240" height="240" rx="8" fill="#C2185B"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add public/icons/source.svg
git commit -m "$(cat <<'EOF'
feat: app icon source SVG (offset afterimage motif)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Icon build script `[steeLL-v1]`

**Files:**
- Create: `scripts/build-icons.mjs`

- [ ] **Step 1: Generate via steeLL-v1**

```bash
scripts/steeLL-v1-task.sh build-icons scripts/build-icons.mjs <<'EOF'
Write a Node.js ESM script that:
1. Reads public/icons/source.svg as a Buffer.
2. Uses `sharp` to produce PNGs into public/icons/:
   - icon-192.png (192x192)
   - icon-512.png (512x512)
   - icon-512-maskable.png (512x512, same source — already maskable-safe)
   - apple-touch-icon.png (180x180)
   - favicon-32.png (32x32)
   - favicon-16.png (16x16)
3. Uses `import sharp from 'sharp'` and `import { readFileSync } from 'node:fs'`.
4. Logs each generated path.
5. Awaits each .toFile().

Output the .mjs file contents only.
EOF
```

- [ ] **Step 2: Claude review** — verify it awaits each .toFile() and paths are correct.

- [ ] **Step 3: Add to build script**

Edit `package.json` `build` script to: `"build": "node scripts/build-icons.mjs && tsc -b && vite build"`

- [ ] **Step 4: Run**

```bash
node scripts/build-icons.mjs
ls public/icons/
```
Expected: 6 PNGs plus source.svg.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-icons.mjs public/icons/*.png package.json
git commit -m "$(cat <<'EOF'
feat: icon build script (sharp-based PNG generation)

Co-Authored-By: steeLL-v1 <steeLL-v1@local.ai>
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: PWA manifest + service worker `[claude]`

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Update `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/mnemochrome/',
  server: { host: '0.0.0.0', port: 5173 },
  test: { environment: 'jsdom' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'Mnemochrome',
        short_name: 'Mnemochrome',
        description: 'See a color, then summon it back.',
        theme_color: '#0E0E10',
        background_color: '#0E0E10',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/mnemochrome/',
        start_url: '/mnemochrome/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
});
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: build completes; `dist/manifest.webmanifest` and `dist/sw.js` exist.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "$(cat <<'EOF'
feat: PWA manifest + service worker via vite-plugin-pwa

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: GitHub Actions Pages workflow `[claude]`

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
ci: GitHub Pages deploy workflow

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: README `[steeLL-v1]`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Generate via steeLL-v1**

```bash
scripts/steeLL-v1-task.sh readme README.md <<'EOF'
Write README.md for a project called "Mnemochrome".

Sections:
- # Mnemochrome
- Tagline: "See a color, then summon it back."
- ## About — 2 short paragraphs: mobile-first PWA color-memory game. Target color shown briefly; touch picker to match. Scored on perceptual color distance (ΔE2000).
- ## Play — "https://nickcason.github.io/mnemochrome/"
- ## Local development:
  ```
  npm install
  npm run dev
  ```
  Note the dev server binds 0.0.0.0:5173.
- ## Tech: Vite, TypeScript, vite-plugin-pwa, culori, sharp.
- ## Co-authorship: small/well-scoped tasks were generated by steeLL-v1 (qwen2.5-coder:7b via Ollama) with Claude review.
- ## License: MIT

Markdown only.
EOF
```

- [ ] **Step 2: Claude review** — check tone, links, structure.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: README

Co-Authored-By: steeLL-v1 <steeLL-v1@local.ai>
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Create + push public repo + enable Pages `[claude]`

- [ ] **Step 1: Confirm `.gitignore` covers everything**

```
node_modules/
dist/
*.log
.DS_Store
.superpowers/
```

- [ ] **Step 2: Create public repo and push**

```bash
gh repo create nickcason/mnemochrome --public --source=. --remote=origin --description "Mobile color-memory game. See it, then summon it back." --push
```

- [ ] **Step 3: Enable Pages with Actions source**

```bash
gh api -X POST repos/nickcason/mnemochrome/pages -f build_type=workflow 2>&1 || \
  gh api -X PUT repos/nickcason/mnemochrome/pages -f build_type=workflow
```

- [ ] **Step 4: Watch first deploy**

```bash
gh run watch
```
Site live at https://nickcason.github.io/mnemochrome/.

---

## Task 19: Phone playtest over Tailscale `[claude]`

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Share URL**

`http://nicks-macbook-air.taild99f50.ts.net:5173`

Three full rounds. Verify:
- Picker drag feels responsive
- Background fills with target during reveal, countdown ring retracts
- Lock In transitions to grade with correct percentage
- Stats update on title screen
- View-time slider respected on next round

- [ ] **Step 3: File follow-up tasks for any rough edges; otherwise close out.**

---

## Notes for the executor

- Run `npx vitest run` after Tasks 4 and 5; both pass before continuing.
- After Task 12, the game is playable end-to-end. 13–19 are deploy/polish.
- For every `[steeLL-v1]` task, Claude reads the generated file before committing and edits if defective.
- If `http://100.122.121.18:11434` is unreachable: `ssh node8 'sudo systemctl restart ollama'`, then retry.
- Don't skip TDD on `src/color.ts` and `src/state.ts` — correctness-critical.
