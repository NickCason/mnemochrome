// src/ui/picker.ts
// 2D pad (hue × saturation) + lightness slider. Pad shows a hue×sat map at the
// current lightness; slider shows a black→current→white gradient at the current
// hue/sat. The parent element's background tracks the live full HSL pick.
//
// The pad is height-capped (and width-capped) so the picker doesn't fill the
// whole screen; the match scene reserves space below for the Lock In button
// via this component's own bottom padding.

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
  root.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:18px;' +
    'padding-top:calc(24px + env(safe-area-inset-top));' +
    'padding-bottom:calc(112px + env(safe-area-inset-bottom));'; // reserve room for Lock In button

  const pad = document.createElement('div');
  pad.style.cssText =
    'flex:1 1 0;width:100%;max-width:360px;max-height:380px;position:relative;touch-action:none;overflow:hidden;border-radius:16px;border:1px solid var(--glass-border, rgba(236,230,218,0.18));box-shadow:0 6px 24px rgba(0,0,0,0.35);';
  // Lens reticle: filled with the current pick so the contact point IS the
  // color being chosen. Paper outline + ink stroke + soft drop shadow keeps
  // it readable on any background (yellow, dark blue, etc).
  const padCross = document.createElement('div');
  padCross.style.cssText =
    'position:absolute;width:26px;height:26px;border:2px solid var(--paper);outline:1px solid var(--ink);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:2;box-shadow:0 0 0 1px rgba(0,0,0,0.45),0 2px 8px rgba(0,0,0,0.4);';
  pad.appendChild(padCross);

  const slider = document.createElement('div');
  slider.style.cssText =
    'width:100%;max-width:360px;height:56px;position:relative;touch-action:none;overflow:hidden;border-radius:16px;border:1px solid var(--glass-border, rgba(236,230,218,0.18));box-shadow:0 6px 24px rgba(0,0,0,0.35);';
  const sliderThumb = document.createElement('div');
  sliderThumb.style.cssText =
    'position:absolute;top:50%;width:34px;height:34px;border:2px solid var(--paper);outline:1px solid var(--ink);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:2;box-shadow:0 0 0 1px rgba(0,0,0,0.45),0 2px 8px rgba(0,0,0,0.4);';
  slider.appendChild(sliderThumb);

  root.appendChild(pad);
  root.appendChild(slider);
  parent.appendChild(root);

  function padGradient(l: number): string {
    const neutral = `hsl(0, 0%, ${l}%)`;
    return [
      `linear-gradient(to bottom, transparent 0%, ${neutral} 100%)`,
      `linear-gradient(to right,
        hsl(0,100%,${l}%) 0%,
        hsl(60,100%,${l}%) 16.66%,
        hsl(120,100%,${l}%) 33.33%,
        hsl(180,100%,${l}%) 50%,
        hsl(240,100%,${l}%) 66.66%,
        hsl(300,100%,${l}%) 83.33%,
        hsl(360,100%,${l}%) 100%)`,
    ].join(', ');
  }

  function sliderGradient(h: number, s: number): string {
    return `linear-gradient(to right, #000 0%, hsl(${h}, ${s}%, 50%) 50%, #fff 100%)`;
  }

  function render() {
    const hex = hslToHex(state);
    parent.style.background = hex;
    pad.style.background = padGradient(state.l);
    slider.style.background = sliderGradient(state.h, state.s);
    // Lens fill — both reticles show the live pick.
    padCross.style.background = hex;
    sliderThumb.style.background = hex;
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
