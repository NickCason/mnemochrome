// src/scenes/reveal.ts
// Reveal scene: fills the screen with a random target color for the configured
// view time, while an edge-ring countdown retracts. Calls onDone(target, hex)
// when the timer elapses.
import { mountCountdown } from '../ui/countdown';
import { hslToHex, randomTarget } from '../color';
import { loadState } from '../state';
export function mountReveal(root, onDone) {
    root.innerHTML = '';
    const target = randomTarget();
    const targetHex = hslToHex(target);
    root.style.background = targetHex;
    const cleanupCountdown = mountCountdown(root, loadState().settings.viewTimeMs, () => onDone(target, targetHex));
    return () => {
        cleanupCountdown();
        root.innerHTML = '';
    };
}
