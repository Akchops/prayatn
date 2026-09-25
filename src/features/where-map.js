// Feature 2 (switch: site.json features.whereMap). The woven map on About:
// the map is pinned while a thread runs from the office in Kalkaji to each
// place in turn; it holds at each one while its card shows what happens
// there. Tap a place to go straight to it. Without JS (or with reduced
// motion) the whole map and every card are simply shown.
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const headPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head')) || 60;

export function start(map) {
  const stick = map.querySelector('.wmap__stick');
  const svg = map.querySelector('.wmap__svg');
  const places = [...map.querySelectorAll('.wmap__place')];
  const items = [...map.querySelectorAll('.wmap__item')];
  if (!stick || !svg || !places.length) return;
  const n = places.length;
  // Where each place is along the route (0..1), from the knots' positions.
  const pts = places.map((g) => g.transform.baseVal.consolidate().matrix).map((m) => [m.e, m.f]);
  const seg = pts.map((p, i) => (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const at = seg.map((d) => (acc += d) / total);

  const TRAVEL = 0.32, HOLD = 0.5;   // screens of scroll per move and per stop
  let L = 0, pinned = false, cur = -1;
  const layout = () => {
    map.classList.add('is-live');
    map.style.height = '';
    // Fits if the map and the tallest single card fit on screen together
    // (only one card shows at a time).
    const fig = map.querySelector('.wmap__fig');
    const tallest = Math.max(...items.map((it) => it.offsetHeight));
    const side = innerWidth >= 900;
    const need = side ? Math.max(fig.offsetHeight, tallest) + 32 : fig.offsetHeight + tallest + 42;
    pinned = need <= innerHeight - headPx();
    if (!pinned) { map.classList.remove('is-live'); return; }
    L = innerHeight * (TRAVEL + HOLD) * n;
    map.style.height = `${stick.offsetHeight + L}px`;
    place();
  };
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    places.forEach((g, k) => { g.classList.toggle('is-lit', k <= i); g.classList.toggle('is-here', k === i); });
    items.forEach((it, k) => it.classList.toggle('is-on', k === i));
  };
  const place = () => {
    if (!pinned) return;
    const top = map.getBoundingClientRect().top;
    const d = clamp(headPx() - top, 0, L) / innerHeight;
    if (d > 0.05 && d * innerHeight < L - 40 && Math.abs(stick.getBoundingClientRect().top - headPx()) > 30) {
      pinned = false; map.style.height = ''; map.classList.remove('is-live'); return;   // sticky not holding
    }
    // Each stop: a move along the thread, then a hold.
    let drawn = 0, here = 0, left = d;
    for (let i = 0; i < n; i++) {
      const from = i ? at[i - 1] : 0;
      if (left < TRAVEL) { drawn = from + (at[i] - from) * (left / TRAVEL); here = Math.max(0, i - 1); break; }
      left -= TRAVEL; drawn = at[i]; here = i;
      if (left < HOLD) break;
      left -= HOLD;
    }
    map.style.setProperty('--drawn', drawn.toFixed(4));
    show(here);
  };
  // Tap a place: scroll to its stop.
  places.forEach((g, i) => g.addEventListener('click', () => {
    if (!pinned) return;
    const y = scrollY + map.getBoundingClientRect().top - headPx() + innerHeight * ((TRAVEL + HOLD) * i + TRAVEL + HOLD * 0.4);
    scrollTo({ top: y, behavior: 'smooth' });
  }));
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); }, { passive: true });
  addEventListener('resize', layout);
  addEventListener('load', layout);
  layout();
  show(0);
}
