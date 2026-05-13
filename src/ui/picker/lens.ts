// Lens — circular magnifier that pops above the hue strip while dragging.
// Shows the live hue as a flat fill + a degree readout at its base. Unlike
// the old vertical-tape magnifier (which scrolled discrete slots through a
// circle), the new strip already displays the entire spectrum statically, so
// the lens only needs to call out the *selected* value at a readable size.

const SIZE = 84;
const OFFSET_ABOVE = 24;
const EDGE_PAD = 8;

export interface LensHandle {
  /** Position the lens horizontally over the touch X (in `parent` coords),
   *  vertically above the strip's top edge by OFFSET_ABOVE. Re-rendered every
   *  pointermove. */
  update: (clientX: number, stripTopClient: number, hue: number) => void;
  hide: () => void;
  destroy: () => void;
}

export function createLens(parent: HTMLElement): LensHandle {
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:absolute',
    `width:${SIZE}px`,
    `height:${SIZE}px`,
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 120ms ease',
    'z-index:50',
    'left:0',
    'top:0',
    'will-change:transform, opacity, background',
    'border-radius:50%',
    'border:2px solid rgba(236, 230, 218, 0.45)',
    'box-shadow:0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.6)',
    'overflow:hidden',
  ].join(';');

  const num = document.createElement('div');
  num.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'bottom:6px',
    'text-align:center',
    'font-size:12px',
    'color:var(--paper, #ECE6DA)',
    'text-shadow:0 1px 4px rgba(0,0,0,0.75)',
    "font-feature-settings:'tnum'",
    'letter-spacing:0.03em',
  ].join(';');
  wrap.appendChild(num);
  parent.appendChild(wrap);

  return {
    update: (clientX, stripTopClient, hue) => {
      const parentRect = parent.getBoundingClientRect();
      const localX = clientX - parentRect.left;
      const half = SIZE / 2;
      const bx = Math.max(
        EDGE_PAD + half,
        Math.min(parentRect.width - EDGE_PAD - half, localX),
      );
      // Sit above the strip; if there's not enough room, clamp to the top.
      const by = Math.max(EDGE_PAD, stripTopClient - parentRect.top - SIZE - OFFSET_ABOVE);
      wrap.style.transform = `translate(${bx - half}px, ${by}px)`;
      wrap.style.background = `hsl(${hue}, 100%, 50%)`;
      num.textContent = `${Math.round(((hue % 360) + 360) % 360)}°`;
      wrap.style.opacity = '1';
    },
    hide: () => {
      wrap.style.opacity = '0';
    },
    destroy: () => {
      wrap.remove();
    },
  };
}
