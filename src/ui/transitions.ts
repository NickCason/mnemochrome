// src/ui/transitions.ts
// Scene-to-scene transition primitives. Each transition mounts a temporary
// overlay on top of the scene root, runs its animation, and removes itself.
// At a configured moment within the animation it calls `onSwap` — that's
// when the dispatcher should clean up the outgoing scene and mount the
// incoming one. The overlay covers the swap so the user never sees a flash.
//
// prefers-reduced-motion collapses every transition to an immediate swap
// with no overlay or animation.

import type { HSL } from '../color';

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
      // mountReveal's innerHTML = '' just detached our overlay. Re-attach
      // it (still at clip-path 150%, fully covering) so the swap is
      // hidden behind the bloom for one more frame, then lift it on the
      // next rAF after the new scene has painted.
      root.appendChild(overlay);
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
 * The bars are driven by a single rAF loop (not CSS keyframes) so the open
 * phase is guaranteed to produce visible per-frame motion regardless of any
 * CSS animation gotchas or asset caching. The seam/dot accent flash still
 * uses its own CSS keyframes (independent of the bars).
 *
 * onSwap fires while the bars are still fully closed so the match scene
 * mounts behind the ink before the open phase starts.
 */
export function shutterTransition(
  root: HTMLElement,
  onSwap: () => void,
  duration = 2000,
): TransitionHandle {
  if (prefersReducedMotion()) return instantSwap(onSwap);

  // Phase boundaries as fractions of total duration.
  const CLOSE_END = 0.20;
  const HOLD_END = 0.38;
  const OPEN_END = 0.82;
  // Easing for the close — slow then snap to centre.
  const easeInCubic = (t: number) => t * t * t;
  // Open is linear so the motion is unambiguously visible end-to-end.

  const overlay = document.createElement('div');
  overlay.className = 'shutter-overlay';

  const top = document.createElement('div');
  top.className = 'shutter-bar shutter-bar-top';
  // Disable CSS animation; we drive transform from JS.
  top.style.animation = 'none';
  top.style.transform = 'translateY(-100%)';

  const bot = document.createElement('div');
  bot.className = 'shutter-bar shutter-bar-bot';
  bot.style.animation = 'none';
  bot.style.transform = 'translateY(100%)';

  const seam = document.createElement('div');
  seam.className = 'shutter-seam';

  const dotL = document.createElement('div');
  dotL.className = 'shutter-dot shutter-dot-l';

  const dotR = document.createElement('div');
  dotR.className = 'shutter-dot shutter-dot-r';

  const dur = `${duration}ms`;
  [seam, dotL, dotR].forEach((el) => {
    el.style.animationDuration = dur;
  });
  dotR.style.animationDelay = '60ms';

  overlay.appendChild(top);
  overlay.appendChild(bot);
  overlay.appendChild(seam);
  overlay.appendChild(dotL);
  overlay.appendChild(dotR);
  root.appendChild(overlay);

  // Drive the bar transforms manually. Linear open phase, so the bars peel
  // back at a steady rate the eye can track from t=HOLD_END to t=OPEN_END.
  const start = performance.now();
  let rafId = 0;
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    let topY: number; // percent — translateY(${topY}%)
    let botY: number;
    if (p <= CLOSE_END) {
      const k = easeInCubic(p / CLOSE_END);
      topY = -100 + 100 * k;
      botY = 100 - 100 * k;
    } else if (p <= HOLD_END) {
      topY = 0;
      botY = 0;
    } else if (p <= OPEN_END) {
      const k = (p - HOLD_END) / (OPEN_END - HOLD_END);
      topY = -100 * k;
      botY = 100 * k;
    } else {
      topY = -100;
      botY = 100;
    }
    top.style.transform = `translateY(${topY}%)`;
    bot.style.transform = `translateY(${botY}%)`;
    if (p < 1) rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  // Swap mid-hold so match is mounted before the bars start opening. The
  // scenes' mount functions wipe root.innerHTML, which detaches our overlay
  // mid-animation — re-append it immediately after so the open phase is
  // visible to the user (without this the screen jumped instantly from
  // ink-covered to fully revealed picker, the bug we're fixing).
  const swapDelay = Math.floor(duration * ((CLOSE_END + HOLD_END) / 2));
  let swapped = false;
  const swapOnce = () => {
    if (swapped) return;
    swapped = true;
    onSwap();
    root.appendChild(overlay);
  };
  const swapTimer = window.setTimeout(swapOnce, swapDelay);

  let removeTimer = 0;
  const done = new Promise<void>((resolve) => {
    removeTimer = window.setTimeout(() => {
      swapOnce();
      cancelAnimationFrame(rafId);
      overlay.remove();
      resolve();
    }, duration);
  });

  return {
    done,
    cancel: () => {
      clearTimeout(swapTimer);
      clearTimeout(removeTimer);
      cancelAnimationFrame(rafId);
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
      // The reveal scene's mountReveal runs root.innerHTML = '' which just
      // detached the wash overlay. Re-attach it so it continues to cover
      // the now-mounted reveal scene until the bloom grows over it —
      // without this re-append the user briefly sees the bare reveal
      // (target colour + countdown ring) for a frame before the bloom
      // starts covering, which reads as "loading bar flashes in".
      root.appendChild(wash);

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

export interface PourContext {
  /** The actual target the player tried to recall (HSL). */
  target: HSL;
  /** What the player picked (HSL). */
  guess: HSL;
  targetHex: string;
  guessHex: string;
}

function padGradient(l: number): string {
  const neutral = `hsl(0, 0%, ${l}%)`;
  return [
    `linear-gradient(to bottom, transparent 0%, ${neutral} 100%)`,
    `linear-gradient(to right,
      hsl(0,100%,${l}%) 0%,
      hsl(60,100%,${l}%) 16.66%,
      hsl(120,100%,${l}%) 33.33%,
      hsl(180,100%,${l}%) 50%,
      hsl(240,100%,${l}%) 66.66%,
      hsl(300,100%,${l}%) 83.33%,
      hsl(360,100%,${l}%) 100%)`,
  ].join(', ');
}

function sliderGradient(h: number, s: number): string {
  return `linear-gradient(to right, #000 0%, hsl(${h}, ${s}%, 50%) 50%, #fff 100%)`;
}

/**
 * Pour: a picker mock mirrors the player's pick; the pad reticle smoothly
 * travels to the target's H/S position; both reticles ignite with a white
 * halo; solid color discs scale up from each thumb position to cover the
 * screen. Use for Match → Grade — the only transition that carries
 * gameplay context (the player's guess vs the actual target).
 *
 * onSwap fires once the pour has fully covered the viewport, so the grade
 * scene mounts behind the now-opaque overlay and is revealed when the
 * overlay is removed.
 */
export function pourTransition(
  root: HTMLElement,
  ctx: PourContext,
  onSwap: () => void,
  duration = 2400,
): TransitionHandle {
  if (prefersReducedMotion()) return instantSwap(onSwap);

  // Phase markers (ms), tuned for a 2400ms total. Adjust by scaling.
  const scale = duration / 2400;
  const HOLD_END = 220 * scale;        // initial picker hold
  const TRAVEL_START = HOLD_END;
  const IGNITE_AT = 1000 * scale;      // both reticles flare
  const POUR_AT = 1100 * scale;        // discs begin growing
  const SWAP_AT = duration * 0.92;     // discs have visually covered the band

  const overlay = document.createElement('div');
  overlay.className = 'pour-overlay';

  // Picker mock — same layout proportions as the live match scene's picker.
  const picker = document.createElement('div');
  picker.className = 'pour-picker';

  const pad = document.createElement('div');
  pad.className = 'pour-pad';
  pad.style.background = padGradient(ctx.guess.l);

  const reticle = document.createElement('div');
  reticle.className = 'pour-reticle';
  reticle.style.left = `${(ctx.guess.h / 360) * 100}%`;
  reticle.style.top = `${(1 - ctx.guess.s / 100) * 100}%`;
  reticle.style.background = ctx.guessHex; // lens fill, matches live picker
  pad.appendChild(reticle);

  const slider = document.createElement('div');
  slider.className = 'pour-slider';
  slider.style.background = sliderGradient(ctx.guess.h, ctx.guess.s);

  const thumb = document.createElement('div');
  thumb.className = 'pour-thumb';
  thumb.style.left = `${(ctx.guess.l / 100) * 100}%`;
  thumb.style.background = ctx.guessHex;
  slider.appendChild(thumb);

  picker.appendChild(pad);
  picker.appendChild(slider);

  const regionTop = document.createElement('div');
  regionTop.className = 'pour-region pour-region-top';
  const discTop = document.createElement('div');
  discTop.className = 'pour-disc';
  discTop.style.background = ctx.targetHex;
  regionTop.appendChild(discTop);

  const regionBot = document.createElement('div');
  regionBot.className = 'pour-region pour-region-bot';
  const discBot = document.createElement('div');
  discBot.className = 'pour-disc';
  discBot.style.background = ctx.guessHex;
  regionBot.appendChild(discBot);

  overlay.appendChild(picker);
  overlay.appendChild(regionTop);
  overlay.appendChild(regionBot);
  root.appendChild(overlay);

  let swapped = false;
  const swapOnce = () => {
    if (swapped) return;
    swapped = true;
    onSwap();
  };

  const timers: number[] = [];
  const later = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };

  // Travel: reticle slides from guess H/S to target H/S. Reticle's lens fill
  // also crossfades to the target color so the destination dot reads as
  // "this is where you should have been".
  later(TRAVEL_START, () => {
    reticle.style.left = `${(ctx.target.h / 360) * 100}%`;
    reticle.style.top = `${(1 - ctx.target.s / 100) * 100}%`;
    reticle.style.background = ctx.targetHex;
  });

  // Ignite: white halos on both reticles.
  later(IGNITE_AT, () => {
    reticle.classList.add('pour-ignite');
    thumb.classList.add('pour-ignite');
  });

  // Pour: position discs at thumb screen coords, then grow.
  later(POUR_AT, () => {
    const rootRect = root.getBoundingClientRect();
    const padRect = pad.getBoundingClientRect();
    const sliderRect = slider.getBoundingClientRect();
    const halfH = rootRect.height / 2;

    const reticleX = padRect.left + (ctx.target.h / 360) * padRect.width - rootRect.left;
    const reticleY = padRect.top + (1 - ctx.target.s / 100) * padRect.height - rootRect.top;
    const thumbX = sliderRect.left + (ctx.guess.l / 100) * sliderRect.width - rootRect.left;
    const thumbY = sliderRect.top + sliderRect.height / 2 - rootRect.top;

    discTop.style.left = `${reticleX}px`;
    discTop.style.top = `${reticleY}px`;
    discBot.style.left = `${thumbX}px`;
    discBot.style.top = `${thumbY - halfH}px`;

    requestAnimationFrame(() => {
      discTop.classList.add('pour-grow');
      discBot.classList.add('pour-grow');
    });
  });

  // Swap once pours have covered the screen.
  later(SWAP_AT, swapOnce);

  const done = new Promise<void>((resolve) => {
    later(duration + 60, () => {
      swapOnce(); // safety
      overlay.remove();
      resolve();
    });
  });

  return {
    done,
    cancel: () => {
      timers.forEach(clearTimeout);
      swapOnce();
      overlay.remove();
    },
  };
}

export interface LockInContext {
  targetHex: string;
  guessHex: string;
}

/**
 * Lock-in: phase B of the Match→Grade hand-off. The match scene has already
 * slid its controls + Lock In button off the bottom (phase A, in match.ts)
 * and tinted its root to the guess colour, so the screen is currently a flat
 * field of the guess colour when this transition starts.
 *
 * Here we slide a target-coloured band down from above the screen so it
 * covers the top half — establishing the target / guess split that the grade
 * scene will mount into. After the slide lands, onSwap fires, the grade
 * scene mounts behind the overlay (its own top/bot bands match the overlay's
 * final state, so removing the overlay is invisible), and the grade card's
 * existing scale-in / cascade choreography plays as phase C.
 */
export function lockInTransition(
  root: HTMLElement,
  ctx: LockInContext,
  onSwap: () => void,
  duration = 580,
): TransitionHandle {
  if (prefersReducedMotion()) return instantSwap(onSwap);

  const SLIDE_MS = 320;
  const SWAP_AT = SLIDE_MS + 20;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;z-index:1000;pointer-events:none;overflow:hidden;';

  // Target band — top half of the screen, drops in from above.
  const target = document.createElement('div');
  target.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'top:0',
    'height:50%',
    `background:${ctx.targetHex}`,
    'transform:translateY(-100%)',
    `transition:transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    'will-change:transform',
    'box-shadow:0 6px 14px rgba(0,0,0,0.25)',
  ].join(';');
  overlay.appendChild(target);

  // Guess base — the bottom half of the screen during the transition. The
  // match scene's tinted root already shows this colour, but we paint it on
  // the overlay too so there's no flicker if the underlying scene unmounts
  // mid-frame.
  const guessBase = document.createElement('div');
  guessBase.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'bottom:0',
    'height:50%',
    `background:${ctx.guessHex}`,
    'z-index:-1',
  ].join(';');
  overlay.appendChild(guessBase);

  root.appendChild(overlay);

  // Kick off the slide on the next frame so the initial transform is committed.
  requestAnimationFrame(() => {
    target.style.transform = 'translateY(0%)';
  });

  let swapped = false;
  const swapOnce = () => {
    if (swapped) return;
    swapped = true;
    onSwap();
  };
  const t1 = window.setTimeout(swapOnce, SWAP_AT);

  let t2 = 0;
  const done = new Promise<void>((resolve) => {
    t2 = window.setTimeout(() => {
      swapOnce();
      requestAnimationFrame(() => {
        overlay.remove();
        resolve();
      });
    }, duration);
  });

  return {
    done,
    cancel: () => {
      clearTimeout(t1);
      clearTimeout(t2);
      swapOnce();
      overlay.remove();
    },
  };
}
