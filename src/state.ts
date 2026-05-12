export type Settings = { viewTimeMs: number; haptics: boolean };
export type State = { pb: number; last10: number[]; total: number; settings: Settings };

const KEY_PB = 'mnemo:pb';
const KEY_LAST10 = 'mnemo:last10';
const KEY_TOTAL = 'mnemo:total';
const KEY_SETTINGS = 'mnemo:settings';

const DEFAULT_SETTINGS: Settings = { viewTimeMs: 3000, haptics: true };

function readInt(key: string, fallback: number): number {
  const v = localStorage.getItem(key);
  return v === null ? fallback : Number.parseInt(v, 10) || fallback;
}

function readJSON<T>(key: string, fallback: T): T {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

export function loadState(): State {
  return {
    pb: readInt(KEY_PB, 0),
    last10: readJSON<number[]>(KEY_LAST10, []),
    total: readInt(KEY_TOTAL, 0),
    settings: { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>(KEY_SETTINGS, {}) },
  };
}

export function recordRound(pct: number): void {
  const s = loadState();
  if (pct > s.pb) localStorage.setItem(KEY_PB, String(pct));
  const next = [...s.last10, pct].slice(-10);
  localStorage.setItem(KEY_LAST10, JSON.stringify(next));
  localStorage.setItem(KEY_TOTAL, String(s.total + 1));
}

export function updateSettings(patch: Partial<Settings>): void {
  const cur = loadState().settings;
  localStorage.setItem(KEY_SETTINGS, JSON.stringify({ ...cur, ...patch }));
}

export function resetStats(): void {
  ['mnemo:pb', 'mnemo:last10', 'mnemo:total', 'mnemo:settings'].forEach(k => localStorage.removeItem(k));
}

export function avgLast10(last10: number[]): number {
  if (last10.length === 0) return 0;
  return Math.round(last10.reduce((a, b) => a + b, 0) / last10.length);
}
