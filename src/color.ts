import { formatHex, parse, differenceCiede2000 } from 'culori';

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
