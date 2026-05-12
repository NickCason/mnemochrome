import type { HSL } from '../../color';
import { hslToHex } from '../../color';
import { loadState } from '../../state';
import { createHaptics } from './haptics';
import { createMagnifier } from './magnifier';
import { createTape, type TapeHandle } from './tape';
import { trueColor } from './render';

export interface PickerHandle {
  getHex: () => string;
  getHSL: () => HSL;
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
    'padding-top:calc(0px + env(safe-area-inset-top))',
    'padding-bottom:calc(96px + env(safe-area-inset-bottom))',
  ].join(';');

  const swatch = document.createElement('div');
  swatch.style.cssText = 'flex:1 1 50%;min-height:120px;background:' + trueColor(state) + ';';
  root.appendChild(swatch);

  const readout = document.createElement('div');
  readout.style.cssText = [
    'padding:8px 0',
    'text-align:center',
    "font-family:'Inter Variable',system-ui,sans-serif",
    'font-size:13px',
    'color:var(--mute, #7A7670)',
    "font-feature-settings:'tnum'",
    'letter-spacing:0.04em',
  ].join(';');
  root.appendChild(readout);

  const labels = document.createElement('div');
  labels.style.cssText = 'display:flex;padding:0 12px 6px;';
  for (const text of ['HUE', 'SAT', 'LIGHT']) {
    const span = document.createElement('div');
    span.className = 'label-micro';
    span.style.flex = '1';
    span.style.textAlign = 'center';
    span.textContent = text;
    labels.appendChild(span);
  }
  root.appendChild(labels);

  const tapesEl = document.createElement('div');
  tapesEl.style.cssText = 'display:flex;flex:0 0 260px;position:relative;';
  root.appendChild(tapesEl);

  parent.appendChild(root);

  const haptics = createHaptics(() => loadState().settings.haptics);
  const magnifier = createMagnifier(parent);

  function updateOutput(): void {
    swatch.style.background = trueColor(state);
    readout.textContent = `${Math.round(state.h)}° · ${Math.round(state.s)}% · ${Math.round(state.l)}%`;
    onChange(hslToHex(state));
  }

  const axisOrder: Array<'h' | 's' | 'l'> = ['h', 's', 'l'];
  const tapes: TapeHandle[] = axisOrder.map((axis) => {
    return createTape({
      axis,
      initialValue: state[axis],
      onChange: (v) => {
        state[axis] = v;
        updateOutput();
        for (let i = 0; i < axisOrder.length; i++) {
          if (axisOrder[i] !== axis) tapes[i].rerenderSlices();
        }
      },
      haptics,
      magnifier,
      getState: () => state,
    });
  });

  tapes.forEach((t) => tapesEl.appendChild(t.el));

  updateOutput();

  return {
    getHex: () => hslToHex(state),
    getHSL: () => ({ ...state }),
    destroy: () => {
      tapes.forEach((t) => t.destroy());
      magnifier.destroy();
      root.remove();
    },
  };
}
