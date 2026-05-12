// src/ui/share-card.ts
// Renders a curated 1080×1920 share image for a finished round: target color
// on top, guess color on bottom, a glass card in the middle holding the
// percentage, the hex codes, the wordmark, and the URL. No DOM is touched —
// the entire card is drawn to an offscreen canvas, so any chrome that happens
// to be on screen (e.g. the Share button itself) cannot leak into the export.

import { axisCloseness, hexToHsl, type HSL } from '../color';

const PAPER = '#ECE6DA';
const MUTE = '#7A7670';
const ACCENT = '#C2185B';
const URL_TEXT = 'nickcason.github.io/mnemochrome';

const W = 1080;
const H = 1920;

const FRAUNCES = '"Fraunces Variable", Georgia, serif';
const INTER = '"Inter Variable", system-ui, sans-serif';

async function ensureFontsLoaded(): Promise<void> {
  // Eager-load the specific weights/sizes we draw — document.fonts.ready alone
  // doesn't guarantee a particular size is rasterized.
  await Promise.all([
    document.fonts.load(`400 200px ${FRAUNCES}`),
    document.fonts.load(`400 56px ${FRAUNCES}`),
    document.fonts.load(`400 44px ${FRAUNCES}`),
    document.fonts.load(`500 26px ${INTER}`),
    document.fonts.load(`500 22px ${INTER}`),
    document.fonts.load(`400 22px ${INTER}`),
    document.fonts.load(`500 38px ${INTER}`),
    document.fonts.load(`400 28px ${INTER}`),
    document.fonts.load(`500 24px ${INTER}`),
  ]);
  await document.fonts.ready;
}

function drawWordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  pxSize: number
): void {
  ctx.font = `400 ${pxSize}px ${FRAUNCES}`;
  ctx.textBaseline = 'alphabetic';
  const text = 'mnemochrome';
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    // The two 'o's are at positions 4 and 8.
    ctx.fillStyle = c === 'o' && (i === 4 || i === 8) ? ACCENT : PAPER;
    ctx.textAlign = 'left';
    ctx.fillText(c, x, y);
    x += widths[i];
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Mirrors the in-app grade-screen swatch chip: label / hex / HSL stacked,
// in a glass capsule that reads on any background color.
function drawSwatchChip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: string,
  hex: string,
  hsl: HSL
): void {
  const hStr = hsl.s < 1.5 ? '—' : `${Math.round(hsl.h)}°`;
  const hslText = `H ${hStr}   ·   S ${Math.round(hsl.s)}%   ·   L ${Math.round(hsl.l)}%`;
  const hexText = hex.toUpperCase();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Measure widest line so the capsule fits its tightest content.
  ctx.font = `500 24px ${INTER}`;
  const labW = ctx.measureText(label).width;
  ctx.font = `500 38px ${INTER}`;
  const hexW = ctx.measureText(hexText).width;
  ctx.font = `400 28px ${INTER}`;
  const hslW = ctx.measureText(hslText).width;

  const maxLineW = Math.max(labW, hexW, hslW);
  const padX = 44;
  const padY = 28;
  const lineGap = 14;
  const hLabel = 28;
  const hHex = 44;
  const hHsl = 32;
  const chipW = maxLineW + padX * 2;
  const chipH = padY * 2 + hLabel + lineGap + hHex + lineGap + hHsl;
  const x = cx - chipW / 2;
  const y = cy - chipH / 2;
  const radius = 28;

  ctx.fillStyle = 'rgba(14, 14, 16, 0.78)';
  drawRoundedRect(ctx, x, y, chipW, chipH, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(236, 230, 218, 0.12)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x, y, chipW, chipH, radius);
  ctx.stroke();

  let lineCy = y + padY + hLabel / 2;
  ctx.font = `500 24px ${INTER}`;
  ctx.fillStyle = MUTE;
  ctx.fillText(label, cx, lineCy);

  lineCy += hLabel / 2 + lineGap + hHex / 2;
  ctx.font = `500 38px ${INTER}`;
  ctx.fillStyle = PAPER;
  ctx.fillText(hexText, cx, lineCy);

  lineCy += hHex / 2 + lineGap + hHsl / 2;
  ctx.font = `400 28px ${INTER}`;
  ctx.fillStyle = MUTE;
  ctx.fillText(hslText, cx, lineCy);
}

