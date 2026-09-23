// The durrie: one definition of the rug, shared by the Canvas 2D tier, the
// static SVG tile (scripts/build-rug.mjs) and, by hand, the GLSL in weave-gl.js.
// If you change a number here, change it in the shader too.

export const COLORS = {
  khadi: [243, 236, 223],   // #F3ECDF  unbleached cotton
  warp: [52, 60, 98],       // #343C62  the rug's warp: a lighter indigo, tone-on-tone with the weft
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

// Plain weave: warp and weft alternate over and under every thread, which
// gives a fine, even cloth texture (the owner found the chevron twill too
// loud behind the photo). CHEVRON is kept as the tile width.
export const CHEVRON = 8;
export function warpOnTop(i, j) {
  return ((i + j) % 2 + 2) % 2 === 0;
}
