// src/scenes/title.ts
// Title scene: wordmark, view-time slider, stats (PB and last-10 avg), Tap to play.

import { loadState, updateSettings, avgLast10 } from '../state';

export function mountTitle(root: HTMLElement, onPlay: () => void): () => void {
  root.innerHTML = '';
  root.style.background = 'var(--ink)';

  const { pb, last10, settings } = loadState();
  const avg = avgLast10(last10);

  const col = document.createElement('div');
  col.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:32px;padding:24px;';

  const wordmark = document.createElement('h1');
  wordmark.className = 'wordmark';
  wordmark.innerHTML = 'mnem<span class="o">o</span>chr<span class="o">o</span>me';

  const rule = document.createElement('div');
  rule.style.cssText = 'width:80px;height:1px;background:var(--mute);';

  // View-time slider group
  const sliderGroup = document.createElement('div');
  sliderGroup.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';

  const sliderLabel = document.createElement('div');
  sliderLabel.style.cssText =
    'font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--mute);';
  sliderLabel.textContent = 'View Time';

  const sliderRow = document.createElement('div');
  sliderRow.style.cssText = 'display:flex;align-items:center;gap:12px;';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1.0';
  slider.max = '10.0';
  slider.step = '0.5';
  slider.value = String(settings.viewTimeMs / 1000);
  slider.style.cssText = 'width:200px;accent-color:var(--accent);';

  const readout = document.createElement('span');
  readout.style.cssText = 'font-size:14px;color:var(--paper);min-width:40px;text-align:right;';
  readout.textContent = `${(settings.viewTimeMs / 1000).toFixed(1)}s`;

  slider.addEventListener('input', () => {
    const seconds = Number(slider.value);
    readout.textContent = `${seconds.toFixed(1)}s`;
    updateSettings({ viewTimeMs: Math.round(seconds * 1000) });
  });

  sliderRow.appendChild(slider);
  sliderRow.appendChild(readout);
  sliderGroup.appendChild(sliderLabel);
  sliderGroup.appendChild(sliderRow);

  // Stats row
  const stats = document.createElement('div');
  stats.style.cssText = 'display:flex;gap:32px;';

  function statCell(label: string, value: string): HTMLElement {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
    const lab = document.createElement('div');
    lab.style.cssText =
      'font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--mute);';
    lab.textContent = label;
    const val = document.createElement('div');
    val.style.cssText = 'font-size:18px;color:var(--paper);';
    val.textContent = value;
    cell.appendChild(lab);
    cell.appendChild(val);
    return cell;
  }

  stats.appendChild(statCell('Best', `${pb}%`));
  stats.appendChild(statCell('Avg10', `${avg}%`));

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = 'Tap to play';
  btn.addEventListener('click', onPlay);

  col.appendChild(wordmark);
  col.appendChild(rule);
  col.appendChild(sliderGroup);
  col.appendChild(stats);
  col.appendChild(btn);
  root.appendChild(col);

  return () => {
    root.innerHTML = '';
  };
}
