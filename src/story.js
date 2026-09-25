// Programme pages on a PC: a two-column scroll story. The photo panel stays
// pinned while the steps scroll past; each step that reaches the middle of the
// screen brings in its own photos over the last ones, each page in its own way
// (data-story-style: a heartbeat for Healthcare, a turning page for Education,
// an opening circle for Women development), with
// a running count and a thread that fills as you read. On phones, and with
// reduced motion, the steps stay as text followed by their photo.
//
// The photos are phone snapshots, many smaller than the panel. So a step's
// photo is joined by the step's other photos ({{more}} in the page) and laid
// out in rows that fill the panel, choosing for the panel's shape how many to
// show so that no photo is enlarged past its own size or cropped much.

const GAP = 10;
const CROP = 0.18;   // the most a photo may lose off its edges to fill its cell

// Every way to arrange the photos (in this order) by cutting the panel in two,
// side by side or one above the other, again and again.
function trees(ids) {
  if (ids.length === 1) return [ids[0]];
  const out = [];
  for (let k = 1; k < ids.length; k++) {
    for (const a of trees(ids.slice(0, k))) for (const b of trees(ids.slice(k))) out.push({ row: true, a, b }, { row: false, a, b });
  }
  return out;
}
function orders(list) {
  if (list.length < 2) return [list];
  return list.flatMap((x, i) => orders([...list.slice(0, i), ...list.slice(i + 1)]).map((r) => [x, ...r]));
}
// Width over height of an arrangement at the photos' own shapes.
const ratio = (t, ps) => (typeof t === 'number' ? ps[t].w / ps[t].h
  : t.row ? ratio(t.a, ps) + ratio(t.b, ps) : 1 / (1 / ratio(t.a, ps) + 1 / ratio(t.b, ps)));
function place(t, ps, x, y, w, h, cells) {
  if (typeof t === 'number') { cells.push({ i: t, x, y, w, h }); return; }
  const ra = ratio(t.a, ps), rb = ratio(t.b, ps);
  if (t.row) {
    const wa = (w - GAP) * ra / (ra + rb);
    place(t.a, ps, x, y, wa, h, cells); place(t.b, ps, x + wa + GAP, y, w - wa - GAP, h, cells);
  } else {
    const ha = (h - GAP) * (1 / ra) / (1 / ra + 1 / rb);
    place(t.a, ps, x, y, w, ha, cells); place(t.b, ps, x, y + ha + GAP, w, h - ha - GAP, cells);
  }
}

// photos: [{ w, h }] with the step's own photo first. Returns the best
// arrangement for a W x H panel: [{ i, x, y, w, h }] in CSS px.
export function plan(photos, W, H) {
  let best = null;
  const extras = photos.slice(1).map((_, j) => j + 1);
  for (let m = 0; m < 1 << extras.length; m++) {
    const set = [0, ...extras.filter((_, j) => m & (1 << j))];
    for (const ids of orders(set)) {
      for (const t of trees(ids)) {
        const r = score(t, set.length, photos, W, H);
        if (!best || r.cost < best.cost) best = r;
      }
    }
  }
  return best.cells;
}

function score(t, n, ps, W, H) {
  // Fill the panel if the arrangement's shape is close enough (photos are
  // cropped a little to fit); otherwise leave a margin of background.
  const A = ratio(t, ps), P = W / H;
  const T = Math.min(Math.max(P, A * (1 - CROP)), A / (1 - CROP));
  const bw = T > P ? W : H * T, bh = T > P ? W / T : H;
  const cells = [];
  place(t, ps, (W - bw) / 2, (H - bh) / 2, bw, bh, cells);
  let crop = 0, grow = 0, tiny = 0, main = 0, other = 0;
  for (const c of cells) {
    const p = ps[c.i], r = (c.w / c.h) / (p.w / p.h);
    crop = Math.max(crop, 1 - Math.min(r, 1 / r));
    grow = Math.max(grow, Math.max(c.w / p.w, c.h / p.h) - 1.05);
    if (Math.min(c.w, c.h) < 150) tiny++;
    const share = (c.w * c.h) / (W * H);
    if (c.i === 0) main = share; else other = Math.max(other, share);
  }
  const cost = 3 * (1 - (bw * bh) / (W * H))   // background showing
    + 1.5 * crop                               // cropping
    + 12 * Math.max(0, grow)                   // any photo enlarged
    + 0.6 * (1 - main)                         // the step's own photo kept large
    + 0.8 * Math.max(0, other - main)          // and the largest
    + 0.05 * (n - 1)
    + 2 * tiny;
  return { cost, cells };
}