export async function renderShareCard(
  targetHex: string,
  guessHex: string,
  pct: number
): Promise<Blob> {
  await ensureFontsLoaded();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // Two color bands, top half target, bottom half guess.
  ctx.fillStyle = targetHex;
  ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = guessHex;
  ctx.fillRect(0, H / 2, W, H / 2);

  // Swatch chips: vertically centered in each swatch's visible area outside
  // the central glass card. Mirrors the in-app grade screen.
  drawSwatchChip(ctx, W / 2, 290, 'ORIGINAL', targetHex, hexToHsl(targetHex));
  drawSwatchChip(ctx, W / 2, H - 290, 'YOUR PICK', guessHex, hexToHsl(guessHex));

  const axes = axisCloseness(targetHex, guessHex);

  // Glass card centered across the split — taller now to host axis breakdown.
  const cardW = 760;
  const cardH = 760;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2;
  const radius = 36;

  // Card body — semi-opaque ink with a subtle 1px paper border.
  ctx.fillStyle = 'rgba(14, 14, 16, 0.78)';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(236, 230, 218, 0.12)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.stroke();

  // Percentage — Fraunces, large, centered.
  ctx.fillStyle = PAPER;
  ctx.font = `400 200px ${FRAUNCES}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${pct}%`, W / 2, cardY + 180);

  // Hex codes, target → guess.
  ctx.font = `500 26px ${INTER}`;
  ctx.fillStyle = MUTE;
  const arrowLine = `${targetHex.toUpperCase()}    →    ${guessHex.toUpperCase()}`;
  ctx.fillText(arrowLine, W / 2, cardY + 320);

  // First divider rule (above axis stats).
  ctx.strokeStyle = 'rgba(236, 230, 218, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 80, cardY + 380);
  ctx.lineTo(cardX + cardW - 80, cardY + 380);
  ctx.stroke();

  // Axis stats row: HUE / SAT / LIGHT
  const axisY = cardY + 470;
  const axisLabels = ['HUE', 'SAT', 'LIGHT'] as const;
  const axisValues = [axes.hue, axes.saturation, axes.lightness];
  const colWidth = cardW / 3;
  for (let i = 0; i < 3; i++) {
    const cx = cardX + colWidth * (i + 0.5);
    ctx.fillStyle = MUTE;
    ctx.font = `500 22px ${INTER}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(axisLabels[i], cx, axisY - 24);
    ctx.fillStyle = PAPER;
    ctx.font = `400 56px ${FRAUNCES}`;
    ctx.fillText(`${axisValues[i]}%`, cx, axisY + 24);
  }

  // Second divider rule (above wordmark).
  ctx.beginPath();
  ctx.moveTo(cardX + 80, cardY + 580);
  ctx.lineTo(cardX + cardW - 80, cardY + 580);
  ctx.stroke();

  // Wordmark.
  drawWordmark(ctx, W / 2, cardY + 660, 44);

  // URL.
  ctx.font = `400 22px ${INTER}`;
  ctx.fillStyle = MUTE;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillText(URL_TEXT, W / 2, cardY + 710);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/png'
    );
  });
}

export interface SharePayload {
  text: string;
  url: string;
  file: File;
}

export async function buildSharePayload(
  targetHex: string,
  guessHex: string,
  pct: number
): Promise<SharePayload> {
  const blob = await renderShareCard(targetHex, guessHex, pct);
  const file = new File([blob], `mnemochrome-${pct}.png`, { type: 'image/png' });
  const text = `${pct}% match on Mnemochrome.\nSee a color, then summon it back.`;
  const url = 'https://nickcason.github.io/mnemochrome/';
  return { text, url, file };
}

export async function shareRound(
  targetHex: string,
  guessHex: string,
  pct: number
): Promise<void> {
  const payload = await buildSharePayload(targetHex, guessHex, pct);

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  const fileData: ShareData = {
    title: 'Mnemochrome',
    text: payload.text,
    url: payload.url,
    files: [payload.file],
  };

  if (nav.share && nav.canShare && nav.canShare(fileData)) {
    try {
      await nav.share(fileData);
      return;
    } catch {
      // user cancelled — fall through to fallbacks
      return;
    }
  }

  if (nav.share) {
    try {
      await nav.share({ title: 'Mnemochrome', text: `${payload.text}\n${payload.url}` });
      return;
    } catch {
      return;
    }
  }

  // No share API at all — download the image and copy the text.
  const a = document.createElement('a');
  a.href = URL.createObjectURL(payload.file);
  a.download = payload.file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  try {
    await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
  } catch {
    // clipboard may be unavailable; the image download is the primary fallback
  }
}
