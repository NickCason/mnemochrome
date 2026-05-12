# Animated Splash Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-shot ink → random hue → ink animated splash on cold launch only, seamlessly handing the wordmark element off to the title scene.

**Architecture:** A new `src/scenes/splash.ts` module owns a pure hue picker, a reduced-motion check, and an rAF-driven timeline (wash-in / hold / wash-out). `src/main.ts` gates the splash to first cold mount via a module flag and bypasses it under `prefers-reduced-motion: reduce`. `src/scenes/title.ts` gains optional params (`skipEntrance`, `existingWordmark`) so it can adopt the splash's wordmark element without re-animating it.

**Tech Stack:** TypeScript, Vite, `requestAnimationFrame`, CSS transitions, Vitest + jsdom for unit tests.

## File Structure

- **Create:** `src/scenes/splash.ts` — splash scene, hue picker, reduced-motion helper
- **Create:** `src/scenes/splash.test.ts` — unit tests for the pure helpers
- **Modify:** `src/scenes/title.ts` — `mountTitle` accepts options for skipEntrance + existingWordmark
- **Modify:** `src/main.ts` — gate splash on first cold mount, bypass for reduced motion
- **Modify:** `src/styles.css` — `.splash-root` rules

Splash is a **one-shot** scene with a non-standard lifecycle (no cleanup function — it self-tears-down and calls a continuation). It does not conform to the `mountX(root, onNext)` pattern of the other scenes; this is intentional and limited to splash.

---

## Task 1: Hue picker pure function

**Files:**
- Create: `src/scenes/splash.ts`
- Test: `src/scenes/splash.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/scenes/splash.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pickSplashHsl } from './splash';

describe('pickSplashHsl', () => {
  it('never produces a hue in the magenta exclusion band [300, 340]', () => {
    for (let i = 0; i < 2000; i++) {
      const { h } = pickSplashHsl();
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(h < 300 || h > 340).toBe(true);
    }
  });

  it('saturation falls in [70, 80]', () => {
    for (let i = 0; i < 500; i++) {
      const { s } = pickSplashHsl();
      expect(s).toBeGreaterThanOrEqual(70);
      expect(s).toBeLessThanOrEqual(80);
    }
  });

  it('lightness falls in [50, 55]', () => {
    for (let i = 0; i < 500; i++) {
      const { l } = pickSplashHsl();
      expect(l).toBeGreaterThanOrEqual(50);
      expect(l).toBeLessThanOrEqual(55);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/splash.test.ts`
