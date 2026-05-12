// src/scenes/grade.ts
// Grade scene: splits the screen horizontally — target on top, guess on bottom.
// A glass card on the split line shows the percentage with a 600ms count-up.
// "Next" advances the loop; "Share" hands off to the OS share sheet (or
// clipboard fallback).

import { scoreMatch } from '../color';
import { loadState, recordRound } from '../state';

export function mountGrade(
  root: HTMLElement,
  targetHex: string,
  guessHex: string,
  onNext: () => void
): () => void {
  root.innerHTML = '';
  const pct = scoreMatch(targetHex, guessHex);
  recordRound(pct);
  if (loadState().settings.haptics && 'vibrate' in navigator) navigator.vibrate(30);

  const top = document.createElement('div');
  top.style.cssText = `position:absolute;top:0;left:0;right:0;height:50%;background:${targetHex};`;

  const bot = document.createElement('div');
  bot.style.cssText = `position:absolute;bottom:0;left:0;right:0;height:50%;background:${guessHex};`;

  const card = document.createElement('div');
  card.className = 'glass';
  card.style.cssText =
    'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:24px 40px;text-align:center;min-width:200px;';

  const num = document.createElement('div');
  num.style.cssText =
    "font-family:'Fraunces Variable',Georgia,serif;font-weight:400;font-size:96px;color:var(--paper);line-height:1;";
  num.textContent = '0%';
  card.appendChild(num);

  const next = document.createElement('button');
  next.className = 'btn-primary';
  next.textContent = 'Next';
  next.style.cssText =
    'position:absolute;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:360px;bottom:calc(24px + env(safe-area-inset-bottom));';
  next.addEventListener('click', onNext);

  const share = document.createElement('button');
  share.className = 'btn-ghost';
  share.textContent = 'Share';
  share.style.cssText =
    'position:absolute;right:24px;top:calc(24px + env(safe-area-inset-top));';
  share.addEventListener('click', async () => {
    const text = `Mnemochrome — ${pct}% match (target ${targetHex} → guess ${guessHex})`;
    const nav = navigator as Navigator & { share?: (data: { text: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      try { await nav.share({ text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); } catch {}
    }
  });

  root.appendChild(top);
  root.appendChild(bot);
  root.appendChild(card);
  root.appendChild(next);
  root.appendChild(share);

  const start = performance.now();
  const DUR = 600;
  let raf = 0;
  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / DUR);
    const eased = 1 - Math.pow(1 - p, 3);
    num.textContent = `${Math.round(eased * pct)}%`;
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    root.innerHTML = '';
  };
}
