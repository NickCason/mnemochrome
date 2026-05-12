import { formatHex, parse, differenceCiede2000, converter } from 'culori';

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

const deltaE = differenceCiede2000();

export function scoreMatch(targetHex: string, guessHex: string): number {
  const a = parse(targetHex);
  const b = parse(guessHex);
  if (!a || !b) return 0;
  const d = deltaE(a, b);
  const pct = 100 * (1 - d / 50);
  return Math.max(0, Math.min(100, Math.round(pct)));
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
