# QA report: Prayatn, "The Durrie"

Run on 2026-09-23 against the production build (`npm run build`, served by
`vite preview`) in headless Chromium 1194. Evidence frames are in `docs/qa/`;
the full 54-capture run is reproduced by
`node scripts/motion-qa.mjs http://localhost:4173 --out ./qa-run --settle 1000`.

## immersive-motion-qa

```
VERDICT: PASS
SIGNATURE: 2 — An object assembling under scroll. "The Weave": the hero photograph (uploads/gallery-81.jpg, a Mahila Panchayat circle) is woven from its own ikat-dyed threads under pinned scroll. Loose, mis-registered warp threads, then the weft shuttling through row by row in a chevron twill, then the threads tightening and sliding into register until the photo resolves. The rug's weft then withdraws, and the bare warp continues as the threads of the next section. — Home, first screen (section.weave, pinned 3 × beatPx) — docs/qa/weave-320-webgl.jpg and docs/qa/weave-320-canvas2d.jpg: eight captures at 0, 15, 30, 45, 60, 72, 85 and 100% of the pin, each a different mid-assembly state of the same element; matrix frames laptop/0pct vs laptop/12_5pct (loose warp → half-woven photo) and modern-phone/0pct vs 12_5pct.
MATRIX: 54/54 captured, console clean, network clean (0 console errors, 0 page errors, 0 failed requests, 0 warnings)
REDUCED MOTION: No pin and no canvas. The finished composition is shown statically: the photo on the woven rug with its caption and all text. Visible text 2,646 chars and 15 images, identical to the no-WebGL pass. The thread line is drawn in full. docs/qa/reduced-motion-390.jpg.
NO WEBGL: Tier 2 (Canvas 2D) renders the same assembly behaviour. Console clean, no black rectangle. docs/qa/no-webgl-390.jpg. A forced WEBGL_lose_context mid-scroll hands tier 1 over to tier 2 at the same progress with no errors (docs/qa/boundary-and-context-loss-320.jpg, right).
NO JS: Every heading, paragraph, photo, label, phone number, email and the donate text is present and readable. The hero shows the static rug with the photo (tier 3, in the HTML). docs/qa/no-js-390.jpg.
320px: The signature runs in full at 320×568 in both tier 1 (WebGL) and tier 2 (Canvas 2D), with the label, the frame (288×187) and the caption all inside the pinned viewport. Captured at eight pin positions per tier (docs/qa/weave-320-*.jpg). The pin releases into the next section with the warp threads continuing across the boundary (docs/qa/boundary-and-context-loss-320.jpg, left).
```

## web-visual-qa punch list

**P0: broken.** None open.

