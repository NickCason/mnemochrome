import { describe, it, expect } from 'vitest';
import { pickSplashHsl } from './splash';

describe('pickSplashHsl', () => {
  it('never produces a hue in the magenta exclusion band [300, 340]', () => {
    for (let i = 0; i < 2000; i++) {
      const { h } = pickSplashHsl();
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(h < 300 || h > 340).toBe(true);
    }
  });

  it('saturation falls in [70, 80]', () => {
    for (let i = 0; i < 500; i++) {
      const { s } = pickSplashHsl();
      expect(s).toBeGreaterThanOrEqual(70);
      expect(s).toBeLessThanOrEqual(80);
    }
  });

  it('lightness falls in [50, 55]', () => {
    for (let i = 0; i < 500; i++) {
      const { l } = pickSplashHsl();
      expect(l).toBeGreaterThanOrEqual(50);
      expect(l).toBeLessThanOrEqual(55);
    }
  });
});
