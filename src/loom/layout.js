// The Loom's layout: an endless field of 4:3 photo tiles, laid like bricks
// (every other row shifted half a tile), with a thread-filled gap between
// tiles. The same arithmetic is in the GLSL (loom-gl.js); keep them in step.

export const TILE_ORDER_X = 7;   // tile index = (cx * 7 + cy * 29) mod count:
export const TILE_ORDER_Y = 29;  // with 61 tiles (a prime) neighbours never repeat

// Tile size in CSS px, from the viewport width.
export function tileSize(vw) {
  const w = Math.round(Math.min(280, Math.max(150, vw * 0.19)));
  return { w, h: Math.round(w * 0.75), gap: vw < 768 ? 10 : 14 };
}

const mod = (a, n) => ((a % n) + n) % n;

// Which tile is under a point of the field (q in field px)?
export function cellAt(qx, qy, t) {
  const px = t.w + t.gap, py = t.h + t.gap;
  const cy = Math.floor(qy / py);
  const sx = qx + mod(cy, 2) * 0.5 * px;           // brick offset
  const cx = Math.floor(sx / px);
  const fx = sx - cx * px, fy = qy - cy * py;       // position inside the cell
  return { cx, cy, fx, fy, inTile: fx < t.w && fy < t.h };
}

export const tileIndex = (cx, cy, count) => mod(cx * TILE_ORDER_X + cy * TILE_ORDER_Y, count);
