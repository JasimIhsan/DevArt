// Regenerates the app icons in public from the DevArt mark: `npm run icons`.
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const mark = '<defs><linearGradient id="dvbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0b1120"/></linearGradient><linearGradient id="dvt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#0d9488"/></linearGradient><linearGradient id="dva" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient><linearGradient id="dvw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs><path d="M14 16h3.5M17.5 16V8.75H21M17.5 16v7.25H21" fill="none" stroke="#64748b" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/><rect x="3.5" y="10.5" width="11" height="11" rx="3" fill="url(#dvt)"/><rect x="6.5" y="13.5" width="5" height="5" rx="1.5" fill="#0f172a" fill-opacity=".28"/><rect x="20.5" y="4.5" width="8" height="8.5" rx="2.5" fill="url(#dva)"/><rect x="20.5" y="19" width="8" height="8.5" rx="2.5" fill="url(#dvw)"/>';
const standard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="url(#dvbg)"/>${mark}</svg>`;
// Maskable icons get cropped by the OS, so the background is full-bleed and the mark stays in the safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="url(#dvbg)"/><g transform="translate(6.4 6.4) scale(0.6)">${mark}</g></svg>`;
const appleTouch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="url(#dvbg)"/><g transform="translate(3.2 3.2) scale(0.8)">${mark}</g></svg>`;

for (const [name, svg, size] of [
  ['icon-192.png', standard, 192], ['icon-512.png', standard, 512],
  ['icon-maskable-512.png', maskable, 512], ['apple-touch-icon.png', appleTouch, 180],
] as const) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/${name}`, png);
}
