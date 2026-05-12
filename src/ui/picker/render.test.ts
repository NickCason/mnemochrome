import { describe, expect, it } from 'vitest';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
  trueColor,
} from './render';

describe('huePreviewSlice', () => {
  it('passes through when S and L are in healthy range', () => {
    expect(huePreviewSlice(180, 60, 50)).toBe('hsl(180, 60%, 50%)');
    expect(huePreviewSlice(0, 30, 30)).toBe('hsl(0, 30%, 30%)');
  });

  it('floors S to a low tint when actual S is below threshold', () => {
    expect(huePreviewSlice(180, 0, 50)).toBe('hsl(180, 25%, 50%)');
    expect(huePreviewSlice(180, 24, 50)).toBe('hsl(180, 25%, 50%)');
  });

  it('clamps L only when actual L is at an extreme', () => {
    expect(huePreviewSlice(180, 70, 5)).toBe('hsl(180, 70%, 35%)');
    expect(huePreviewSlice(180, 70, 95)).toBe('hsl(180, 70%, 65%)');
  });

  it('leaves L alone outside the extreme thresholds', () => {
    expect(huePreviewSlice(180, 70, 20)).toBe('hsl(180, 70%, 20%)');
    expect(huePreviewSlice(180, 70, 80)).toBe('hsl(180, 70%, 80%)');
  });
});

describe('satPreviewSlice', () => {
  it('passes through verbatim', () => {
    expect(satPreviewSlice(50, 200, 50)).toBe('hsl(200, 50%, 50%)');
    expect(satPreviewSlice(0, 200, 10)).toBe('hsl(200, 0%, 10%)');
  });
});

describe('lightPreviewSlice', () => {
  it('passes through verbatim', () => {
    expect(lightPreviewSlice(0, 200, 60)).toBe('hsl(200, 60%, 0%)');
    expect(lightPreviewSlice(50, 200, 60)).toBe('hsl(200, 60%, 50%)');
    expect(lightPreviewSlice(100, 200, 60)).toBe('hsl(200, 60%, 100%)');
  });
});

describe('trueColor', () => {
  it('returns the unclamped hsl string for the state', () => {
    expect(trueColor({ h: 200, s: 0, l: 10 })).toBe('hsl(200, 0%, 10%)');
    expect(trueColor({ h: 359, s: 100, l: 50 })).toBe('hsl(359, 100%, 50%)');
  });
});
