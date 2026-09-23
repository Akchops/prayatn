// Pinned photo reel on the programme pages: vertical scroll moves the row of
// photos sideways, each photo drifting inside its frame. Loaded lazily from
// main.js, never under reduced motion. Without it the row is swipeable.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function start(section) {
  const track = section.querySelector('[data-reel-track]');
  const bar = section.querySelector('.reel__bar i');
  if (!track) return;
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    section.classList.add('is-pinned');
    // Distance: exactly the row's overflow, 1 px of scroll per px of travel,
    // so the reel moves at the speed of the reader's scroll (no false inertia).
    const travel = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    const head = () => document.querySelector('.site-head')?.offsetHeight ?? 0;
    const tween = gsap.to(track, {
      x: () => -travel(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: () => `top ${head()}px`,
        end: () => '+=' + travel(),
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (st) => { if (bar) bar.style.transform = `scaleX(${st.progress.toFixed(4)})`; },
      },
    });
    // Each programme page moves its cards differently (data-reel):
    //   pan   – each photo pans inside its frame against the direction of travel
    //   tilt  – cards swing from leaning back to leaning forward as they pass
    //   scale – cards grow as they reach the middle of the screen, then shrink
    const mode = section.dataset.reel || 'pan';
    track.querySelectorAll('.reel__card').forEach((card) => {
      const st = { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true };
      if (mode === 'tilt') {
        gsap.fromTo(card, { rotate: 7, y: 30 }, { rotate: -7, y: -30, ease: 'none', scrollTrigger: st });
      } else if (mode === 'scale') {
        gsap.timeline({ scrollTrigger: st })
          .fromTo(card, { scale: 0.78, opacity: 0.55 }, { scale: 1, opacity: 1, ease: 'power1.out', duration: 1 })
          .to(card, { scale: 0.78, opacity: 0.55, ease: 'power1.in', duration: 1 });
      } else {
        const img = card.querySelector('.reel__img img');
        if (img) gsap.fromTo(img, { xPercent: 7 }, { xPercent: -7, ease: 'none', scrollTrigger: st });
      }
    });
    return () => section.classList.remove('is-pinned');
  });
  ScrollTrigger.refresh();
}
