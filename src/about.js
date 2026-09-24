// About page, with motion. Loaded lazily from main.js, never with reduced
// motion; without it every section below is plain and complete.
//   - Our projects: on a PC the project's photo follows the mouse down the index.
//   - Mission: held on screen while its words light up, one by one, with the scroll.
//   - How we work: three threads (the three areas of work) woven into one cloth
//     as you scroll: each goes back and forth across the warp, over and under.
//   - Trustees: the seven cards stand in a ring that turns with the scroll and
//     can be spun by hand or with the arrow buttons.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const headPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head')) || 60;

// Hold a section's inner panel on screen (position: sticky) for a runway of
// scroll and report progress 0..1 through it. If the panel is taller than the
// screen, or the browser will not hold it, it is not pinned and progress runs
// while the section crosses the screen instead.
function pinScrub(section, stick, runway, onP) {
  let L = 0, pinned = false;
  const layout = () => {
    section.classList.add('is-live');
    section.style.height = '';
    pinned = stick.scrollHeight <= innerHeight - headPx() + 2;
    L = pinned ? innerHeight * runway : 0;
    if (pinned) section.style.height = `${stick.offsetHeight + L}px`;
    place();
  };
  const place = () => {
    const r = section.getBoundingClientRect();
    let p;
    if (pinned) {
      const d = headPx() - r.top;
      if (d > 40 && d < L - 40 && Math.abs(stick.getBoundingClientRect().top - headPx()) > 30) {
        pinned = false; section.style.height = '';           // sticky is not holding: stop pinning
        return place();
      }
      p = clamp(d / L);
    } else {
      p = clamp((innerHeight * 0.8 - r.top) / (r.height * 0.8 + 1));
    }
    onP(p);
  };
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); }, { passive: true });
  addEventListener('resize', layout);
  addEventListener('load', layout);
  layout();
}

