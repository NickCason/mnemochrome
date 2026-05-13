import { describe, expect, it } from 'vitest';
import { padToSL, slToPad, clampSL } from './sl-pad';

describe('padToSL', () => {
  it('maps top-left to (s=0, l=100)', () => {
    expect(padToSL(0, 0, 100, 100)).toEqual({ s: 0, l: 100 });
  });
  it('maps top-right to (s=100, l=100)', () => {
    expect(padToSL(100, 0, 100, 100)).toEqual({ s: 100, l: 100 });
  });
  it('maps bottom-left to (s=0, l=0)', () => {
    expect(padToSL(0, 100, 100, 100)).toEqual({ s: 0, l: 0 });
  });
  it('maps bottom-right to (s=100, l=0)', () => {
    expect(padToSL(100, 100, 100, 100)).toEqual({ s: 100, l: 0 });
  });
  it('maps center to (50, 50)', () => {
    expect(padToSL(50, 50, 100, 100)).toEqual({ s: 50, l: 50 });
  });
  it('clamps outside coords', () => {
    expect(padToSL(-10, -10, 100, 100)).toEqual({ s: 0, l: 100 });
    expect(padToSL(110, 110, 100, 100)).toEqual({ s: 100, l: 0 });
  });
  it('returns center on zero dimensions', () => {
    expect(padToSL(50, 50, 0, 0)).toEqual({ s: 0, l: 0 });
  });
});

describe('slToPad', () => {
  it('maps (s=0, l=100) to top-left', () => {
    expect(slToPad(0, 100, 100, 100)).toEqual({ x: 0, y: 0 });
  });
  it('maps (s=100, l=0) to bottom-right', () => {
    expect(slToPad(100, 0, 100, 100)).toEqual({ x: 100, y: 100 });
  });
  it('maps (s=50, l=50) to center', () => {
    expect(slToPad(50, 50, 100, 100)).toEqual({ x: 50, y: 50 });
  });
});

describe('clampSL', () => {
  it('clamps both axes to 0..100', () => {
    expect(clampSL({ s: -5, l: 150 })).toEqual({ s: 0, l: 100 });
    expect(clampSL({ s: 105, l: -10 })).toEqual({ s: 100, l: 0 });
  });
  it('passes through in-range values', () => {
    expect(clampSL({ s: 42, l: 73 })).toEqual({ s: 42, l: 73 });
  });
});
