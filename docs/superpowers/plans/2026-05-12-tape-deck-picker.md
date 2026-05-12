# Tape Deck Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mnemochrome's 2D pad + slider color picker with a three-tape (H/S/L) vertical picker that has zero finger occlusion, a magnifier bubble, velocity-aware drag, tap-to-step, and haptic detents.

**Architecture:** New folder `src/ui/picker/` with five focused files (`index`, `tape`, `magnifier`, `render`, `haptics`). Pure functions in `render.ts` and the pure logic in `tape.ts` (velocity scaling, value normalization, tap detection) are unit-tested via Vitest. The public `PickerHandle` from `src/ui/picker.ts` is preserved so `match.ts` does not change. Old `src/ui/picker.ts` is deleted as part of Task 5.

**Tech Stack:** TypeScript, Vite, Vitest (jsdom), vanilla DOM + CSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-tape-deck-picker-design.md`

---

## File Map

| File | Responsibility | Created in |
|------|----------------|------------|
| `src/ui/picker/haptics.ts` | `createHaptics(isEnabled)` → `{tick, tickStrong, tickFirm}` wrapping `navigator.vibrate`. | Task 1 |
| `src/ui/picker/haptics.test.ts` | Vitest: gate by isEnabled; no-throw when `vibrate` absent. | Task 1 |
| `src/ui/picker/render.ts` | Pure functions returning CSS `hsl(...)` strings for tape preview slices, with the render-only clamps from the spec. | Task 2 |
| `src/ui/picker/render.test.ts` | Vitest: clamp behavior at extremes; selection-slot is unclamped. | Task 2 |
| `src/ui/picker/magnifier.ts` | `createMagnifier(parent)` → `{update, hide, destroy}`. 96px DOM bubble lifted 60px above touch. | Task 3 |
| `src/ui/picker/tape.ts` | `createTape(opts)` plus exported pure helpers (`velocityScale`, `dragToValueDelta`, `normalizeValue`, `isTap`). Handles drag/tap/inertia, haptic ticks, slot colors. | Task 4 |
| `src/ui/picker/tape.test.ts` | Vitest: velocity scale curve; drag-to-value math; normalize wrap/clamp; tap detection. | Task 4 |
| `src/ui/picker/index.ts` | `mountPicker(parent, initial, onChange)` — composes swatch + readout + three tapes; returns existing `PickerHandle`. | Task 5 |
| `src/ui/picker.ts` | **Deleted** in Task 5 (replaced by the directory). | Task 5 |

`src/scenes/match.ts` does **not** change — same import path resolves to `picker/index.ts` after deletion.

---

## Task 1: Haptics module

**Files:**
- Create: `src/ui/picker/haptics.ts`
- Create: `src/ui/picker/haptics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/picker/haptics.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createHaptics } from './haptics';

