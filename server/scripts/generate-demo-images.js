/**
 * Generates the clearly-labelled PLACEHOLDER illustrations used by the demo products
 * (server/seed/demo-images/*.jpg). They are original artwork produced by this script, so there is no
 * third-party copyright or licence to worry about. They are NOT product photographs.
 *
 *   npm run demo-images -w server
 *
 * Replace them with real photographs of real stock whenever you have them (via the admin dashboard).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seed/demo-images');

const tap = (x, y, c = '#8d99a0') =>
  `<rect x="${x - 10}" y="${y}" width="20" height="46" rx="6" fill="${c}"/><rect x="${x - 10}" y="${y + 36}" width="52" height="14" rx="6" fill="${c}"/>`;

// Each drawing is a plain, generic silhouette (no logos, no brand shapes, no claims).
const shapes = {
  domestic: () => `
    <rect x="360" y="250" width="480" height="560" rx="46" fill="#f4f6f7" stroke="#cfd6da" stroke-width="4"/>
    <rect x="400" y="300" width="400" height="230" rx="30" fill="#dfe9ee"/>
    <circle cx="600" cy="640" r="46" fill="#cfd8dd"/><circle cx="600" cy="640" r="20" fill="#36747e"/>
    ${tap(600, 790)}`,
  ro: () => `
    <rect x="270" y="170" width="370" height="640" rx="40" fill="#f7f8f9" stroke="#cfd6da" stroke-width="4"/>
    <rect x="310" y="220" width="290" height="150" rx="22" fill="#d6e4ea"/>
    <rect x="310" y="410" width="290" height="22" rx="11" fill="#e1e7ea"/><rect x="310" y="450" width="290" height="22" rx="11" fill="#e1e7ea"/>
    <rect x="690" y="330" width="250" height="480" rx="48" fill="#e9eef0" stroke="#cfd6da" stroke-width="4"/>
    <rect x="720" y="370" width="190" height="14" rx="7" fill="#c9d3d8"/>
    ${tap(455, 760)}`,
  uv: () => `
    <rect x="470" y="210" width="260" height="600" rx="130" fill="#eef1f3" stroke="#cfd6da" stroke-width="4"/>
    <rect x="515" y="300" width="170" height="320" rx="85" fill="#7a5cf0" opacity=".30"/>
    <rect x="545" y="330" width="110" height="260" rx="55" fill="#a995ff" opacity=".55"/>
    <rect x="500" y="690" width="200" height="40" rx="20" fill="#d8dee2"/>
    ${tap(600, 770)}`,
  commercial: () => `
    <rect x="200" y="330" width="330" height="480" rx="34" fill="#cfd7dc" stroke="#9aa6ad" stroke-width="4"/>
    <rect x="670" y="330" width="330" height="480" rx="34" fill="#cfd7dc" stroke="#9aa6ad" stroke-width="4"/>
    <rect x="230" y="370" width="270" height="20" rx="10" fill="#e8edf0"/><rect x="700" y="370" width="270" height="20" rx="10" fill="#e8edf0"/>
    <rect x="510" y="440" width="180" height="26" rx="13" fill="#7f8c94"/><rect x="510" y="560" width="180" height="26" rx="13" fill="#7f8c94"/>
    <rect x="470" y="190" width="260" height="130" rx="22" fill="#f4f6f7" stroke="#9aa6ad" stroke-width="4"/>
    <circle cx="540" cy="255" r="30" fill="#36747e"/><circle cx="650" cy="255" r="30" fill="#b88639"/>`,
  compact: () => `
    <rect x="450" y="420" width="300" height="390" rx="42" fill="#f5f7f8" stroke="#cfd6da" stroke-width="4"/>
    <rect x="485" y="465" width="230" height="110" rx="20" fill="#dbe7ec"/>
    <circle cx="600" cy="660" r="26" fill="#36747e"/>
    ${tap(600, 745)}`,
  premium: () => `
    <rect x="360" y="190" width="480" height="620" rx="64" fill="#1f2b2f"/>
    <rect x="360" y="190" width="480" height="620" rx="64" fill="none" stroke="#c79a50" stroke-width="5"/>
    <rect x="410" y="250" width="380" height="180" rx="30" fill="#0f1a1d"/>
    <rect x="450" y="300" width="300" height="12" rx="6" fill="#c79a50"/><rect x="450" y="340" width="200" height="12" rx="6" fill="#4f8f98"/>
    <circle cx="600" cy="560" r="52" fill="none" stroke="#c79a50" stroke-width="5"/>
    ${tap(600, 745, '#c79a50')}`,
};

const products = [
  ['domestic', 'Domestic'], ['ro', 'RO'], ['uv', 'UV'],
  ['commercial', 'Commercial'], ['compact', 'Compact'], ['premium', 'Premium'],
];

const svg = (draw, label, view) => {
  const dark = view === 2;
  const [bg1, bg2, ink] = dark ? ['#46555b', '#1c2629', '#e8edf0'] : ['#ffffff', '#dfe4e2', '#14201f'];
  const scale = dark ? 1.12 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    <defs><radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient></defs>
    <rect width="1200" height="1200" fill="url(#bg)"/>
    <ellipse cx="600" cy="850" rx="${dark ? 420 : 380}" ry="34" fill="#000" opacity="${dark ? 0.35 : 0.14}"/>
    <g transform="translate(${600 - 600 * scale} ${520 - 520 * scale}) scale(${scale})">${draw()}</g>
    <rect x="0" y="1040" width="1200" height="160" fill="#14201f"/>
    <text x="600" y="1100" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#e5d0a3" letter-spacing="3">DEMO PLACEHOLDER IMAGE</text>
    <text x="600" y="1148" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="${'#d5e8e9'}">Generic illustration, not a real product photo (${label}, view ${view})</text>
    <text x="40" y="70" font-family="Arial, sans-serif" font-size="26" fill="${ink}" opacity=".7">${label} purifier (illustrative)</text>
  </svg>`;
};

await fs.mkdir(outDir, { recursive: true });
for (const [key, label] of products) {
  for (const view of [1, 2]) {
    const file = path.join(outDir, `${key}-${view}.jpg`);
    await sharp(Buffer.from(svg(shapes[key], label, view))).jpeg({ quality: 86, mozjpeg: true }).toFile(file);
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
  }
}
