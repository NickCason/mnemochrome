// src/scenes/splash.ts
// One-shot animated splash that plays on cold launch. Picks a random
// saturated hue, washes it in over ink, holds the wordmark, washes
// back out to ink, then hands the wordmark element off to title.

import { hslToHex, type HSL } from '../color';

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

/**
 * Splash is bypassed entirely under OS-level Reduce Motion. The goal of
 * splash is brand/polish, both of which yield to user preference.
 */
export function shouldSkipSplash(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

// Timeline (all ms from T=0). WASH_IN starts at T=0 (no setTimeout needed).
// WORDMARK_IN_DUR (300 ms) is the CSS transition on .is-visible — set in stylesheet.
const WASH_IN_DUR = 300;
const WORDMARK_IN_START = 150;
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
      // Clean up pulse class so it doesn't linger after re-parent into title.
      wordmark.querySelectorAll<HTMLElement>('.o').forEach((el) => {
        el.classList.remove('o-splash-pulse');
      });
      wordmark.remove(); // detach from splash-root (keeps it alive)
      panel.remove();
      opts.onComplete(wordmark);
    }, TOTAL_DUR);
  });
}