Expected: FAIL — cannot import `pickSplashHsl` (module doesn't exist).

- [ ] **Step 3: Implement the picker**

Create `src/scenes/splash.ts`:

```typescript
// src/scenes/splash.ts
// One-shot animated splash that plays on cold launch. Picks a random
// saturated hue, washes it in over ink, holds the wordmark, washes
// back out to ink, then hands the wordmark element off to title.

import type { HSL } from '../color';

/**
 * Pick the HSL for the splash wash. Hue is uniform random in [0, 360)
 * excluding [300, 340] so the magenta-tinted o's in the wordmark always
 * have contrast against the wash. Saturation 70-80%, lightness 50-55%.
 */
export function pickSplashHsl(): HSL {
  // Generate hue, rejecting the exclusion band.
  let h: number;
  do {
    h = Math.random() * 360;
  } while (h >= 300 && h <= 340);
  const s = 70 + Math.random() * 10;
  const l = 50 + Math.random() * 5;
  return { h, s, l };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scenes/splash.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/splash.ts src/scenes/splash.test.ts
git commit -m "feat(splash): pickSplashHsl with magenta-exclusion + sat/light bounds"
```

---

## Task 2: Reduced-motion helper

**Files:**
- Modify: `src/scenes/splash.ts`
- Test: `src/scenes/splash.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/scenes/splash.test.ts`:

```typescript
import { shouldSkipSplash } from './splash';

describe('shouldSkipSplash', () => {
  const setMatchMedia = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches,
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  };

  it('returns true when prefers-reduced-motion: reduce matches', () => {
    setMatchMedia(true);
    expect(shouldSkipSplash()).toBe(true);
  });

  it('returns false when prefers-reduced-motion does not match', () => {
    setMatchMedia(false);
    expect(shouldSkipSplash()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/splash.test.ts`
Expected: FAIL — `shouldSkipSplash` not exported.

- [ ] **Step 3: Implement the helper**

Append to `src/scenes/splash.ts`:

```typescript
/**
 * Splash is bypassed entirely under OS-level Reduce Motion. The goal of
 * splash is brand/polish, both of which yield to user preference.
 */
export function shouldSkipSplash(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scenes/splash.test.ts`
Expected: PASS (5 tests total now).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/splash.ts src/scenes/splash.test.ts
git commit -m "feat(splash): shouldSkipSplash respects prefers-reduced-motion"
```

---

## Task 3: Splash CSS skeleton

**Files:**
- Modify: `src/styles.css`

This task is CSS-only — no test. Visual verification later.

- [ ] **Step 1: Add splash CSS block**

Append to `src/styles.css` (after the existing `.wordmark` rules; find a sensible spot near the wordmark/transition section):

```css
/* ============================================================
   Splash screen — one-shot cold-launch animation. Wraps the
   wordmark in a full-viewport panel that washes from ink to a
   random saturated hue and back to ink, then hands the wordmark
   element off to the title scene without re-animating it.
   ============================================================ */
.splash-root {
  position: fixed;
  inset: 0;
  background: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  /* No baked transition — splash.ts sets element.style.transition
     per phase (ease-out 300ms wash-in, ease-in 400ms wash-out) so
     timing stays authoritative in one place. */
}

.splash-root .wordmark {
  /* Shares typography with title; only the legibility shadow is
     splash-specific. */
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.25),
    0 0 1px rgba(0, 0, 0, 0.4);
  transition: text-shadow 400ms ease;
  opacity: 0;
  transition-property: text-shadow, opacity;
  transition-duration: 400ms;
}

.splash-root.is-visible .wordmark {
  opacity: 1;
}

.splash-root.is-washing-out .wordmark {
  text-shadow: none;
}

/* O-glow one-shot pulse (added/removed by splash.ts at T~600ms). */
.splash-root .wordmark .o.o-splash-pulse {
  animation: splashOPulse 250ms ease-out;
}
@keyframes splashOPulse {
  0%   { text-shadow: 0 0 0 var(--accent); }
  50%  { text-shadow: 0 0 14px var(--accent); }
  100% { text-shadow: 0 0 0 var(--accent); }
}

/* Reduce-motion already bypasses splash in JS, but if .splash-root
   ever ends up rendered under reduce, kill its motion. */
