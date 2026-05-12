import type { HSL } from '../../color';
import { huePreviewSlice, satPreviewSlice, lightPreviewSlice } from './render';

const SIZE = 96;
const OFFSET_ABOVE = 60;
const EDGE_PAD = 8;
const SLOT_PITCH = 16;
const SLOT_HEIGHT = 12;
const TOTAL_SLOTS = 9;
const CENTER_INDEX = 4;

export type MagnifierAxis = 'h' | 's' | 'l';

export interface MagnifierHandle {
  /** Show / re-position / re-render in one call. Idempotent. The internal
   *  strip translates by the fractional part of `value` so colors physically
   *  scroll past the centered paper-outlined slot — matches the main tape. */
  update: (x: number, y: number, value: number, axis: MagnifierAxis, state: HSL) => void;
  hide: () => void;
  destroy: () => void;
}

function normalize(value: number, axis: MagnifierAxis): number {
  if (axis === 'h') return ((value % 360) + 360) % 360;
  return Math.max(0, Math.min(100, value));
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

  // Internal scrolling strip: a stack of slot divs absolutely positioned
  // inside the circle. Translate based on the fractional part of value.
  const strip = document.createElement('div');
  strip.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'top:50%',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'will-change:transform',
  ].join(';');

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.style.cssText = [
      'width:68%',
      `height:${SLOT_HEIGHT}px`,
      `margin:${(SLOT_PITCH - SLOT_HEIGHT) / 2}px 0`,
      'border-radius:3px',
      'flex-shrink:0',
    ].join(';');
    if (i === CENTER_INDEX) {
      slot.style.boxShadow = '0 0 0 1.5px var(--paper, #ECE6DA), 0 0 0 2.5px rgba(0,0,0,0.6)';
    }
    strip.appendChild(slot);
    slots.push(slot);
  }

  circle.appendChild(strip);
  wrapper.appendChild(circle);
  wrapper.appendChild(nub);
  parent.appendChild(wrapper);

  function renderColors(value: number, axis: MagnifierAxis, state: HSL): void {
    const intValue = Math.round(value);
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const v = normalize(intValue + (i - CENTER_INDEX), axis);
      let color: string;
      if (axis === 'h')      color = huePreviewSlice(v, state.s, state.l);
      else if (axis === 's') color = satPreviewSlice(v, state.h, state.l);
      else                   color = lightPreviewSlice(v, state.h, state.s);
      slots[i].style.background = color;
    }
  }

  function renderTransform(value: number): void {
    const intValue = Math.round(value);
    const offset = value - intValue;
    const tY = -(CENTER_INDEX + 0.5 + offset) * SLOT_PITCH;
    strip.style.transform = `translateY(${tY}px)`;
  }

  return {
    update: (x, y, value, axis, state) => {
      renderColors(value, axis, state);
      renderTransform(value);
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
