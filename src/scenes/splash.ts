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

/**
 * Splash is bypassed entirely under OS-level Reduce Motion. The goal of
 * splash is brand/polish, both of which yield to user preference.
 */
export function shouldSkipSplash(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
