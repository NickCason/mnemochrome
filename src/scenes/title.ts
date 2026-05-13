// src/scenes/title.ts
// Title scene: large wordmark, decorative hue strip, glass stats card,
// view-time slider, Tap-to-play CTA, build SHA stamp in the corner.
//
// "Alive" treatments: wordmark letters fade-translate in with 50ms stagger;
// the two magenta o's pick up a slow breath cycle after the entrance lands;
// the hue strip drifts laterally on a 60s loop (ambient); the Best/Avg
// stats count up from 0 with the same ease-out the grade card uses.

import { loadState, updateSettings, avgLast10 } from '../state';

const WORDMARK_TEXT = 'mnemochrome';
const O_INDICES = new Set([4, 8]); // positions of the two o's
const LETTER_STAGGER_MS = 50;
const LETTER_ENTRANCE_MS = 600;

export interface TitleOptions {
  /** Skip the wordmark letter-entrance animation; spans start settled. */
  skipEntrance?: boolean;
  /** Adopt an existing wordmark element (from splash) instead of building a new one. */
  existingWordmark?: HTMLElement;
}

export function mountTitle(
  root: HTMLElement,
  onPlay: () => void,
  opts: TitleOptions = {},
): () => void {
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const { pb, last10, settings } = loadState();
  const avg = avgLast10(last10);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const col = document.createElement('div');
  col.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:36px;padding:48px 28px;padding-top:calc(48px + env(safe-area-inset-top));padding-bottom:calc(48px + env(safe-area-inset-bottom));';

  // Wordmark block (wordmark + hue strip)
  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:18px;';

  // Wordmark: either adopt one passed in (from splash) or build fresh.
  // When adopting, ensure spans are in their settled state so they don't
  // snap back to the base CSS (.wordmark span: opacity:0; translateY(8px)).
  let wordmark: HTMLElement;
  let letterSpans: HTMLSpanElement[];
  if (opts.existingWordmark) {
    wordmark = opts.existingWordmark;
    letterSpans = Array.from(
      wordmark.querySelectorAll<HTMLSpanElement>('span'),
    );
  } else {
    wordmark = document.createElement('h1');
    wordmark.className = 'wordmark';
    letterSpans = [];
    [...WORDMARK_TEXT].forEach((ch, i) => {
      const span = document.createElement('span');
      span.textContent = ch;
      if (O_INDICES.has(i)) span.classList.add('o');
      if (opts.skipEntrance) {
        // Settle the span immediately, no entrance keyframe.
        span.style.opacity = '1';
        span.style.transform = 'translateY(0)';
        span.style.animation = 'none';
      } else {
        span.style.animationDelay = `${i * LETTER_STAGGER_MS}ms`;
      }
      letterSpans.push(span);
      wordmark.appendChild(span);
    });
  }

  const hueStrip = document.createElement('div');
  hueStrip.className = 'hue-strip';

  const tagline = document.createElement('div');
  tagline.className = 'label-micro';
  tagline.textContent = 'See a color, then summon it back';

  header.appendChild(wordmark);
  header.appendChild(hueStrip);
  header.appendChild(tagline);

  // Stats card (glass)
  const statsCard = document.createElement('div');
  statsCard.className = 'glass';
  statsCard.style.cssText =
    'display:flex;align-items:stretch;padding:20px 8px;gap:8px;min-width:260px;';

  function statCell(label: string): { el: HTMLElement; setValue: (v: number) => void } {
    const cell = document.createElement('div');
    cell.style.cssText =
      'flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:4px 16px;';
    const lab = document.createElement('div');
    lab.className = 'label-micro';
    lab.textContent = label;
    const val = document.createElement('div');
    val.style.cssText =
      "font-family:'Fraunces Variable',Georgia,serif;font-weight:400;font-size:36px;line-height:1;color:var(--paper);font-feature-settings:'tnum';";
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

  const divider = document.createElement('div');
  divider.style.cssText = 'width:1px;background:var(--glass-border);';

  const bestStat = statCell('Best');
  const avgStat = statCell('Avg 10');
  statsCard.appendChild(bestStat.el);
  statsCard.appendChild(divider);
  statsCard.appendChild(avgStat.el);

  // View-time control
  const sliderGroup = document.createElement('div');
  sliderGroup.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:300px;';

  const sliderHead = document.createElement('div');
  sliderHead.style.cssText =
    'display:flex;justify-content:space-between;width:100%;align-items:baseline;';

  const sliderLabel = document.createElement('div');
  sliderLabel.className = 'label-micro';
  sliderLabel.textContent = 'View Time';

  const readout = document.createElement('div');
  readout.style.cssText =
    "font-family:'Fraunces Variable',Georgia,serif;font-weight:400;font-size:18px;color:var(--paper);font-feature-settings:'tnum';";
  readout.textContent = `${(settings.viewTimeMs / 1000).toFixed(1)}s`;

  sliderHead.appendChild(sliderLabel);
  sliderHead.appendChild(readout);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1.0';
  slider.max = '10.0';
  slider.step = '0.5';
  slider.value = String(settings.viewTimeMs / 1000);
  slider.style.cssText = 'width:100%;accent-color:var(--accent);';

  slider.addEventListener('input', () => {
    const seconds = Number(slider.value);
    readout.textContent = `${seconds.toFixed(1)}s`;
    updateSettings({ viewTimeMs: Math.round(seconds * 1000) });
  });

  sliderGroup.appendChild(sliderHead);
  sliderGroup.appendChild(slider);

  // Play button
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Tap to play';
  btn.style.cssText = 'width:100%;max-width:300px;margin-top:8px;';
  btn.addEventListener('click', onPlay);

  col.appendChild(header);
  col.appendChild(statsCard);
  col.appendChild(sliderGroup);
  col.appendChild(btn);
  root.appendChild(col);

  // Build SHA stamp
  const stamp = document.createElement('div');
  stamp.className = 'version-stamp';
  stamp.textContent = `v${__BUILD_SHA__}`;
  root.appendChild(stamp);

  // Reduced motion: skip count-up, skip breath, finalize values.
  if (reduced) {
    bestStat.setValue(pb);
    avgStat.setValue(avg);
    return () => {
      root.innerHTML = '';
    };
  }

  // Schedule the breath cycle on the o's. Normally we wait for the
  // entrance animation to land. When entrance is skipped (e.g., the
  // wordmark was handed in from splash), breath can start immediately.
  const breathStartDelay = (i: number): number =>
    opts.skipEntrance ? 0 : i * LETTER_STAGGER_MS + LETTER_ENTRANCE_MS;

  const timers: number[] = [];
  letterSpans.forEach((span, i) => {
    if (!O_INDICES.has(i)) return;
    timers.push(
      window.setTimeout(
        () => span.classList.add('o-breath'),
        breathStartDelay(i),
      ),
    );
  });

  // Stat count-up — same ease-out curve as the grade card, offset to start
  // after the wordmark has begun appearing so the title doesn't all happen
  // at once.
  const startT = performance.now();
  const valueAt = (target: number, from: number, to: number, elapsed: number): number => {
    if (elapsed <= from) return 0;
    if (elapsed >= to) return target;
    const p = (elapsed - from) / (to - from);
    return Math.round((1 - Math.pow(1 - p, 3)) * target);
  };
  const BEST = { from: 700, to: 1500 };
  const AVG = { from: 850, to: 1650 };
  let raf = 0;
  const tick = (t: number) => {
    const elapsed = t - startT;
    bestStat.setValue(valueAt(pb, BEST.from, BEST.to, elapsed));
    avgStat.setValue(valueAt(avg, AVG.from, AVG.to, elapsed));
    if (elapsed < AVG.to) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach((t) => clearTimeout(t));
    root.innerHTML = '';
  };
}
