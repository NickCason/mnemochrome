// src/scenes/reveal.ts
// Reveal scene: fills the screen with a target color for the configured view
// time, while an edge-ring countdown retracts. Target is supplied by the
// caller so the bloom transition into this scene can use the same colour as
// what will fill the screen.

import { mountCountdown } from '../ui/countdown';
import type { HSL } from '../color';
import { loadState } from '../state';

export function mountReveal(
  root: HTMLElement,
  _target: HSL,
  targetHex: string,
  onDone: () => void
): () => void {
  root.innerHTML = '';
  root.style.background = targetHex;
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
