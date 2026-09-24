// The Loom, tier 2 (no WebGL): the same field, drag, hover lift, filter and
// weave-in, drawn with Canvas 2D from the same atlas. What it drops is the
// cloth bend.
import { cellAt, tileIndex } from './layout.js';

const INDIGO = '#1E2440', WARP = '#343C62', WEFT = ['#E2A019', '#C22F66', '#1D6E62'];
const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const mod = (a, n) => ((a % n) + n) % n;

export function create(canvas, atlas, meta) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  let dpr = 1, W = 0, H = 0;
  return {
    kind: 'canvas2d',
    resize(w, h) {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      W = w; H = h;
    },
    render(s) {
      const t = s.tile, px = t.w + t.gap, py = t.h + t.gap;
      const zoom = 1 + Math.min(Math.hypot(s.vx, s.vy) * 0.006, 0.12) + (1 - s.intro) * 0.18;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = INDIGO; ctx.fillRect(0, 0, W, H);
      // Screen = (field - off - centre) / zoom + centre.
      ctx.translate(W / 2, H / 2); ctx.scale(1 / zoom, 1 / zoom); ctx.translate(-W / 2 - s.ox, -H / 2 - s.oy);
      const x0 = s.ox + (0 - W / 2) * zoom + W / 2, x1 = s.ox + (W - W / 2) * zoom + W / 2;
      const y0 = s.oy + (0 - H / 2) * zoom + H / 2, y1 = s.oy + (H - H / 2) * zoom + H / 2;
      const cyA = Math.floor(y0 / py) - 1, cyB = Math.floor(y1 / py) + 1;
      const cxc = s.ox + W / 2, cyc = s.oy + H / 2, diag = Math.hypot(W, H);
      for (let cy = cyA; cy <= cyB; cy++) {
        const shift = mod(cy, 2) * 0.5 * px;
        // Weft thread along this row's gap.
        ctx.fillStyle = WEFT[mod(cy, 3)]; ctx.globalAlpha = 0.8;
        ctx.fillRect(x0 - px, cy * py + t.h + t.gap * 0.3, (x1 - x0) + 2 * px, t.gap * 0.4);
        ctx.globalAlpha = 1;
        const cxA = Math.floor((x0 + shift) / px) - 1, cxB = Math.floor((x1 + shift) / px) + 1;
        for (let cx = cxA; cx <= cxB; cx++) {
          const x = cx * px - shift, y = cy * py;
          ctx.fillStyle = WARP; ctx.fillRect(x + t.w + t.gap * 0.3, y, t.gap * 0.4, t.h + t.gap);
          const far = Math.hypot(x + px / 2 - cxc, y + py / 2 - cyc) / diag;
          let a = Math.min(1, Math.max(0, s.intro * 2.2 - far * 1.4 - hash(cx, cy) * 0.35));
          a = a * a * (3 - 2 * a);
          if (a <= 0) continue;
          const idx = tileIndex(cx, cy, meta.count);
          const lift = s.hover && s.hover.cx === cx && s.hover.cy === cy ? s.hoverAmt : 0;
          const other = s.sel >= 0 && meta.tiles[idx].cat !== s.sel ? s.selAmt : 0;
          const inset = (1 - a) * t.w * 0.06;
          ctx.globalAlpha = a * (1 - 0.9 * other) * (1 - 0.18 * s.hoverAmt * (1 - lift));
          ctx.drawImage(atlas, (idx % meta.cols) * meta.tw, Math.floor(idx / meta.cols) * meta.th, meta.tw, meta.th,
            x + inset, y + inset * 0.75, t.w - 2 * inset, t.h - 1.5 * inset);
          ctx.globalAlpha = 1;
          if (lift > 0.02) { ctx.strokeStyle = `rgba(243,236,223,${lift})`; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, t.w - 3, t.h - 3); }
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    destroy() {},
  };
}

export { cellAt };
