// src/scenes/grade.ts
// Grade scene: target color top half, guess bottom half. A glass card on the
// split line shows the headline % with a "Thunk + stagger" landing — headline
// counts up smooth ease-out then lands, then HUE → SAT → LIGHT cascade in.
// On ≥90% the card scale-pulses with a magenta border glow. On 100% the
// headline text washes magenta. prefers-reduced-motion collapses all of this
// to an instant final state.

import { scoreMatch, axisCloseness, hexToHsl, type HSL } from '../color';
import { loadState, recordRound } from '../state';
import { shareRound } from '../ui/share-card';

// Staggered landing timeline (ms from scene mount).
const TIMING = {
  headline: { from: 0,    to: 900 },
  hue:      { from: 640,  to: 1340 },
  sat:      { from: 820,  to: 1520 },
  light:    { from: 1000, to: 1700 },
  pulseAt:  1700,
  pulseDur: 620,
  flareDur: 720,
} as const;

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
  const haptic = loadState().settings.haptics && 'vibrate' in navigator;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const top = document.createElement('div');
  top.style.cssText = `position:absolute;top:0;left:0;right:0;height:50%;background:${targetHex};`;

  const bot = document.createElement('div');
  bot.style.cssText = `position:absolute;bottom:0;left:0;right:0;height:50%;background:${guessHex};`;

  // Swatch chips: label + hex + HSL, so the headline % reconciles with the
  // raw values driving it. Positioned above (target) and below (guess) the
  // glass card, clear of the Share and Next buttons.
  const originalChip = swatchChip('ORIGINAL', targetHex, hexToHsl(targetHex));
  originalChip.style.cssText +=
    'position:absolute;left:50%;transform:translateX(-50%);top:calc(24px + env(safe-area-inset-top));';

  const guessChip = swatchChip('YOUR PICK', guessHex, hexToHsl(guessHex));
  guessChip.style.cssText +=
    'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom));';

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
  root.appendChild(originalChip);
  root.appendChild(guessChip);
  root.appendChild(card);
  root.appendChild(next);
  root.appendChild(share);

  // Reduced motion: skip the count-up and post-land flourishes, show final
  // values immediately, fire haptic now.
  if (reduced) {
    num.textContent = `${pct}%`;
    hueCell.setValue(axes.hue);
    satCell.setValue(axes.saturation);
    lightCell.setValue(axes.lightness);
    if (haptic) navigator.vibrate(30);
    return () => {
      root.innerHTML = '';
    };
  }

  // Card scale-in entrance (CSS keyframes, ends at scale(1)).
  card.classList.add('grade-card-enter');

  // Single rAF loop computing each value's piecewise ease-out within its window.
  const startT = performance.now();
  const valueAt = (target: number, from: number, to: number, elapsed: number): number => {
    if (elapsed <= from) return 0;
    if (elapsed >= to) return target;
    const p = (elapsed - from) / (to - from);
    return Math.round((1 - Math.pow(1 - p, 3)) * target);
  };
  let raf = 0;
  const tick = (t: number) => {
    const elapsed = t - startT;
    num.textContent = `${valueAt(pct, TIMING.headline.from, TIMING.headline.to, elapsed)}%`;
    hueCell.setValue(valueAt(axes.hue,        TIMING.hue.from,   TIMING.hue.to,   elapsed));
    satCell.setValue(valueAt(axes.saturation, TIMING.sat.from,   TIMING.sat.to,   elapsed));
    lightCell.setValue(valueAt(axes.lightness, TIMING.light.from, TIMING.light.to, elapsed));
    if (elapsed < TIMING.light.to) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // Side effects scheduled by the timeline: haptic + 100% flare sync to
  // headline land; ≥90% card pulse syncs to last axis land.
  const timers: number[] = [];
  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };

  after(TIMING.headline.to, () => {
    if (haptic) navigator.vibrate(30);
    if (pct === 100) {
      num.classList.add('grade-num-flare');
      after(TIMING.flareDur, () => num.classList.remove('grade-num-flare'));
    }
  });

  if (pct >= 90) {
    after(TIMING.pulseAt, () => {
      card.classList.add('grade-card-pulse');
      after(TIMING.pulseDur, () => card.classList.remove('grade-card-pulse'));
    });
  }

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach((t) => clearTimeout(t));
    root.innerHTML = '';
  };
}

function swatchChip(label: string, hex: string, hsl: HSL): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'glass';
  chip.style.cssText =
    'padding:10px 16px;display:flex;flex-direction:column;align-items:center;gap:4px;';

  const lab = document.createElement('div');
  lab.className = 'label-micro';
  lab.textContent = label;

  const hexEl = document.createElement('div');
  hexEl.style.cssText =
    "font-family:'Inter Variable',system-ui,sans-serif;font-size:14px;color:var(--paper);font-feature-settings:'tnum';letter-spacing:0.04em;";
  hexEl.textContent = hex.toUpperCase();

  // Hue is meaningless for near-grays; the scoring uses s < 1.5 as the
  // achromatic threshold, so match that here to avoid a misleading "H 0°".
  const hStr = hsl.s < 1.5 ? '—' : `${Math.round(hsl.h)}°`;
  const hslEl = document.createElement('div');
  hslEl.style.cssText =
    "font-family:'Inter Variable',system-ui,sans-serif;font-size:12px;color:var(--mute);font-feature-settings:'tnum';";
  hslEl.textContent = `H ${hStr} · S ${Math.round(hsl.s)}% · L ${Math.round(hsl.l)}%`;

  chip.appendChild(lab);
  chip.appendChild(hexEl);
  chip.appendChild(hslEl);
  return chip;
}
