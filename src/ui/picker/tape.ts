import type { HSL } from '../../color';
import type { HapticsHandle } from './haptics';
import type { MagnifierHandle, MagnifierAxis } from './magnifier';
import {
  huePreviewSlice,
  satPreviewSlice,
  lightPreviewSlice,
  trueColor,
} from './render';

export const SLOT_PITCH = 32;
export const VISIBLE_RADIUS = 4; // slots above and below selection
const TOTAL_SLOTS = VISIBLE_RADIUS * 2 + 1; // 9
export const V_SLOW = 1.0;
export const V_FAST = 2.5;
export const MAX_SCALE = 8;
export const TAP_MAX_DURATION_MS = 200;
export const TAP_MAX_MOVE_PX = 8;
const INERTIA_MIN_V = 0.4;
const INERTIA_DECAY_PER_MS = 0.0035; // exponential factor
const STEP_SNAP_MS = 120;

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
  return (base * velocityScale(velocityPxMs)) || 0; // coerce -0 → 0
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
    'border-left:1px solid rgba(236,230,218,0.06)',
  ].join(';');

  // Top/bottom fades
  const fadeTop = document.createElement('div');
  fadeTop.style.cssText = 'position:absolute;left:0;right:0;top:0;height:38%;background:linear-gradient(to bottom, var(--ink, #0E0E10), transparent);pointer-events:none;z-index:2;';
  const fadeBot = document.createElement('div');
  fadeBot.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:38%;background:linear-gradient(to top, var(--ink, #0E0E10), transparent);pointer-events:none;z-index:2;';

  // Strip container holding 9 slots, vertically centered
  const strip = document.createElement('div');
  strip.style.cssText = 'position:absolute;left:0;right:0;top:50%;display:flex;flex-direction:column;align-items:center;transform:translateY(-50%);pointer-events:none;';

  const slots: HTMLDivElement[] = [];
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const s = document.createElement('div');
    s.style.cssText = `width:62%;height:${SLOT_PITCH - 4}px;margin:2px 0;border-radius:5px;flex-shrink:0;`;
    if (i === VISIBLE_RADIUS) {
      // selection slot
      s.style.height = `${SLOT_PITCH - 4}px`;
      s.style.boxShadow = '0 0 0 1px var(--paper, #ECE6DA), 0 0 0 2px rgba(0,0,0,0.6)';
      s.style.borderRadius = '6px';
    }
    strip.appendChild(s);
    slots.push(s);
  }

  el.appendChild(fadeTop);
  el.appendChild(fadeBot);
  el.appendChild(strip);

  function renderSlots(): void {
    const state = opts.getState();
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const delta = i - VISIBLE_RADIUS;
      const raw = value + delta;
      const v = normalizeValue(raw, opts.axis);
      let color: string;
      if (delta === 0) {
        color = trueColor({ ...state, [opts.axis]: v } as HSL);
      } else if (opts.axis === 'h') {
        color = huePreviewSlice(v, state.s, state.l);
      } else if (opts.axis === 's') {
        color = satPreviewSlice(v, state.h, state.l);
      } else {
        color = lightPreviewSlice(v, state.h, state.s);
      }
      slots[i].style.background = color;
    }
  }

  function setValue(next: number, fireChange: boolean): void {
    const prevRounded = Math.round(value);
    value = normalizeValue(next, opts.axis);
    const newRounded = Math.round(value);
    if (newRounded !== prevRounded) {
      // One tick per frame in which the rounded value changed; strong if the
      // new rounded value is a multiple of 10. Capping at one tick per frame
      // keeps fast flicks from buzzing indistinguishably.
      if (newRounded % 10 === 0) opts.haptics.tickStrong();
      else opts.haptics.tick();
    }
    renderSlots();
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
    let v = initialV; // px/ms; positive = downward = decreasing value
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
      setValue(value + direction, true);
      if (!prefersReducedMotion()) {
        strip.animate(
          [
            { transform: `translateY(calc(-50% + ${direction * 4}px))` },
            { transform: 'translateY(-50%)' },
          ],
          { duration: STEP_SNAP_MS, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' },
        );
      }
      return;
    }
    startInertia(velocity);
  }
  el.addEventListener('pointerup', pointerEnd, sig);
  el.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activePointerId) return;
    try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    endDrag();
  }, sig);

  // initial render
  renderSlots();

  return {
    el,
    rerenderSlices: renderSlots,
    getValue: () => value,
    destroy: () => {
      ac.abort();
      cancelInertia();
      el.remove();
    },
  };
}
