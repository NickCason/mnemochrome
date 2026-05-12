import type { HSL } from '../../color';
import { huePreviewSlice, satPreviewSlice, lightPreviewSlice } from './render';

const SIZE = 96;
const OFFSET_ABOVE = 60;
const EDGE_PAD = 8;
export type MagnifierAxis = 'h' | 's' | 'l';

export interface MagnifierHandle {
  /** Show / re-position / re-render in one call. Idempotent. */
  update: (x: number, y: number, value: number, axis: MagnifierAxis, state: HSL) => void;
  hide: () => void;
  destroy: () => void;
}

export function createMagnifier(parent: HTMLElement): MagnifierHandle {
  const bubble = document.createElement('div');
  bubble.style.cssText = [
    'position:absolute',
    `width:${SIZE}px`,
    `height:${SIZE}px`,
    'border-radius:50%',
    'background:var(--ink, #0E0E10)',
    'border:2px solid rgba(236, 230, 218, 0.45)',
    'box-shadow:0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.6)',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 120ms ease',
    'z-index:50',
    'overflow:hidden',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:4px',
    'left:0',
    'top:0',
    'will-change:transform, opacity',
  ].join(';');

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < 5; i++) {
    const slot = document.createElement('div');
    slot.style.cssText = 'width:70%;height:14px;border-radius:3px;flex-shrink:0;';
    if (i === 2) {
      slot.style.boxShadow = '0 0 0 2px var(--paper, #ECE6DA), 0 0 0 3px rgba(0,0,0,0.6)';
    }
    bubble.appendChild(slot);
    slots.push(slot);
  }

  parent.appendChild(bubble);

  function renderSlices(value: number, axis: MagnifierAxis, state: HSL): void {
    const wrap = axis === 'h';
    const max = wrap ? 360 : 100;
    for (let i = 0; i < 5; i++) {
      const delta = i - 2;
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
    update: (x, y, value, axis, state) => {
      renderSlices(value, axis, state);
      const parentRect = parent.getBoundingClientRect();
      const localX = x - parentRect.left;
      const localY = y - parentRect.top;
      const half = SIZE / 2;
      const bx = Math.max(EDGE_PAD + half, Math.min(parentRect.width - EDGE_PAD - half, localX));
      const by = localY - OFFSET_ABOVE - half;
      bubble.style.transform = `translate(${bx - half}px, ${by}px)`;
      bubble.style.opacity = '1';
    },
    hide: () => {
      bubble.style.opacity = '0';
    },
    destroy: () => {
      bubble.remove();
    },
  };
}
