import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles.css';
import { mountTitle } from './scenes/title';
import { mountReveal } from './scenes/reveal';
import { mountMatch } from './scenes/match';
import { mountGrade } from './scenes/grade';
import { hslToHex, randomTarget } from './color';
import {
  bloomTransition,
  shutterTransition,
  washBloomTransition,
  type TransitionHandle,
} from './ui/transitions';

const root = document.querySelector<HTMLDivElement>('#app')!;
let cleanup: () => void = () => {};
let isFirst = true;

/**
 * Dispatch helper. On first call, mounts the scene directly. On subsequent
 * calls, runs the supplied transition; if no transition is given, falls back
 * to the legacy 100ms opacity fade.
 */
type Transition = (root: HTMLElement, onSwap: () => void) => TransitionHandle;

function go(fn: () => () => void, transition?: Transition) {
  if (isFirst) {
    isFirst = false;
    cleanup = fn();
    return;
  }
  const old = cleanup;
  const onSwap = () => {
    old();
    cleanup = fn();
  };
  if (transition) {
    transition(root, onSwap);
    return;
  }
  // Fallback for boundaries that don't yet have a dedicated transition.
  root.style.transition = 'opacity 100ms linear';
  root.style.opacity = '0';
  setTimeout(() => {
    onSwap();
    root.style.transition = 'none';
    root.style.opacity = '0';
    requestAnimationFrame(() => {
      root.style.transition = 'opacity 100ms linear';
      root.style.opacity = '1';
    });
  }, 100);
}

function title() {
  go(() => mountTitle(root, () => goReveal('first')));
}

/**
 * Reveal can be entered from two boundaries:
 *   - 'first'  → from the title screen (plain bloom)
 *   - 'grade'  → from a grade card (wash + bloom)
 */
function goReveal(from: 'first' | 'grade') {
  const target = randomTarget();
  const targetHex = hslToHex(target);
  const transition: Transition =
    from === 'first'
      ? (r, onSwap) => bloomTransition(r, targetHex, onSwap)
      : (r, onSwap) => washBloomTransition(r, targetHex, onSwap);
  go(
    () => mountReveal(root, target, targetHex, () => match(targetHex)),
    transition,
  );
}

function match(targetHex: string) {
  go(
    () => mountMatch(root, (guess) => grade(targetHex, guess)),
    (r, onSwap) => shutterTransition(r, onSwap),
  );
}

function grade(targetHex: string, guess: string) {
  // Match → Grade: dedicated pour transition is still on its way; for now
  // this boundary uses the legacy fade fallback.
  go(() => mountGrade(root, targetHex, guess, () => goReveal('grade')));
}

title();
