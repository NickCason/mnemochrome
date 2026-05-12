// src/ui/countdown.ts
// Edge-ring countdown: a paper-colored rounded-rect outline traced around the
// viewport that retracts to nothing over durationMs, then calls onDone.
//
// The outline is a rounded path (not a sharp rect) and is inset from the
// screen edges so it doesn't get clipped by iOS's rounded display corners
// or the home indicator. Path length is normalized to 1000 so the
// stroke-dashoffset transition is aspect-independent. The path rebuilds on
// resize/orientation change without interrupting the offset animation.

const INSET = 10;           // pixels in from each edge — clears iOS corner radius
const CORNER_RADIUS = 36;   // visual roundness of the ring's own corners
const PATH_LENGTH = 1000;   // normalized animation length

function buildRoundedRectPath(w: number, h: number): string {
  const inset = INSET;
  const r = Math.min(CORNER_RADIUS, (w - 2 * inset) / 2, (h - 2 * inset) / 2);
  const x1 = inset;
  const y1 = inset;
  const x2 = w - inset;
  const y2 = h - inset;
  return (
    `M ${x1 + r} ${y1} ` +
    `H ${x2 - r} ` +
    `A ${r} ${r} 0 0 1 ${x2} ${y1 + r} ` +
    `V ${y2 - r} ` +
    `A ${r} ${r} 0 0 1 ${x2 - r} ${y2} ` +
    `H ${x1 + r} ` +
    `A ${r} ${r} 0 0 1 ${x1} ${y2 - r} ` +
    `V ${y1 + r} ` +
    `A ${r} ${r} 0 0 1 ${x1 + r} ${y1} ` +
    `Z`
  );
}

export function mountCountdown(
  parent: HTMLElement,
  durationMs: number,
  onDone: () => void
): () => void {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'var(--paper)');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  path.setAttribute('pathLength', String(PATH_LENGTH));
  path.setAttribute('stroke-dasharray', String(PATH_LENGTH));
  path.setAttribute('stroke-dashoffset', '0');
  path.style.transition = `stroke-dashoffset ${durationMs}ms linear`;

  function sync() {
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    path.setAttribute('d', buildRoundedRectPath(w, h));
  }

  sync();
  svg.appendChild(path);
  parent.appendChild(svg);

  // Rebuild on size change (orientation, browser chrome show/hide). Because
  // the dasharray is fixed at PATH_LENGTH and pathLength normalizes the path,
  // changing `d` mid-animation does not interrupt the visual retraction.
  const resize = new ResizeObserver(sync);
  resize.observe(parent);

  // Kick off retraction on next frame so the transition actually applies.
  const raf = requestAnimationFrame(() => {
    path.setAttribute('stroke-dashoffset', String(PATH_LENGTH));
  });

  const timer = window.setTimeout(onDone, durationMs);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    resize.disconnect();
    svg.remove();
  };
}
