import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, recordRound, resetStats, updateSettings } from './state';

beforeEach(() => localStorage.clear());

describe('state', () => {
  it('fresh load returns defaults', () => {
    const s = loadState();
    expect(s.pb).toBe(0);
    expect(s.last10).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.settings.viewTimeMs).toBe(3000);
    expect(s.settings.haptics).toBe(true);
  });

  it('recordRound updates pb, last10, total', () => {
    recordRound(82);
    recordRound(91);
    const s = loadState();
    expect(s.pb).toBe(91);
    expect(s.last10).toEqual([82, 91]);
    expect(s.total).toBe(2);
  });

  it('last10 caps at 10 entries', () => {
    for (let i = 1; i <= 12; i++) recordRound(i * 5);
    const s = loadState();
    expect(s.last10).toHaveLength(10);
    expect(s.last10[0]).toBe(15);
    expect(s.last10[9]).toBe(60);
  });

  it('updateSettings persists', () => {
    updateSettings({ viewTimeMs: 1500, haptics: false });
    expect(loadState().settings).toEqual({ viewTimeMs: 1500, haptics: false });
  });

  it('resetStats clears everything', () => {
    recordRound(50);
    updateSettings({ viewTimeMs: 5000, haptics: false });
    resetStats();
    const s = loadState();
    expect(s.pb).toBe(0);
    expect(s.last10).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.settings.viewTimeMs).toBe(3000);
  });
});
