// src/scenes/match.ts
// Match scene: mounts the touch picker and a Lock In button. The picker's
// swatch becomes the current selection on every drag. When the user commits,
// we tint the scene's root to the picked color, slide the controls + button
// off the bottom of the screen, then fire onLockIn(hex) so main.ts can
// hand off to the lock-in transition for phase B (target slides in from
// above) and phase C (grade card animates in).

import { mountPicker } from '../ui/picker';
import { loadState } from '../state';

const SLIDE_OUT_MS = 240;

export function mountMatch(
  root: HTMLElement,
  onLockIn: (guessHex: string) => void
): () => void {
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const picker = mountPicker(
    root,
    { h: Math.floor(Math.random() * 360), s: 50, l: 50 },
    () => {},
  );

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Lock In';
  btn.style.cssText =
    'position:absolute;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:360px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:10;will-change:transform;';

  let lockedIn = false;
  let slideTimer = 0;

  btn.addEventListener('click', () => {
    if (lockedIn) return;
    lockedIn = true;

    const settings = loadState().settings;
    if (settings.haptics && 'vibrate' in navigator) navigator.vibrate(10);

    const hex = picker.getHex();
    // Tint the root so the area revealed beneath the sliding controls is the
    // user's picked color, not the ink background.
    root.style.background = hex;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      onLockIn(hex);
      return;
    }

    const ease = 'cubic-bezier(0.4, 0, 1, 1)'; // accelerate-out — snappy departure
    picker.controlsEl.style.transition = `transform ${SLIDE_OUT_MS}ms ${ease}`;
    picker.controlsEl.style.transform = 'translateY(110vh)';
    btn.style.transition = `transform ${SLIDE_OUT_MS}ms ${ease}`;
    btn.style.transform = 'translateX(-50%) translateY(110vh)';

    slideTimer = window.setTimeout(() => {
      slideTimer = 0;
      onLockIn(hex);
    }, SLIDE_OUT_MS + 10);
  });
  root.appendChild(btn);

  return () => {
    if (slideTimer) clearTimeout(slideTimer);
    picker.destroy();
    btn.remove();
    root.innerHTML = '';
  };
}
