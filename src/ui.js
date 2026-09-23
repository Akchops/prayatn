// Interface behaviour that everyone gets, including reduced-motion visitors.
// Loaded lazily from main.js. Without JS each of these degrades to plain HTML:
// the whole gallery grouped by category, a link to Google Maps, plain links.

// Gallery: category filter and a lightbox.
const filter = document.querySelector('[data-gfilter]');
if (filter) {
  filter.hidden = false;
  const groups = [...document.querySelectorAll('.g-group')];
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]');
    if (!b) return;
    filter.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.f;
    groups.forEach((g) => { g.hidden = f !== 'all' && g.dataset.cat !== f; });
  });
}
const box = document.querySelector('[data-lightbox]');
if (box && typeof box.showModal === 'function') {
  const img = box.querySelector('img');
  const cap = box.querySelector('.lightbox__cap');
  document.addEventListener('click', (e) => {
    const fig = e.target.closest('.g-item');
    if (!fig) return;
    const src = fig.querySelector('img');
    // The largest JPEG in the srcset: never larger than the photo's native size.
    const best = (src.getAttribute('srcset') || '').split(',').map((s) => s.trim().split(' ')[0]).filter(Boolean).pop();
    img.src = best || src.currentSrc || src.src;
    img.alt = src.alt;
    cap.textContent = src.alt;
    box.showModal();
  });
  box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('[data-close]')) box.close(); });
  document.querySelectorAll('.g-item').forEach((f) => { f.tabIndex = 0; f.setAttribute('role', 'button'); f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.click(); } }); });
}

// Map: Google Maps loads only when asked (third-party, heavy on mobile data).
document.querySelectorAll('[data-map]').forEach((map) => {
  const open = map.querySelector('.map__open');
  const btns = document.createElement('div');
  btns.className = 'map__btns';
  const load = document.createElement('button');
  load.type = 'button';
  load.className = 'map__load';
  load.textContent = 'Show map here';
  load.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.title = 'Map: E-103, Kalkaji, New Delhi';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://www.google.com/maps?q=E-103%2C%20Kalkaji%2C%20New%20Delhi%20110019&output=embed';
    map.appendChild(f);
    load.remove();
  });
  btns.append(load, open);
  map.appendChild(btns);
});

// Projects index: on desktop a photo from the project follows the pointer.
const plist = document.querySelector('[data-plist]');
const float = document.querySelector('.plist__float');
if (plist && float && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  float.style.display = 'block';
  const fimg = float.querySelector('img');
  let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = () => {
    x += (tx - x) * (still ? 1 : 0.18); y += (ty - y) * (still ? 1 : 0.18);
    float.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${still ? 0 : (tx - x) * 0.03}deg)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : 0;
  };
  // The preview rides in the empty right-hand part of the list, following the
  // pointer vertically (and a little horizontally), so it never covers a name.
  plist.addEventListener('pointermove', (e) => {
    const r = plist.getBoundingClientRect();
    tx = r.left + r.width * 0.72 + (e.clientX - (r.left + r.width / 2)) * 0.08;
    ty = e.clientY;
    if (!raf) raf = requestAnimationFrame(loop);
  });
  plist.addEventListener('pointerover', (e) => {
    const row = e.target.closest('.plist__row');
    if (row?.dataset.preview) { fimg.src = row.dataset.preview; float.classList.add('is-on'); } else float.classList.remove('is-on');
  });
  plist.addEventListener('pointerleave', () => float.classList.remove('is-on'));
}

// Phone menu: lock the page behind it, close with Escape or on following a link.
const menu = document.querySelector('[data-menu]');
if (menu) {
  const sync = () => document.documentElement.classList.toggle('menu-open', menu.open);
  menu.addEventListener('toggle', sync);
  menu.addEventListener('click', (e) => { if (e.target.closest('.menu__panel a')) menu.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
  matchMedia('(min-width: 1080px)').addEventListener('change', (m) => { if (m.matches) menu.open = false; });
}
