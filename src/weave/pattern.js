// The durrie: one definition of the rug, shared by the Canvas 2D tier, the
// static SVG tile (scripts/build-rug.mjs) and, by hand, the GLSL in weave-gl.js.
// If you change a number here, change it in the shader too.

export const COLORS = {
  khadi: [243, 236, 223],   // #F3ECDF  unbleached cotton: the warp
  indigo: [30, 36, 64],     // #1E2440  the main weft
  marigold: [226, 160, 25], // #E2A019
  rani: [194, 47, 102],     // #C22F66
  neem: [29, 110, 98],      // #1D6E62
};

// Weft colour by row. A 20-row repeat: broad indigo with single accent picks,
// the way a rag durrie is striped.
export const ROW_PERIOD = 20;
export function rowColor(j) {
  const r = ((j % ROW_PERIOD) + ROW_PERIOD) % ROW_PERIOD;
  if (r === 7) return COLORS.marigold;
  if (r === 10) return COLORS.rani;
  if (r === 17) return COLORS.neem;
  return COLORS.indigo;
}

// Chevron twill. In each cell either the warp (vertical) or the weft
// (horizontal) thread is on top. A 2/2 twill steps one column per row, which
// draws diagonals; flipping the diagonal every 8 columns turns them into the
// zig-zag you see on durries.
export const CHEVRON = 8;
export function warpOnTop(i, j) {
  const flip = Math.floor(i / CHEVRON) % 2 === 0 ? 1 : -1;
  const k = (((i + flip * j) % 4) + 4) % 4;
  return k < 2;
}
