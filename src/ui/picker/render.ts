import type { HSL } from '../../color';

// Render-only clamps for the HUE tape:
//   - If actual S is very low, the hue strip would be all gray.
//   - If actual L is extreme, every hue would be near-black or near-white.
// We softly clamp the *render* so the user can always see the hue spectrum
// scrolling by, while the selection-slot's truecolor (and the live swatch,
// and the picker's state) all stay at the user's actual pick.

const S_FLOOR_FOR_HUE = 25;
const S_THRESHOLD = 25;
const L_PREVIEW_MIN = 35;
const L_PREVIEW_MAX = 65;
const L_THRESHOLD_LOW = 15;
const L_THRESHOLD_HIGH = 85;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function huePreviewSlice(h: number, s: number, l: number): string {
  const renderS = s < S_THRESHOLD ? S_FLOOR_FOR_HUE : s;
  const renderL = (l < L_THRESHOLD_LOW || l > L_THRESHOLD_HIGH)
    ? clamp(l, L_PREVIEW_MIN, L_PREVIEW_MAX)
    : l;
  return `hsl(${h}, ${renderS}%, ${renderL}%)`;
}

export function satPreviewSlice(s: number, h: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function lightPreviewSlice(l: number, h: number, s: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function trueColor(state: HSL): string {
  return `hsl(${state.h}, ${state.s}%, ${state.l}%)`;
}
