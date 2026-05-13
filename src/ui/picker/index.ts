import type { HSL } from '../../color';
import { hslToHex } from '../../color';
import { loadState } from '../../state';
import { createHaptics } from './haptics';
import { createHueStrip, type HueStripHandle } from './hue-strip';
import { createSLPad, type SLPadHandle } from './sl-pad';
import { trueColor } from './render';

export interface PickerHandle {
  getHex: () => string;
  getHSL: () => HSL;
  /** Wrapper around readout + labels + hue strip + sl pad. Exposed so the
   *  match scene can slide it off-screen during the lock-in transition while
   *  the swatch stays put. */
  controlsEl: HTMLElement;
  destroy: () => void;
}

export function mountPicker(
  parent: HTMLElement,
  initial: HSL,
  onChange: (hex: string) => void,
): PickerHandle {
  const state: HSL = { ...initial };

  const root = document.createElement('div');
  root.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:flex',
    'flex-direction:column',
    'padding-top:env(safe-area-inset-top)',
    'padding-bottom:calc(96px + env(safe-area-inset-bottom))',
  ].join(';');

  const swatch = document.createElement('div');
  swatch.style.cssText = [
    'flex:1 1 50%',
    'min-height:120px',
    'background:' + trueColor(state),
    'transition:background 60ms linear',
  ].join(';');
  root.appendChild(swatch);

  const controls = document.createElement('div');
  controls.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:10px',
    'padding:12px 16px 0',
    'will-change:transform',
    'flex:1 1 auto',
    'min-height:0',
  ].join(';');

  const readout = document.createElement('div');
  readout.style.cssText = [
    'padding:4px 0 2px',
    'text-align:center',
    "font-family:'Inter Variable',system-ui,sans-serif",
    'font-size:13px',
    'color:var(--mute, #7A7670)',
    "font-feature-settings:'tnum'",
    'letter-spacing:0.04em',
  ].join(';');
  controls.appendChild(readout);

  const hueLabel = document.createElement('div');
  hueLabel.className = 'label-micro';
  hueLabel.style.textAlign = 'center';
  hueLabel.textContent = 'HUE';
  controls.appendChild(hueLabel);

  const padLabel = document.createElement('div');
  padLabel.className = 'label-micro';
  padLabel.style.textAlign = 'center';
  padLabel.style.marginTop = '6px';
  padLabel.textContent = 'SAT × LIGHT';

  // Mount strip + pad. The lens needs to float above the strip without being
  // clipped, so we anchor it to the picker root.
  const hapticsEnabled = loadState().settings.haptics;
  const haptics = createHaptics(() => hapticsEnabled);

  function renderOutput(): void {
    swatch.style.background = trueColor(state);
    readout.textContent =
      `${Math.round(state.h)}° · ${Math.round(state.s)}% · ${Math.round(state.l)}%`;
  }

  let hueStrip: HueStripHandle;
  let pad: SLPadHandle;

  hueStrip = createHueStrip({
    initial: state.h,
    onChange: (h) => {
      state.h = h;
      renderOutput();
      onChange(hslToHex(state));
      pad.rerender();
    },
    haptics,
    getState: () => state,
    lensParent: root,
  });
  controls.appendChild(hueStrip.el);

  controls.appendChild(padLabel);

  pad = createSLPad({
    initialS: state.s,
    initialL: state.l,
    onChange: ({ s, l }) => {
      state.s = s;
      state.l = l;
      renderOutput();
      onChange(hslToHex(state));
    },
    haptics,
    getState: () => state,
  });
  controls.appendChild(pad.el);

  root.appendChild(controls);
  parent.appendChild(root);

  renderOutput();

  return {
    getHex: () => hslToHex(state),
    getHSL: () => ({ ...state }),
    controlsEl: controls,
    destroy: () => {
      hueStrip.destroy();
      pad.destroy();
      root.remove();
    },
  };
}
