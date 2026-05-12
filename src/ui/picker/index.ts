import type { HSL } from '../../color';
import { hslToHex } from '../../color';
import { loadState } from '../../state';
import { createHaptics } from './haptics';
import { createMagnifier } from './magnifier';
import { createTape, type TapeHandle, SLOT_PITCH } from './tape';
import { trueColor } from './render';

export interface PickerHandle {
  getHex: () => string;
  getHSL: () => HSL;
  /** Wrapper around readout + labels + tapes capsule. Exposed so the match
   *  scene can slide it off-screen during the lock-in transition while the
   *  swatch stays put. */
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

  // Controls wrapper — readout + axis labels + tapes capsule. Grouped so the
  // match scene can slide the whole bottom region off in one transform during
  // the lock-in transition while the swatch stays put.
  const controls = document.createElement('div');
  controls.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'will-change:transform',
  ].join(';');

  const readout = document.createElement('div');
  readout.style.cssText = [
    'padding:10px 0 6px',
    'text-align:center',
    "font-family:'Inter Variable',system-ui,sans-serif",
    'font-size:13px',
    'color:var(--mute, #7A7670)',
    "font-feature-settings:'tnum'",
    'letter-spacing:0.04em',
  ].join(';');
  controls.appendChild(readout);

  const labels = document.createElement('div');
  labels.style.cssText = 'display:flex;padding:0 28px 8px;';
  for (const text of ['HUE', 'SAT', 'LIGHT']) {
    const span = document.createElement('div');
    span.className = 'label-micro';
    span.style.flex = '1';
    span.style.textAlign = 'center';
    labels.appendChild(span);
    span.textContent = text;
  }
  controls.appendChild(labels);

  // Unified tapes container — one rounded capsule wrapping all three tapes,
  // with a horizontal selection band overlay spanning all three at the
  // vertical center. iOS-picker style.
  const tapesWrap = document.createElement('div');
  tapesWrap.style.cssText = [
    'position:relative',
    'flex:0 0 252px',
    'margin:0 16px',
    'border:1px solid rgba(236,230,218,0.18)',
    'border-radius:16px',
    'overflow:hidden',
    'background:rgba(14,14,16,0.45)',
    'box-shadow:0 6px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(236,230,218,0.04)',
  ].join(';');

  const tapesRow = document.createElement('div');
  tapesRow.style.cssText = 'display:flex;height:100%;';
  tapesWrap.appendChild(tapesRow);

  // Selection band — two thin paper-colored rules framing the center row.
  const band = document.createElement('div');
  band.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'top:50%',
    `height:${SLOT_PITCH}px`,
    `margin-top:${-SLOT_PITCH / 2}px`,
    'border-top:1px solid rgba(236,230,218,0.55)',
    'border-bottom:1px solid rgba(236,230,218,0.55)',
    'pointer-events:none',
    'z-index:3',
  ].join(';');
  tapesWrap.appendChild(band);

  controls.appendChild(tapesWrap);
  root.appendChild(controls);
  parent.appendChild(root);

  const hapticsEnabled = loadState().settings.haptics;
  const haptics = createHaptics(() => hapticsEnabled);
  const magnifier = createMagnifier(parent);

  function renderOutput(): void {
    swatch.style.background = trueColor(state);
    readout.textContent = `${Math.round(state.h)}° · ${Math.round(state.s)}% · ${Math.round(state.l)}%`;
  }

  function updateOutput(): void {
    renderOutput();
    onChange(hslToHex(state));
  }

  const axisOrder: Array<'h' | 's' | 'l'> = ['h', 's', 'l'];
  // Hue needs much higher visual density than sat/light because its range
  // (360°) is 3.6× wider and adjacent hues at narrow pitches blend so the
  // gradient direction reads more like a smooth ribbon than discrete bars.
  // At pitch 3, the visible window spans ~84° of spectrum — roughly a
  // quarter of the wheel — so the user can clearly see red→orange→yellow
  // (or any analogous arc) at a glance. 1° precision is preserved (each
  // slot is still one unit). The 32px lens at center picks out the actual
  // selected value at a readable size regardless of pitch.
  const axisCfg: Record<'h' | 's' | 'l', { slotPitch: number; totalSlots: number }> = {
    h: { slotPitch: 3,  totalSlots: 105 },
    s: { slotPitch: 6,  totalSlots: 49  },
    l: { slotPitch: 6,  totalSlots: 49  },
  };
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
      slotPitch: axisCfg[axis].slotPitch,
      totalSlots: axisCfg[axis].totalSlots,
    });
  });

  tapes.forEach((t) => tapesRow.appendChild(t.el));

  renderOutput();

  return {
    getHex: () => hslToHex(state),
    getHSL: () => ({ ...state }),
    controlsEl: controls,
    destroy: () => {
      tapes.forEach((t) => t.destroy());
      magnifier.destroy();
      root.remove();
    },
  };
}