**P1: fixed during QA**
- The woven borders on the photos read as cheap dashed lines. Photos are now shown plain.
- The desktop mosaics overlapped photos through negative margins. They were re-laid out with no collisions.
- The woven "1992" was illegible at phone widths. It now uses finer threads (.045em) plus an indigo edge.
- A health photo (#03) showed the clinic signboard naming a supporter. It is now cropped (the owner asked for supporters to stay unnamed).
- The rani thread line broke into segments in Chromium (non-scaling-stroke vs pathLength). It is now a scaled element.
- The handoff seam: the canvas warp was 60% wide while the CSS warp was 80%. All three are now 60%.
- Contrast: the contact-tile labels (4.36:1) and the "03" label (4.03:1) are now 5.5:1.

**P2: polish, open**
- A full scroll on a phone moves about 720 kB, 583 kB of it images. That is 15 photos at DPR 2.6. Serving smaller candidates to phones would cut it further.
- Several photos are soft at their largest mosaic size (for example #51, 713px wide). They are capped at native width and never upscaled, but they are phone snapshots.
- `vite preview` serves index.html for unknown URLs. On the real host, point 404s at `/404.html`.

**P3: later**
- A Hindi version (Hind already carries Devanagari).
- School figures from the yearly report, once supplied.

Checked and passing:
- Tab order: skip link, then wordmark, nav, Donate.
- Visible focus rings.
- One `h1` per page, landmarks, and alt text on every photo.
- Titles and descriptions on every page.
- No horizontal overflow at 320px or at 1920px.
- All internal links return 200.

## Page weight

| | Phone 390×844 (DPR 2.6) | Laptop 1440×900 |
|---|---|---|
| **First load (gate): HTML + render-blocking CSS + entry JS, gzip** | **10.0 kB** (limit 100 kB) | same |
| First view, everything on the wire | 357 kB (images 221, fonts 73, lazy JS 54, HTML/CSS 9) | 384 kB |
| After scrolling the whole page | 720 kB | 522 kB |

GSAP + ScrollTrigger (45 kB gzip) and the weave renderers (6.6 kB) are dynamic
imports and never load under reduced motion. The site does not use three.js at all.

## immersive-scroll-engineer delivery report

```
SCENES
  The Weave — 3 beats x beatPx() = 2100px desktop / 1260px phone, pinned. beatPx = min(700 | 420 on <768px, 0.9 x viewport height). Reason: one readable change per beat (the shuttle, the tightening, the resolve and withdraw); a phone gets 60% because a thumb fling covers more distance.
BOUNDARIES
  Weave -> "Looking for us?": the warp threads left when the weft withdraws are the same pitch (--t) as the CSS warp lines at the top of the next section, which fade into it. Shared element across the boundary.
  Our work (health -> school -> women): one rani thread, scaled by scroll, runs through all three.
  Remaining boundaries (work -> since 1992 -> ways in -> footer) are ordinary section breaks. The brief asks the spectacle to get out of the way after the signature.
REDUCED MOTION
  No pin, no canvas, no GSAP download. The static rug + photo + caption, every fact present (text and image counts identical to the animated run).
NO-JS
  Base CSS hides nothing. The hero is the photo on rug.svg; everything is readable (verified: docs/qa/no-js-390.jpg).
320px
  Verified: yes. Label, frame and caption fit inside the 526px pinned stage; the frame is sized from svh so the URL bar can't resize the pin.
REAL-TIME VS PRE-RENDERED
  Real-time by choice (approved in Phase 2). The output depends only on scroll, but it is a flat 2D effect: one texture and one fragment shader, about 3 kB. Pre-rendering would ship 1–2 MB of frames over mobile data and need re-encoding per aspect ratio.
SEQUENCE BUDGETS
  No frame sequences.
UNVERIFIED
  Tier 1 (WebGL) frame rate on a real mid-range Android: this machine has no GPU, so the p95 >= 55fps gate has not been measured for tier 1. SwiftShader figures are not a proxy.
  Measured instead: tier 2 holds 60fps unthrottled and at 2x CPU throttling (p95 16.7ms). At 4x it can't, and the watchdog steps it down (25 -> 9 samples per thread), then retires it to the static hero, so scrolling stays at 60fps but the animation is lost on that device class.
  The same watchdog guards tier 1: if drawing averages over 12ms, the weave retires to the static hero rather than stutter.
  To close this: open the preview on a Pixel 6a / Galaxy A54-class phone with remote debugging and record a Performance trace through the pin.
```

## webgl-shader-interaction-engineer delivery report

```
EFFECT        A photograph that only appears once its own threads are woven tight and slid into register.
TIER 1        Raw WebGL1, one full-screen triangle, src/weave/weave-gl.js. Uniforms: uRes, uDpr, uStage, uT, uFrame, uTex, uWeft, uTight, uResolve, uHand.
TIER 2        Canvas 2D (src/weave/weave-canvas.js): same shuttle, tightening, ikat registration, resolve and withdraw, computed at 5x5 (or 3x3) samples per thread and scaled up.
TIER 3        uploads/gallery-81 as <picture> inside .weave__frame on the CSS rug, in the HTML unconditionally, carrying the alt text.
PROBE         src/weave/probe.js: constructor check, try/catch getContext, failIfMajorPerformanceCaveat, renderer string, WEBGL_lose_context release. Silent on no-WebGL: yes (no-webgl pass, 0 warnings).
BUDGET        10.0 kB gzip first load (limit 100 kB), from scripts/first-load-budget.mjs.
GLSL          src/weave/weave-gl.js. Every uniform, constant and term is commented.
TRAPS         #1 lattice: no noise field (per-thread hash only). #2 flat-top: thread roundness is a half-sine, never a plateau. #3 clamp crease: the clamp only bounds sin()'s input at the thread edge, where the thread ends anyway.
CONTEXT LOSS  Tested by forcing loseContext(): yes. Hands over to tier 2 at the same progress, console clean.
320px         Verified: yes, both tiers.
```

## Photos still needing consent (see docs/ASSET-MANIFEST.md)

All 15 photos on the site show identifiable people. **Nine of them show
children.** The hero, `uploads/gallery-81.jpg`, comes first: it shows six women
and two young children.
