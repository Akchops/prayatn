// The Weave: mounts the best available tier over the static hero and drives it
// from a pinned ScrollTrigger. Loaded lazily from main.js, never under
// prefers-reduced-motion. If anything here fails, the static hero (tier 3:
// the photo on the CSS rug) is already on screen and stays there.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { phases, BEATS, beatPx } from './phases.js';
import { probeWebGL } from './probe.js';
import { create as createGL } from './weave-gl.js';
import { create as createCanvas } from './weave-canvas.js';

gsap.registerPlugin(ScrollTrigger);

export async function start(section) {
  const stage = section.querySelector('.weave__stage');
  const frame = section.querySelector('.weave__frame');
  const introEl = section.querySelector('.weave__intro');
  const img = section.querySelector('.weave__photo img');
  if (!stage || !frame || !img) return;

  // The photo must be decoded before it can become a texture.
  try { await img.decode(); } catch { if (!img.complete || !img.naturalWidth) return; }

  // ?tier=1 / ?tier=2 force a tier for QA screenshots. tier=1 allows a
  // software rasteriser, which headless browsers without a GPU need.
  const force = new URLSearchParams(location.search).get('tier');
  const allowSoftware = force === '1';

  const canvas = document.createElement('canvas');
  canvas.className = 'weave__canvas';
  canvas.setAttribute('aria-hidden', 'true');   // semantics stay on the <img>

  let renderer = null;
  if (force !== '2') {
    const caps = probeWebGL({ allowSoftware });
    if (caps && caps.tier !== 'low') renderer = createGL(canvas, img, { allowSoftware, onLost: demote });
  }
  let target = canvas;
  if (!renderer) renderer = createCanvas(canvas, img);
  if (!renderer) return;                          // tier 3 stands
  document.documentElement.dataset.weaveTier = renderer.kind;

  let geom = null;
  let progress = 0;          // what is drawn
  let goal = 0;              // where the scroll says we should be
  let intro = 0.55;          // load intro: the photo's threads settle from loose to tight
  let introT0 = 0;
  let raf = 0;
  const aspect = img.naturalWidth / img.naturalHeight;

  function measure() {
    const s = stage.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const t = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t')) || 10;
    // The opening rect: the photo scaled to cover the whole stage.
    const cw = Math.max(s.width, s.height * aspect), ch = cw / aspect;
    geom = {
      width: s.width, height: s.height, t,
      frame: { x: f.left - s.left, y: f.top - s.top, w: f.width, h: f.height },
      cover: { x: (s.width - cw) / 2, y: (s.height - ch) / 2, w: cw, h: ch },
    };
    renderer.resize(geom);
  }

  // Performance watchdog. Scroll-driven frames are timed; if drawing takes
  // longer than 12ms on average (leaving no room in a 16.7ms frame), step
  // down: Canvas 2D gets cheaper sampling, then WebGL or Canvas 2D gives way
  // to the static hero (tier 3), which is already in the DOM underneath.
  let cost = 0, samples = 0;
  function watch(ms) {
    cost = samples ? cost * 0.8 + ms * 0.2 : ms;
    if (++samples < 8 || cost < 12) return;
    samples = 0;
    if (renderer.degrade?.()) { measure(); return; }
    retire();
  }
  let retired = false;
  function retire() {
    retired = true;
    cancelAnimationFrame(raf); raf = 0;
    target.remove();
    renderer.destroy();
    section.classList.remove('is-weaving');
    document.documentElement.dataset.weaveTier = 'static';
  }

  function draw() {
    if (retired) return;
    const ph = phases(progress, intro);
    const t0 = performance.now();
    renderer.render(ph);
    watch(performance.now() - t0);
    section.style.setProperty('--caption', ph.caption.toFixed(3));
    section.style.setProperty('--intro-out', ph.introOut.toFixed(3));
    section.style.setProperty('--label-in', ph.labelIn.toFixed(3));
    // Once the title has gone, it must not catch clicks meant for the scene.
    introEl?.toggleAttribute('data-gone', ph.introOut > 0.95);
  }

  // Scroll sets the goal; this loop eases towards it and stops when it
  // arrives, so nothing renders while the page is still.
  function tick(now) {
    const d = goal - progress;
    progress = Math.abs(d) < 0.0005 ? goal : progress + d * 0.2;
    // Load intro: 1.4s ease-out from loose to tight, whatever the scroll does.
    if (intro < 1) {
      if (!introT0) introT0 = now;
      const k = Math.min(1, (now - introT0) / 1400);
      intro = 0.55 + 0.45 * (1 - Math.pow(1 - k, 3));
    }
    draw();
    raf = progress === goal && intro >= 1 ? 0 : requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf && !retired) raf = requestAnimationFrame(tick); };

  // WebGL context lost (tab backgrounded on a phone, GPU reset): swap the
  // canvas for a fresh one running the Canvas 2D tier, at the same progress.
  function demote() {
    const fresh = document.createElement('canvas');
    fresh.className = 'weave__canvas';
    fresh.setAttribute('aria-hidden', 'true');
    const next = createCanvas(fresh, img);
    if (!next) { target.remove(); section.classList.remove('is-weaving'); return; }
    target.replaceWith(fresh);
    target = fresh;
    renderer = next;
    document.documentElement.dataset.weaveTier = renderer.kind;
    measure(); draw();
  }

  const headH = () => document.querySelector('.site-head')?.offsetHeight ?? 0;
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    stage.prepend(target);
    section.classList.add('is-weaving');
    measure();
    draw();
    kick();                                        // starts the load intro

    const st = ScrollTrigger.create({
      trigger: stage,
      start: () => `top ${headH()}px`,
      // 3 beats x beatPx(): desktop 3 x 700 = 2100px, phone 3 x 420 = 1260px.
      //   beat 1: the title lifts; the full-bleed photo contracts into its frame
      //           while the durrie is woven in around it
      //   beat 2: the label arrives; the photo resolves from threads to detail
      //   beat 3: the caption holds; the rug's weft withdraws into the next section
      end: () => '+=' + BEATS * beatPx(),
      pin: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => { goal = self.progress; kick(); },
      onRefresh: (self) => { if (retired) return; measure(); goal = progress = self.progress; draw(); },
    });

    return () => {
      st.kill();
      cancelAnimationFrame(raf); raf = 0;
      target.remove();
      section.classList.remove('is-weaving');
      for (const v of ['--caption', '--intro-out', '--label-in']) section.style.removeProperty(v);
    };
  });

  // The pin adds scroll length above everything else: re-measure all triggers
  // (including the thread's, if it loaded first). Fonts change the label's
  // height, which moves the frame, so measure again once they have loaded.
  ScrollTrigger.refresh();
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
