import { describe, expect, it } from 'vitest';
import {
  pxToHue,
  hueToPx,
  snapHue,
  isTap,
  HUE_RANGE,
  TAP_MAX_DURATION_MS,
  TAP_MAX_MOVE_PX,
} from './hue-strip';

describe('pxToHue', () => {
  it('maps 0 to 0', () => {
    expect(pxToHue(0, 360)).toBe(0);
  });
  it('maps width to HUE_RANGE', () => {
    expect(pxToHue(360, 360)).toBe(HUE_RANGE);
  });
  it('maps half to 180', () => {
    expect(pxToHue(180, 360)).toBe(180);
  });
  it('clamps below zero', () => {
    expect(pxToHue(-50, 360)).toBe(0);
  });
  it('clamps above width', () => {
    expect(pxToHue(500, 360)).toBe(HUE_RANGE);
  });
  it('returns 0 when width is zero', () => {
    expect(pxToHue(50, 0)).toBe(0);
  });
});

describe('hueToPx', () => {
  it('maps 0 to 0', () => {
    expect(hueToPx(0, 360)).toBe(0);
  });
  it('maps 180 to half', () => {
    expect(hueToPx(180, 360)).toBe(180);
  });
  it('maps HUE_RANGE to width', () => {
    expect(hueToPx(HUE_RANGE, 360)).toBe(360);
  });
  it('clamps negative to 0', () => {
    expect(hueToPx(-10, 360)).toBe(0);
  });
  it('clamps above HUE_RANGE to width', () => {
    expect(hueToPx(400, 360)).toBe(360);
  });
});

describe('snapHue', () => {
  it('rounds to nearest integer', () => {
    expect(snapHue(0.4)).toBe(0);
    expect(snapHue(0.6)).toBe(1);
    expect(snapHue(127.5)).toBe(128);
  });
  it('caps at HUE_RANGE - 1 to avoid the 360 == 0 wrap edge case', () => {
    expect(snapHue(359.7)).toBe(359);
    expect(snapHue(HUE_RANGE)).toBe(HUE_RANGE - 1);
  });
  it('floors negative to 0', () => {
    expect(snapHue(-5)).toBe(0);
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
