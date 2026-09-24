// Motion that is not the signature: reveals, the drifting photo strip, the
// year counter. Loaded lazily from main.js and never under reduced motion.
// Everything is visible before this runs; it only hides elements that are
// still below the fold, then reveals them as they arrive.

const below = (el) => el.getBoundingClientRect().top > window.innerHeight;

// Headings: the line rises out of a mask.
const heads = [...document.querySelectorAll('.rv')].filter(below);
// Photos: the weft slats withdraw.
const photos = [...document.querySelectorAll('.m')].filter(below);
photos.forEach((f) => {
  const pic = f.querySelector('picture') || f.querySelector('img');
  if (!pic) return;
  const wrap = document.createElement('div');
  wrap.className = 'slats';
  pic.replaceWith(wrap);
  wrap.appendChild(pic);
  const cover = document.createElement('div');
  cover.className = 'slats__cover';
  cover.setAttribute('aria-hidden', 'true');
  cover.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
  wrap.appendChild(cover);
});
heads.forEach((h) => h.classList.add('rv-on'));

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const t = e.target.classList.contains('rv-on') ? e.target : e.target.querySelector('.slats');
    t?.classList.add('is-in');
    io.unobserve(e.target);
  });
}, { rootMargin: '0px' });
heads.forEach((h) => io.observe(h));
photos.forEach((f) => io.observe(f));

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
const groups = ['.trustees', '.since__list', '.projgrid', '.act__grid', '.foot-col ul'];
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
