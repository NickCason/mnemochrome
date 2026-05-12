import type { HSL } from '../../color';

// Preview slices for the three tapes. Pass-through verbatim — the picker
// now starts at a random hue with S=L=50 so the tapes are never in a
// degenerate state at mount, and no clamps are needed.

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
