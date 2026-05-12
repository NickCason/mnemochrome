// src/scenes/title.ts
// Title scene: large wordmark, decorative hue strip, glass stats card,
// view-time slider, Tap-to-play CTA, build SHA stamp in the corner.

import { loadState, updateSettings, avgLast10 } from '../state';

export function mountTitle(root: HTMLElement, onPlay: () => void): () => void {
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const { pb, last10, settings } = loadState();
  const avg = avgLast10(last10);

  const col = document.createElement('div');
  col.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:36px;padding:48px 28px;padding-top:calc(48px + env(safe-area-inset-top));padding-bottom:calc(48px + env(safe-area-inset-bottom));';

  // Wordmark block (wordmark + hue strip)
  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:18px;';

  const wordmark = document.createElement('h1');
  wordmark.className = 'wordmark';
  wordmark.innerHTML = 'mnem<span class="o">o</span>chr<span class="o">o</span>me';

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

  function statCell(label: string, value: string): HTMLElement {
    const cell = document.createElement('div');
    cell.style.cssText =
      'flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:4px 16px;';
    const lab = document.createElement('div');
    lab.className = 'label-micro';
    lab.textContent = label;
    const val = document.createElement('div');
    val.style.cssText =
      "font-family:'Fraunces Variable',Georgia,serif;font-weight:400;font-size:36px;line-height:1;color:var(--paper);font-feature-settings:'tnum';";
    val.textContent = value;
    cell.appendChild(lab);
    cell.appendChild(val);
    return cell;
  }

  const divider = document.createElement('div');
  divider.style.cssText = 'width:1px;background:var(--glass-border);';

  statsCard.appendChild(statCell('Best', `${pb}%`));
  statsCard.appendChild(divider);
  statsCard.appendChild(statCell('Avg 10', `${avg}%`));

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

  return () => {
    root.innerHTML = '';
  };
}
