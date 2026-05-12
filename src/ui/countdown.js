// src/ui/countdown.ts
// Renders a thin paper-colored rectangle outline inside `parent` that retracts
// (stroke-dashoffset animates from 0 to its full pathLength) over `durationMs`
// and calls `onDone` when finished. Returns a cleanup function that cancels
// the animation, clears the timer, and removes the SVG.
export function mountCountdown(parent, durationMs, onDone) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '1');
    rect.setAttribute('y', '1');
    rect.setAttribute('width', '98');
    rect.setAttribute('height', '98');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'var(--paper)');
    rect.setAttribute('stroke-width', '0.6');
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    rect.setAttribute('pathLength', '1000');
    rect.setAttribute('stroke-dasharray', '1000');
    rect.setAttribute('stroke-dashoffset', '0');
    rect.style.transition = `stroke-dashoffset ${durationMs}ms linear`;
    svg.appendChild(rect);
    parent.appendChild(svg);
    // Trigger the animation on next frame so the transition actually applies.
    const raf = requestAnimationFrame(() => {
        rect.setAttribute('stroke-dashoffset', '1000');
    });
    const timer = window.setTimeout(onDone, durationMs);
    return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        svg.remove();
    };
}
