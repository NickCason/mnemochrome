import { describe, expect, it } from 'vitest';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
  trueColor,
} from './render';

describe('preview slices', () => {
  it('huePreviewSlice formats hsl with all three values verbatim', () => {
    expect(huePreviewSlice(180, 60, 50)).toBe('hsl(180, 60%, 50%)');
    expect(huePreviewSlice(0, 0, 10)).toBe('hsl(0, 0%, 10%)');
    expect(huePreviewSlice(359, 100, 90)).toBe('hsl(359, 100%, 90%)');
  });

  it('satPreviewSlice formats hsl with all three values verbatim', () => {
    expect(satPreviewSlice(50, 200, 50)).toBe('hsl(200, 50%, 50%)');
    expect(satPreviewSlice(0, 200, 10)).toBe('hsl(200, 0%, 10%)');
  });

  it('lightPreviewSlice formats hsl with all three values verbatim', () => {
    expect(lightPreviewSlice(0, 200, 60)).toBe('hsl(200, 60%, 0%)');
    expect(lightPreviewSlice(50, 200, 60)).toBe('hsl(200, 60%, 50%)');
    expect(lightPreviewSlice(100, 200, 60)).toBe('hsl(200, 60%, 100%)');
  });
});

describe('trueColor', () => {
  it('returns the hsl string for the state object', () => {
    expect(trueColor({ h: 200, s: 0, l: 10 })).toBe('hsl(200, 0%, 10%)');
    expect(trueColor({ h: 359, s: 100, l: 50 })).toBe('hsl(359, 100%, 50%)');
  });
});
