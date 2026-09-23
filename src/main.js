// Entry script: the only JavaScript on the first load. Everything heavy
// (GSAP, ScrollTrigger, the weave renderers) is a dynamic import.

// "Years of work" is counted from 1992 at build time; this keeps it right if
// the site isn't rebuilt every year.
const years = new Date().getFullYear() - 1992;
document.querySelectorAll('[data-years]').forEach((el) => { el.textContent = String(years); });

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

import('./ui.js').catch(() => {});
if (!reduce.matches) import('./motion.js').catch(() => {});

if (!reduce.matches) {
  const weave = document.querySelector('[data-weave]');
  if (weave) {
    import('./weave/index.js').then((m) => m.start(weave)).catch(() => { /* tier 3 stands */ });
  }

  const work = document.querySelector('.work');
  if (work && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      import('./weave/thread.js').then((m) => m.start(work)).catch(() => {});
    }, { rootMargin: '50% 0px' });
    io.observe(work);
  }
}
