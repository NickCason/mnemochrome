// src/scenes/reveal.ts
// Reveal scene: fills the screen with a target color for the configured view
// time, while an edge-ring countdown retracts. A contemplative hint phrase
// (one of 100, randomly picked each round) fades in at the top of the screen
// to give the player a beat to settle into the colour before the picker.

import { mountCountdown } from '../ui/countdown';
import type { HSL } from '../color';
import { loadState } from '../state';
import { pickRevealPhrase } from '../reveal-phrases';

export function mountReveal(
  root: HTMLElement,
  _target: HSL,
  targetHex: string,
  onDone: () => void
): () => void {
  root.innerHTML = '';
  root.style.background = targetHex;

  const hint = document.createElement('div');
  hint.className = 'reveal-hint';
  hint.textContent = pickRevealPhrase();
  root.appendChild(hint);

  const cleanupCountdown = mountCountdown(
    root,
    loadState().settings.viewTimeMs,
    onDone,
  );
  return () => {
    cleanupCountdown();
    root.innerHTML = '';
  };
}
