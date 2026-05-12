import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles.css';
import { mountTitle } from './scenes/title';
import { mountReveal } from './scenes/reveal';
import { mountMatch } from './scenes/match';
import { mountGrade } from './scenes/grade';

const root = document.querySelector<HTMLDivElement>('#app')!;
let cleanup: () => void = () => {};
let isFirst = true;

function go(fn: () => () => void) {
  if (isFirst) {
    isFirst = false;
    cleanup = fn();
    return;
  }
  const old = cleanup;
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
  go(() => mountReveal(root, (_t, targetHex) => match(targetHex)));
}
function match(targetHex: string) {
  go(() => mountMatch(root, (guess) => grade(targetHex, guess)));
}
function grade(targetHex: string, guess: string) {
  go(() => mountGrade(root, targetHex, guess, () => reveal()));
}

title();
