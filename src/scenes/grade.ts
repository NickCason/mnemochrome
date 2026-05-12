// src/scenes/grade.ts
// Grade scene: target color top half, guess bottom half. A glass card on the
// split line shows the ΔE2000 percentage with a 600ms count-up, plus a row of
// per-axis closeness scores (hue / saturation / lightness). Next advances the
// loop; Share renders a curated PNG via the share-card helper.

import { scoreMatch, axisCloseness } from '../color';
import { loadState, recordRound } from '../state';
import { shareRound } from '../ui/share-card';

export function mountGrade(
  root: HTMLElement,
  targetHex: string,
  guessHex: string,
  onNext: () => void
): () => void {
  root.innerHTML = '';
  const pct = scoreMatch(targetHex, guessHex);
  const axes = axisCloseness(targetHex, guessHex);
  recordRound(pct);
  if (loadState().settings.haptics && 'vibrate' in navigator) navigator.vibrate(30);

  const top = document.createElement('div');
  top.style.cssText = `position:absolute;top:0;left:0;right:0;height:50%;background:${targetHex};`;

  const bot = document.createElement('div');
  bot.style.cssText = `position:absolute;bottom:0;left:0;right:0;height:50%;background:${guessHex};`;

  const card = document.createElement('div');
  card.className = 'glass';
  card.style.cssText =
    'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 28px 18px;text-align:center;min-width:280px;display:flex;flex-direction:column;align-items:center;gap:14px;';

  const num = document.createElement('div');
  num.style.cssText =
    "font-family:'Fraunces Variable',Georgia,serif;font-weight:400;font-size:88px;color:var(--paper);line-height:1;font-feature-settings:'tnum';";
  num.textContent = '0%';

  const divider = document.createElement('div');
  divider.style.cssText = 'width:80%;height:1px;background:var(--glass-border, rgba(236,230,218,0.14));';

  const axisRow = document.createElement('div');
  axisRow.style.cssText = 'display:flex;gap:18px;';

  function axisCell(label: string): { el: HTMLElement; setValue: (v: number) => void } {
    const cell = document.createElement('div');
    cell.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:4px;min-width:64px;';
    const lab = document.createElement('div');
    lab.className = 'label-micro';
    lab.textContent = label;
    const val = document.createElement('div');
    val.style.cssText =
      "font-family:'Fraunces Variable',Georgia,serif;font-weight:400;font-size:24px;color:var(--paper);line-height:1;font-feature-settings:'tnum';";
    val.textContent = '0%';
    cell.appendChild(lab);
    cell.appendChild(val);
    return {
      el: cell,
      setValue: (v: number) => {
        val.textContent = `${v}%`;
      },
    };
  }

  const hueCell = axisCell('Hue');
  const satCell = axisCell('Sat');
  const lightCell = axisCell('Light');
  axisRow.appendChild(hueCell.el);
  axisRow.appendChild(satCell.el);
  axisRow.appendChild(lightCell.el);

  card.appendChild(num);
  card.appendChild(divider);
  card.appendChild(axisRow);

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
    if (share.disabled) return;
    share.disabled = true;
    const label = share.textContent;
    share.textContent = '...';
    try {
      await shareRound(targetHex, guessHex, pct);
    } catch {
      // Silent fallback; the button just re-enables.
    } finally {
      share.disabled = false;
      share.textContent = label ?? 'Share';
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
    hueCell.setValue(Math.round(eased * axes.hue));
    satCell.setValue(Math.round(eased * axes.saturation));
    lightCell.setValue(Math.round(eased * axes.lightness));
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    root.innerHTML = '';
  };
}
