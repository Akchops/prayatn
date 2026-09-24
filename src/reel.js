// Pinned photo reel on the programme pages. While it is pinned the page stops
// moving and scrolling slides the photos instead: the top row to the left,
// the bottom row to the right. Loaded lazily from main.js, never under reduced
// motion; without it the two rows are simply swipeable.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function start(section) {
  const [rowA, rowB] = section.querySelectorAll('[data-reel-track]');
  const bar = section.querySelector('.reel__bar i');
  if (!rowA) return;
  const cards = [...section.querySelectorAll('.reel__card')];
  const imgs = cards.map((c) => c.querySelector('.reel__img img'));
  const mode = section.dataset.reel || 'pan';

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    section.classList.add('is-pinned');
    const vw = () => document.documentElement.clientWidth;
    const over = (row) => (row ? Math.max(0, row.scrollWidth - vw()) : 0);
    // Scroll distance: the longer row's overflow, 1 px of scroll per px of
    // travel, so the photos move at the reader's own scroll speed.
    const travel = () => Math.max(over(rowA), over(rowB));
    const head = () => document.querySelector('.site-head')?.offsetHeight ?? 0;

    // Each programme page moves its photos differently (data-reel), from each
    // card's position across the screen (-1 at the left edge, 1 at the right):
    //   pan   – the photo pans inside its frame
    //   tilt  – the card leans back on the right and forward on the left
    //   scale – the card is largest at the centre of the screen
    function shape() {
      const w = vw();
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        if (r.right < -50 || r.left > w + 50) return;
        const x = Math.max(-1, Math.min(1, ((r.left + r.width / 2) / w) * 2 - 1));
        if (mode === 'tilt') {
          card.style.rotate = `${(x * 6).toFixed(2)}deg`;
          card.style.translate = `0 ${(x * x * 14).toFixed(1)}px`;
        } else if (mode === 'scale') {
          const k = 1 - Math.abs(x);
          card.style.scale = (0.8 + 0.2 * k).toFixed(3);
          card.style.opacity = (0.5 + 0.5 * k).toFixed(3);
        } else if (imgs[i]) {
          imgs[i].style.translate = `${(-x * 7).toFixed(2)}% 0`;
        }
      });
    }

    const st = ScrollTrigger.create({
      trigger: section,
      start: () => `top ${head()}px`,
      end: () => '+=' + travel(),
      pin: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        gsap.to(rowA, { x: -over(rowA) * p, duration: 0.5, ease: 'power2.out', overwrite: true, onUpdate: shape });
        if (rowB) gsap.to(rowB, { x: -over(rowB) * (1 - p), duration: 0.5, ease: 'power2.out', overwrite: true });
        if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
      },
      onRefresh: (self) => {
        gsap.set(rowA, { x: -over(rowA) * self.progress });
        if (rowB) gsap.set(rowB, { x: -over(rowB) * (1 - self.progress) });
        shape();
      },
    });
    shape();

    return () => {
      st.kill();
      section.classList.remove('is-pinned');
      gsap.set([rowA, rowB].filter(Boolean), { clearProps: 'transform' });
      cards.forEach((c) => { c.style.rotate = c.style.translate = c.style.scale = c.style.opacity = ''; });
      imgs.forEach((i) => { if (i) i.style.translate = ''; });
    };
  });
  ScrollTrigger.refresh();
  // The page above the reel can change height after this runs (photos and
  // fonts arriving, the story layout switching on), which would leave the pin
  // at the wrong place. Re-measure whenever the page's height changes.
  let t = 0, lastH = document.body.offsetHeight;
  const again = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 150); };
  new ResizeObserver(() => { const h = document.body.offsetHeight; if (Math.abs(h - lastH) > 4) { lastH = h; again(); } }).observe(document.body);
  addEventListener('load', again);
  document.fonts?.ready.then(again);
}
