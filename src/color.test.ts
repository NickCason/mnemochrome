import { describe, it, expect } from 'vitest';
import { hslToHex, hexToRgb, scoreMatch, randomTarget, type HSL } from './color';

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
