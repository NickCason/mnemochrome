import type { HSL } from '../../color';
import type { HapticsHandle } from './haptics';
import type { MagnifierHandle, MagnifierAxis } from './magnifier';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
} from './render';

export const SLOT_PITCH = 32;
const DEFAULT_TOTAL_SLOTS = 15;
export const V_SLOW = 1.0;
export const V_FAST = 2.5;
export const MAX_SCALE = 8;
export const TAP_MAX_DURATION_MS = 200;
export const TAP_MAX_MOVE_PX = 8;
const INERTIA_MIN_V = 0.4;
const INERTIA_DECAY_PER_MS = 0.0035;
const STEP_SNAP_MS = 140;

// ---- Pure helpers (unit-tested) ----

export function velocityScale(v: number): number {
  const av = Math.abs(v);
  if (av <= V_SLOW) return 1;
  if (av >= V_FAST) return MAX_SCALE;
  const t = (av - V_SLOW) / (V_FAST - V_SLOW);
  return 1 + t * (MAX_SCALE - 1);
}

export function dragToValueDelta(deltaYPx: number, velocityPxMs: number): number {
  const base = -deltaYPx / SLOT_PITCH;
  return (base * velocityScale(velocityPxMs)) || 0;
}

export function normalizeValue(value: number, axis: MagnifierAxis): number {
  if (axis === 'h') return ((value % 360) + 360) % 360;
  return Math.max(0, Math.min(100, value));
}

export function isTap(durationMs: number, totalMovePx: number): boolean {
  return durationMs <= TAP_MAX_DURATION_MS && totalMovePx <= TAP_MAX_MOVE_PX;
}

// ---- Tape ----

export interface TapeOpts {
  axis: MagnifierAxis;
  initialValue: number;
  onChange: (value: number) => void;
  haptics: HapticsHandle;
  magnifier: MagnifierHandle;
  getState: () => HSL;
  /** Px per unit. Smaller pitch = denser tape. Default 32 (good for 100-unit
   *  axes like sat/light). Hue uses ~8 for visible spectrum density at 1°
   *  precision. */
  slotPitch?: number;
  /** Total slot DOM nodes — enough to cover visible window + buffer for the
   *  strip's translate. Default 15 (works for 32px pitch). */
  totalSlots?: number;
}

export interface TapeHandle {
  el: HTMLElement;
  rerenderSlices: () => void;
  getValue: () => number;
  destroy: () => void;
}

