import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createHaptics } from './haptics';

describe('createHaptics', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  const origVibrate = (navigator as Navigator & { vibrate?: unknown }).vibrate;

  beforeEach(() => {
    vibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
  });

  afterEach(() => {
    if (origVibrate === undefined) {
      delete (navigator as unknown as { vibrate?: unknown }).vibrate;
    } else {
      Object.defineProperty(navigator, 'vibrate', { value: origVibrate, configurable: true, writable: true });
    }
  });

  it('tick() vibrates 8ms when enabled', () => {
    const h = createHaptics(() => true);
    h.tick();
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('tickStrong() vibrates 16ms when enabled', () => {
    const h = createHaptics(() => true);
    h.tickStrong();
    expect(vibrate).toHaveBeenCalledWith(16);
  });

  it('tickFirm() vibrates 24ms when enabled', () => {
    const h = createHaptics(() => true);
    h.tickFirm();
    expect(vibrate).toHaveBeenCalledWith(24);
  });

  it('does not vibrate when disabled', () => {
    const h = createHaptics(() => false);
    h.tick();
    h.tickStrong();
    h.tickFirm();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not throw when navigator.vibrate is undefined', () => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
    const h = createHaptics(() => true);
    expect(() => { h.tick(); h.tickStrong(); h.tickFirm(); }).not.toThrow();
  });
});
