// The Loom: the gallery as one endless woven tapestry of every photo. Drag it
// in any direction (it carries on with momentum and bends like cloth), hover to
// lift a photo, tap or click to open it, filter by programme. Loaded lazily from
// main.js, never under reduced motion; without it the page shows the plain
// grouped list of photos, which stays in the DOM underneath either way.
import { probeWebGL } from '../weave/probe.js';
import { create as createGL } from './loom-gl.js';
import { create as createCanvas } from './loom-canvas.js';
import { tileSize, cellAt, tileIndex } from './layout.js';
import meta from '../data/atlas.json';

const CAT = { health: 0, school: 1, women: 2, events: 3 };
const BASE = import.meta.env.BASE_URL;

function loadAtlas() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    // AVIF where supported, JPEG otherwise.
    // BASE_URL: '/' on the real domain, '/prayatn/' on the GitHub preview.
    img.onerror = () => { if (!img.src.endsWith('.jpg')) img.src = `${BASE}img/atlas.jpg`; else reject(); };
    img.src = `${BASE}img/atlas.avif`;
  });
}

export async function start(section) {
  const stage = section.querySelector('.loom__stage');
  if (!stage) return;
  let atlas;
  try { atlas = await loadAtlas(); await atlas.decode?.(); } catch { return; }

  const force = new URLSearchParams(location.search).get('tier');
  const canvas = document.createElement('canvas');
  canvas.className = 'loom__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let r = null;
  if (force !== '2') {
    const caps = probeWebGL({ allowSoftware: force === '1' });
    if (caps && caps.tier !== 'low') r = createGL(canvas, atlas, meta, { allowSoftware: force === '1', onLost: () => { r = createCanvas(swap(), atlas, meta); size(); } });
  }
  if (!r) r = createCanvas(canvas, atlas, meta);
  if (!r) return;
  function swap() { const c = canvas.cloneNode(); canvas.replaceWith(c); return c; }
  stage.prepend(canvas);
  document.documentElement.classList.add('has-loom');
  section.dataset.tier = r.kind;

  const s = { ox: 0, oy: 0, vx: 0, vy: 0, px: 0, py: 0, tile: tileSize(innerWidth), hover: null, hoverAmt: 0, sel: -1, selAmt: 0, intro: 0 };
  let W = 0, H = 0;
  function size() {
    const b = stage.getBoundingClientRect();
    W = b.width; H = b.height; s.tile = tileSize(innerWidth);
    r.resize(W, H);
    s.px = W / 2; s.py = H / 2;
  }
  size();
  addEventListener('resize', size);

  // Field point under a stage point (same maths as the shader, minus the
  // cloth lag, which is zero at the pointer anyway).
  const zoomNow = () => 1 + Math.min(Math.hypot(s.vx, s.vy) * 0.006, 0.12) + (1 - s.intro) * 0.18;
  function tileAt(x, y) {
    const z = zoomNow();
    const c = cellAt((x - W / 2) * z + W / 2 + s.ox, (y - H / 2) * z + H / 2 + s.oy, s.tile);
    return c.inTile ? { cx: c.cx, cy: c.cy, idx: tileIndex(c.cx, c.cy, meta.count) } : null;
  }

  // Dragging with momentum. Horizontal drags always pan; on touch screens
  // vertical swipes still scroll the page (touch-action: pan-y), and the page
  // scroll itself drifts the field.
  let drag = null, moved = 0, targetHover = 0;
  stage.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
    moved = 0;
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', (e) => {
    const b = stage.getBoundingClientRect();
    s.px = e.clientX - b.left; s.py = e.clientY - b.top;
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.pointerType === 'touch' ? 0 : e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      s.ox -= dx; s.oy -= dy;
      s.vx = s.vx * 0.5 + -dx * 0.5; s.vy = s.vy * 0.5 + -dy * 0.5;
    } else if (e.pointerType === 'mouse') {
      s.hover = tileAt(s.px, s.py); targetHover = s.hover ? 1 : 0;
    }
    wake();
  });
  const end = (e) => {
    if (!drag) return;
    stage.classList.remove('is-dragging');
    const b = stage.getBoundingClientRect();
    if (moved < 8 && e.type === 'pointerup') {
      const hit = tileAt(e.clientX - b.left, e.clientY - b.top);
      if (hit) open(hit.idx);
    }
    drag = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('pointerleave', () => { targetHover = 0; wake(); });

  // Keyboard: arrows pan a tile at a time, Enter opens the photo in the middle.
  stage.addEventListener('keydown', (e) => {
    const t = s.tile, step = { ArrowLeft: [-t.w, 0], ArrowRight: [t.w, 0], ArrowUp: [0, -t.h], ArrowDown: [0, t.h] }[e.key];
    if (step) { e.preventDefault(); s.vx = step[0] / 8; s.vy = step[1] / 8; wake(); }
    if (e.key === 'Enter') { const hit = tileAt(W / 2, H / 2) || tileAt(W / 2 + t.w / 2, H / 2); if (hit) open(hit.idx); }
  });

  // Page scroll drifts the field downwards while it is on screen.
  let lastY = scrollY;
  addEventListener('scroll', () => { if (visible) { s.oy += (scrollY - lastY) * 0.45; wake(); } lastY = scrollY; }, { passive: true });

  // Filters: the page's programme buttons also drive the field.
  document.querySelector('[data-gfilter]')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]');
    if (!b) return;
    s.sel = b.dataset.f === 'all' ? s.sel : CAT[b.dataset.f];
    s.selTarget = b.dataset.f === 'all' ? 0 : 1;
    if (b.dataset.f !== 'all') s.sel = CAT[b.dataset.f];
    wake();
  });

  // Opening a photo: the site's lightbox, at up to the photo's native size.
  const box = document.querySelector('[data-lightbox]');
  function open(idx) {
    const t = meta.tiles[idx];
    if (!box || typeof box.showModal !== 'function') { location.href = BASE + t.src.replace(/^\//, ''); return; }
    const img = box.querySelector('img'), cap = box.querySelector('.lightbox__cap');
    img.src = BASE + t.src.replace(/^\//, ''); img.alt = t.alt; cap.textContent = t.alt;
    box.showModal();
  }

  // The loop: momentum, a slow idle drift, the hover lift and filter fades,
  // and the weave-in on arrival. Runs only while the field is on screen.
  let visible = false, raf = 0, t0 = 0;
  function frame(now) {
    raf = 0;
    if (!t0) t0 = now;
    s.intro = Math.min(1, (now - t0) / 1900);
    if (!drag) {
      s.ox += s.vx; s.oy += s.vy;
      s.vx *= 0.94; s.vy *= 0.94;
      // Idle drift: the loom keeps turning slowly.
      s.ox += 0.35; s.oy += 0.12;
    } else { s.vx *= 0.85; s.vy *= 0.85; }
    s.hoverAmt += (targetHover - s.hoverAmt) * 0.15;
    s.selAmt += ((s.selTarget ?? 0) - s.selAmt) * 0.12;
    r.render(s);
    if (visible) raf = requestAnimationFrame(frame);
  }
  function wake() { if (visible && !raf) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { if (!t0) t0 = 0; wake(); } }).observe(stage);
}
