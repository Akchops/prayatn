// Entry script: the only JavaScript on the first load. Everything heavy
// (GSAP, ScrollTrigger, the weave renderers) is a dynamic import.

// "Years of work" is counted from 1992 at build time; this keeps it right if
// the site isn't rebuilt every year.
const years = new Date().getFullYear() - 1992;
document.querySelectorAll('[data-years]').forEach((el) => { el.textContent = String(years); });

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

import('./ui.js').catch(() => {});

// Switchable features (site.json features; the list is set in head.html).
const features = (document.documentElement.dataset.features || '').split(' ');
const giftEl = features.includes('giftSlider') && document.querySelector('[data-gift]');
if (giftEl) import('./features/gift.js').then((m) => m.start(giftEl)).catch(() => {});

// The page's full-screen opening, if the inline script in <head> chose to play it.
if (document.documentElement.classList.contains('opening')) {
  import('./opening.js').then((m) => m.start()).catch(() => document.documentElement.classList.remove('opening'));
}

const story = document.querySelector('[data-story]');
if (story) import('./story.js').then((m) => m.start(story)).catch(() => {});
if (!reduce.matches) import('./motion.js').catch(() => {});

if (!reduce.matches) {
  const loom = document.querySelector('[data-loom]');
  if (loom) import('./loom/index.js').then((m) => m.start(loom)).catch((e) => { document.documentElement.dataset.loomFail = `script: ${e?.message || e}`; });

  // About: project photos that follow the mouse, the mission, the loom, the ring.
  if (document.querySelector('.pindex')) import('./about.js').then((m) => m.start()).catch(() => {});

  // The brushable woven header on the inner pages.
  const bandEl = document.querySelector('[data-band]');
  if (bandEl) import('./bandfx.js').then((m) => m.start(bandEl)).catch(() => {});

  const reel = document.querySelector('[data-reel]');
  if (reel) import('./reel.js').then((m) => m.start(reel)).catch(() => {});

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

// ?debug: after five seconds, show what each animated part is doing on this
// device, so a problem on someone's phone can be reported with a screenshot.
if (/[?&]debug\b/.test(location.search)) {
  setTimeout(() => {
    const d = document.documentElement.dataset;
    const loom = document.querySelector('[data-loom]');
    let gl = 'none', frag = '-';
    try {
      const c = document.createElement('canvas').getContext('webgl');
      if (c) {
        gl = c.getParameter(c.VERSION);
        frag = c.getParameter(c.MAX_FRAGMENT_UNIFORM_VECTORS);
        const x = c.getExtension('WEBGL_debug_renderer_info');
        if (x) gl += ' / ' + c.getParameter(x.UNMASKED_RENDERER_WEBGL);
        c.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch (e) { gl = 'error: ' + e.message; }
    const box = document.createElement('pre');
    box.className = 'debug-box';
    box.textContent = [
      `hero: ${d.weaveTier || '-'}`,
      `gallery: ${loom ? (loom.dataset.tier || 'not started') + (d.loomFail ? ` (${d.loomFail})` : '') : '-'}`,
      `reduced motion: ${reduce.matches}`,
      `webgl: ${gl}`,
      `fragment uniform vectors: ${frag}`,
      `screen: ${innerWidth}x${innerHeight} @${devicePixelRatio}`,
      navigator.userAgent,
    ].join('\n');
    document.body.appendChild(box);
  }, 5000);
}
