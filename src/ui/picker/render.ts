import type { HSL } from '../../color';

// Preview slices for the three tapes. The functions are equivalent in output
// (`hsl(h, s, l)`) but named per-axis to keep call sites self-documenting.
// Values pass through verbatim — the tape shows what the color actually looks
// like at each candidate value, not a sanitized version.

export function huePreviewSlice(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
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
