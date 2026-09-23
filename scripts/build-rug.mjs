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
