import type { HSL } from '../../color';

const MIN_S_FOR_HUE = 40;
const MIN_L_FOR_PREVIEW = 40;
const MAX_L_FOR_PREVIEW = 60;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function huePreviewSlice(h: number, s: number, l: number): string {
  const renderS = Math.max(s, MIN_S_FOR_HUE);
  const renderL = clamp(l, MIN_L_FOR_PREVIEW, MAX_L_FOR_PREVIEW);
  return `hsl(${h}, ${renderS}%, ${renderL}%)`;
}

export function satPreviewSlice(s: number, h: number, l: number): string {
  const renderL = clamp(l, MIN_L_FOR_PREVIEW, MAX_L_FOR_PREVIEW);
  return `hsl(${h}, ${s}%, ${renderL}%)`;
}

export function lightPreviewSlice(l: number, h: number, s: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function trueColor(state: HSL): string {
  return `hsl(${state.h}, ${state.s}%, ${state.l}%)`;
}
