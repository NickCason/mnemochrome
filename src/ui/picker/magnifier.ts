import type { HSL } from '../../color';
import { huePreviewSlice, satPreviewSlice, lightPreviewSlice } from './render';

const SIZE = 96;
const OFFSET_ABOVE = 60;
const EDGE_PAD = 8;
export type MagnifierAxis = 'h' | 's' | 'l';

export interface MagnifierHandle {
  /** Show / re-position / re-render in one call. Idempotent.
   *  `step` is the value-units-per-slot of the tape (1 for sat/light, 5 for hue). */
  update: (x: number, y: number, value: number, axis: MagnifierAxis, state: HSL, step?: number) => void;
  hide: () => void;
  destroy: () => void;
}

export function createMagnifier(parent: HTMLElement): MagnifierHandle {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:absolute',
    `width:${SIZE}px`,
    `height:${SIZE}px`,
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 120ms ease',
    'z-index:50',
    'left:0',
    'top:0',
    'will-change:transform, opacity',
  ].join(';');

  const circle = document.createElement('div');
  circle.style.cssText = [
    'position:absolute',
    'inset:0',
    'border-radius:50%',
    'background:var(--ink, #0E0E10)',
    'border:2px solid rgba(236, 230, 218, 0.45)',
    'box-shadow:0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.6)',
    'overflow:hidden',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:4px',
  ].join(';');

  const nub = document.createElement('div');
  nub.style.cssText = [
    'position:absolute',
    'left:50%',
    'bottom:-7px',
    'width:14px',
    'height:14px',
    'margin-left:-7px',
    'background:var(--ink, #0E0E10)',
    'border-right:2px solid rgba(236, 230, 218, 0.45)',
    'border-bottom:2px solid rgba(236, 230, 218, 0.45)',
    'transform:rotate(45deg)',
    'z-index:-1',
  ].join(';');

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < 5; i++) {
    const slot = document.createElement('div');
    slot.style.cssText = 'width:70%;height:14px;border-radius:3px;flex-shrink:0;';
    if (i === 2) {
      slot.style.boxShadow = '0 0 0 2px var(--paper, #ECE6DA), 0 0 0 3px rgba(0,0,0,0.6)';
    }
    circle.appendChild(slot);
    slots.push(slot);
  }

  wrapper.appendChild(circle);
  wrapper.appendChild(nub);
  parent.appendChild(wrapper);

  function renderSlices(value: number, axis: MagnifierAxis, state: HSL, step: number): void {
    const wrap = axis === 'h';
    const max = wrap ? 360 : 100;
    for (let i = 0; i < 5; i++) {
      const delta = (i - 2) * step;
      let v = value + delta;
      if (wrap) v = ((v % max) + max) % max;
      else v = Math.max(0, Math.min(max, v));
      let color: string;
      if (axis === 'h')      color = huePreviewSlice(v, state.s, state.l);
      else if (axis === 's') color = satPreviewSlice(v, state.h, state.l);
      else                   color = lightPreviewSlice(v, state.h, state.s);
      slots[i].style.background = color;
    }
  }

  return {
    update: (x, y, value, axis, state, step = 1) => {
      renderSlices(value, axis, state, step);
      const parentRect = parent.getBoundingClientRect();
      const localX = x - parentRect.left;
      const localY = y - parentRect.top;
      const half = SIZE / 2;
      const bx = Math.max(EDGE_PAD + half, Math.min(parentRect.width - EDGE_PAD - half, localX));
      const by = Math.max(EDGE_PAD, localY - OFFSET_ABOVE - half);
      wrapper.style.transform = `translate(${bx - half}px, ${by}px)`;
      wrapper.style.opacity = '1';
    },
    hide: () => {
      wrapper.style.opacity = '0';
    },
    destroy: () => {
      wrapper.remove();
    },
  };
}
