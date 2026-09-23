// One rani thread runs down the left edge through all three programmes and is
// drawn by scroll: the weave's thread carried through the work. Without JS
// or with reduced motion it is simply drawn in full.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function start(work) {
  const line = work.querySelector('.thread__line');
  if (!line) return;
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Not pinned: the line tracks the reader, reaching the bottom of the work
    // section as its last photo leaves the screen.
    gsap.fromTo(line, { scaleY: 0 }, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: work, start: 'top 70%', end: 'bottom 70%', scrub: 0.4 },
    });
  });
}