export function start(section) {
  const panel = section.querySelector('.story__media');
  const steps = [...section.querySelectorAll('.story__step')];
  if (!panel || !steps.length) return;
  const mq = matchMedia('(min-width: 760px) and (prefers-reduced-motion: no-preference)');
  const style = section.dataset.storyStyle || 'band';
  section.classList.add(`story--${style}`);
  let io = null, shots = [], active = -1, onScroll = null, ro = null;

  function build() {
    panel.innerHTML = '';
    shots = steps.map((step) => {
      const shot = document.createElement('div');
      shot.className = 'shot';
      const pic = step.querySelector('.story__fig picture');
      if (pic) {
        const sheet = document.createElement('div');
        sheet.className = 'shot__photos';
        shot.appendChild(sheet);
        const extra = step.querySelector('template.story__more');
        const pics = [pic, ...(extra ? extra.content.querySelectorAll('picture') : [])];
        shot._photos = pics.map((p, k) => {
          const clone = document.importNode(p, true);
          clone.querySelector('.weft')?.remove();   // the phone reveal's cover, if it was added first
          const img = clone.querySelector('img');
          img.loading = 'eager';
          img.style.cssText = '';           // drop the phone scroll effect's inline styles
          clone.style.cssText = '';
          const cell = document.createElement('div');
          cell.className = 'shot__cell';
          cell.style.setProperty('--k', k);
          cell.appendChild(clone);
          return { sheet, cell, img, w: Number(img.getAttribute('width')), h: Number(img.getAttribute('height')) };
        });
      } else {
        // A step without a photo gets its title.
        shot.innerHTML = `<div class="shot__photos shot__type"><span>${step.dataset.title}</span></div>`;
      }
      // The page's own transition piece: a woven shuttle band (default), a
      // heartbeat trace (Healthcare) or a ring (Women development). The page
      // turn (Education) needs none.
      if (style === 'pulse') {
        shot.insertAdjacentHTML('beforeend', '<svg class="shot__ecg" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 60 L120 60 L140 52 L155 60 L170 60 L182 72 L198 12 L214 84 L228 60 L262 60 L276 50 L292 60 L400 60"/></svg>');
      } else if (style === 'iris') {
        shot.insertAdjacentHTML('beforeend', '<span class="shot__ring" aria-hidden="true"></span>');
      } else if (style !== 'page') {
        const band = document.createElement('div');
        band.className = 'shot__band';
        shot.appendChild(band);
      }
      panel.appendChild(shot);
      return shot;
    });
    const cap = document.createElement('div');
    cap.className = 'story__cap';
    cap.innerHTML = '<span class="story__captext"></span><span class="story__count"></span>';
    const thread = document.createElement('div');
    thread.className = 'story__thread';
    thread.innerHTML = '<i></i>';
    panel.append(cap, thread);
    arrange();
  }

  // Lays out each step's photos for the panel's current size. A photo that is
  // left out is taken out of the page, so it is not downloaded.
  let size = '';
  function arrange() {
    const W = panel.clientWidth, H = panel.clientHeight;
    if (!W || !H || size === `${W}x${H}`) return;
    size = `${W}x${H}`;
    for (const shot of shots) {
      if (!shot._photos) continue;
      const cells = plan(shot._photos, W, H);
      const used = new Set(cells.map((c) => c.i));
      shot._photos.forEach((p, i) => { if (!used.has(i)) p.cell.remove(); });
      for (const c of cells) {
        const p = shot._photos[c.i];
        Object.assign(p.cell.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` });
        p.img.sizes = `${Math.ceil(Math.max(c.w, (c.h * p.w) / p.h))}px`;
        if (!p.cell.isConnected) p.sheet.appendChild(p.cell);
      }
    }
  }

  function show(i) {
    if (i === active || !shots[i]) return;
    shots.forEach((s, k) => { s.classList.toggle('was-on', k === active); s.classList.remove('is-on'); });
    void shots[i].offsetWidth;               // restart the wipe
    shots[i].classList.add('is-on');
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    const fig = steps[i].querySelector('.story__fig figcaption');
    panel.querySelector('.story__captext').textContent = fig ? fig.textContent : '';
    panel.querySelector('.story__count').innerHTML = `${String(i + 1).padStart(2, '0')}<small> / ${String(steps.length).padStart(2, '0')}</small>`;
    active = i;
  }

  function on() {
    section.classList.add('story--live');
    build();
    active = -1;
    show(0);
    io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) show(steps.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
    const thread = panel.querySelector('.story__thread');
    onScroll = () => {
      const r = section.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight / 2 - r.top) / r.height));
      thread.style.setProperty('--p', p.toFixed(4));
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    ro = new ResizeObserver(arrange);
    ro.observe(panel);
  }
  function off() {
    section.classList.remove('story--live');
    io?.disconnect();
    ro?.disconnect();
    size = '';
    if (onScroll) removeEventListener('scroll', onScroll);
    panel.innerHTML = '';
    steps.forEach((s) => s.classList.remove('is-active'));
  }
  const sync = () => (mq.matches ? on() : off());
  mq.addEventListener?.('change', () => { off(); sync(); });
  sync();
}
