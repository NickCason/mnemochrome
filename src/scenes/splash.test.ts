import { describe, it, expect } from 'vitest';
import { pickSplashHsl, shouldSkipSplash } from './splash';

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

describe('shouldSkipSplash', () => {
  const setMatchMedia = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches,
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  };

  it('returns true when prefers-reduced-motion: reduce matches', () => {
    setMatchMedia(true);
    expect(shouldSkipSplash()).toBe(true);
  });

  it('returns false when prefers-reduced-motion does not match', () => {
    setMatchMedia(false);
    expect(shouldSkipSplash()).toBe(false);
  });
});
