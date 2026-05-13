// Horizontal hue strip — full 360° spectrum laid out across the screen, with
// a thin paper thumb tracking the touch position. Replaces the vertical hue
// tape. Operating concept preserved from the old tape:
//   - drag-to-set (thumb tracks finger)
//   - inertia after a fast flick
//   - snap-to-integer on release
//   - haptic ticks at integer crossings (strong every 10°)
//   - a lens magnifier pops above the touch point during the drag
// Differs from the old tape in two ways: the whole spectrum is visible at
// rest (no scrolling under a band), and a tap sets the hue to the tapped
// position directly rather than stepping by 1.

import type { HSL } from '../../color';
import type { HapticsHandle } from './haptics';
import { createLens, type LensHandle } from './lens';

export const HUE_RANGE = 360;
export const TAP_MAX_DURATION_MS = 200;
export const TAP_MAX_MOVE_PX = 8;
const INERTIA_MIN_V = 0.4;
const INERTIA_DECAY_PER_MS = 0.0035;
const STEP_SNAP_MS = 140;

// ---- Pure helpers (unit-tested) ----

export function pxToHue(x: number, width: number): number {
  if (width <= 0) return 0;
  const t = Math.max(0, Math.min(1, x / width));
  return t * HUE_RANGE;
}

export function hueToPx(h: number, width: number): number {
  const clamped = Math.max(0, Math.min(HUE_RANGE, h));
  return (clamped / HUE_RANGE) * width;
}

/** Round to integer, then cap at HUE_RANGE - 1 so the right edge doesn't
 *  collapse to 0 (since hsl(360) === hsl(0) but visually we want the thumb
 *  to stay near the right). */
export function snapHue(value: number): number {
  return Math.min(HUE_RANGE - 1, Math.max(0, Math.round(value)));
}

export function isTap(durationMs: number, totalMovePx: number): boolean {
  return durationMs <= TAP_MAX_DURATION_MS && totalMovePx <= TAP_MAX_MOVE_PX;
}

// ---- Strip ----

export interface HueStripOpts {
  initial: number;
  onChange: (h: number) => void;
  haptics: HapticsHandle;
  getState: () => HSL;
  /** Parent element the lens is attached to — usually the picker root, so the
   *  lens can float above the strip without being clipped by its border. */
  lensParent: HTMLElement;
}

export interface HueStripHandle {
  el: HTMLElement;
  getValue: () => number;
  rerender: () => void;
  destroy: () => void;
}

