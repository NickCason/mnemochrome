// src/ui/transitions.ts
// Scene-to-scene transition primitives. Each transition mounts a temporary
// overlay on top of the scene root, runs its animation, and removes itself.
// At a configured moment within the animation it calls `onSwap` — that's
// when the dispatcher should clean up the outgoing scene and mount the
// incoming one. The overlay covers the swap so the user never sees a flash.
//
// prefers-reduced-motion collapses every transition to an immediate swap
// with no overlay or animation.

export interface TransitionHandle {
  /** Resolves once the overlay has been fully removed. */
  done: Promise<void>;
  /** Tear down immediately. Calls onSwap if it hasn't fired yet. */
  cancel: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function instantSwap(onSwap: () => void): TransitionHandle {
  onSwap();
  return { done: Promise.resolve(), cancel: () => {} };
}

/**
 * Bloom: a disc of `color` grows from the centre of the screen to cover
 * the viewport. Use for entrance moments where the colour itself is the
 * subject — Title → Reveal, and the second half of Grade → Reveal.
 *
 * The overlay starts with `clip-path: circle(0)` so it's invisible; we
 * grow the clip-path to a radius beyond the diagonal so it fully covers,
 * then fire onSwap (so the new scene mounts behind the overlay), then
 * remove the overlay on the next frame.
 */
export function bloomTransition(
  root: HTMLElement,
  color: string,
  onSwap: () => void,
  duration = 520,
): TransitionHandle {
  if (prefersReducedMotion()) return instantSwap(onSwap);

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:absolute',
    'inset:0',
    `background:${color}`,
    'z-index:1000',
    'clip-path:circle(0% at 50% 50%)',
    `transition:clip-path ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    'pointer-events:none',
    'will-change:clip-path',
  ].join(';');
  root.appendChild(overlay);

  let swapped = false;
  const swapOnce = () => {
    if (swapped) return;
    swapped = true;
    onSwap();
  };

  // Commit the initial clip-path before starting the transition.
  requestAnimationFrame(() => {
    overlay.style.clipPath = 'circle(150% at 50% 50%)';
  });

  let timer = 0;
  const done = new Promise<void>((resolve) => {
    timer = window.setTimeout(() => {
      swapOnce();
      // One frame after swap so the new scene's layout is established
      // before we lift the overlay.
      requestAnimationFrame(() => {
        overlay.remove();
        resolve();
      });
    }, duration);
  });

  return {
    done,
    cancel: () => {
      clearTimeout(timer);
      swapOnce();
      overlay.remove();
    },
  };
}

/**
 * Shutter: two ink bars converge from top and bottom, hold briefly while a
 * magenta seam flashes and two o-dots glow at the wordmark's positions, then
 * retract. Use for Reveal → Match where the metaphor is "eyes close, memory
 * imprints, eyes open on the new task".
 *
 * onSwap fires at the closed moment (the held centre of the animation), so
 * the picker has been mounted by the time the bars open.
 */
export function shutterTransition(
  root: HTMLElement,
  onSwap: () => void,
  duration = 2200,
): TransitionHandle {
  if (prefersReducedMotion()) return instantSwap(onSwap);

  const overlay = document.createElement('div');
  overlay.className = 'shutter-overlay';

  const top = document.createElement('div');
  top.className = 'shutter-bar shutter-bar-top';

  const bot = document.createElement('div');
  bot.className = 'shutter-bar shutter-bar-bot';

  const seam = document.createElement('div');
  seam.className = 'shutter-seam';

  const dotL = document.createElement('div');
  dotL.className = 'shutter-dot shutter-dot-l';

  const dotR = document.createElement('div');
  dotR.className = 'shutter-dot shutter-dot-r';

  // All animations share the configured duration. The 60ms stagger on the
  // right o-dot is preserved as an animation-delay so the two dots feel
  // independent rather than ringing in unison.
  const dur = `${duration}ms`;
  [top, bot, seam, dotL, dotR].forEach((el) => {
    el.style.animationDuration = dur;
  });
  dotR.style.animationDelay = '60ms';

  overlay.appendChild(top);
  overlay.appendChild(bot);
  overlay.appendChild(seam);
  overlay.appendChild(dotL);
  overlay.appendChild(dotR);
  root.appendChild(overlay);

  // Swap when bars are fully closed (the held middle of the animation,
  // matching the 22%/52% close/open keyframe split).
  const swapDelay = Math.floor(duration * 0.34);
  let swapped = false;
  const swapOnce = () => {
    if (swapped) return;
    swapped = true;
    onSwap();
  };
  const swapTimer = window.setTimeout(swapOnce, swapDelay);

  let removeTimer = 0;
  const done = new Promise<void>((resolve) => {
    removeTimer = window.setTimeout(() => {
      swapOnce(); // safety
      overlay.remove();
      resolve();
    }, duration);
  });

  return {
    done,
    cancel: () => {
      clearTimeout(swapTimer);
      clearTimeout(removeTimer);
      swapOnce();
      overlay.remove();
    },
  };
}

/**
 * Wash + bloom: the outgoing scene fades to ink, then the new color blooms
 * from centre. Use for Grade → Reveal where we want to reset the eye between
 * a verdict and the next memorisation.
 *
 * onSwap fires when the wash is fully opaque (mid-transition), so the new
 * reveal scene is mounted behind the ink before the bloom starts.
 */
export function washBloomTransition(
  root: HTMLElement,
  nextColor: string,
  onSwap: () => void,
  washDuration = 280,
  bloomDuration = 520,
): TransitionHandle {
  if (prefersReducedMotion()) return instantSwap(onSwap);

  const wash = document.createElement('div');
  wash.style.cssText = [
    'position:absolute',
    'inset:0',
    'background:var(--ink, #0E0E10)',
    'z-index:999',
    'opacity:0',
    `transition:opacity ${washDuration}ms ease-in`,
    'pointer-events:none',
    'will-change:opacity',
  ].join(';');
  root.appendChild(wash);

  requestAnimationFrame(() => {
    wash.style.opacity = '1';
  });

  let swapped = false;
  const swapOnce = () => {
    if (swapped) return;
    swapped = true;
    onSwap();
  };

  let bloom: HTMLDivElement | null = null;
  let washTimer = 0;
  let bloomTimer = 0;

  const done = new Promise<void>((resolve) => {
    washTimer = window.setTimeout(() => {
      swapOnce();
      // Bloom overlay sits above the wash. The wash is ink, the bloom
      // reveals the new colour from the centre — outside the bloom's clip
      // the wash continues to cover the (new) reveal scene beneath.
      bloom = document.createElement('div');
      bloom.style.cssText = [
        'position:absolute',
        'inset:0',
        `background:${nextColor}`,
        'z-index:1000',
        'clip-path:circle(0% at 50% 50%)',
        `transition:clip-path ${bloomDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        'pointer-events:none',
        'will-change:clip-path',
      ].join(';');
      root.appendChild(bloom);
      requestAnimationFrame(() => {
        if (bloom) bloom.style.clipPath = 'circle(150% at 50% 50%)';
      });
      bloomTimer = window.setTimeout(() => {
        if (bloom) bloom.remove();
        wash.remove();
        resolve();
      }, bloomDuration);
    }, washDuration);
  });

  return {
    done,
    cancel: () => {
      clearTimeout(washTimer);
      clearTimeout(bloomTimer);
      swapOnce();
      if (bloom) bloom.remove();
      wash.remove();
    },
  };
}
