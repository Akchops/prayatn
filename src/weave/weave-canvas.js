// Tier 2: The Weave in Canvas 2D, for devices without (or with software-only)
// WebGL. It traces the same behaviour as the shader: the same shuttle, the
// same tightening, the same ikat registration, the same resolve and withdraw.
// What it loses is sub-thread detail: it computes S x S samples per thread
// cell and scales them up, instead of shading every screen pixel.

import { rowColor, warpOnTop, COLORS } from './pattern.js';
import { hash } from './phases.js';

const S = 5;                       // samples per thread, per axis (odd, so edge samples fall in the gaps)
const GROUND = COLORS.indigo;
const WARP_OUT = [217, 209, 193];  // #D9D1C1, as in the shader

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

  // Photo colour at a CSS-px stage position, clamped to the frame.
  function photoAt(x, y, out) {
    const f = geom.frame;
    const u = Math.min(pw - 1, Math.max(0, Math.floor(((x - f.x) / f.w) * pw)));
    const v = Math.min(ph - 1, Math.max(0, Math.floor(((y - f.y) / f.h) * ph)));
    const k = (v * pw + u) * 4;
    out[0] = photo[k]; out[1] = photo[k + 1]; out[2] = photo[k + 2];
    return out;
  }

  const wc = [0, 0, 0], fc = [0, 0, 0];

  return {
    kind: 'canvas2d',
    resize(g) {
      geom = g;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(g.width * dpr);
      canvas.height = Math.round(g.height * dpr);
      geom.dpr = canvas.width / g.width;
      cols = Math.ceil(g.width / g.t);
      rows = Math.ceil(g.height / g.t);
      buf.width = cols * S; buf.height = rows * S;
      data = bctx.createImageData(buf.width, buf.height);
      samplePhoto();
    },
    render(phs) {
      if (!geom) return;
      const { t, frame: f, width: W } = geom;
      const px = data.data;
      const width = 0.42 + 0.58 * phs.tight;
      const amp = (1 - phs.tight) * f.h * 0.6;
      const keepIn = 1 - phs.resolve;
      const keepOut = 1 - phs.hand;

      for (let j = 0; j < rows; j++) {
        const delay = (j / rows) * 0.6;
        const head = Math.min(1, Math.max(0, (phs.weft - delay) / 0.4)) * W;
        const away = Math.min(1, Math.max(0, (phs.hand - delay * 0.5) / 0.7));
        const weftShift = (hash(j + 101) - 0.5) * amp;
        const rc = rowColor(j);
        for (let sy = 0; sy < S; sy++) {
          const fy = (sy + 0.5) / S;
          const y = (j + fy) * t;
          const wy = (fy - 0.5) / width + 0.5;
          const onWeftBody = wy > 0 && wy < 1;
          const weftShade = 0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, wy)));
          let o = (j * S + sy) * buf.width * 4;
          for (let i = 0; i < cols; i++) {
            const warpShift = (hash(i + 1) - 0.5) * amp;
            for (let sx = 0; sx < S; sx++, o += 4) {
              const fx = (sx + 0.5) / S;
              const x = (i + fx) * t;
              const inFrame = x >= f.x && y >= f.y && x < f.x + f.w && y < f.y + f.h;
              const ww = inFrame ? width : width + (0.8 - width) * phs.hand;
              const wx = (fx - 0.5) / ww + 0.5;
              const onWarp = wx > 0 && wx < 1;
              let weftHere = x < head;
              if (!inFrame) weftHere = weftHere && x < (1 - away) * W;
              const onWeft = onWeftBody && weftHere;

              let c = GROUND, shade = 1;
              const top = onWarp && onWeft ? warpOnTop(i, j) : onWarp;
              if (onWarp || onWeft) {
                if (top) {
                  c = inFrame ? photoAt((i + 0.5) * t, y + warpShift, wc)
                              : mixInto(wc, COLORS.khadi, WARP_OUT, phs.hand);
                  shade = 0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, wx)));
                } else {
                  c = inFrame ? photoAt(x + weftShift, (j + 0.5) * t, fc) : rc;
                  shade = weftShade;
                }
              }
              const k = 1 + (shade - 1) * (inFrame ? keepIn : keepOut);
              px[o] = c[0] * k; px[o + 1] = c[1] * k; px[o + 2] = c[2] * k; px[o + 3] = 255;
            }
          }
        }
      }
      bctx.putImageData(data, 0, 0);
      const d = geom.dpr;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, 0, 0, cols * t * d, rows * t * d);
      // The resolve: the real photograph, drawn over its frame at full detail.
      if (phs.resolve > 0) {
        ctx.globalAlpha = phs.resolve;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, f.x * d, f.y * d, f.w * d, f.h * d);
        ctx.globalAlpha = 1;
      }
    },
    destroy() {},
  };
}

function mixInto(out, a, b, k) {
  out[0] = a[0] + (b[0] - a[0]) * k;
  out[1] = a[1] + (b[1] - a[1]) * k;
  out[2] = a[2] + (b[2] - a[2]) * k;
  return out;
}
