import { formatHex, converter } from 'culori';

const toHsl = converter('hsl');

export type HSL = { h: number; s: number; l: number };
export type RGB = { r: number; g: number; b: number };

export function hslToHex(c: HSL): string {
  return formatHex({ mode: 'hsl', h: c.h, s: c.s / 100, l: c.l / 100 })!;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.toLowerCase();
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function randomTarget(): HSL {
  return {
    h: Math.random() * 360,
    s: 10 + Math.random() * 90,
    l: 15 + Math.random() * 70,
  };
}

// Overall match is a weighted average of the per-axis HSL closenesses we
// already display, so the grade card's headline number reconciles with its
// breakdown. Hue is weighted by mean saturation: when one or both colors are
// near-gray, hue is "undefined" and shouldn't inflate or deflate the score.
//
// Why not ΔE2000? Perceptually-uniform Lab distance is more accurate to human
// vision but doesn't agree numerically with HSL-space breakdowns, which made
// the headline % feel disconnected from the per-axis stats. The per-axis
// breakdown is what players see and adjust against, so the headline now
// matches that frame.
export function scoreMatch(targetHex: string, guessHex: string): number {
  const a = axisCloseness(targetHex, guessHex);
  const t = hexToHsl(targetHex);
  const g = hexToHsl(guessHex);

  const bothAchromatic = t.s < 1.5 && g.s < 1.5;
  if (bothAchromatic) {
    // No meaningful hue (and sat is degenerate when both ≈ 0) — among grays,
    // only lightness is a real axis, so the headline matches it exactly.
    return a.lightness;
  }

  // Hue contribution is scaled by mean chroma; a low-saturation target shouldn't
  // punish a guess on hue precision the player can barely perceive.
  const meanSatWeight = ((t.s + g.s) / 200); // 0..1
  const weights = meanSatWeight + 2; // sat + light each contribute weight 1
  const sum = a.hue * meanSatWeight + a.saturation + a.lightness;
  return Math.max(0, Math.min(100, Math.round(sum / weights)));
}

export function hexToHsl(hex: string): HSL {
  const c = toHsl(hex);
  if (!c) return { h: 0, s: 0, l: 0 };
  return {
    h: c.h ?? 0,
    s: (c.s ?? 0) * 100,
    l: (c.l ?? 0) * 100,
  };
}

export interface AxisCloseness {
  hue: number;       // 0..100
  saturation: number;
  lightness: number;
}

// Per-axis closeness for the grade breakdown. Hue is circular, so distance is
// the shorter way around the wheel (max 180°). Sat and lightness are linear
// 0..100. When either color is effectively achromatic (s < 1.5%), hue is
// reported as 100 — chromatic distance between two near-grays is not
// meaningful and shouldn't be penalized.
export function axisCloseness(targetHex: string, guessHex: string): AxisCloseness {
  const t = hexToHsl(targetHex);
  const g = hexToHsl(guessHex);

  let hue = 100;
  if (t.s > 1.5 && g.s > 1.5) {
    const raw = Math.abs(t.h - g.h);
    const dH = Math.min(raw, 360 - raw);
    hue = clamp01(1 - dH / 180);
  }

  const saturation = clamp01(1 - Math.abs(t.s - g.s) / 100);
  const lightness = clamp01(1 - Math.abs(t.l - g.l) / 100);
  return { hue, saturation, lightness };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v * 100)));
}