describe('createHaptics', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  const origVibrate = (navigator as Navigator & { vibrate?: unknown }).vibrate;

  beforeEach(() => {
    vibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
  });

  afterEach(() => {
    if (origVibrate === undefined) {
      delete (navigator as Navigator & { vibrate?: unknown }).vibrate;
    } else {
      Object.defineProperty(navigator, 'vibrate', { value: origVibrate, configurable: true, writable: true });
    }
  });

  it('tick() vibrates 8ms when enabled', () => {
    const h = createHaptics(() => true);
    h.tick();
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('tickStrong() vibrates 16ms when enabled', () => {
    const h = createHaptics(() => true);
    h.tickStrong();
    expect(vibrate).toHaveBeenCalledWith(16);
  });

  it('tickFirm() vibrates 24ms when enabled', () => {
    const h = createHaptics(() => true);
    h.tickFirm();
    expect(vibrate).toHaveBeenCalledWith(24);
  });

  it('does not vibrate when disabled', () => {
    const h = createHaptics(() => false);
    h.tick();
    h.tickStrong();
    h.tickFirm();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not throw when navigator.vibrate is undefined', () => {
    delete (navigator as Navigator & { vibrate?: unknown }).vibrate;
    const h = createHaptics(() => true);
    expect(() => { h.tick(); h.tickStrong(); h.tickFirm(); }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/picker/haptics.test.ts`
Expected: FAIL with module not found for `./haptics`.

- [ ] **Step 3: Implement haptics.ts**

Create `src/ui/picker/haptics.ts`:

```ts
export interface HapticsHandle {
  tick: () => void;
  tickStrong: () => void;
  tickFirm: () => void;
}

function safeVibrate(ms: number): void {
  if (typeof navigator === 'undefined') return;
  const v = (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate;
  if (typeof v !== 'function') return;
  try { v.call(navigator, ms); } catch { /* no-op */ }
}

export function createHaptics(isEnabled: () => boolean): HapticsHandle {
  return {
    tick:       () => { if (isEnabled()) safeVibrate(8); },
    tickStrong: () => { if (isEnabled()) safeVibrate(16); },
    tickFirm:   () => { if (isEnabled()) safeVibrate(24); },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/picker/haptics.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/picker/haptics.ts src/ui/picker/haptics.test.ts
git commit -m "feat(picker): haptics module with isEnabled gate"
```

---

## Task 2: Render module (pure preview slices)

**Files:**
- Create: `src/ui/picker/render.ts`
- Create: `src/ui/picker/render.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/picker/render.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
  trueColor,
} from './render';

describe('huePreviewSlice', () => {
  it('passes through s and l when both in safe range', () => {
    expect(huePreviewSlice(180, 60, 50)).toBe('hsl(180, 60%, 50%)');
  });

  it('clamps s up to 40 when actual s < 40 (so hue is visible)', () => {
    expect(huePreviewSlice(180, 0, 50)).toBe('hsl(180, 40%, 50%)');
    expect(huePreviewSlice(180, 39, 50)).toBe('hsl(180, 40%, 50%)');
  });

  it('clamps l into [40, 60] for hue tape rendering', () => {
    expect(huePreviewSlice(180, 70, 10)).toBe('hsl(180, 70%, 40%)');
    expect(huePreviewSlice(180, 70, 90)).toBe('hsl(180, 70%, 60%)');
  });
});

describe('satPreviewSlice', () => {
  it('passes through h and s', () => {
    expect(satPreviewSlice(50, 200, 50)).toBe('hsl(200, 50%, 50%)');
  });

  it('clamps l into [40, 60] for sat tape rendering', () => {
    expect(satPreviewSlice(50, 200, 10)).toBe('hsl(200, 50%, 40%)');
    expect(satPreviewSlice(50, 200, 95)).toBe('hsl(200, 50%, 60%)');
  });
});

describe('lightPreviewSlice', () => {
  it('passes all three values through unclamped', () => {
    expect(lightPreviewSlice(0, 200, 60)).toBe('hsl(200, 60%, 0%)');
    expect(lightPreviewSlice(50, 200, 60)).toBe('hsl(200, 60%, 50%)');
    expect(lightPreviewSlice(100, 200, 60)).toBe('hsl(200, 60%, 100%)');
  });
});

describe('trueColor', () => {
  it('returns the unclamped hsl string for the actual state', () => {
    expect(trueColor({ h: 200, s: 0, l: 10 })).toBe('hsl(200, 0%, 10%)');
    expect(trueColor({ h: 359, s: 100, l: 50 })).toBe('hsl(359, 100%, 50%)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/picker/render.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement render.ts**

Create `src/ui/picker/render.ts`:

```ts
import type { HSL } from '../../color';

const MIN_S_FOR_HUE = 40;
const MIN_L_FOR_PREVIEW = 40;
const MAX_L_FOR_PREVIEW = 60;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function huePreviewSlice(h: number, s: number, l: number): string {
  const renderS = Math.max(s, MIN_S_FOR_HUE);
  const renderL = clamp(l, MIN_L_FOR_PREVIEW, MAX_L_FOR_PREVIEW);
  return `hsl(${h}, ${renderS}%, ${renderL}%)`;
}

export function satPreviewSlice(s: number, h: number, l: number): string {
  const renderL = clamp(l, MIN_L_FOR_PREVIEW, MAX_L_FOR_PREVIEW);
  return `hsl(${h}, ${s}%, ${renderL}%)`;
}

export function lightPreviewSlice(l: number, h: number, s: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function trueColor(state: HSL): string {
  return `hsl(${state.h}, ${state.s}%, ${state.l}%)`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/picker/render.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/picker/render.ts src/ui/picker/render.test.ts
git commit -m "feat(picker): render module — pure preview slices with degenerate-state clamps"
```

---

## Task 3: Magnifier module

**Files:**
- Create: `src/ui/picker/magnifier.ts`

No unit tests — the magnifier is DOM positioning and visual styling, covered by manual verification in Task 6.

- [ ] **Step 1: Implement magnifier.ts**

Create `src/ui/picker/magnifier.ts`:

```ts
import type { HSL } from '../../color';
import { huePreviewSlice, satPreviewSlice, lightPreviewSlice } from './render';

const SIZE = 96;
const OFFSET_ABOVE = 60;
const EDGE_PAD = 8;
export type MagnifierAxis = 'h' | 's' | 'l';

export interface MagnifierHandle {
  /** Show / re-position / re-render in one call. Idempotent. */
  update: (x: number, y: number, value: number, axis: MagnifierAxis, state: HSL) => void;
  hide: () => void;
  destroy: () => void;
}

export function createMagnifier(parent: HTMLElement): MagnifierHandle {
  const bubble = document.createElement('div');
  bubble.style.cssText = [
    'position:absolute',
    `width:${SIZE}px`,
    `height:${SIZE}px`,
    'border-radius:50%',
    'background:var(--ink, #0E0E10)',
    'border:2px solid rgba(236, 230, 218, 0.45)',
    'box-shadow:0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.6)',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 120ms ease',
    'z-index:50',
    'overflow:hidden',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:4px',
    'left:0',
    'top:0',
    'will-change:transform, opacity',
  ].join(';');

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < 5; i++) {
    const slot = document.createElement('div');
    slot.style.cssText = 'width:70%;height:14px;border-radius:3px;flex-shrink:0;';
    if (i === 2) {
      slot.style.boxShadow = '0 0 0 2px var(--paper, #ECE6DA), 0 0 0 3px rgba(0,0,0,0.6)';
    }
    bubble.appendChild(slot);
    slots.push(slot);
  }

  parent.appendChild(bubble);

  function renderSlices(value: number, axis: MagnifierAxis, state: HSL): void {
    const wrap = axis === 'h';
    const max = wrap ? 360 : 100;
    for (let i = 0; i < 5; i++) {
      const delta = i - 2;
      let v = value + delta;
      if (wrap) v = ((v % max) + max) % max;
      else v = Math.max(0, Math.min(max, v));
      let color: string;
      if (axis === 'h')      color = huePreviewSlice(v, state.s, state.l);
      else if (axis === 's') color = satPreviewSlice(v, state.h, state.l);
      else                   color = lightPreviewSlice(v, state.h, state.s);
      slots[i].style.background = color;
    }
  }

  return {
    update: (x, y, value, axis, state) => {
      renderSlices(value, axis, state);
      const parentRect = parent.getBoundingClientRect();
      const localX = x - parentRect.left;
      const localY = y - parentRect.top;
      const half = SIZE / 2;
      const bx = Math.max(EDGE_PAD + half, Math.min(parentRect.width - EDGE_PAD - half, localX));
      const by = localY - OFFSET_ABOVE - half;
      bubble.style.transform = `translate(${bx - half}px, ${by}px)`;
      bubble.style.opacity = '1';
    },
    hide: () => {
      bubble.style.opacity = '0';
    },
    destroy: () => {
      bubble.remove();
    },
  };
}
```

- [ ] **Step 2: Verify the module builds**

Run: `npx tsc -b --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/ui/picker/magnifier.ts
git commit -m "feat(picker): magnifier bubble — 96px DOM lifted 60px above thumb"
```

---

## Task 4: Tape module (drag + tap + inertia + haptics)

**Files:**
- Create: `src/ui/picker/tape.ts`
- Create: `src/ui/picker/tape.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/picker/tape.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  velocityScale,
  dragToValueDelta,
  normalizeValue,
  isTap,
  V_SLOW,
  V_FAST,
  MAX_SCALE,
  SLOT_PITCH,
  TAP_MAX_DURATION_MS,
  TAP_MAX_MOVE_PX,
} from './tape';

describe('velocityScale', () => {
  it('returns 1 at zero velocity', () => {
    expect(velocityScale(0)).toBe(1);
  });
  it('returns 1 at or below V_SLOW', () => {
    expect(velocityScale(V_SLOW)).toBe(1);
    expect(velocityScale(V_SLOW * 0.5)).toBe(1);
  });
  it('returns MAX_SCALE at or above V_FAST', () => {
    expect(velocityScale(V_FAST)).toBe(MAX_SCALE);
    expect(velocityScale(V_FAST * 2)).toBe(MAX_SCALE);
  });
  it('interpolates linearly between V_SLOW and V_FAST', () => {
    const mid = (V_SLOW + V_FAST) / 2;
    const expected = 1 + ((MAX_SCALE - 1) / 2);
    expect(velocityScale(mid)).toBeCloseTo(expected, 5);
  });
});

describe('dragToValueDelta', () => {
  it('drag up by one slot at slow velocity yields +1', () => {
    expect(dragToValueDelta(-SLOT_PITCH, V_SLOW * 0.5)).toBeCloseTo(1, 5);
  });
  it('drag down by one slot at slow velocity yields -1', () => {
    expect(dragToValueDelta(SLOT_PITCH, V_SLOW * 0.5)).toBeCloseTo(-1, 5);
  });
  it('drag up by one slot at max velocity yields +MAX_SCALE', () => {
    expect(dragToValueDelta(-SLOT_PITCH, V_FAST)).toBeCloseTo(MAX_SCALE, 5);
  });
  it('zero drag yields zero', () => {
    expect(dragToValueDelta(0, 5)).toBe(0);
  });
});

describe('normalizeValue', () => {
  it('hue wraps positively past 360', () => {
    expect(normalizeValue(370, 'h')).toBe(10);
    expect(normalizeValue(720, 'h')).toBe(0);
  });
  it('hue wraps negatively past 0', () => {
    expect(normalizeValue(-10, 'h')).toBe(350);
    expect(normalizeValue(-360, 'h')).toBe(0);
  });
  it('sat clamps to [0, 100]', () => {
    expect(normalizeValue(-5, 's')).toBe(0);
    expect(normalizeValue(50, 's')).toBe(50);
    expect(normalizeValue(105, 's')).toBe(100);
  });
  it('light clamps to [0, 100]', () => {
    expect(normalizeValue(-5, 'l')).toBe(0);
    expect(normalizeValue(50, 'l')).toBe(50);
    expect(normalizeValue(105, 'l')).toBe(100);
  });
});

describe('isTap', () => {
  it('short + small movement is a tap', () => {
    expect(isTap(150, 4)).toBe(true);
  });
  it('too long is not a tap', () => {
    expect(isTap(TAP_MAX_DURATION_MS + 10, 2)).toBe(false);
  });
  it('too much movement is not a tap', () => {
    expect(isTap(100, TAP_MAX_MOVE_PX + 1)).toBe(false);
  });
  it('exactly at thresholds is still a tap', () => {
    expect(isTap(TAP_MAX_DURATION_MS, TAP_MAX_MOVE_PX)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/picker/tape.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement tape.ts**

Create `src/ui/picker/tape.ts`:

```ts
import type { HSL } from '../../color';
import type { HapticsHandle } from './haptics';
import type { MagnifierHandle, MagnifierAxis } from './magnifier';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
  trueColor,
} from './render';

export const SLOT_PITCH = 32;
export const VISIBLE_RADIUS = 4; // slots above and below selection
const TOTAL_SLOTS = VISIBLE_RADIUS * 2 + 1; // 9
export const V_SLOW = 1.0;
export const V_FAST = 2.5;
export const MAX_SCALE = 8;
export const TAP_MAX_DURATION_MS = 200;
export const TAP_MAX_MOVE_PX = 8;
const INERTIA_MIN_V = 0.4;
const INERTIA_DECAY_PER_MS = 0.0035; // exponential factor
const STEP_SNAP_MS = 120;

// ---- Pure helpers (unit-tested) ----

export function velocityScale(v: number): number {
  const av = Math.abs(v);
  if (av <= V_SLOW) return 1;
  if (av >= V_FAST) return MAX_SCALE;
  const t = (av - V_SLOW) / (V_FAST - V_SLOW);
  return 1 + t * (MAX_SCALE - 1);
}

export function dragToValueDelta(deltaYPx: number, velocityPxMs: number): number {
  const base = -deltaYPx / SLOT_PITCH; // up = positive
  return base * velocityScale(velocityPxMs);
}

export function normalizeValue(value: number, axis: MagnifierAxis): number {
  if (axis === 'h') return ((value % 360) + 360) % 360;
  return Math.max(0, Math.min(100, value));
}

export function isTap(durationMs: number, totalMovePx: number): boolean {
  return durationMs <= TAP_MAX_DURATION_MS && totalMovePx <= TAP_MAX_MOVE_PX;
}

// ---- Tape ----

export interface TapeOpts {
  axis: MagnifierAxis;
  initialValue: number;
  onChange: (value: number) => void;
  haptics: HapticsHandle;
  magnifier: MagnifierHandle;
  getState: () => HSL;
}

export interface TapeHandle {
  el: HTMLElement;
  rerenderSlices: () => void;
  getValue: () => number;
  destroy: () => void;
}

export function createTape(opts: TapeOpts): TapeHandle {
  let value = opts.initialValue;
  let dragging = false;
  let activePointerId: number | null = null;
  let startY = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let startValue = 0;
  let startTime = 0;
  let totalAbsMove = 0;
  let inertiaRaf = 0;

  const el = document.createElement('div');
  el.style.cssText = [
    'flex:1',
    'position:relative',
    'overflow:hidden',
    'touch-action:none',
    'border-left:1px solid rgba(236,230,218,0.06)',
  ].join(';');

  // Top/bottom fades
  const fadeTop = document.createElement('div');
  fadeTop.style.cssText = 'position:absolute;left:0;right:0;top:0;height:38%;background:linear-gradient(to bottom, var(--ink, #0E0E10), transparent);pointer-events:none;z-index:2;';
  const fadeBot = document.createElement('div');
  fadeBot.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(to top, var(--ink, #0E0E10), transparent);pointer-events:none;z-index:2;';

  // Strip container holding 9 slots, vertically centered
  const strip = document.createElement('div');
  strip.style.cssText = 'position:absolute;left:0;right:0;top:50%;display:flex;flex-direction:column;align-items:center;transform:translateY(-50%);pointer-events:none;';

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const s = document.createElement('div');
    s.style.cssText = `width:62%;height:${SLOT_PITCH - 4}px;margin:2px 0;border-radius:5px;flex-shrink:0;`;
    if (i === VISIBLE_RADIUS) {
      // selection slot
      s.style.height = `${SLOT_PITCH - 4}px`;
      s.style.boxShadow = '0 0 0 1px var(--paper, #ECE6DA), 0 0 0 2px rgba(0,0,0,0.6)';
      s.style.borderRadius = '6px';
    }
    strip.appendChild(s);
    slots.push(s);
  }

  el.appendChild(fadeTop);
  el.appendChild(fadeBot);
  el.appendChild(strip);

  function renderSlots(): void {
    const state = opts.getState();
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const delta = i - VISIBLE_RADIUS;
      const raw = value + delta;
      const v = normalizeValue(raw, opts.axis);
      let color: string;
      if (delta === 0) {
        color = trueColor({ ...state, [opts.axis]: v } as HSL);
      } else if (opts.axis === 'h') {
        color = huePreviewSlice(v, state.s, state.l);
      } else if (opts.axis === 's') {
        color = satPreviewSlice(v, state.h, state.l);
      } else {
        color = lightPreviewSlice(v, state.h, state.s);
      }
      slots[i].style.background = color;
    }
  }

  function setValue(next: number, fireChange: boolean): void {
    const prevRounded = Math.round(value);
    value = normalizeValue(next, opts.axis);
    const newRounded = Math.round(value);
    if (newRounded !== prevRounded) {
      // One tick per frame in which the rounded value changed; strong if the
      // new rounded value is a multiple of 10. Capping at one tick per frame
      // keeps fast flicks from buzzing indistinguishably.
      if (newRounded % 10 === 0) opts.haptics.tickStrong();
      else opts.haptics.tick();
    }
    renderSlots();
    if (fireChange) opts.onChange(value);
  }

  function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function endDrag(): void {
    dragging = false;
    activePointerId = null;
    opts.magnifier.hide();
  }

  function startInertia(initialV: number): void {
    if (Math.abs(initialV) < INERTIA_MIN_V) return;
    if (prefersReducedMotion()) return;
    let v = initialV; // px/ms; positive = downward = decreasing value
    let prevTime = performance.now();
    const step = (t: number) => {
      const dt = t - prevTime;
      prevTime = t;
      const dy = v * dt;
      const dValue = dragToValueDelta(dy, Math.abs(v));
      setValue(value + dValue, true);
      v *= Math.exp(-INERTIA_DECAY_PER_MS * dt);
      if (Math.abs(v) > 0.05) {
        inertiaRaf = requestAnimationFrame(step);
      }
    };
    inertiaRaf = requestAnimationFrame(step);
  }

  function cancelInertia(): void {
    if (inertiaRaf) {
      cancelAnimationFrame(inertiaRaf);
      inertiaRaf = 0;
    }
  }

  el.addEventListener('pointerdown', (e: PointerEvent) => {
    if (activePointerId !== null) return;
    cancelInertia();
    activePointerId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    dragging = true;
    startY = e.clientY;
    lastY = e.clientY;
    lastTime = performance.now();
    startTime = lastTime;
    velocity = 0;
    startValue = value;
    totalAbsMove = 0;
    opts.magnifier.update(e.clientX, e.clientY, Math.round(value), opts.axis, opts.getState());
  });

  el.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerId !== activePointerId || !dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    const dy = e.clientY - lastY;
    velocity = dy / dt;
    totalAbsMove += Math.abs(dy);
    const dValue = dragToValueDelta(dy, Math.abs(velocity));
    setValue(value + dValue, true);
    lastY = e.clientY;
    lastTime = now;
    opts.magnifier.update(e.clientX, e.clientY, Math.round(value), opts.axis, opts.getState());
  });

  function pointerEnd(e: PointerEvent): void {
    if (e.pointerId !== activePointerId) return;
    const duration = performance.now() - startTime;
    const isAtap = isTap(duration, totalAbsMove);
    try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    endDrag();
    if (isAtap) {
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const direction = e.clientY < centerY ? 1 : -1;
      setValue(value + direction, true);
      if (!prefersReducedMotion()) {
        strip.animate(
          [
            { transform: `translateY(calc(-50% + ${direction * 4}px))` },
            { transform: 'translateY(-50%)' },
          ],
          { duration: STEP_SNAP_MS, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' },
        );
      }
      return;
    }
    startInertia(velocity);
  }
  el.addEventListener('pointerup', pointerEnd);
  el.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activePointerId) return;
    try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    endDrag();
  });

  // initial render
  renderSlots();

  return {
    el,
    rerenderSlices: renderSlots,
    getValue: () => value,
    destroy: () => {
      cancelInertia();
      el.remove();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/picker/tape.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/ui/picker/tape.ts src/ui/picker/tape.test.ts
git commit -m "feat(picker): tape module — drag/tap/inertia + haptic detents"
```

---

## Task 5: Index module — compose, delete old picker

**Files:**
- Create: `src/ui/picker/index.ts`
- Delete: `src/ui/picker.ts`

- [ ] **Step 1: Delete old picker.ts**

Run: `git rm src/ui/picker.ts`

- [ ] **Step 2: Implement the new entry point**

Create `src/ui/picker/index.ts`:

```ts
import type { HSL } from '../../color';
import { hslToHex } from '../../color';
import { loadState } from '../../state';
import { createHaptics } from './haptics';
import { createMagnifier } from './magnifier';
import { createTape, type TapeHandle } from './tape';
import { trueColor } from './render';

export interface PickerHandle {
  getHex: () => string;
  getHSL: () => HSL;
  destroy: () => void;
}

export function mountPicker(
  parent: HTMLElement,
  initial: HSL,
  onChange: (hex: string) => void,
): PickerHandle {
  const state: HSL = { ...initial };

  const root = document.createElement('div');
  root.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:flex',
    'flex-direction:column',
    'padding-top:calc(0px + env(safe-area-inset-top))',
    'padding-bottom:calc(96px + env(safe-area-inset-bottom))',
  ].join(';');

  const swatch = document.createElement('div');
  swatch.style.cssText = 'flex:1 1 50%;min-height:120px;background:' + trueColor(state) + ';';
  root.appendChild(swatch);

  const readout = document.createElement('div');
  readout.style.cssText = [
    'padding:8px 0',
    'text-align:center',
    "font-family:'Inter Variable',system-ui,sans-serif",
    'font-size:13px',
    'color:var(--mute, #7A7670)',
    "font-feature-settings:'tnum'",
    'letter-spacing:0.04em',
  ].join(';');
  root.appendChild(readout);

  const labels = document.createElement('div');
  labels.style.cssText = 'display:flex;padding:0 12px 6px;';
  for (const text of ['HUE', 'SAT', 'LIGHT']) {
    const span = document.createElement('div');
    span.className = 'label-micro';
    span.style.flex = '1';
    span.style.textAlign = 'center';
    span.textContent = text;
    labels.appendChild(span);
  }
  root.appendChild(labels);

  const tapesEl = document.createElement('div');
  tapesEl.style.cssText = 'display:flex;flex:0 0 260px;position:relative;';
  root.appendChild(tapesEl);

  parent.appendChild(root);

  const haptics = createHaptics(() => loadState().settings.haptics);
  const magnifier = createMagnifier(parent);

  function updateOutput(): void {
    swatch.style.background = trueColor(state);
    readout.textContent = `${Math.round(state.h)}° · ${Math.round(state.s)}% · ${Math.round(state.l)}%`;
    onChange(hslToHex(state));
  }

  const axisOrder: Array<'h' | 's' | 'l'> = ['h', 's', 'l'];
  const tapes: TapeHandle[] = axisOrder.map((axis) => {
    return createTape({
      axis,
      initialValue: state[axis],
      onChange: (v) => {
        state[axis] = v;
        updateOutput();
        for (let i = 0; i < axisOrder.length; i++) {
          if (axisOrder[i] !== axis) tapes[i].rerenderSlices();
        }
      },
      haptics,
      magnifier,
      getState: () => state,
    });
  });

  tapes.forEach((t) => tapesEl.appendChild(t.el));

  updateOutput();

  return {
    getHex: () => hslToHex(state),
    getHSL: () => ({ ...state }),
    destroy: () => {
      tapes.forEach((t) => t.destroy());
      magnifier.destroy();
      root.remove();
    },
  };
}
```

- [ ] **Step 3: Run all tests to verify**

Run: `npx vitest run`
Expected: PASS (all existing color/state tests plus new haptics/render/tape tests).

- [ ] **Step 4: Run typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS — no type errors, no references to deleted `src/ui/picker.ts`.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: PASS — produces `dist/` without errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/picker/index.ts
git commit -m "feat(picker): index module + delete old picker.ts"
```

---

## Task 6: Verify, dev server, notify

**Files:** none modified — verification + deploy step.

- [ ] **Step 1: Full test + typecheck + build**

Run all three in sequence:
```bash
npx vitest run && npx tsc -b --noEmit && npm run build
```
Expected: all green.

- [ ] **Step 2: Start dev server in the background**

Run (with `run_in_background: true` on the Bash tool):
```bash
npm run dev
```
Expected: server listens on `0.0.0.0:5173`. The startup banner should print a Network URL line.

- [ ] **Step 3: Confirm the server is reachable**

After ~3 seconds, check the BashOutput. Expected line resembling:
```
  ➜  Network: http://<tailnet-or-lan>:5173/
```
If the line isn't visible, run `curl -sI http://localhost:5173 | head -1` — expect `HTTP/1.1 200 OK`.

- [ ] **Step 4: Push to ntfy**

The tailnet URL for this machine is `http://nicks-macbook-air.taild99f50.ts.net:5173`.

Run:
```bash
curl -d "Tape-deck picker ready to test: http://nicks-macbook-air.taild99f50.ts.net:5173 — Tap to play → reach the Match scene to use the new picker." ntfy.sh/nickcason-claude-9f2a
```
Expected: returns a JSON message receipt.

- [ ] **Step 5: Report back to the user**

In the assistant's reply, summarize: dev server URL, what to test (drag, tap above/below, magnifier visibility, haptic ticks if on a phone), and note the known pour-transition visual mismatch (deferred per spec).

No commit in this task — runtime verification only.

---

## Known Follow-Up

The pour transition (`src/ui/transitions.ts:pourTransition`) still draws a mock pad+slider, which now visually mismatches the new tape-deck picker. This is **explicitly out of scope** for this plan per the spec's "Open Item: Pour Transition" section. A follow-up spec will adapt the pour to scroll each tape's selection slot from the guess value to the target value.
