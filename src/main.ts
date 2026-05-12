import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles.css';
import { mountTitle } from './scenes/title';
import { mountReveal } from './scenes/reveal';
import { mountMatch } from './scenes/match';
import { mountGrade } from './scenes/grade';
import { hslToHex, randomTarget } from './color';
import { bloomTransition } from './ui/transitions';

const root = document.querySelector<HTMLDivElement>('#app')!;
let cleanup: () => void = () => {};
let isFirst = true;

/**
 * Dispatch helper. On first call, mounts the scene directly. On subsequent
 * calls, runs the appropriate transition (if `bloomColor` is given, blooms
 * with that color; otherwise falls back to a brief opacity fade).
 */
function go(fn: () => () => void, bloomColor?: string) {
  if (isFirst) {
    isFirst = false;
    cleanup = fn();
    return;
  }
  const old = cleanup;
  if (bloomColor) {
    bloomTransition(root, bloomColor, () => {
      old();
      cleanup = fn();
    });
    return;
  }
  // Fallback: existing 100ms fade. Will be replaced per-boundary with
  // dedicated transitions (shutter, pour, wash+bloom) in follow-up commits.
  root.style.transition = 'opacity 100ms linear';
  root.style.opacity = '0';
  setTimeout(() => {
    old();
    cleanup = fn();
    root.style.transition = 'none';
    root.style.opacity = '0';
    requestAnimationFrame(() => {
      root.style.transition = 'opacity 100ms linear';
      root.style.opacity = '1';
    });
  }, 100);
}

function title() {
  go(() => mountTitle(root, () => reveal()));
}
function reveal() {
  // Generate the target up here so the bloom into the reveal scene can use
  // the exact color the reveal will fill the screen with.
  const target = randomTarget();
  const targetHex = hslToHex(target);
  go(
    () => mountReveal(root, target, targetHex, () => match(targetHex)),
    targetHex,
  );
}
function match(targetHex: string) {
  go(() => mountMatch(root, (guess) => grade(targetHex, guess)));
}
function grade(targetHex: string, guess: string) {
  go(() => mountGrade(root, targetHex, guess, () => reveal()));
}

title();
