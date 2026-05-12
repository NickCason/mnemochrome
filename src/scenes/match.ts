// src/scenes/match.ts
// Match scene: mounts the touch picker and a Lock In button. The picker's
// background becomes the current selection on every drag. When the user
// commits, fire onLockIn(hex).

import { mountPicker } from '../ui/picker';
import { loadState } from '../state';

export function mountMatch(
  root: HTMLElement,
  onLockIn: (guessHex: string) => void
): () => void {
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const picker = mountPicker(root, { h: 0, s: 0, l: 50 }, () => {});

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Lock In';
  btn.style.cssText =
    'position:absolute;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:360px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:10;';
  btn.addEventListener('click', () => {
    if (loadState().settings.haptics && 'vibrate' in navigator) navigator.vibrate(10);
    onLockIn(picker.getHex());
  });
  root.appendChild(btn);

  return () => {
    picker.destroy();
    btn.remove();
    root.innerHTML = '';
  };
}
