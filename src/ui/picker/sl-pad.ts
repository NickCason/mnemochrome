// 2D saturation × lightness pad. X axis = saturation (0 → 100, left → right),
// Y axis = lightness (100 → 0, top → bottom). Standard color-picker XY pad.
// Operating concept:
//   - drag-to-set; the thumb tracks the finger
//   - haptic tick when integer S or L crosses
//   - snap-to-integer S and L on release (animated)
//   - pad background re-renders on hue change so the landscape stays correct
// Unlike the hue strip we don't run an inertia model — XY pads feel snappier
// when they stop where you let go.

import type { HSL } from '../../color';
import type { HapticsHandle } from './haptics';

export interface SLValue { s: number; l: number; }
export interface PadCoord { x: number; y: number; }

// ---- Pure helpers (unit-tested) ----

export function padToSL(x: number, y: number, w: number, h: number): SLValue {
  if (w <= 0 || h <= 0) return { s: 0, l: 0 };
  const sx = Math.max(0, Math.min(1, x / w));
  const sy = Math.max(0, Math.min(1, y / h));
  return { s: sx * 100, l: (1 - sy) * 100 };
}

export function slToPad(s: number, l: number, w: number, h: number): PadCoord {
  return { x: (s / 100) * w, y: ((100 - l) / 100) * h };
}

export function clampSL(v: SLValue): SLValue {
  return {
    s: Math.max(0, Math.min(100, v.s)),
    l: Math.max(0, Math.min(100, v.l)),
  };
}

// ---- Pad ----

const SNAP_MS = 120;

export interface SLPadOpts {
  initialS: number;
  initialL: number;
  onChange: (sl: SLValue) => void;
  haptics: HapticsHandle;
  getState: () => HSL;
}

export interface SLPadHandle {
  el: HTMLElement;
  getValue: () => SLValue;
  rerender: () => void;
  destroy: () => void;
}

export function createSLPad(opts: SLPadOpts): SLPadHandle {
  let s = Math.max(0, Math.min(100, opts.initialS));
  let l = Math.max(0, Math.min(100, opts.initialL));
  let pid: number | null = null;
  let rafId = 0;

  const ac = new AbortController();
  const sig: AddEventListenerOptions = { signal: ac.signal };

  const pad = document.createElement('div');
  pad.style.cssText = [
    'position:relative',
    'flex:1 1 0',
    'min-height:200px',
    'border-radius:16px',
    'border:1px solid rgba(236,230,218,0.18)',
    'overflow:hidden',
    'touch-action:none',
    'box-shadow:0 6px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
  ].join(';');

  // Saturation layer — horizontal grey-to-current-hue at lightness 50. This
  // becomes the colour landscape's mid-row.
  const satLayer = document.createElement('div');
  satLayer.style.cssText = 'position:absolute;inset:0;';
  pad.appendChild(satLayer);

  // Lightness layer — vertical white-to-transparent-to-black. Top covers in
  // white, bottom covers in black, the middle stays transparent so the sat
  // layer shows through.
  const lightLayer = document.createElement('div');
  lightLayer.style.cssText = [
    'position:absolute',
    'inset:0',
    'background:linear-gradient(to bottom,' +
      'rgba(255,255,255,1) 0%,' +
      'rgba(255,255,255,0) 50%,' +
      'rgba(0,0,0,0) 50%,' +
      'rgba(0,0,0,1) 100%)',
  ].join(';');
  pad.appendChild(lightLayer);

  const thumb = document.createElement('div');
  thumb.style.cssText = [
    'position:absolute',
    'width:28px',
    'height:28px',
    'margin:-14px',
    'border-radius:50%',
    'border:2px solid var(--paper, #ECE6DA)',
    'box-shadow:0 0 0 1.5px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.55)',
    'pointer-events:none',
    'will-change:left, top, background, box-shadow',
    'z-index:4',
    'transition:box-shadow 120ms ease',
  ].join(';');
  pad.appendChild(thumb);

  function setSatGradient(): void {
    const h = opts.getState().h;
    satLayer.style.background =
      `linear-gradient(to right, hsl(${h},0%,50%), hsl(${h},100%,50%))`;
  }

  function reposThumb(): void {
    const rect = pad.getBoundingClientRect();
    const { x, y } = slToPad(s, l, rect.width, rect.height);
    thumb.style.left = `${x}px`;
    thumb.style.top = `${y}px`;
    const state = opts.getState();
    thumb.style.background = `hsl(${state.h}, ${s}%, ${l}%)`;
  }

  function rerender(): void {
    setSatGradient();
    reposThumb();
  }

  function setValue(nextS: number, nextL: number, fireChange: boolean): void {
    const prevS = Math.round(s);
    const prevL = Math.round(l);
    const clamped = clampSL({ s: nextS, l: nextL });
    s = clamped.s;
    l = clamped.l;
    const nowS = Math.round(s);
    const nowL = Math.round(l);
    if (nowS !== prevS || nowL !== prevL) {
      const onTen = (nowS !== prevS && nowS % 10 === 0) || (nowL !== prevL && nowL % 10 === 0);
      if (onTen) opts.haptics.tickStrong();
      else opts.haptics.tick();
    }
    reposThumb();
    if (fireChange) opts.onChange({ s, l });
  }

  function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cancelAnim(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function snapToInteger(): void {
    const targetS = Math.round(s);
    const targetL = Math.round(l);
    if (prefersReducedMotion()) {
      setValue(targetS, targetL, true);
      return;
    }
    cancelAnim();
    const startS = s;
    const startL = l;
    const startT = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (t: number) => {
      const p = Math.min(1, (t - startT) / SNAP_MS);
      setValue(startS + (targetS - startS) * ease(p), startL + (targetL - startL) * ease(p), true);
      if (p < 1) rafId = requestAnimationFrame(step);
      else rafId = 0;
    };
    rafId = requestAnimationFrame(step);
  }

  function update(clientX: number, clientY: number): void {
    const rect = pad.getBoundingClientRect();
    const sl = padToSL(clientX - rect.left, clientY - rect.top, rect.width, rect.height);
    setValue(sl.s, sl.l, true);
  }

  pad.addEventListener('pointerdown', (e: PointerEvent) => {
    if (pid !== null) return;
    cancelAnim();
    pid = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch { /* noop */ }
    thumb.style.boxShadow =
      '0 0 0 1.5px rgba(0,0,0,0.5), 0 0 0 6px rgba(236,230,218,0.18), 0 2px 8px rgba(0,0,0,0.55)';
    update(e.clientX, e.clientY);
  }, sig);

  pad.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    update(e.clientX, e.clientY);
  }, sig);

  function end(e: PointerEvent): void {
    if (e.pointerId !== pid) return;
    try { pad.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    pid = null;
    thumb.style.boxShadow = '0 0 0 1.5px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.55)';
    snapToInteger();
  }
  pad.addEventListener('pointerup', end, sig);
  pad.addEventListener('pointercancel', end, sig);

  // Initial paint.
  setSatGradient();
  reposThumb();
  const onResize = () => { reposThumb(); };
  window.addEventListener('resize', onResize, sig);

  return {
    el: pad,
    getValue: () => ({ s, l }),
    rerender,
    destroy: () => {
      ac.abort();
      cancelAnim();
      pad.remove();
    },
  };
}
