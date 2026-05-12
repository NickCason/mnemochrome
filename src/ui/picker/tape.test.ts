import { describe, expect, it } from 'vitest';
import {
  velocityScale,
  dragToValueDelta,
  normalizeValue,
  isTap,
  V_SLOW,
  V_FAST,
  MAX_SCALE,
  SLOT_PITCH,
  TAP_MAX_DURATION_MS,
  TAP_MAX_MOVE_PX,
} from './tape';

describe('velocityScale', () => {
  it('returns 1 at zero velocity', () => {
    expect(velocityScale(0)).toBe(1);
  });
  it('returns 1 at or below V_SLOW', () => {
    expect(velocityScale(V_SLOW)).toBe(1);
    expect(velocityScale(V_SLOW * 0.5)).toBe(1);
  });
  it('returns MAX_SCALE at or above V_FAST', () => {
    expect(velocityScale(V_FAST)).toBe(MAX_SCALE);
    expect(velocityScale(V_FAST * 2)).toBe(MAX_SCALE);
  });
  it('interpolates linearly between V_SLOW and V_FAST', () => {
    const mid = (V_SLOW + V_FAST) / 2;
    const expected = 1 + ((MAX_SCALE - 1) / 2);
    expect(velocityScale(mid)).toBeCloseTo(expected, 5);
  });
});

describe('dragToValueDelta', () => {
  it('drag up by one slot at slow velocity yields +1', () => {
    expect(dragToValueDelta(-SLOT_PITCH, V_SLOW * 0.5)).toBeCloseTo(1, 5);
  });
  it('drag down by one slot at slow velocity yields -1', () => {
    expect(dragToValueDelta(SLOT_PITCH, V_SLOW * 0.5)).toBeCloseTo(-1, 5);
  });
  it('drag up by one slot at max velocity yields +MAX_SCALE', () => {
    expect(dragToValueDelta(-SLOT_PITCH, V_FAST)).toBeCloseTo(MAX_SCALE, 5);
  });
  it('zero drag yields zero', () => {
    expect(dragToValueDelta(0, 5)).toBe(0);
  });
});

describe('normalizeValue', () => {
  it('hue wraps positively past 360', () => {
    expect(normalizeValue(370, 'h')).toBe(10);
    expect(normalizeValue(720, 'h')).toBe(0);
  });
  it('hue wraps negatively past 0', () => {
    expect(normalizeValue(-10, 'h')).toBe(350);
    expect(normalizeValue(-360, 'h')).toBe(0);
  });
  it('sat clamps to [0, 100]', () => {
    expect(normalizeValue(-5, 's')).toBe(0);
    expect(normalizeValue(50, 's')).toBe(50);
    expect(normalizeValue(105, 's')).toBe(100);
  });
  it('light clamps to [0, 100]', () => {
    expect(normalizeValue(-5, 'l')).toBe(0);
    expect(normalizeValue(50, 'l')).toBe(50);
    expect(normalizeValue(105, 'l')).toBe(100);
  });
});

describe('isTap', () => {
  it('short + small movement is a tap', () => {
    expect(isTap(150, 4)).toBe(true);
  });
  it('too long is not a tap', () => {
    expect(isTap(TAP_MAX_DURATION_MS + 10, 2)).toBe(false);
  });
  it('too much movement is not a tap', () => {
    expect(isTap(100, TAP_MAX_MOVE_PX + 1)).toBe(false);
  });
  it('exactly at thresholds is still a tap', () => {
    expect(isTap(TAP_MAX_DURATION_MS, TAP_MAX_MOVE_PX)).toBe(true);
  });
});
