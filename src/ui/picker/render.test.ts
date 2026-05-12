import { describe, expect, it } from 'vitest';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
  trueColor,
} from './render';

describe('huePreviewSlice', () => {
  it('passes through s and l when both in safe range', () => {
    expect(huePreviewSlice(180, 60, 50)).toBe('hsl(180, 60%, 50%)');
  });

  it('clamps s up to 40 when actual s < 40 (so hue is visible)', () => {
    expect(huePreviewSlice(180, 0, 50)).toBe('hsl(180, 40%, 50%)');
    expect(huePreviewSlice(180, 39, 50)).toBe('hsl(180, 40%, 50%)');
  });

  it('clamps l into [40, 60] for hue tape rendering', () => {
    expect(huePreviewSlice(180, 70, 10)).toBe('hsl(180, 70%, 40%)');
    expect(huePreviewSlice(180, 70, 90)).toBe('hsl(180, 70%, 60%)');
  });
});

describe('satPreviewSlice', () => {
  it('passes through h and s', () => {
    expect(satPreviewSlice(50, 200, 50)).toBe('hsl(200, 50%, 50%)');
  });

  it('clamps l into [40, 60] for sat tape rendering', () => {
    expect(satPreviewSlice(50, 200, 10)).toBe('hsl(200, 50%, 40%)');
    expect(satPreviewSlice(50, 200, 95)).toBe('hsl(200, 50%, 60%)');
  });
});

describe('lightPreviewSlice', () => {
  it('passes all three values through unclamped', () => {
    expect(lightPreviewSlice(0, 200, 60)).toBe('hsl(200, 60%, 0%)');
    expect(lightPreviewSlice(50, 200, 60)).toBe('hsl(200, 60%, 50%)');
    expect(lightPreviewSlice(100, 200, 60)).toBe('hsl(200, 60%, 100%)');
  });
});

describe('trueColor', () => {
  it('returns the unclamped hsl string for the actual state', () => {
    expect(trueColor({ h: 200, s: 0, l: 10 })).toBe('hsl(200, 0%, 10%)');
    expect(trueColor({ h: 359, s: 100, l: 50 })).toBe('hsl(359, 100%, 50%)');
  });
});