export function createHueStrip(opts: HueStripOpts): HueStripHandle {
  let value = Math.max(0, Math.min(HUE_RANGE - 1, opts.initial));
  let pid: number | null = null;
  let dragging = false;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let startTime = 0;
  let totalAbsMove = 0;
  let rafId = 0;

  const ac = new AbortController();
  const sig: AddEventListenerOptions = { signal: ac.signal };

  // Outer wrapper — the part that lives in document flow. The strip itself
  // sits inside with padding so the thumb can extend a few pixels above and
  // below the gradient without being clipped.
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:relative',
    'flex:0 0 auto',
    'padding:6px 0',
    'margin:0 4px',
  ].join(';');

  const strip = document.createElement('div');
  strip.style.cssText = [
    'position:relative',
    'height:40px',
    'border-radius:10px',
    'border:1px solid rgba(236,230,218,0.18)',
    'overflow:hidden',
    'touch-action:none',
    'box-shadow:inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 14px rgba(0,0,0,0.35)',
  ].join(';');

  const grad = document.createElement('div');
  // Fixed s=100, l=50 so the spectrum stays discriminable regardless of the
  // currently selected sat/light — same idea as the demo, same as most
  // production color pickers.
  grad.style.cssText = [
    'position:absolute',
    'inset:0',
    'background:linear-gradient(to right,' +
      'hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),' +
      'hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))',
  ].join(';');
  strip.appendChild(grad);

  const thumb = document.createElement('div');
  thumb.style.cssText = [
    'position:absolute',
    'top:-6px',
    'bottom:-6px',
    'width:3px',
    'margin-left:-1.5px',
    'background:var(--paper, #ECE6DA)',
    'border-radius:2px',
    'box-shadow:0 0 0 1px rgba(0,0,0,0.55), 0 1px 6px rgba(0,0,0,0.45)',
    'pointer-events:none',
    'will-change:left',
    'z-index:3',
  ].join(';');
  strip.appendChild(thumb);

  // Tick rule — visual reference for the major hue families.
  const ticksEl = document.createElement('div');
  ticksEl.style.cssText = [
    'position:relative',
    'height:14px',
    'margin-top:4px',
    'overflow:visible',
  ].join(';');

  wrap.appendChild(strip);
  wrap.appendChild(ticksEl);

  const lens: LensHandle = createLens(opts.lensParent);

  function renderTicks(): void {
    ticksEl.innerHTML = '';
    const w = strip.getBoundingClientRect().width;
    // Minor tick every 30°, major every 60°. Labels on majors.
    for (let h = 0; h <= HUE_RANGE; h += 30) {
      const isMajor = h % 60 === 0;
      const tk = document.createElement('div');
      tk.style.cssText = [
        'position:absolute',
        'top:0',
        'width:1px',
        `height:${isMajor ? 9 : 5}px`,
        `background:rgba(236,230,218,${isMajor ? 0.45 : 0.22})`,
        'margin-left:-0.5px',
        `left:${(h / HUE_RANGE) * w}px`,
      ].join(';');
      ticksEl.appendChild(tk);
      if (isMajor) {
        const lab = document.createElement('div');
        lab.style.cssText = [
          'position:absolute',
          'top:11px',
          'font-size:9px',
          'color:var(--mute, #7A7670)',
          'letter-spacing:0.05em',
          'transform:translateX(-50%)',
          `left:${(h / HUE_RANGE) * w}px`,
        ].join(';');
        lab.textContent = `${h}°`;
        ticksEl.appendChild(lab);
      }
    }
  }

  function renderThumb(): void {
    const w = strip.getBoundingClientRect().width;
    thumb.style.left = `${hueToPx(value, w)}px`;
  }

  function rerender(): void {
    renderThumb();
  }

  function setValue(next: number, fireChange: boolean): void {
    const prev = Math.round(value);
    value = Math.max(0, Math.min(HUE_RANGE, next));
    const now = Math.round(value);
    if (prev !== now) {
      if (now % 10 === 0) opts.haptics.tickStrong();
      else opts.haptics.tick();
    }
    renderThumb();
    if (fireChange) opts.onChange(((value % HUE_RANGE) + HUE_RANGE) % HUE_RANGE);
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
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (t: number) => {
      const p = Math.min(1, (t - startT) / STEP_SNAP_MS);
      setValue(startV + (target - startV) * ease(p), true);
      if (p < 1) rafId = requestAnimationFrame(step);
      else rafId = 0;
    };
    rafId = requestAnimationFrame(step);
  }

  function startInertia(initialV: number): void {
    if (Math.abs(initialV) < INERTIA_MIN_V) {
      animateTo(snapHue(value));
      return;
    }
    if (prefersReducedMotion()) {
      animateTo(snapHue(value));
      return;
    }
    let v = initialV;
    let prevTime = performance.now();
    const step = (t: number) => {
      const dt = t - prevTime;
      prevTime = t;
      const dx = v * dt;
      const w = strip.getBoundingClientRect().width;
      const dValue = (dx / w) * HUE_RANGE;
      setValue(value + dValue, true);
      v *= Math.exp(-INERTIA_DECAY_PER_MS * dt);
      if (Math.abs(v) > 0.05) rafId = requestAnimationFrame(step);
      else animateTo(snapHue(value));
    };
    rafId = requestAnimationFrame(step);
  }

  function localX(e: PointerEvent): number {
    const rect = strip.getBoundingClientRect();
    return e.clientX - rect.left;
  }

  function showLens(e: PointerEvent): void {
    const rect = strip.getBoundingClientRect();
    lens.update(e.clientX, rect.top, value);
  }

  strip.addEventListener('pointerdown', (e: PointerEvent) => {
    if (pid !== null) return;
    cancelAnim();
    pid = e.pointerId;
    try { strip.setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragging = true;
    lastX = e.clientX;
    lastTime = performance.now();
    startTime = lastTime;
    velocity = 0;
    totalAbsMove = 0;
    const w = strip.getBoundingClientRect().width;
    setValue(pxToHue(localX(e), w), true);
    showLens(e);
  }, sig);

  strip.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerId !== pid || !dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    const dx = e.clientX - lastX;
    velocity = dx / dt;
    totalAbsMove += Math.abs(dx);
    const w = strip.getBoundingClientRect().width;
    setValue(pxToHue(localX(e), w), true);
    showLens(e);
    lastX = e.clientX;
    lastTime = now;
  }, sig);

  function pointerEnd(e: PointerEvent): void {
    if (e.pointerId !== pid) return;
    const duration = performance.now() - startTime;
    const tap = isTap(duration, totalAbsMove);
    try { strip.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    pid = null;
    dragging = false;
    lens.hide();
    // Both tap and short drag end the same way: snap to integer at current
    // position. Long fast drags keep some momentum.
    if (!tap && Math.abs(velocity) >= INERTIA_MIN_V && !prefersReducedMotion()) {
      startInertia(velocity);
    } else {
      animateTo(snapHue(value));
    }
  }
  strip.addEventListener('pointerup', pointerEnd, sig);
  strip.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== pid) return;
    try { strip.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    pid = null;
    dragging = false;
    lens.hide();
    animateTo(snapHue(value));
  }, sig);

  // Initial paint. Defer ticks one frame so the strip has its real width.
  renderThumb();
  requestAnimationFrame(renderTicks);
  // Keep ticks correct on resize (orientation change, dynamic viewport).
  const onResize = () => { renderTicks(); renderThumb(); };
  window.addEventListener('resize', onResize, sig);

  return {
    el: wrap,
    getValue: () => value,
    rerender,
    destroy: () => {
      ac.abort();
      cancelAnim();
      lens.destroy();
      wrap.remove();
    },
  };
}