export function createTape(opts: TapeOpts): TapeHandle {
  const pitch = opts.slotPitch ?? SLOT_PITCH;
  const totalSlots = opts.totalSlots ?? DEFAULT_TOTAL_SLOTS;
  const centerIndex = Math.floor(totalSlots / 2);

  let value = opts.initialValue;
  let dragging = false;
  let activePointerId: number | null = null;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let startTime = 0;
  let totalAbsMove = 0;
  let rafId = 0;

  const ac = new AbortController();
  const sig = { signal: ac.signal };

  const el = document.createElement('div');
  el.style.cssText = [
    'flex:1',
    'position:relative',
    'overflow:hidden',
    'touch-action:none',
    'border-left:1px solid rgba(236,230,218,0.10)',
  ].join(';');

  const fadeTop = document.createElement('div');
  fadeTop.style.cssText = 'position:absolute;left:0;right:0;top:0;height:38%;background:linear-gradient(to bottom, rgba(14,14,16,0.92), rgba(14,14,16,0));pointer-events:none;z-index:2;';
  const fadeBot = document.createElement('div');
  fadeBot.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(to top, rgba(14,14,16,0.92), rgba(14,14,16,0));pointer-events:none;z-index:2;';

  // Strip is `totalSlots * pitch` tall. Each slot is `pitch` tall. Width-padded
  // for the rounded bar look; very small pitches (hue) get reduced inner
  // padding so the bar still has some height visually.
  const strip = document.createElement('div');
  strip.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'top:50%',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'pointer-events:none',
    'will-change:transform',
  ].join(';');

  const innerMargin = pitch >= 24 ? 3 : 1;
  const slotHeight = pitch - innerMargin * 2;
  const slotRadius = Math.min(5, Math.floor(slotHeight / 2));

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < totalSlots; i++) {
    const s = document.createElement('div');
    s.style.cssText = [
      'width:78%',
      `height:${slotHeight}px`,
      `margin:${innerMargin}px 0`,
      `border-radius:${slotRadius}px`,
      'flex-shrink:0',
      'box-shadow:inset 0 0 0 1px rgba(0,0,0,0.22)',
    ].join(';');
    strip.appendChild(s);
    slots.push(s);
  }

  el.appendChild(strip);
  el.appendChild(fadeTop);
  el.appendChild(fadeBot);

  function renderTransform(): void {
    const intValue = Math.round(value);
    const offset = value - intValue;
    const tY = -(centerIndex + 0.5 + offset) * pitch;
    strip.style.transform = `translateY(${tY}px)`;
  }

  function renderColors(): void {
    const state = opts.getState();
    const intValue = Math.round(value);
    for (let i = 0; i < totalSlots; i++) {
      const slotValue = normalizeValue(intValue + (i - centerIndex), opts.axis);
      let color: string;
      if (opts.axis === 'h')      color = huePreviewSlice(slotValue, state.s, state.l);
      else if (opts.axis === 's') color = satPreviewSlice(slotValue, state.h, state.l);
      else                        color = lightPreviewSlice(slotValue, state.h, state.s);
      slots[i].style.background = color;
    }
  }

  function setValue(next: number, fireChange: boolean): void {
    const prevRounded = Math.round(value);
    value = normalizeValue(next, opts.axis);
    const newRounded = Math.round(value);
    if (newRounded !== prevRounded) {
      if (newRounded % 10 === 0) opts.haptics.tickStrong();
      else opts.haptics.tick();
      renderColors();
    }
    renderTransform();
    if (fireChange) opts.onChange(value);
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

  function animateTo(target: number): void {
    cancelAnim();
    if (target === value) return;
    if (prefersReducedMotion()) {
      setValue(target, true);
      return;
    }
    const startV = value;
    const startT = performance.now();
    const dur = STEP_SNAP_MS;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (t: number) => {
      const p = Math.min(1, (t - startT) / dur);
      const v = startV + (target - startV) * ease(p);
      setValue(v, true);
      if (p < 1) rafId = requestAnimationFrame(step);
      else rafId = 0;
    };
    rafId = requestAnimationFrame(step);
  }

  function startInertia(initialV: number): void {
    if (Math.abs(initialV) < INERTIA_MIN_V) return;
    if (prefersReducedMotion()) return;
    let v = initialV;
    let prevTime = performance.now();
    const step = (t: number) => {
      const dt = t - prevTime;
      prevTime = t;
      const dy = v * dt;
      const base = -dy / pitch;
      const dValue = (base * velocityScale(Math.abs(v))) || 0;
      setValue(value + dValue, true);
      v *= Math.exp(-INERTIA_DECAY_PER_MS * dt);
      if (Math.abs(v) > 0.05) {
        rafId = requestAnimationFrame(step);
      } else {
        snapToInteger();
      }
    };
    rafId = requestAnimationFrame(step);
  }

  function snapToInteger(): void {
    animateTo(Math.round(value));
  }

  function endDrag(): void {
    dragging = false;
    activePointerId = null;
    opts.magnifier.hide();
  }

  el.addEventListener('pointerdown', (e: PointerEvent) => {
    if (activePointerId !== null) return;
    cancelAnim();
    activePointerId = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragging = true;
    lastY = e.clientY;
    lastTime = performance.now();
    startTime = lastTime;
    velocity = 0;
    totalAbsMove = 0;
    opts.magnifier.update(e.clientX, e.clientY, value, opts.axis, opts.getState());
  }, sig);

  el.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerId !== activePointerId || !dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    const dy = e.clientY - lastY;
    velocity = dy / dt;
    totalAbsMove += Math.abs(dy);
    const base = -dy / pitch;
    const dValue = (base * velocityScale(Math.abs(velocity))) || 0;
    setValue(value + dValue, true);
    lastY = e.clientY;
    lastTime = now;
    opts.magnifier.update(e.clientX, e.clientY, value, opts.axis, opts.getState());
  }, sig);

  function pointerEnd(e: PointerEvent): void {
    if (e.pointerId !== activePointerId) return;
    const duration = performance.now() - startTime;
    const wasTap = isTap(duration, totalAbsMove);
    try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    endDrag();
    if (wasTap) {
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const direction = e.clientY < centerY ? 1 : -1;
      animateTo(Math.round(value) + direction);
      return;
    }
    if (Math.abs(velocity) >= INERTIA_MIN_V && !prefersReducedMotion()) {
      startInertia(velocity);
    } else {
      snapToInteger();
    }
  }
  el.addEventListener('pointerup', pointerEnd, sig);
  el.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activePointerId) return;
    try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    endDrag();
    snapToInteger();
  }, sig);

  renderColors();
  renderTransform();

  return {
    el,
    rerenderSlices: renderColors,
    getValue: () => value,
    destroy: () => {
      ac.abort();
      cancelAnim();
      el.remove();
    },
  };
}