function projectFollower() {
  const idx = document.querySelector('.pindex');
  if (!idx || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const rows = [...idx.querySelectorAll('.pindex__row')];
  const follow = document.createElement('div');
  follow.className = 'pindex__follow';
  follow.setAttribute('aria-hidden', 'true');
  const layers = rows.map((row) => {
    const pic = row.querySelector('.pindex__pic');
    const layer = pic.cloneNode(true);
    layer.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; img.sizes = '380px'; });
    layer.querySelectorAll('source').forEach((src) => { src.sizes = '380px'; });
    follow.appendChild(layer);
    return layer;
  });
  document.body.appendChild(follow);

  let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf = 0, on = -1;
  const show = (i) => {
    if (i === on) return;
    layers.forEach((l, k) => l.classList.toggle('is-on', k === i));
    follow.classList.toggle('is-on', i >= 0);
    on = i;
    wake();
  };
  const frame = () => {
    raf = 0;
    x += (tx - x) * 0.16; y += (ty - y) * 0.16;
    const w = follow.offsetWidth, h = follow.offsetHeight;
    // Beside the pointer, on whichever side has room; leaning with the movement.
    const left = x + 36 + w > innerWidth - 12 ? x - 36 - w : x + 36;
    const rot = clamp((tx - x) * 0.06, -9, 9);
    follow.style.transform = `translate(${left.toFixed(1)}px, ${(y - h / 2).toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
  rows.forEach((row, i) => row.querySelector('a').addEventListener('pointerenter', (e) => {
    if (on < 0) { x = tx = e.clientX; y = ty = e.clientY; }
    show(i);
  }));
  idx.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; wake(); });
  idx.querySelector('.pindex__list').addEventListener('pointerleave', () => show(-1));
  addEventListener('scroll', () => { if (on >= 0) show(-1); }, { passive: true });
}

function mission() {
  const sec = document.querySelector('[data-mission]');
  const text = sec?.querySelector('.mission__text');
  if (!sec || !text) return;
  const KEY = /^(empower|education|skill|decent|dignified|independent)/i;
  const words = text.textContent.trim().split(/\s+/);
  text.innerHTML = words.map((w) => `<span class="mission__w${KEY.test(w) ? ' is-key' : ''}">${w}</span>`).join(' ');
  const spans = [...text.querySelectorAll('.mission__w')];
  pinScrub(sec, sec.querySelector('.mission__stick'), 1.1, (p) => {
    const lit = p * (spans.length + 3) - 1;
    spans.forEach((s, i) => s.classList.toggle('is-on', i < lit));
  });
}

function threads() {
  const sec = document.querySelector('[data-threads]');
  const loom = sec?.querySelector('.threads__loom');
  if (!sec || !loom) return;
  const legend = [...sec.querySelectorAll('.threads__legend li')];
  const ns = 'http://www.w3.org/2000/svg';
  const W = 760, H = 330, GAP = 20, PICKS = 5, PICK = 16, BAND = PICKS * PICK + 26;
  const WARP = '#343C62';
  const COLORS = ['#E2A019', '#C22F66', '#1D6E62'];
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const el = (name, attrs) => { const e = document.createElementNS(ns, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  // The cloth's ground and the warp.
  svg.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, fill: '#1E2440', rx: 4 }));
  const warps = [];
  for (let x = 30; x <= W - 30; x += GAP) warps.push(x);
  warps.forEach((x) => svg.appendChild(el('line', { x1: x, y1: 14, x2: x, y2: H - 14, stroke: WARP, 'stroke-width': 9, 'stroke-linecap': 'round' })));
  // Each area's thread: five picks, back and forth, turning at the selvedges.
  const paths = COLORS.map((c, j) => {
    const top = 34 + j * BAND;
    const L = 16, R = W - 16;
    let d = `M${L} ${top}`;
    for (let k = 0; k < PICKS; k++) {
      const y = top + k * PICK, toRight = k % 2 === 0;
      d += ` L${toRight ? R : L} ${y}`;
      if (k < PICKS - 1) d += ` A${PICK / 2} ${PICK / 2} 0 0 ${toRight ? 1 : 0} ${toRight ? R : L} ${y + PICK}`;
    }
    const path = el('path', { d, fill: 'none', stroke: c, 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(path);
    return path;
  });
  // Over and under: where the warp is on top, a short piece of warp covers
  // the weft (it matches the warp line, so it is invisible until a thread arrives).
  COLORS.forEach((_, j) => {
    const top = 34 + j * BAND;
    for (let k = 0; k < PICKS; k++) {
      warps.forEach((x, i) => {
        if ((i + k + j) % 2 === 0) svg.appendChild(el('rect', { x: x - 4.5, y: top + k * PICK - 8, width: 9, height: 16, fill: WARP }));
      });
    }
  });
  // The shuttle, at the head of the thread being woven.
  const shuttle = el('g', {});
  shuttle.appendChild(el('ellipse', { cx: 0, cy: 0, rx: 17, ry: 6, fill: '#F3ECDF' }));
  shuttle.appendChild(el('ellipse', { cx: 0, cy: 0, rx: 8, ry: 2.2, fill: '#1E2440' }));
  svg.appendChild(shuttle);
  loom.appendChild(svg);
  const lens = paths.map((p) => p.getTotalLength());
  paths.forEach((p, j) => { p.style.strokeDasharray = `${lens[j]}`; p.style.strokeDashoffset = `${lens[j]}`; });

  pinScrub(sec, sec.querySelector('.threads__stick'), 1.6, (p) => {
    let head = null;
    paths.forEach((path, j) => {
      const q = clamp(p * 3.15 - j);
      path.style.strokeDashoffset = `${(lens[j] * (1 - q)).toFixed(1)}`;
      if (legend[j]) { legend[j].classList.toggle('is-on', q > 0); legend[j].style.setProperty('--lp', q.toFixed(3)); }
      if (q > 0 && q < 1) head = path.getPointAtLength(lens[j] * q);
    });
    if (head) { shuttle.setAttribute('transform', `translate(${head.x.toFixed(1)} ${head.y.toFixed(1)})`); shuttle.style.opacity = 1; }
    else shuttle.style.opacity = 0;
  });
}

function trusteeRing() {
  const stage = document.querySelector('.board__stage');
  const list = stage?.querySelector('.trustees');
  if (!stage || !list) return;
  const cards = [...list.children];
  const n = cards.length, step = 360 / n;
  stage.classList.add('is-ring');
  list.classList.add('is-ring');
  const nav = document.createElement('div');
  nav.className = 'board__nav';
  nav.innerHTML = '<button type="button" aria-label="Turn the ring back">‹</button><button type="button" aria-label="Turn the ring on">›</button>';
  stage.appendChild(nav);
  const [prev, next] = nav.querySelectorAll('button');

  const size = () => {
    const cw = innerWidth < 700 ? 190 : 250, ch = Math.round(cw * 0.6);
    list.style.setProperty('--cw', `${cw}px`);
    list.style.setProperty('--ch', `${ch}px`);
    list.style.setProperty('--rad', `${Math.round(cw / 2 / Math.tan(Math.PI / n) + 26)}px`);
  };
  cards.forEach((c, i) => c.style.setProperty('--a', `${i * step}deg`));
  size();
  addEventListener('resize', size);

  let base = 0, hand = 0, target = 0, v = 0, drag = null, raf = 0;
  const render = () => {
    const spin = -(base + hand);
    list.style.setProperty('--spin', `${spin.toFixed(2)}deg`);
    let best = -2, front = null;
    cards.forEach((c, i) => {
      const rel = ((i * step + spin) % 360 + 540) % 360 - 180;
      const f = Math.cos(rel * Math.PI / 180);
      c.style.opacity = (0.3 + 0.7 * Math.max(0, f)).toFixed(3);
      if (f > best) { best = f; front = c; }
    });
    cards.forEach((c) => c.classList.toggle('is-front', c === front));
  };
  const frame = () => {
    raf = 0;
    if (!drag) {
      if (Math.abs(v) > 0.05) { target += v; v *= 0.92; if (Math.abs(v) <= 0.05) snap(); }
      hand += (target - hand) * 0.12;
    }
    render();
    if (drag || Math.abs(target - hand) > 0.05 || Math.abs(v) > 0.05) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const snap = () => { target = Math.round((base + target) / step) * step - base; v = 0; };

  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { x: e.clientX, id: e.pointerId };
    stage.setPointerCapture?.(e.pointerId);
    wake();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x; drag.x = e.clientX;
    hand -= dx * 0.3; target = hand; v = -dx * 0.3;
    wake();
  });
  const end = () => { if (!drag) return; drag = null; if (Math.abs(v) < 0.4) snap(); wake(); };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  prev.addEventListener('click', () => { snap(); target -= step; wake(); });
  next.addEventListener('click', () => { snap(); target += step; wake(); });

  // The scroll turns it slowly while the section crosses the screen.
  const sec = stage.closest('.board');
  const onScroll = () => {
    const r = sec.getBoundingClientRect();
    base = clamp((innerHeight - r.top) / (innerHeight + r.height)) * step * 3;
    render();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function start() {
  projectFollower();
  mission();
  threads();
  trusteeRing();
}
