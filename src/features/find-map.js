// Feature 4 (switch: site.json features.findMap). Our street map on Get
// involved: drag to move, the buttons or Ctrl/⌘ + scroll to zoom, two fingers
// on a touch screen (one finger keeps scrolling the page). The arrow keys and
// + / − work when the map has focus. Without JS it is a still map centred on
// the office.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export function start(map) {
  const svg = map.querySelector('.fmap__svg');
  const ui = map.querySelector('.fmap__ui');
  const hint = map.querySelector('.fmap__hint');
  const W = +map.dataset.w, H = +map.dataset.h;
  const home = () => ({ x: 0, y: 0, w: Math.min(+map.dataset.view, map.clientWidth < 700 ? 900 : Infinity) });
  let v = home(), anim = 0;
  const MIN_W = 260;

  // The view: its centre (x, y) and width w, in metres from the office.
  function fit(s) {
    const r = map.clientHeight / map.clientWidth || 0.6;
    const maxW = Math.min(W, H / r);
    const w = clamp(s.w, MIN_W, maxW), h = w * r;
    return { x: clamp(s.x, -W / 2 + w / 2, W / 2 - w / 2), y: clamp(s.y, -H / 2 + h / 2, H / 2 - h / 2), w };
  }
  function draw() {
    v = fit(v);
    const h = v.w * (map.clientHeight / map.clientWidth);
    svg.setAttribute('viewBox', `${(v.x - v.w / 2).toFixed(1)} ${(v.y - h / 2).toFixed(1)} ${v.w.toFixed(1)} ${h.toFixed(1)}`);
    map.style.setProperty('--s', (map.clientWidth / v.w).toFixed(4));
  }
  function go(to) {
    cancelAnimationFrame(anim);
    to = fit(to);
    if (reduce.matches) { v = to; draw(); return; }
    const from = { ...v }, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 450), e = 1 - (1 - k) ** 3;
      v = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w * (to.w / from.w) ** e };
      draw();
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  // Zoom by factor f (>1 zooms in) keeping the point under (px, py) still.
  function zoomAt(f, px = map.clientWidth / 2, py = map.clientHeight / 2, smooth = false) {
    const s = map.clientWidth / v.w;
    const mx = v.x + (px - map.clientWidth / 2) / s, my = v.y + (py - map.clientHeight / 2) / s;
    const w = clamp(v.w / f, MIN_W, W);
    const s2 = map.clientWidth / w;
    const to = { x: mx - (px - map.clientWidth / 2) / s2, y: my - (py - map.clientHeight / 2) / s2, w };
    if (smooth) go(to); else { cancelAnimationFrame(anim); v = to; draw(); }
  }
  let hintTimer = 0;
  function say(text) {
    hint.textContent = text;
    hint.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('is-on'), 1400);
  }

  // Buttons.
  ui.classList.add('is-on');
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (!b) return;
    const z = b.dataset.zoom;
    if (z === 'home') go(home()); else zoomAt(z === 'in' ? 1.7 : 1 / 1.7, undefined, undefined, true);
  });

  // Mouse (and pen): drag to move.
  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    cancelAnimationFrame(anim);
    drag = { x: e.clientX, y: e.clientY, v: { ...v } };
    svg.setPointerCapture(e.pointerId);
    map.classList.add('is-dragging');
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const s = map.clientWidth / v.w;
    v = { ...drag.v, x: drag.v.x - (e.clientX - drag.x) / s, y: drag.v.y - (e.clientY - drag.y) / s };
    draw();
  });
  const end = () => { drag = null; map.classList.remove('is-dragging'); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  // Scroll wheel: zoom only with Ctrl/⌘ (a trackpad pinch arrives this way
  // too), so scrolling the page never gets caught by the map.
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  map.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) { say(`Hold ${mac ? '⌘' : 'Ctrl'} and scroll to zoom`); return; }
    e.preventDefault();
    const r = map.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // Touch: two fingers move and pinch; one finger scrolls the page.
  let pinch = null;
  const mid = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) });
  map.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) { cancelAnimationFrame(anim); pinch = { ...mid(e.touches), v: { ...v } }; }
  }, { passive: true });
  map.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && !pinch) { say('Use two fingers to move the map'); return; }
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const m = mid(e.touches), r = map.getBoundingClientRect();
    v = { ...pinch.v };
    const s = map.clientWidth / v.w;
    v.x -= (m.x - pinch.x) / s; v.y -= (m.y - pinch.y) / s;
    zoomAt(m.d / pinch.d, m.x - r.left, m.y - r.top);
  }, { passive: false });
  map.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; });

  // Keyboard, when the map has focus.
  map.addEventListener('keydown', (e) => {
    const step = v.w * 0.15;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); go({ ...v, x: v.x + moves[e.key][0], y: v.y + moves[e.key][1] }); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1.7, undefined, undefined, true); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(1 / 1.7, undefined, undefined, true); }
    else if (e.key === '0' || e.key === 'Home') { e.preventDefault(); go(home()); }
  });

  new ResizeObserver(draw).observe(map);
  map.classList.add('is-live');
  draw();
}