@media (prefers-reduced-motion: reduce) {
  .splash-root,
  .splash-root .wordmark,
  .splash-root .wordmark .o.o-splash-pulse {
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "style(splash): .splash-root scaffolding + o-pulse keyframe"
```

---

## Task 4: Splash scene — DOM mount + timeline driver

**Files:**
- Modify: `src/scenes/splash.ts`

This task adds the splash scene function. No unit test for the DOM/timing — it's animation, verified on device. Logic that's testable (the hue picker, reduce-motion check) was covered in tasks 1–2.

- [ ] **Step 1: Add SplashOptions type and the splash function**

Append to `src/scenes/splash.ts`:

```typescript
import { hslToHex } from '../color';

export interface SplashOptions {
  /**
   * Called when the splash timeline ends. Receives the wordmark element,
   * already detached from the splash DOM and ready to be re-parented
   * into the title scene. The splash-root has already been removed.
   */
  onComplete: (wordmarkEl: HTMLElement) => void;
}

const WORDMARK_TEXT = 'mnemochrome';
const O_INDICES = new Set([4, 8]);

// Timeline (all ms from T=0).
const WASH_IN_START = 0;
const WASH_IN_DUR = 300;
const WORDMARK_IN_START = 150;
const WORDMARK_IN_DUR = 300;
const O_PULSE_START = 600;
const WASH_OUT_START = 950;
const WASH_OUT_DUR = 400;
const TOTAL_DUR = WASH_OUT_START + WASH_OUT_DUR; // 1350

/**
 * Mount the splash scene on `root` and run its timeline once. When the
 * timeline ends, the wordmark element is detached and passed to
 * opts.onComplete; the splash-root is removed from the DOM.
 *
 * Splash does not return a cleanup function — it owns its full lifecycle
 * and tears itself down. The continuation (mounting title) happens via
 * opts.onComplete.
 */
export function splash(root: HTMLElement, opts: SplashOptions): void {
  // Clear root so splash owns the viewport for its duration.
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const panel = document.createElement('div');
  panel.className = 'splash-root';

  // Build the wordmark with the same structure title uses so it's a
  // drop-in handoff. Spans are pre-settled (opacity 1, translateY 0,
  // animation none) so they don't snap to base state on re-parent.
  const wordmark = document.createElement('h1');
  wordmark.className = 'wordmark';
  [...WORDMARK_TEXT].forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch;
    if (O_INDICES.has(i)) span.classList.add('o');
    span.style.opacity = '1';
    span.style.transform = 'translateY(0)';
    span.style.animation = 'none';
    wordmark.appendChild(span);
  });
  panel.appendChild(wordmark);
  root.appendChild(panel);

  // Pick wash color.
  const targetHsl = pickSplashHsl();
  const targetHex = hslToHex(targetHsl);

  // Force a frame so transitions on `.is-visible` etc. actually animate.
  // (Without this, adding the class on the same tick as appendChild may
  // skip the transition.)
  requestAnimationFrame(() => {
    // Phase 1: wash-in (bg ink → hue).
    panel.style.transition = `background-color ${WASH_IN_DUR}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    panel.style.background = targetHex;

    // Wordmark fade-in starts WORDMARK_IN_START ms after splash mount,
    // overlapping the wash for smoothness.
    setTimeout(() => {
      panel.classList.add('is-visible');
    }, WORDMARK_IN_START);

    // O-pulse one-shot during the hold phase.
    setTimeout(() => {
      wordmark.querySelectorAll<HTMLElement>('.o').forEach((el) => {
        el.classList.add('o-splash-pulse');
      });
    }, O_PULSE_START);

    // Phase 3: wash-out (bg hue → ink, drop-shadow → none).
    setTimeout(() => {
      panel.style.transition = `background-color ${WASH_OUT_DUR}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      panel.style.background = 'var(--ink)';
      panel.classList.add('is-washing-out');
    }, WASH_OUT_START);

    // End of timeline: detach wordmark, remove panel, call onComplete.
    setTimeout(() => {
      wordmark.remove(); // detach from splash-root (keeps it alive)
      panel.remove();
      opts.onComplete(wordmark);
    }, TOTAL_DUR);
  });
}
```

- [ ] **Step 2: Verify tests still pass**

Run: `npx vitest run src/scenes/splash.test.ts`
Expected: PASS (5 tests). The new `splash()` function isn't unit-tested directly.

- [ ] **Step 3: Quick TypeScript sanity check**

Run: `npx vite build` (or `npx tsc --noEmit` if available)
Expected: no type errors. Fix any import issues if they appear.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/splash.ts
git commit -m "feat(splash): scene function + rAF/setTimeout timeline"
```

---

## Task 5: title.ts — skipEntrance + existingWordmark options

**Files:**
- Modify: `src/scenes/title.ts`

- [ ] **Step 1: Update the export signature and add option handling**

Edit `src/scenes/title.ts`. Change `mountTitle` signature and the wordmark-construction block:

Find this block near line 17–47:

```typescript
export function mountTitle(root: HTMLElement, onPlay: () => void): () => void {
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const { pb, last10, settings } = loadState();
  const avg = avgLast10(last10);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const col = document.createElement('div');
  col.style.cssText = ...

  // Wordmark block (wordmark + hue strip)
  const header = document.createElement('div');
  header.style.cssText = ...

  // Build the wordmark as individual <span> letters so each can carry its
  // own staggered entrance animation. The two o's get a `.o` class for the
  // magenta tint and the post-entrance breath cycle.
  const wordmark = document.createElement('h1');
  wordmark.className = 'wordmark';
  const letterSpans: HTMLSpanElement[] = [];
  [...WORDMARK_TEXT].forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch;
    if (O_INDICES.has(i)) span.classList.add('o');
    span.style.animationDelay = `${i * LETTER_STAGGER_MS}ms`;
    letterSpans.push(span);
    wordmark.appendChild(span);
  });
```

Replace with:

```typescript
export interface TitleOptions {
  /** Skip the wordmark letter-entrance animation; spans start settled. */
  skipEntrance?: boolean;
  /** Adopt an existing wordmark element (from splash) instead of building a new one. */
  existingWordmark?: HTMLElement;
}

export function mountTitle(
  root: HTMLElement,
  onPlay: () => void,
  opts: TitleOptions = {},
): () => void {
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const { pb, last10, settings } = loadState();
  const avg = avgLast10(last10);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const col = document.createElement('div');
  col.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:36px;padding:48px 28px;padding-top:calc(48px + env(safe-area-inset-top));padding-bottom:calc(48px + env(safe-area-inset-bottom));';

  // Wordmark block (wordmark + hue strip)
  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:18px;';

  // Wordmark: either adopt one passed in (from splash) or build fresh.
  // When adopting, ensure spans are in their settled state so they don't
  // snap back to the base CSS (.wordmark span: opacity:0; translateY(8px)).
  let wordmark: HTMLElement;
  let letterSpans: HTMLSpanElement[];
  if (opts.existingWordmark) {
    wordmark = opts.existingWordmark;
    letterSpans = Array.from(
      wordmark.querySelectorAll<HTMLSpanElement>('span'),
    );
  } else {
    wordmark = document.createElement('h1');
    wordmark.className = 'wordmark';
    letterSpans = [];
    [...WORDMARK_TEXT].forEach((ch, i) => {
      const span = document.createElement('span');
      span.textContent = ch;
      if (O_INDICES.has(i)) span.classList.add('o');
      if (opts.skipEntrance) {
        // Settle the span immediately, no entrance keyframe.
        span.style.opacity = '1';
        span.style.transform = 'translateY(0)';
        span.style.animation = 'none';
      } else {
        span.style.animationDelay = `${i * LETTER_STAGGER_MS}ms`;
      }
      letterSpans.push(span);
      wordmark.appendChild(span);
    });
  }
```

- [ ] **Step 2: Verify the rest of title.ts still works**

The rest of title.ts (header, statsCard, slider, button, breath scheduling, stat count-up) does not need to change. Read through to confirm `letterSpans` is used the same way for breath scheduling — it is (line 165–173 in the original).

One caveat: the breath cycle's setTimeout delay is `i * LETTER_STAGGER_MS + LETTER_ENTRANCE_MS` (= 600ms for the first o, 800ms for the second). When `skipEntrance` is true, the entrance never played — we want breath to start sooner. Add this guard before the breath scheduling block (replace the existing block around line 165–173):

