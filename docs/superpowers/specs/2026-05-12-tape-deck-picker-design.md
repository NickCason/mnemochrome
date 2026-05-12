# Tape Deck Picker — Design Spec

**Date:** 2026-05-12
**Status:** Approved direction; pending spec review
**Replaces:** `src/ui/picker.ts` (2D hue×sat pad + lightness slider)

## Goal

Replace Mnemochrome's color picker with a distinctive, mobile-native control that solves four pain points in one stroke:

1. **No finger occlusion** — the color you're picking is never under your thumb.
2. **Easy fine selection** — landing on an exact value should not require precision finger work.
3. **Unified controls** — no mode-switching between a 2D pad and a 1D slider.
4. **Signature game-feel** — a gesture and look that feels like Mnemochrome's, not a stock utility picker.

## Concept: Three Tape Decks

Three vertical, iOS-picker-style scrolling tapes side-by-side — one each for **Hue**, **Saturation**, **Lightness**. The screen is split into two regions:

- **Top half (~50% height):** the full live color swatch. Always visible, never occluded. A small mute-colored HSL readout sits directly beneath it.
- **Bottom region:** the three tapes, each with axis labels ("HUE / SAT / LIGHT"), a fixed paper-outlined **selection slot** at vertical center, and softly faded top/bottom edges. Below the tapes: the existing **Lock In** button.

### The key idea — context-aware tape rendering

Each tape doesn't show abstract value gradients; it shows **the color you'd land on** at each candidate value of that axis, given the other two axes' current state:

- HUE tape slices: `hsl(candidateH, currentS, currentL)` at each row
- SAT tape slices: `hsl(currentH, candidateS, currentL)` at each row
- LIGHT tape slices: `hsl(currentH, currentS, candidateL)` at each row

So moving any one tape re-renders the other two. The player scrubs *through colors in context* — every potential pick is previewed before committing.

**Render-only clamps for degenerate states:** when actual S is very low (achromatic) or actual L is at an extreme, the HUE tape would show identical grays/blacks/whites for every hue value, which feels broken. Fix: when *rendering* the HUE tape, clamp S to ≥40% and L to [40,60]. Likewise for the SAT tape, clamp L to [40,60] when rendering. The *state* values stay exactly what the user picked — only the visual preview compensates. The selection-slot at the center always shows the true current color so there's no lie.

## Layout

Portrait, mobile, fills `#app` (`100vw × 100dvh`), bottom inset reserves space for Lock In.

```
┌──────────────────────────────┐  ← top safe-area
│                              │
│     LIVE COLOR SWATCH        │  ~50% of height
│       (current pick)         │
│                              │
├──────────────────────────────┤
│   270° · 60% · 48%           │  HSL readout, small mute
├──────────────────────────────┤
│   HUE     SAT     LIGHT      │  axis labels, micro-uppercase
│  ─────   ─────   ─────       │
│   ░░░     ░░░     ░░░        │  faded top edge
│   ███     ███     ███        │
│   ┃▓▓┃   ┃▓▓┃   ┃▓▓┃         │  selection slot (paper outline)
│   ███     ███     ███        │
│   ░░░     ░░░     ░░░        │  faded bottom edge
├──────────────────────────────┤
│       [ LOCK IN ]            │
└──────────────────────────────┘  ← bottom safe-area
```

Approximate vertical budget (700px usable):

| Region          | Height                  |
|-----------------|-------------------------|
| Swatch          | ~50% (≈350px)           |
| HSL readout     | ~28px                   |
| Axis labels     | ~22px                   |
| Tapes           | ~240px                  |
| Lock In + safe  | ~80px                   |

Each tape is ~33% of `#app` width. The selection slot is a 32px paper-bordered rounded rect at vertical center. ~7 value slices visible at a time (slot pitch ≈ 32px). Top and bottom 38% of each tape fade to the ink background so the visible "window" feels framed.

## Interaction Model

### Initial state
- `H = 0, S = 0, L = 50` (mid-gray, matches current behavior).
- Tapes render around their starting values.

### Drag (the primary gesture)

`pointermove` translates vertical finger movement to value changes per-tape:

- **Slot pitch** = 32px = 1 unit of that axis.
- **Velocity-aware scaling:**
  - If instantaneous velocity is below `V_SLOW` (≈1.0 px/ms), drag is **1:1 with the visual pitch** — fine work.
  - Above `V_FAST` (≈2.5 px/ms), drag is **log-accelerated** up to ~8× — sweeping work.
  - Between, scale interpolates smoothly. No mode-switch button, no separate fine-mode UI.
- Direction: drag **up** = value increases (tape scrolls down, next value rises into the slot). Standard iOS picker convention.
- Hue wraps at 360→0 seamlessly (infinite tape). S and L clamp at 0/100 with a slight rubber-band squash (8px max overshoot).

### Magnifier bubble (the occlusion fix)

On `pointerdown` on a tape, a **96px circular magnifier bubble** appears floating ~60px above the contact Y, biased horizontally to stay within `#app` width.

Contents: 5 enlarged color slices — `currentValue ± 2` — stacked vertically, with a **paper-outlined center slice** marking the exact current pick. Updates live as the user drags.

The bubble:
- Follows the finger vertically (re-positions on each `pointermove`).
- Has a downward-pointing nub aimed at the contact point so the user feels the connection.
- Disappears on `pointerup` with a 120ms fade.
- Never renders on `pointercancel` (drag interrupted by system).

### Inertia & momentum

On `pointerup` with non-trivial velocity (> 0.4 px/ms), apply momentum: value continues changing at decaying velocity (exponential, half-life ~200ms) until under threshold, then stops. Inertia is interruptible by any new `pointerdown`.

