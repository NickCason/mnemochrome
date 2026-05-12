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
