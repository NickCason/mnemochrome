# Animated splash screen — design

**Date:** 2026-05-12
**Scope:** Add an animated splash sequence to Mnemochrome that plays on cold launch only, before the title screen.

## Goals

1. **Hide the PWA boot flash.** Replace the white/blank moment between iOS launch image and first JS paint with a deliberate, on-brand sequence.
2. **Brand moment.** Give the wordmark its own entrance — letting Mnemochrome introduce itself before handing off to the title screen.

## Non-goals

- **Game priming.** Splash does not preview the round's target color. The game-color reveal is the existing title→reveal bloom transition.
- **Replacing existing transitions.** `bloomTransition`, `shutterTransition`, `washBloomTransition`, and `lockInTransition` are unchanged. Splash plays only on first cold mount.
- **Per-route splash.** Splash does not replay when returning to title from grade (that's `washBloomTransition`).

## Visual timeline

Total duration ~1.4s. Ink-bookended (start and end on `var(--ink)` = `#0E0E10`), with a random saturated hue blooming in between.

```
T = 0ms          App boots on ink. Matches iOS launch image (follow-up).
T = 0–300ms      Color wash IN. Background transitions ink → random
                 saturated hue. Ease-out.
T = 150–450ms    Wordmark fades in over the color. Overlaps the wash for
                 smoothness. Ease-out. Paper text + magenta o's, with a
                 subtle drop-shadow for legibility on color.
T = 450–950ms    Hold. Solid color, full wordmark visible. Magenta o's
                 emit a single soft glow pulse centered at ~T=600ms
                 (~250ms duration, peak at +120ms).
T = 950–1350ms   Color wash OUT. Background transitions hue → ink.
                 Ease-in. Wordmark stays in place; its drop-shadow
                 opacity animates 1 → 0 in sync with the bg.
T = 1350ms       Splash detaches. Title scene mounts the rest
                 (best/last10/settings/SHA stamp) around the
                 already-placed wordmark — no second entrance.
```

## Color logic

- **Hue:** uniform random in `[0°, 360°)` **excluding the magenta band `[300°, 340°]`** so the magenta o's always contrast against the wash.
- **Saturation:** 70–80% (uniform random in this band).
- **Lightness:** 50–55% (uniform random in this band).
- Generated via the same `culori` utilities the rest of the app uses; HSL → hex string applied as `background-color` on the splash root.

The exclusion zone is the only constraint. All other hues are fair game including the magenta-adjacent reds and purples; only the o-clash range is forbidden.

## Wordmark + seamless handoff

The splash mounts the wordmark as a real DOM element with **identical position, size, typography, and color** to the title-screen wordmark. When the splash timeline ends, that exact element is **re-parented** into the title scene's DOM rather than destroyed and re-created.

This means:

- The wordmark visually persists across the splash → title boundary. No second entrance animation.
- The drop-shadow used for color legibility is animated to opacity 0 during the wash-out phase, so by the time it's on ink, the wordmark looks identical to its title-screen state.
- The breath animation on the magenta o's (existing `.o-breath` on title) starts when title mounts, not during splash. Splash's o-glow pulse is a one-shot.

## Implementation

### New file: `src/scenes/splash.ts`

```ts
export interface SplashOptions {
  onComplete: (wordmarkEl: HTMLElement) => void;
}

export function splash(opts: SplashOptions): void;
```

Responsibilities:
- Pick a random hue (with magenta exclusion).
- Build splash root with the wordmark inside.
- Run the timeline via `requestAnimationFrame` driver (not CSS keyframes alone) so timing is precise and not subject to browser CSS scheduling. The `shutterTransition` uses this pattern already — follow it.
- On final frame, detach the splash root *but keep the wordmark element alive*, calling `onComplete(wordmarkEl)`.

### Modified: `src/main.ts`

- Module-level `let splashShown = false`.
- On first call to the function that mounts title (after PWA init), check:
  - If `prefers-reduced-motion: reduce` → set `splashShown = true`, mount title directly with default entrance.
  - Else if `!splashShown` → mount splash; in its `onComplete(wordmarkEl)`, set `splashShown = true` and call `title({ skipEntrance: true, existingWordmark: wordmarkEl })`.
  - Else → mount title normally.

### Modified: `src/scenes/title.ts`

Current signature is parameterless. New signature:

```ts
interface TitleOptions {
  skipEntrance?: boolean;
  existingWordmark?: HTMLElement;
}
export function title(opts?: TitleOptions): void;
```

Behavior changes:
- If `existingWordmark` is provided, re-parent it into the title DOM rather than constructing a new wordmark span tree.
- If `skipEntrance` is true, wordmark spans start in their settled state (opacity 1, translateY 0) and the `.wordmark-entrance` keyframe is not applied. The `.o-breath` animation still starts.
- The rest of title (best stats, last10, settings, SHA stamp) cascades in as today regardless of `skipEntrance` — that's title's own content, not splash's.

### Modified: `src/styles.css`

Add splash-scoped rules:

```css
.splash-root {
  position: fixed;
  inset: 0;
  background: var(--ink);
  /* No baked-in transition — JS sets style.transition per phase
     (300ms ease-out for wash-in, 400ms ease-in for wash-out) before
     mutating background-color. Keeps CSS declarative and timing
     authoritative in one place: splash.ts */
}
.splash-root .wordmark {
  /* shares typography/positioning with title .wordmark */
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.25),
    0 0 1px rgba(0, 0, 0, 0.4);
  transition: text-shadow 400ms ease;
}
.splash-root.wash-out .wordmark {
  text-shadow: none;
}
```

The wordmark class is shared with title; only the parent `.splash-root` differs.

**Settled-state handover detail:** title's base CSS has `.wordmark span { opacity: 0; transform: translateY(8px) }` so that its entrance animation can drive from those values. When `skipEntrance` is true, title must explicitly set `opacity: 1; transform: translateY(0)` on the wordmark spans (either via inline style or a `.wordmark--settled` class) so they don't snap back to the hidden base state when the entrance animation is omitted. The handover wordmark from splash already has these inline values applied by splash's final frame.

## Edge cases

- **Reduced motion.** Splash is bypassed entirely. Title mounts cold on ink with its existing entrance. No fallback animation needed — the goal of splash is brand/polish, both of which yield to user preference.
- **Hue collision with o's.** Mitigated by the 300°–340° exclusion in the hue picker. No runtime fallback needed.
- **Wordmark legibility on bright hues.** Drop-shadow visible during wash + hold, fades out during wash-out.
- **Return to title from grade.** Existing `washBloomTransition` plays. Splash does not.
- **PWA service-worker update activates new build.** Cold launch of the updated PWA replays splash. This is correct behavior — new launch, new color.
- **Tab backgrounded mid-splash.** `requestAnimationFrame` pauses when the tab is hidden; on resume, the timeline continues from where it was. Acceptable. No mid-flight cancel logic.

## Testing

- **Unit:** `splash.test.ts` covers (a) the hue picker excludes 300°–340° across many samples, (b) the reduced-motion branch in main.ts skips splash and calls title without `skipEntrance`.
- **Visual / device:** verified by previewing the dev server on tailnet from the iPhone (mobile-dev-mode workflow). No automated visual test.
- **No regression:** existing 49 tests must continue to pass.

## Out of scope (follow-ups)

- **iOS PWA launch image.** Configure `vite-plugin-pwa` (or generate via `@vite-pwa/assets-generator`) to emit ink-colored `apple-touch-startup-image` variants so the boot flash before JS loads is also invisible. Separate spec/task — this work is build-config, not splash-scene logic.
- **Splash color "memory":** the picked hue could be passed to the title screen as a subtle accent (e.g., the SHA stamp gets a faint tint of that hue). Not in v1.

## Acceptance

- On first cold launch (clean session storage, fresh PWA boot), splash plays for ~1.4s and the title is visible afterward with no flicker or double-entrance.
- The wordmark visibly stays in the same screen position across splash → title.
- After a round (grade → reveal), splash does NOT play; existing wash-bloom transition runs.
- With OS-level Reduce Motion enabled, splash is skipped; title mounts directly.
- All existing tests still pass.
