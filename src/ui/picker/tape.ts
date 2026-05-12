import type { HSL } from '../../color';
import type { HapticsHandle } from './haptics';
import type { MagnifierHandle, MagnifierAxis } from './magnifier';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
} from './render';

export const SLOT_PITCH = 32;
// Slot buffer above + below center. With CENTER_INDEX=7 the strip has 15 slots
// total (visible ~7 plus invisible buffer that gets re-tinted as values cross
// integer boundaries). The strip translateY hides the buffer outside the tape.
const CENTER_INDEX = 7;
const TOTAL_SLOTS = CENTER_INDEX * 2 + 1; // 15
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
  const base = -deltaYPx / SLOT_PITCH; // up = positive
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
}

export interface TapeHandle {
  el: HTMLElement;
  rerenderSlices: () => void;
  getValue: () => number;
  destroy: () => void;
}

export function createTape(opts: TapeOpts): TapeHandle {
  let value = opts.initialValue;
  let dragging = false;
  let activePointerId: number | null = null;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let startTime = 0;
  let totalAbsMove = 0;
  let inertiaRaf = 0;

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

  // Top/bottom fades so values outside the visible window fade into the ink.
  const fadeTop = document.createElement('div');
  fadeTop.style.cssText = 'position:absolute;left:0;right:0;top:0;height:42%;background:linear-gradient(to bottom, rgba(14,14,16,0.95), rgba(14,14,16,0));pointer-events:none;z-index:2;';
  const fadeBot = document.createElement('div');
  fadeBot.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(to top, rgba(14,14,16,0.95), rgba(14,14,16,0));pointer-events:none;z-index:2;';

  // Strip: a tall vertical stack of TOTAL_SLOTS slots, translated so the
  // center slot lands on the tape's vertical centerline. Slots are full-width
  // flush-stacked (no margins, no per-slot borders) so the column reads as a
  // single continuous tape, not a row of bars.
  const strip = document.createElement('div');
  strip.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'top:50%',
    'display:flex',
    'flex-direction:column',
    'align-items:stretch',
    'pointer-events:none',
    'will-change:transform',
  ].join(';');

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const s = document.createElement('div');
    s.style.cssText = `width:100%;height:${SLOT_PITCH}px;flex-shrink:0;`;
    strip.appendChild(s);
    slots.push(s);
  }

  el.appendChild(strip);
  el.appendChild(fadeTop);
  el.appendChild(fadeBot);

  // Strip translate that places slot[CENTER_INDEX]'s vertical center at the
  // tape's vertical centerline (which is `top:50%`). For sub-integer values
  // we add an additional offset so the tape appears to scroll continuously
  // between integer slots.
  function renderTransform(): void {
    const intValue = Math.round(value);
    const offset = value - intValue; // ∈ [-0.5, 0.5]
    const tY = -(CENTER_INDEX + 0.5 + offset) * SLOT_PITCH;
    strip.style.transform = `translateY(${tY}px)`;
  }

  function renderColors(): void {
    const state = opts.getState();
    const intValue = Math.round(value);
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const slotValue = normalizeValue(intValue + (i - CENTER_INDEX), opts.axis);
      let color: string;
      if (opts.axis === 'h')      color = huePreviewSlice(slotValue, state.s, state.l);
      else if (opts.axis === 's') color = satPreviewSlice(slotValue, state.h, state.l);
      else                        color = lightPreviewSlice(slotValue, state.h, state.s);
      slots[i].style.background = color;
    }
  }

  function renderAll(): void {
    renderTransform();
    renderColors();
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

  function endDrag(): void {
    dragging = false;
    activePointerId = null;
    opts.magnifier.hide();
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
      const dValue = dragToValueDelta(dy, Math.abs(v));
      setValue(value + dValue, true);
      v *= Math.exp(-INERTIA_DECAY_PER_MS * dt);
      if (Math.abs(v) > 0.05) {
        inertiaRaf = requestAnimationFrame(step);
      } else {
        // Snap to the nearest integer at the end so the tape rests aligned.
        snapToInteger();
      }
    };
    inertiaRaf = requestAnimationFrame(step);
  }

  function cancelInertia(): void {
    if (inertiaRaf) {
      cancelAnimationFrame(inertiaRaf);
      inertiaRaf = 0;
    }
  }

  function animateTo(target: number): void {
    cancelInertia();
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
      if (p < 1) inertiaRaf = requestAnimationFrame(step);
      else inertiaRaf = 0;
    };
    inertiaRaf = requestAnimationFrame(step);
  }

  function snapToInteger(): void {
    animateTo(Math.round(value));
  }

  el.addEventListener('pointerdown', (e: PointerEvent) => {
    if (activePointerId !== null) return;
    cancelInertia();
    activePointerId = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragging = true;
    lastY = e.clientY;
    lastTime = performance.now();
    startTime = lastTime;
    velocity = 0;
    totalAbsMove = 0;
    opts.magnifier.update(e.clientX, e.clientY, Math.round(value), opts.axis, opts.getState());
  }, sig);

  el.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerId !== activePointerId || !dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    const dy = e.clientY - lastY;
    velocity = dy / dt;
    totalAbsMove += Math.abs(dy);
    const dValue = dragToValueDelta(dy, Math.abs(velocity));
    setValue(value + dValue, true);
    lastY = e.clientY;
    lastTime = now;
    opts.magnifier.update(e.clientX, e.clientY, Math.round(value), opts.axis, opts.getState());
  }, sig);

  function pointerEnd(e: PointerEvent): void {
    if (e.pointerId !== activePointerId) return;
    const duration = performance.now() - startTime;
    const isAtap = isTap(duration, totalAbsMove);
    try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    endDrag();
    if (isAtap) {
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

  renderAll();

  return {
    el,
    rerenderSlices: renderColors,
    getValue: () => value,
    destroy: () => {
      ac.abort();
      cancelInertia();
      el.remove();
    },
  };
}
