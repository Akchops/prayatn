// Motion that is not the signature: reveals, the drifting photo strip, the
// year counter. Loaded lazily from main.js and never under reduced motion.
// Everything is visible before this runs; it only hides elements that are
// still below the fold, then reveals them as they arrive.

const below = (el) => el.getBoundingClientRect().top > window.innerHeight;

// Headings: the line rises out of a mask.
const heads = [...document.querySelectorAll('.rv')].filter(below);
heads.forEach((h) => h.classList.add('rv-on'));

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  });
}, { rootMargin: '0px' });
heads.forEach((h) => io.observe(h));

// Days at Prayatn: the strip drifts sideways as the section crosses the screen.
const strip = document.querySelector('.moments');
const track = strip?.querySelector('[data-moments]');
if (strip && track) {
  strip.classList.add('js-drift');
  // The strip moves sideways, so native lazy-loading would leave empty frames
  // sliding in: load its photos as soon as the section is near.
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    track.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
  }, { rootMargin: '150% 0px' }).observe(strip);
  let raf = 0;
  const place = () => {
    raf = 0;
    const r = strip.getBoundingClientRect();
    const span = track.scrollWidth - document.documentElement.clientWidth;
    // 0 as the section enters from below, 1 as it leaves at the top.
    const k = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
    track.style.transform = `translate3d(${-k * Math.max(0, span)}px, 0, 0)`;
  };
  const on = () => { if (!raf) raf = requestAnimationFrame(place); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { window.addEventListener('scroll', on, { passive: true }); on(); }
    else window.removeEventListener('scroll', on);
  }).observe(strip);
  window.addEventListener('resize', on);
}

// The years since 1992 count up when they arrive.
document.querySelectorAll('.since [data-years]').forEach((el) => {
  if (!below(el)) return;
  const end = Number(el.textContent);
  el.textContent = '0';
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1200);
      el.textContent = String(Math.round(end * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }).observe(el);
});

// Page headers: the title rises word by word; the photo card drifts up and
// the text drifts down as the header scrolls away.
// Page headers: split the title into letters or words, depending on the page's
// opening (data-intro), so each page's title arrives differently.
const PER_LETTER = { wipe: 1, deal: 1, swing: 1 };
document.querySelectorAll('.band__title').forEach((t) => {
  const text = t.textContent.trim();
  const intro = t.closest('[data-intro]')?.dataset.intro;
  t.setAttribute('aria-label', text);
  let i = 0;
  t.innerHTML = text.split(/\s+/).map((w) => PER_LETTER[intro]
    ? `<span class="wd" aria-hidden="true" style="display:inline-block;white-space:nowrap">${[...w].map((ch) => `<span class="u" style="--i:${i++}">${ch}</span>`).join('')}</span>`
    : `<span class="u" aria-hidden="true" style="--i:${i++}">${w}</span>`).join(' ');
});
const band = document.querySelector('[data-band]');
if (band) {
  const card = band.querySelector('.band__card');
  const inner = band.querySelector('.band__inner');
  let raf = 0;
  // The header's exit, scrubbed by scroll (k: 0 at the top, 1 when it has
  // scrolled away): the photo lifts off, shrinks and turns slightly; the title
  // drifts down and fades; the woven background darkens. Separate translate /
  // scale / rotate properties, so the page's opening animation (transform)
  // is never overwritten.
  const place = () => {
    raf = 0;
    const h = band.offsetHeight || 1;
    const y = Math.min(window.scrollY, h);
    const k = y / h;
    const amp = window.innerWidth < 768 ? 0.6 : 1;
    if (card) {
      card.style.translate = `0 ${(-y * 0.35 * amp).toFixed(1)}px`;
      card.style.scale = (1 - 0.14 * k * amp).toFixed(4);
      card.style.rotate = `${(-3 * k * amp).toFixed(2)}deg`;
    }
    if (inner) {
      inner.style.translate = `0 ${(y * 0.25 * amp).toFixed(1)}px`;
      inner.style.opacity = Math.max(0, 1 - 1.3 * k).toFixed(3);
    }
    band.style.setProperty('--k', (0.75 * k).toFixed(3));
  };
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(place); }, { passive: true });
}

// Ticker: runs by itself, and speeds up (and reverses) with the reader's scroll.
const ticker = document.querySelector('[data-ticker]');
const anim = ticker?.getAnimations?.()[0];
if (anim) {
  let lastY = window.scrollY, lastT = performance.now(), rate = 1, raf = 0;
  const settle = () => {
    rate += (1 - rate) * 0.06;
    anim.playbackRate = rate;
    raf = Math.abs(rate - 1) > 0.01 ? requestAnimationFrame(settle) : 0;
  };
  window.addEventListener('scroll', () => {
    const now = performance.now(), v = (window.scrollY - lastY) / Math.max(1, now - lastT);
    lastY = window.scrollY; lastT = now;
    rate = Math.max(-6, Math.min(6, 1 + v * 4));
    if (!raf) raf = requestAnimationFrame(settle);
  }, { passive: true });
}

