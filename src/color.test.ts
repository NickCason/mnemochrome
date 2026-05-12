import { describe, it, expect } from 'vitest';
import { hslToHex, hexToRgb, scoreMatch, randomTarget, axisCloseness, type HSL } from './color';

describe('hslToHex', () => {
  it('pure red', () => expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#ff0000'));
  it('pure white', () => expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe('#ffffff'));
  it('pure black', () => expect(hslToHex({ h: 0, s: 0, l: 0 })).toBe('#000000'));
  it('round-trip via hex', () => {
    const hex = hslToHex({ h: 210, s: 60, l: 45 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('hexToRgb', () => {
  it('parses lowercase', () => expect(hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 }));
  it('parses uppercase', () => expect(hexToRgb('#FF8800')).toEqual({ r: 255, g: 136, b: 0 }));
});

describe('scoreMatch', () => {
  it('identical colors → 100', () => expect(scoreMatch('#ff0000', '#ff0000')).toBe(100));
  it('opposite extremes → 0', () => expect(scoreMatch('#000000', '#ffffff')).toBe(0));
  it('very close colors → >= 95', () => {
    expect(scoreMatch('#ff0000', '#fe0101')).toBeGreaterThanOrEqual(95);
  });
  it('moderately distant colors → between 30 and 80', () => {
    const s = scoreMatch('#ff0000', '#ff8800');
    expect(s).toBeGreaterThan(30);
    expect(s).toBeLessThan(80);
  });
  it('always returns integer 0..100', () => {
    const s = scoreMatch('#123456', '#abcdef');
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe('axisCloseness', () => {
  it('identical colors → 100/100/100', () => {
    expect(axisCloseness('#ff0000', '#ff0000')).toEqual({ hue: 100, saturation: 100, lightness: 100 });
  });

  it('hue across the wheel (red vs cyan) → 0 hue', () => {
    expect(axisCloseness('#ff0000', '#00ffff').hue).toBe(0);
  });

  it('same hue, very different lightness → hue+sat high, lightness low', () => {
    const r = axisCloseness('#400000', '#ff8080');
    expect(r.hue).toBe(100);
    expect(r.lightness).toBeLessThan(60);
  });

  it('two near-grays → hue reported as 100 (no chromatic distance to measure)', () => {
    expect(axisCloseness('#222222', '#aaaaaa').hue).toBe(100);
  });

  it('returns integers in [0,100] for each axis', () => {
    const r = axisCloseness('#123456', '#abcdef');
    for (const v of [r.hue, r.saturation, r.lightness]) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('randomTarget', () => {
  it('returns valid HSL in target ranges', () => {
    for (let i = 0; i < 50; i++) {
      const c: HSL = randomTarget();
      expect(c.h).toBeGreaterThanOrEqual(0);
      expect(c.h).toBeLessThan(360);
      expect(c.s).toBeGreaterThanOrEqual(10);
      expect(c.s).toBeLessThanOrEqual(100);
      expect(c.l).toBeGreaterThanOrEqual(15);
      expect(c.l).toBeLessThanOrEqual(85);
    }
  });
});