```typescript
  const breathStartDelay = (i: number) =>
    opts.skipEntrance ? 0 : i * LETTER_STAGGER_MS + LETTER_ENTRANCE_MS;

  letterSpans.forEach((span, i) => {
    if (!O_INDICES.has(i)) return;
    timers.push(
      window.setTimeout(() => span.classList.add('o-breath'), breathStartDelay(i)),
    );
  });
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: all 49 prior tests still pass. (No new tests for this task — the change is type-narrowing + a behavioral option.)

- [ ] **Step 4: Commit**

```bash
git add src/scenes/title.ts
git commit -m "feat(title): mountTitle accepts skipEntrance + existingWordmark options"
```

---

## Task 6: main.ts — splash gate on first cold mount

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import splash and add the gate**

Edit `src/main.ts`. Add to imports:

```typescript
import { splash, shouldSkipSplash } from './scenes/splash';
```

Replace the bottom-of-file `title()` call (line 94 in the current file) with:

```typescript
// First-mount routing: cold launch runs the splash unless the user
// has Reduce Motion enabled, in which case title mounts directly.
if (shouldSkipSplash()) {
  title();
} else {
  splash(root, {
    onComplete: (wordmarkEl) => {
      isFirst = true; // ensure go() takes the direct-mount branch
      go(() =>
        mountTitle(
          root,
          () => goReveal('first'),
          { skipEntrance: true, existingWordmark: wordmarkEl },
        ),
      );
    },
  });
}
```

Note: `isFirst` is already `true` at module init, but splash clears `root` and mounts/unmounts content during its run. We re-assert `isFirst = true` so `go()` takes the direct-mount branch (no transition) when title arrives via splash.

The existing `title()` function (line 57–59) stays as-is — it's used when grade routes back to title via `goReveal('grade')`, which doesn't go through this branch.

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: all 49 tests still pass.

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: build succeeds, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(main): route first cold mount through splash, bypass for reduce-motion"
```

---

## Task 7: Manual device verification on tailnet

**Files:** none modified. This task is verification only.

- [ ] **Step 1: Start dev server bound to tailnet**

Run (in a separate terminal or as a background process):

```bash
npm run dev -- --host 0.0.0.0
```

Confirm output shows the server listening on `0.0.0.0:5173` (or whatever port Vite picks).

- [ ] **Step 2: Get the tailnet URL**

Run:

```bash
TAILNET_HOST=$(tailscale status --self --json | python3 -c "import json,sys; print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))")
echo "http://${TAILNET_HOST}:5173/mnemochrome/"
```

Expected: `http://nicks-macbook-air.taild99f50.ts.net:5173/mnemochrome/` (or similar).

- [ ] **Step 3: msgme the URL to Nick's phone for testing**

```bash
source ~/.zshrc 2>/dev/null
curl -s \
  --form-string "token=$PUSHOVER_TOKEN" \
  --form-string "user=$PUSHOVER_USER" \
  --form-string "title=Splash dev preview" \
  --form-string "message=Cold-reload to test the splash sequence" \
  --form-string "url=http://${TAILNET_HOST}:5173/mnemochrome/" \
  --form-string "url_title=Open dev preview" \
  --form-string "sound=magic" \
  https://api.pushover.net/1/messages.json
```

Expected: `{"status":1,...}`. If the env vars aren't loaded, inline them explicitly (see the mobile-dev-mode skill for the pattern).

- [ ] **Step 4: Verify on device**

Acceptance checklist (Nick verifies on iPhone via the msgme'd URL):

- Cold-launch (hard refresh) shows the splash for ~1.4s.
- Background washes from dark → random saturated color → dark.
- Wordmark fades in, hue is not in the magenta-clash band.
- Magenta o's emit a single soft glow during the hold phase.
- After splash, the wordmark is visibly in the **same position** on the title screen — no second entrance animation, no jump.
- After playing a round, returning to title via `washBloomTransition` does NOT replay splash.
- With iOS Settings → Accessibility → Motion → Reduce Motion ON, splash is skipped entirely and title mounts on ink immediately.

- [ ] **Step 5: Commit & push**

```bash
git push origin main
```

Per the "always push to GitHub" rule, this happens automatically after the last code commit. The background `gh run watch` from mobile-dev-mode will fire msgme on CI completion.

---

## Self-review checklist (already run by plan author)

- [x] **Spec coverage:** All goals, timeline phases, color logic, handoff behavior, and edge cases from the spec map to tasks 1–7.
- [x] **Placeholder scan:** No TBD / TODO / "implement later" / vague "add error handling". Every code block is complete.
- [x] **Type consistency:** `SplashOptions.onComplete: (wordmarkEl: HTMLElement) => void` is used identically in tasks 4 and 6. `TitleOptions { skipEntrance, existingWordmark }` is consistent in tasks 5 and 6. `pickSplashHsl()` returns `HSL` (from `../color`) — matches existing project type.
- [x] **iOS PWA launch image:** explicitly out of scope per spec; not in any task.
