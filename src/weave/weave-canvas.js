// Tier 2: The Weave in Canvas 2D, for devices without (or with software-only)
// WebGL. It traces the same behaviour as the shader: the same shuttle, the
// same tightening, the same ikat registration, the same resolve and withdraw.
// What it loses is sub-thread detail: it computes S x S samples per thread
// cell and scales them up, instead of shading every screen pixel.

import { rowColor, warpOnTop, COLORS } from './pattern.js';
import { hash } from './phases.js';

// Samples per thread, per axis. Odd, so edge samples fall in the gaps between
// threads. 5 by default; degrade() drops to 3 on slow devices.
let S = 5;
const GROUND = COLORS.indigo;
const WARP_OUT = [52, 60, 98];     // #343C62, as in the shader

export function create(canvas, img) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d');
  let geom = null, data = null, photo = null, pw = 0, ph = 0, cols = 0, rows = 0;

  function samplePhoto() {
    // The photo at thread-sample resolution, read once per resize.
    pw = Math.max(1, Math.round((geom.frame.w / geom.t) * S));
    ph = Math.max(1, Math.round((geom.frame.h / geom.t) * S));
    const c = document.createElement('canvas');
    c.width = pw; c.height = ph;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, pw, ph);
    photo = cx.getImageData(0, 0, pw, ph).data;
  }

  let warpShift = new Float32Array(0);
  let onIn = new Uint8Array(S), onOut = new Uint8Array(S);
  let shIn = new Float32Array(S), shOut = new Float32Array(S);

  return {
    kind: 'canvas2d',
    resize(g) {
      geom = g;
      // DPR capped at 1.5: the threads are drawn as scaled-up blocks anyway,
      // and a 3x canvas costs this tier more than it shows.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(g.width * dpr);
      canvas.height = Math.round(g.height * dpr);
      geom.dpr = canvas.width / g.width;
      cols = Math.ceil(g.width / g.t);
      rows = Math.ceil(g.height / g.t);
      buf.width = cols * S; buf.height = rows * S;
      data = bctx.createImageData(buf.width, buf.height);
      warpShift = new Float32Array(cols);
      samplePhoto();
    },
    render(phs) {
      if (!geom) return;
      const { t, width: W } = geom;
      const F = geom.frame, C = geom.cover, k0 = phs.shrink;
      // The photo's current rect: full-bleed at the start, its frame at the end of beat 1.
      const f = { x: C.x + (F.x - C.x) * k0, y: C.y + (F.y - C.y) * k0, w: C.w + (F.w - C.w) * k0, h: C.h + (F.h - C.h) * k0 };
      const px = data.data;
      const width = 0.42 + 0.58 * phs.tight;           // the photo's threads close on load
      const widthOut = 1 + (0.6 - 1) * phs.hand;       // the rug's warp relaxes at the handoff
      const amp = (1 - phs.tight) * f.h * 0.25;
      const keepIn = 1 - phs.resolve;
      const keepOut = 1 - phs.hand;
      const dim = phs.dim;
      const fx0 = f.x, fy0 = f.y, fx1 = f.x + f.w, fy1 = f.y + f.h;
      const sx = pw / f.w, sy = ph / f.h;

      // Everything that depends only on the column, or only on the sample's
      // position inside a thread, is worked out once per frame, not per sample.
      for (let i = 0; i < cols; i++) warpShift[i] = (hash(i + 1) - 0.5) * amp;
      for (let s = 0; s < S; s++) {
        const fx = (s + 0.5) / S;
        const wIn = (fx - 0.5) / width + 0.5, wOut = (fx - 0.5) / widthOut + 0.5;
        onIn[s] = wIn > 0 && wIn < 1 ? 1 : 0;
        onOut[s] = wOut > 0 && wOut < 1 ? 1 : 0;
        shIn[s] = 0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, wIn)));
        shOut[s] = 0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, wOut)));
      }
      const kr = COLORS.warp[0] + (WARP_OUT[0] - COLORS.warp[0]) * phs.hand;
      const kg = COLORS.warp[1] + (WARP_OUT[1] - COLORS.warp[1]) * phs.hand;
      const kb = COLORS.warp[2] + (WARP_OUT[2] - COLORS.warp[2]) * phs.hand;

      for (let j = 0; j < rows; j++) {
        const delay = (j / rows) * 0.6;
        const head = Math.min(1, Math.max(0, (phs.weft - delay) / 0.4)) * W;
        const away = Math.min(1, Math.max(0, (phs.hand - delay * 0.5) / 0.7));
        const outLimit = Math.min(head, (1 - away) * W);
        const weftShift = (hash(j + 101) - 0.5) * amp;
        const rc = rowColor(j);
        const vRow = Math.min(ph - 1, Math.max(0, Math.floor(((j + 0.5) * t - fy0) * sy)));
        for (let s2 = 0; s2 < S; s2++) {
          const fy = (s2 + 0.5) / S;
          const y = (j + fy) * t;
          const rowIn = y >= fy0 && y < fy1;
          const wy = (fy - 0.5) / (rowIn ? width : 1) + 0.5;
          const onWeftBody = wy > 0 && wy < 1;
          const weftShade = 0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, wy)));
          let o = (j * S + s2) * buf.width * 4;
          for (let i = 0; i < cols; i++) {
            const top = warpOnTop(i, j);
            const uCol = Math.min(pw - 1, Math.max(0, Math.floor(((i + 0.5) * t - fx0) * sx)));
            const vWarp = Math.min(ph - 1, Math.max(0, Math.floor((y + warpShift[i] - fy0) * sy)));
            for (let s = 0; s < S; s++, o += 4) {
              const x = (i + (s + 0.5) / S) * t;
              const inFrame = rowIn && x >= fx0 && x < fx1;
              const onWarp = inFrame ? onIn[s] : onOut[s];
              const onWeft = onWeftBody && (inFrame || x < outLimit);
              let r = GROUND[0], g = GROUND[1], bl = GROUND[2], shade = 1;
              if (onWarp && (top || !onWeft)) {
                if (inFrame) { const k = (vWarp * pw + uCol) * 4; r = photo[k]; g = photo[k + 1]; bl = photo[k + 2]; }
                else { r = kr; g = kg; bl = kb; }
                shade = inFrame ? shIn[s] : shOut[s];
              } else if (onWeft) {
                if (inFrame) {
                  const u = Math.min(pw - 1, Math.max(0, Math.floor((x + weftShift - fx0) * sx)));
                  const k = (vRow * pw + u) * 4; r = photo[k]; g = photo[k + 1]; bl = photo[k + 2];
                } else { r = rc[0]; g = rc[1]; bl = rc[2]; }
                shade = weftShade;
              }
              let m = 1 + (shade - 1) * (inFrame ? keepIn : keepOut);
              if (inFrame) m *= dim;
              px[o] = r * m; px[o + 1] = g * m; px[o + 2] = bl * m; px[o + 3] = 255;
            }
          }
        }
      }
      bctx.putImageData(data, 0, 0);
      const d = geom.dpr;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, 0, 0, cols * t * d, rows * t * d);
      // The resolve: the real photograph over its frame at full detail (only
      // once the rect has reached its native-size frame).
      if (phs.resolve > 0) {
        ctx.globalAlpha = phs.resolve * dim;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, f.x * d, f.y * d, f.w * d, f.h * d);
        ctx.globalAlpha = 1;
      }
    },
    // Cheaper sampling: 9 samples per thread instead of 25. Returns false when
    // there is nothing cheaper left, and the caller falls back to tier 3.
    degrade() {
      if (S === 3) return false;
      S = 3;
      onIn = new Uint8Array(S); onOut = new Uint8Array(S);
      shIn = new Float32Array(S); shOut = new Float32Array(S);
      if (geom) this.resize(geom);
      return true;
    },
    destroy() {},
  };
}