// Cards tilt towards the pointer (desktop).
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.act__card, .projgrid a, .nextprog a, .trustees li').forEach((c) => {
    c.classList.add('tilt');
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
      c.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -8}deg`);
    });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
  });
}

// Lists rise in one item after another.
const groups = ['.trustees', '.projgrid', '.act__grid', '.foot-col ul'];
groups.forEach((sel) => document.querySelectorAll(sel).forEach((g) => {
  const kids = [...g.children].filter(below);
  kids.forEach((k, i) => { k.classList.add('rise'); k.style.setProperty('--d', i); });
  if (!kids.length) return;
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    kids.forEach((k) => k.classList.add('is-in'));
  }, { rootMargin: '0px 0px -10% 0px' }).observe(g);
}));

// Photos move with the scroll, not with a timer. For each photo on screen,
// k runs from 1 (just entering at the bottom) through 0 (centre of the
// screen) to -1 (leaving at the top). Its frame opens as it rises towards the
// centre and closes again as it leaves, alternately from the middle and from
// the sides; the picture drifts and zooms inside the frame. Nothing is hidden
// without JS: these are inline styles written only while scrolling.
const scrubbed = [...document.querySelectorAll('.m, .g-item, .sp')];
if (scrubbed.length) {
  const on = new Set();
  const vis = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? on.add(e.target) : on.delete(e.target))), { rootMargin: '10% 0px' });
  scrubbed.forEach((f, i) => {
    f.classList.add('scrub');
    f.dataset.scrub = i % 2 ? 'side' : 'mid';
    vis.observe(f);
  });
  let raf = 0;
  const place = () => {
    raf = 0;
    const vh = window.innerHeight;
    on.forEach((f) => {
      const pic = f.querySelector('picture');
      if (!pic) return;
      const r = pic.getBoundingClientRect();
      const k = Math.max(-1, Math.min(1, ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2)));
      // Open fully over the lower 60% of the journey; close over the last 30%.
      const shut = k > 0 ? Math.min(1, k / 0.6) : Math.max(0, (-k - 0.7) / 0.3);
      const e = shut * shut;
      const cut = (e * 48).toFixed(2);
      pic.style.clipPath = f.dataset.scrub === 'side'
        ? `inset(0 ${cut}% 0 ${cut}%)`
        : `inset(${cut}% 0 ${cut}% 0)`;
      const img = pic.querySelector('img');
      if (img) {
        img.style.scale = (1 + 0.22 * Math.abs(k)).toFixed(4);
        img.style.translate = `0 ${(k * 9).toFixed(2)}%`;
      }
    });
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(place); };
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);
  kick();
}

// Partners: each name slides in along its thread, alternately from the left
// and the right, scrubbed by the section's position on screen.
const plist2 = document.querySelector('[data-partners]');
if (plist2) {
  const rows = [...plist2.children];
  let raf = 0;
  const place = () => {
    raf = 0;
    const vh = window.innerHeight;
    rows.forEach((row, i) => {
      const r = row.getBoundingClientRect();
      // 0 when the row is at the bottom of the screen, 1 by the time it is 35% up.
      const k = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.35)));
      const e = 1 - Math.pow(1 - k, 3);
      const dir = i % 2 ? 1 : -1;
      row.style.translate = `${(dir * (1 - e) * 40).toFixed(2)}vw 0`;
      row.style.opacity = (0.15 + 0.85 * e).toFixed(3);
      row.style.setProperty('--thread', e.toFixed(3));
    });
  };
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(place); }, { passive: true });
  place();
}

// The timeline draws itself. A thread runs down the milestones and ties a
// knot at each year it reaches. On the home page the whole timeline is
// pinned while this plays: the thread travels to each milestone and holds
// there for a stretch of scroll before moving on, and the big year shows the
// milestone's year at each knot, counting between them. Elsewhere (About)
// the thread simply follows the scroll. Scrolling back unpicks it.
// Without JS, or with reduced motion: the plain list with its years.
document.querySelectorAll('.since__list').forEach((list) => {
  const ns = 'http://www.w3.org/2000/svg';
  const track = document.createElement('div');
  track.className = 'since__track';
  const mover = document.createElement('div');
  mover.className = 'since__mover';
  list.before(track);
  track.appendChild(mover);
  mover.appendChild(list);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'since__thread');
  svg.setAttribute('aria-hidden', 'true');
  const under = document.createElementNS(ns, 'path');
  const path = document.createElementNS(ns, 'path');
  under.setAttribute('class', 'since__thread-under');
  svg.append(under, path);
  mover.prepend(svg);
  list.classList.add('is-threaded');
  const items = [...list.children];
  const since = list.closest('.since');
  const inner = since?.querySelector('.since__inner');
  const year = since?.querySelector('.since__year');
  const now = new Date().getFullYear();
  // Each milestone's year from its label: "1998–99" counts as 1998, "Today" as this year.
  const years = items.map((li) => Number(li.querySelector('b')?.textContent.match(/\d{4}/)?.[0]) || now);
  const KNOT = 35;   // knot centre below the top of its item (CSS: top 26px + 9px)

  let H = 0, knots = [], lens = [], total = 0;
  const shape = () => {
    H = list.offsetHeight;
    knots = items.map((li) => li.offsetTop + KNOT);
    svg.setAttribute('viewBox', `0 0 28 ${H}`);
    svg.style.height = `${H}px`;
    // A loose thread: a slow sine down the list, pulled straight at each knot.
    // lens[k] is the thread's length down to y = 4k, for drawing to any depth.
    let d = 'M14 0', px = 14, py = 0;
    total = 0; lens = [0];
    for (let y = 4; y <= H + 3; y += 4) {
      const x = knots.some((k) => Math.abs(k - y) < 14) ? 14 : 14 + 7 * Math.sin(y / 19);
      total += Math.hypot(x - px, y - py); px = x; py = y;
      lens.push(total);
      d += ` L${x.toFixed(1)} ${y}`;
    }
    under.setAttribute('d', d);
    path.setAttribute('d', d);
    path.style.strokeDasharray = `${total}`;
  };
  // Draw the thread down to depth y (px from the top of the list).
  let shown = '';
  const draw = (y) => {
    path.style.strokeDashoffset = `${(total - (lens[Math.min(lens.length - 1, Math.round(y / 4))] || 0)).toFixed(1)}`;
    items.forEach((li, i) => li.classList.toggle('is-tied', y >= knots[i] - 2));
    if (!year) return;
    let v = years[0];
    for (let i = 0; i < knots.length; i++) {
      if (y >= knots[i] - 2) v = years[i];
      if (i + 1 < knots.length && y > knots[i] && y < knots[i + 1]) {
        v = Math.round(years[i] + (years[i + 1] - years[i]) * (y - knots[i]) / (knots[i + 1] - knots[i]));
      }
    }
    const t = String(v);
    if (t !== shown) { year.textContent = t; shown = t; }
  };

  let place;
  if (since && inner) {
    // Pinned: the runway is one "travel" and one "hold" per milestone.
    since.classList.add('is-pinned');
    const head = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head')) || 60;
    const travel = () => innerHeight * 0.4, hold = () => innerHeight * 0.45;
    let L = 0;
    const layout = () => {
      shape();
      L = items.length * (travel() + hold());
      since.style.height = `${inner.offsetHeight + L}px`;
    };
    const ease = (k) => k * k * (3 - 2 * k);
    place = () => {
      let d = Math.max(0, Math.min(L, head() - since.getBoundingClientRect().top));
      const tr = travel(), hd = hold();
      let y = knots[knots.length - 1], prev = 0;
      for (let i = 0; i < knots.length; i++) {
        if (d < tr) { y = prev + (knots[i] - prev) * ease(d / tr); break; }
        d -= tr;
        if (d < hd) { y = knots[i]; break; }
        d -= hd;
        prev = knots[i];
      }
      draw(y);
      // Keep the moving knot in view when the list is taller than its window.
      // On a milestone, show all of its text, even on a small phone.
      const win = track.clientHeight;
      let shift = y - win * 0.42;
      const at = knots.findLastIndex((k) => y >= k - 2);
      if (at >= 0) {
        const li = items[at];
        shift = Math.max(shift, Math.min(li.offsetTop + li.offsetHeight + 8 - win, li.offsetTop - 4));
      }
      shift = Math.max(0, Math.min(shift, H + 24 - win));
      mover.style.transform = `translateY(${(-shift).toFixed(1)}px)`;
    };
    layout();
    addEventListener('resize', () => { layout(); kick(); });
    document.fonts?.ready.then(() => { layout(); kick(); });
  } else {
    // Unpinned: the thread reaches whatever is at the middle of the screen.
    place = () => draw(Math.max(0, Math.min(H, innerHeight / 2 - list.getBoundingClientRect().top)));
    shape();
    addEventListener('resize', () => { shape(); kick(); });
    document.fonts?.ready.then(() => { shape(); kick(); });
  }
  let raf = 0;
  const run = () => { raf = 0; place(); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(run); };
  place();
  addEventListener('scroll', kick, { passive: true });
});

// Donate: the line joining the three steps fills as you scroll down them,
// and each step's number lights up when the line reaches it.
document.querySelectorAll('.give').forEach((g) => {
  g.classList.add('is-drawn');
  const steps = [...g.children];
  let raf = 0;
  const place = () => {
    raf = 0;
    const r = g.getBoundingClientRect();
    const y = Math.max(0, Math.min(r.height, innerHeight * 0.62 - r.top));
    g.style.setProperty('--fill', Math.max(0, Math.min(1, (y - 24) / Math.max(1, r.height - 48))).toFixed(4));
    steps.forEach((s) => s.classList.toggle('is-reached', y >= s.offsetTop + 25));
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(place); };
  place();
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
});
