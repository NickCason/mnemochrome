import { describe, expect, it } from 'vitest';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
  trueColor,
} from './render';

describe('preview slices (no clamp)', () => {
  it('huePreviewSlice formats hsl verbatim', () => {
    expect(huePreviewSlice(180, 60, 50)).toBe('hsl(180, 60%, 50%)');
    expect(huePreviewSlice(0, 0, 0)).toBe('hsl(0, 0%, 0%)');
    expect(huePreviewSlice(359, 100, 100)).toBe('hsl(359, 100%, 100%)');
  });

  it('satPreviewSlice formats hsl verbatim', () => {
    expect(satPreviewSlice(50, 200, 50)).toBe('hsl(200, 50%, 50%)');
  });

  it('lightPreviewSlice formats hsl verbatim', () => {
    expect(lightPreviewSlice(0, 200, 60)).toBe('hsl(200, 60%, 0%)');
    expect(lightPreviewSlice(100, 200, 60)).toBe('hsl(200, 60%, 100%)');
  });
});

describe('trueColor', () => {
  it('returns hsl string for the state', () => {
    expect(trueColor({ h: 200, s: 0, l: 10 })).toBe('hsl(200, 0%, 10%)');
    expect(trueColor({ h: 359, s: 100, l: 50 })).toBe('hsl(359, 100%, 50%)');
  });
});