### Tap-to-step

A `pointerup` within 200ms of `pointerdown` and < 8px total movement counts as a tap, not a drag:

- Tap **above** the selection slot → value += 1
- Tap **below** the selection slot → value −= 1
- A short snap animation (120ms) slides the tape one slot.

### Haptics

Tied to the existing `settings.haptics` flag (`navigator.vibrate` gated by user preference).

- **Light tick (8ms)** on every unit crossed during drag.
- **Stronger tick (16ms)** at multiples of 10 (a sub-rhythm so the user feels approximate magnitude).
- **One firm tick (24ms)** on Lock In (already exists).
- `prefers-reduced-motion` only suppresses the *animation* paths (snap, inertia). Haptics stay gated solely by `settings.haptics`.

## Component Boundaries

### `src/ui/picker.ts` — public API stays the same

The match scene's call site does not need to change:

```ts
const picker = mountPicker(root, { h: 0, s: 0, l: 50 }, () => {});
// later:
picker.getHex(); picker.getHSL(); picker.destroy();
```

Internals are replaced entirely. The exported `PickerHandle` shape is preserved.

### New internal split

The current single-file picker is replaced by a small file group inside `src/ui/picker/`:

| File              | Responsibility                                                                 |
|-------------------|--------------------------------------------------------------------------------|
| `picker/index.ts` | `mountPicker` entry — composes the swatch, readout, three tapes, returns `PickerHandle`. |
| `picker/tape.ts`  | One vertical tape. Renders value slices, handles drag/tap/inertia, fires `onChange(value)`. Stateless beyond current scroll offset. |
| `picker/magnifier.ts` | The floating bubble: creates DOM, positions above the finger, updates 5 slices on demand. |
| `picker/render.ts` | Pure functions: `renderHueTape(state, range) → CSS gradient stops`, same for sat/light. Includes the render-only clamps. |
| `picker/haptics.ts` | Thin wrapper around `navigator.vibrate` honoring `settings.haptics`. Exposes `tick()`, `tickStrong()`. |

This keeps each file focused (< 200 lines), and `render.ts` is pure and unit-testable.

### What stays untouched

- `src/scenes/match.ts` continues to call `mountPicker(root, initial, () => {})` and a Lock In button.
- `src/color.ts` is unchanged (HSL math and scoring stay the same).
- `src/state.ts` is unchanged (no new settings — haptics flag covers it).

## Edge Cases

| Case                                  | Behavior |
|---------------------------------------|----------|
| Hue wrap (359 → 0 or 0 → 359)         | Seamless infinite tape; haptic tick fires on the boundary. |
| S = 0 or L = 0/100 (achromatic/black/white) | Selection slot shows true gray/black/white; surrounding tape slices use rendering clamps so the user can still see hue variety. |
| `prefers-reduced-motion`              | Magnifier still appears (it's an information tool, not animation). Tap-step animation collapses to instant. Inertia disabled. Drag remains 1:1 always (no velocity scaling). |
| `settings.haptics === false`          | All ticks suppressed. Drag and visuals unchanged. |
| Pointer cancel mid-drag (system interrupt) | Magnifier removed; current value held. No inertia. |
| Orientation change / resize           | Layout reflows naturally (flex). Tapes re-measure slot pitch. Current values preserved. |
| Concurrent pointers (multi-touch)     | Only the first pointer per tape is tracked; additional pointers ignored. Different fingers on different tapes is supported (one tracked per tape). |

## Open Item: Pour Transition

The existing `pourTransition` (`src/ui/transitions.ts`) mirrors the live picker: a pad reticle and slider thumb travel from guess to target H/S/L positions, then discs grow from those points.

The new picker has no 2D pad, so the pour metaphor needs a small adaptation. **Out of scope for this spec** — the picker spec is concerned with the picker. The follow-up:

- Pour mock matches the tape-deck layout.
- Each tape's selection slot "scrolls" from the guess value to the target value (with the same `360ms cubic-bezier` ease as today).
- Two discs grow from the swatch region (already a big colored area), one tinted target, one tinted guess — meeting at the screen midpoint.

A separate spec will follow. This spec deliberately limits scope to the picker itself.

## Testing

| Area                          | Approach |
|-------------------------------|----------|
| `picker/render.ts` (pure)     | Vitest unit tests: given HSL state, return expected gradient stops; verify the render-only clamps fire at S<40 and L outside [40,60] for the HUE/SAT tapes; verify selection-slot is always the true value. |
| Tape drag → value mapping     | Vitest with stubbed pointer events: assert 1:1 mapping at low velocity, accelerated at high. |
| Tap-step                      | Vitest: pointerdown + pointerup within 200ms and < 8px → value ±1; longer/farther → no step. |
| Haptics gating                | Vitest with mocked `navigator.vibrate` + state flag: assert call/no-call. |
| Visual / interaction          | Manual on iOS Safari + Android Chrome. Specific checklist in the implementation plan. |

No new e2e harness. The existing `vitest run` covers the new unit tests.

## Out of Scope

- Picker redesign for the Title scene's view-time slider (not affected).
- Changes to scoring, color math, share card, or grade screen.
- Pour transition rework (separate follow-up spec).
- New settings or persistence.

## Success Criteria

- A user with no instruction can land on a target hex within ±2 on each axis in under 8 seconds, with the swatch never occluded.
- All four pain points (occlusion, precision, mode-switch, game-feel) get a checkmark in self-test.
- The `PickerHandle` contract is preserved — `src/scenes/match.ts` is unchanged.
- Reduced-motion + haptics-off paths are clean and explicitly tested.
