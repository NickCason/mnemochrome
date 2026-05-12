export interface HapticsHandle {
  tick: () => void;
  tickStrong: () => void;
  tickFirm: () => void;
}

function safeVibrate(ms: number): void {
  if (typeof navigator === 'undefined') return;
  const v = (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate;
  if (typeof v !== 'function') return;
  try { v.call(navigator, ms); } catch { /* no-op */ }
}

export function createHaptics(isEnabled: () => boolean): HapticsHandle {
  return {
    tick:       () => { if (isEnabled()) safeVibrate(8); },
    tickStrong: () => { if (isEnabled()) safeVibrate(16); },
    tickFirm:   () => { if (isEnabled()) safeVibrate(24); },
  };
}
