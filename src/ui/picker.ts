// src/ui/picker.ts
// 2D pad (hue × saturation) + lightness slider. Updates the parent's background
// to the current HSL on every change. Calls onChange with a hex string.

import type { HSL } from '../color';
import { hslToHex } from '../color';

export interface PickerHandle {
  getHex: () => string;
  getHSL: () => HSL;
  destroy: () => void;
}

export function mountPicker(
  parent: HTMLElement,
  initial: HSL,
  onChange: (hex: string) => void
): PickerHandle {
  const state: HSL = { ...initial };

  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:24px;gap:16px;padding-bottom:calc(24px + env(safe-area-inset-bottom));padding-top:calc(24px + env(safe-area-inset-top));';

  const pad = document.createElement('div');
  pad.className = 'glass';
  pad.style.cssText = 'flex:1;position:relative;touch-action:none;overflow:hidden;';
  const padCross = document.createElement('div');
  padCross.style.cssText = 'position:absolute;width:24px;height:24px;border:2px solid var(--paper);outline:1px solid var(--ink);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;';
  pad.appendChild(padCross);

  const slider = document.createElement('div');
  slider.className = 'glass';
  slider.style.cssText = 'height:64px;position:relative;touch-action:none;';
  const sliderThumb = document.createElement('div');
  sliderThumb.style.cssText = 'position:absolute;top:50%;width:36px;height:36px;border:2px solid var(--paper);outline:1px solid var(--ink);border-radius:50%;background:transparent;transform:translate(-50%,-50%);pointer-events:none;';
  slider.appendChild(sliderThumb);

  root.appendChild(pad);
  root.appendChild(slider);
  parent.appendChild(root);

  function render() {
    const hex = hslToHex(state);
    parent.style.background = hex;
    const padRect = pad.getBoundingClientRect();
    padCross.style.left = `${(state.h / 360) * padRect.width}px`;
    padCross.style.top = `${(1 - state.s / 100) * padRect.height}px`;
    const sRect = slider.getBoundingClientRect();
    sliderThumb.style.left = `${(state.l / 100) * sRect.width}px`;
    onChange(hex);
  }

  function attachDrag(el: HTMLElement, handler: (x: number, y: number, w: number, h: number) => void) {
    let activeId: number | null = null;
    const update = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      handler(x, y, rect.width, rect.height);
    };
    el.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      update(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId) return;
      update(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  attachDrag(pad, (x, y, w, h) => {
    state.h = (x / w) * 360;
    state.s = (1 - (y / h)) * 100;
    render();
  });
  attachDrag(slider, (x, _y, w) => {
    state.l = (x / w) * 100;
    render();
  });

  requestAnimationFrame(render);

  return {
    getHex: () => hslToHex(state),
    getHSL: () => ({ ...state }),
    destroy: () => root.remove(),
  };
}
