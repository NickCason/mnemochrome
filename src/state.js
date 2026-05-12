const KEY_PB = 'mnemo:pb';
const KEY_LAST10 = 'mnemo:last10';
const KEY_TOTAL = 'mnemo:total';
const KEY_SETTINGS = 'mnemo:settings';
const DEFAULT_SETTINGS = { viewTimeMs: 3000, haptics: true };
function readInt(key, fallback) {
    const v = localStorage.getItem(key);
    return v === null ? fallback : Number.parseInt(v, 10) || fallback;
}
function readJSON(key, fallback) {
    const v = localStorage.getItem(key);
    if (v === null)
        return fallback;
    try {
        return JSON.parse(v);
    }
    catch {
        return fallback;
    }
}
export function loadState() {
    return {
        pb: readInt(KEY_PB, 0),
        last10: readJSON(KEY_LAST10, []),
        total: readInt(KEY_TOTAL, 0),
        settings: { ...DEFAULT_SETTINGS, ...readJSON(KEY_SETTINGS, {}) },
    };
}
export function recordRound(pct) {
    const s = loadState();
    if (pct > s.pb)
        localStorage.setItem(KEY_PB, String(pct));
    const next = [...s.last10, pct].slice(-10);
    localStorage.setItem(KEY_LAST10, JSON.stringify(next));
    localStorage.setItem(KEY_TOTAL, String(s.total + 1));
}
export function updateSettings(patch) {
    const cur = loadState().settings;
    localStorage.setItem(KEY_SETTINGS, JSON.stringify({ ...cur, ...patch }));
}
export function resetStats() {
    ['mnemo:pb', 'mnemo:last10', 'mnemo:total', 'mnemo:settings'].forEach(k => localStorage.removeItem(k));
}
export function avgLast10(last10) {
    if (last10.length === 0)
        return 0;
    return Math.round(last10.reduce((a, b) => a + b, 0) / last10.length);
}
