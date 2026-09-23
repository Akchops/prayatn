// Motion that is not the signature: reveals, the drifting photo strip, the
// year counter. Loaded lazily from main.js and never under reduced motion.
// Everything is visible before this runs; it only hides elements that are
// still below the fold, then reveals them as they arrive.

const below = (el) => el.getBoundingClientRect().top > window.innerHeight;

// Headings: the line rises out of a mask.
const heads = [...document.querySelectorAll('.rv')].filter(below);
// Photos: the weft slats withdraw.
const photos = [...document.querySelectorAll('.m, .g-item')].filter(below);
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
