// Exports run in the browser: the canvas is rendered to SVG, then rasterised for PNG and PDF.
import { PDFDocument } from 'pdf-lib';
import { renderCanvasSvg } from '../core/render.ts';
import type { CanvasElement, Theme } from '../core/types.ts';

export type ExportFormat = 'svg' | 'png' | 'pdf';
export interface ExportOptions { theme: Theme; scale: number; transparent: boolean }

const clampScale = (v: number) => (Number.isFinite(v) && v > 0 ? Math.min(4, Math.max(0.5, v)) : 2);

/** The diagram as an inline `data:` URL, for thumbnails. */
export function svgDataUrl(elements: CanvasElement[], opts: { theme: Theme; background?: boolean }) {
  const { svg } = renderCanvasSvg(elements, { theme: opts.theme, background: opts.background ?? false });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function rasterise(svg: string, width: number, height: number, scale: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('Could not draw the diagram')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot export images');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error('Could not export the image'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Renders the whole canvas, or one element with `only`, in the requested format. */
export async function exportCanvas(elements: CanvasElement[], format: ExportFormat, opts: ExportOptions & { only?: string }): Promise<Blob> {
  const out = renderCanvasSvg(elements, { only: opts.only, theme: opts.theme, background: !opts.transparent });
  if (format === 'svg') return new Blob([out.svg], { type: 'image/svg+xml' });
  const png = await rasterise(out.svg, out.width, out.height, clampScale(opts.scale));
  if (format === 'png') return png;
  // The PDF page keeps the diagram's size in points; scale sets the resolution of the embedded image.
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()));
  pdf.addPage([out.width, out.height]).drawImage(image, { x: 0, y: 0, width: out.width, height: out.height });
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
