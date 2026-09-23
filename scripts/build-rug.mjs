#!/usr/bin/env node
// Writes public/rug.svg: one repeat of the durrie (16 columns x 20 rows of
// threads) from the same definition the animated tiers use. It is the static
// rug: what no-JS, reduced-motion and failed-boot visitors see, and the
// ground the animated weave settles into.
import { writeFileSync } from 'node:fs';
import { COLORS, rowColor, warpOnTop, CHEVRON, ROW_PERIOD } from '../src/weave/pattern.js';

const COLS = CHEVRON * 2;       // two chevron halves: the horizontal repeat
const ROWS = ROW_PERIOD;        // 20 rows; divisible by the twill's 4-step
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

let rects = '';
for (let j = 0; j < ROWS; j++) {
  for (let i = 0; i < COLS; i++) {
    const warp = warpOnTop(i, j);
    const c = warp ? COLORS.khadi : rowColor(j);
    rects += `<rect x="${i}" y="${j}" width="1" height="1" fill="${hex(c)}"/>`;
    // A darker hairline down one side of the top thread gives it roundness
    // without a gradient per cell.
    rects += warp
      ? `<rect x="${i + 0.86}" y="${j}" width="0.14" height="1" fill="#000" fill-opacity=".10"/>`
      : `<rect x="${i}" y="${j + 0.86}" width="1" height="0.14" fill="#000" fill-opacity=".14"/>`;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS} ${ROWS}" width="${COLS * 10}" height="${ROWS * 10}" shape-rendering="crispEdges">${rects}</svg>\n`;
writeFileSync(new URL('../public/rug.svg', import.meta.url), svg);
console.log(`rug: ${COLS}x${ROWS} threads -> public/rug.svg (${svg.length} bytes)`);

// public/thread-shade.svg: a 2 x 2 thread tile of roundness shading, laid over
// the pixel-per-thread photos so each pixel reads as a woven thread. Warp on
// the diagonal, weft off it: a plain weave.
const shade = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2" width="20" height="20">
<defs>
<linearGradient id="v" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-opacity=".38"/><stop offset=".5" stop-opacity="0"/><stop offset="1" stop-opacity=".38"/></linearGradient>
<linearGradient id="h" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-opacity=".38"/><stop offset=".5" stop-opacity="0"/><stop offset="1" stop-opacity=".38"/></linearGradient>
</defs>
<rect x="0" y="0" width="1" height="1" fill="url(#v)"/><rect x="1" y="1" width="1" height="1" fill="url(#v)"/>
<rect x="1" y="0" width="1" height="1" fill="url(#h)"/><rect x="0" y="1" width="1" height="1" fill="url(#h)"/>
</svg>
`;
writeFileSync(new URL('../public/thread-shade.svg', import.meta.url), shade);
console.log('thread-shade: public/thread-shade.svg');
