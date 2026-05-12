import type { HSL } from '../../color';
import type { HapticsHandle } from './haptics';
import type { MagnifierHandle, MagnifierAxis } from './magnifier';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
} from './render';

export const SLOT_PITCH = 32;
// Buffer above + below the centered slot. 15 slots total per tape; ~7 are
// visible inside the 252px capsule, the rest are off-window for the strip's
// translate to draw against.
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
  const base = -deltaYPx / SLOT_PITCH; // up = positive, units = slot-pitches
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
  /** Value units per slot. Defaults to 1 (sat/light). Set to 5 for hue so a
   *  visible 7-slot window spans 35° of hue — enough to see a real color
   *  gradient. */
  valueStep?: number;
}

export interface TapeHandle {
  el: HTMLElement;
  rerenderSlices: () => void;
  getValue: () => number;
  destroy: () => void;
}

export function createTape(opts: TapeOpts): TapeHandle {
  const valueStep = opts.valueStep ?? 1;

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

  // Top/bottom fades so slots outside the visible window soften into the ink.
  const fadeTop = document.createElement('div');
  fadeTop.style.cssText = 'position:absolute;left:0;right:0;top:0;height:38%;background:linear-gradient(to bottom, rgba(14,14,16,0.92), rgba(14,14,16,0));pointer-events:none;z-index:2;';
  const fadeBot = document.createElement('div');
  fadeBot.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(to top, rgba(14,14,16,0.92), rgba(14,14,16,0));pointer-events:none;z-index:2;';

  // Strip carrying TOTAL_SLOTS rounded-bar slots, translated so the centered
  // slot lands on the tape's vertical centerline.
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

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const s = document.createElement('div');
    s.style.cssText = [
      'width:74%',
      `height:${SLOT_PITCH - 6}px`,
      'margin:3px 0',
      'border-radius:5px',
      'flex-shrink:0',
      'box-shadow:inset 0 0 0 1px rgba(0,0,0,0.25)',
    ].join(';');
    strip.appendChild(s);
    slots.push(s);
  }

  el.appendChild(strip);
  el.appendChild(fadeTop);
  el.appendChild(fadeBot);

  // currentSnap = nearest valueStep multiple to current value. Slot at
  // CENTER_INDEX shows currentSnap; slot[CENTER_INDEX + i] shows
  // currentSnap + i * valueStep.
  function currentSnap(): number {
    return Math.round(value / valueStep) * valueStep;
  }

  function renderTransform(): void {
    const snap = currentSnap();
    // Offset is fraction of one slot-pitch the strip should drift to
    // visually represent `value` between snap points. Range [-0.5, 0.5].
    const offset = (value - snap) / valueStep;
    const tY = -(CENTER_INDEX + 0.5 + offset) * SLOT_PITCH;
    strip.style.transform = `translateY(${tY}px)`;
  }

  function renderColors(): void {
    const state = opts.getState();
    const snap = currentSnap();
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const slotValue = normalizeValue(snap + (i - CENTER_INDEX) * valueStep, opts.axis);
      let color: string;
      if (opts.axis === 'h')      color = huePreviewSlice(slotValue, state.s, state.l);
      else if (opts.axis === 's') color = satPreviewSlice(slotValue, state.h, state.l);
      else                        color = lightPreviewSlice(slotValue, state.h, state.s);
      slots[i].style.background = color;
    }
  }

  function setValue(next: number, fireChange: boolean): void {
    const prevSnap = currentSnap();
    value = normalizeValue(next, opts.axis);
    const nextSnap = currentSnap();
    if (nextSnap !== prevSnap) {
      if (nextSnap % 10 === 0) opts.haptics.tickStrong();
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
      const dValue = dragToValueDelta(dy, Math.abs(v)) * valueStep;
      setValue(value + dValue, true);
      v *= Math.exp(-INERTIA_DECAY_PER_MS * dt);
      if (Math.abs(v) > 0.05) {
        rafId = requestAnimationFrame(step);
      } else {
        snapToSnap();
      }
    };
    rafId = requestAnimationFrame(step);
  }

  function snapToSnap(): void {
    animateTo(currentSnap());
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
    opts.magnifier.update(e.clientX, e.clientY, currentSnap(), opts.axis, opts.getState(), valueStep);
  }, sig);

  el.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerId !== activePointerId || !dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    const dy = e.clientY - lastY;
    velocity = dy / dt;
    totalAbsMove += Math.abs(dy);
    const dValue = dragToValueDelta(dy, Math.abs(velocity)) * valueStep;
    setValue(value + dValue, true);
    lastY = e.clientY;
    lastTime = now;
    opts.magnifier.update(e.clientX, e.clientY, currentSnap(), opts.axis, opts.getState(), valueStep);
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
      animateTo(currentSnap() + direction * valueStep);
      return;
    }
    if (Math.abs(velocity) >= INERTIA_MIN_V && !prefersReducedMotion()) {
      startInertia(velocity);
    } else {
      snapToSnap();
    }
  }
  el.addEventListener('pointerup', pointerEnd, sig);
  el.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activePointerId) return;
    try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    endDrag();
    snapToSnap();
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
