// The Weave's beat sheet. Both tiers and the DOM layers read these, so timing
// lives in one place.
//
// On load (time, ~1.4s): the full-bleed photo's threads close up and slide
// into register behind the PRAYATN title.
//
// Then 3 beats, pinned, driven by scroll progress p (0..1):
//   beat 1 (0 → .42)  the title lifts away; the photo contracts from full-bleed
//                     to its native-size frame while the durrie is woven in
//                     around it, row by row
//   beat 2 (.42 → .7) the "Many hands. One floor." label arrives; the photo
//                     resolves from threads to full detail; the caption lands
//   beat 3 (.8 → 1)   the rug's weft withdraws, leaving the warp threads that
//                     continue into the next section

// Smooth 0..1 ramp between a and b. Used on time only, never on space, so the
// C1 kink at its ends never shows as an edge in the image.
export const ramp = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function phases(p, intro = 1) {
  return {
    tight: intro,
    shrink: ramp(p, 0.04, 0.42),
    weft: ramp(p, 0.1, 0.46),
    dim: 0.45 + 0.55 * ramp(p, 0.0, 0.3),
    resolve: ramp(p, 0.46, 0.62),
    hand: ramp(p, 0.82, 1.0),
    // DOM layers
    introOut: ramp(p, 0.0, 0.2),
    labelIn: ramp(p, 0.38, 0.52),
    caption: ramp(p, 0.6, 0.68),
  };
}

export const BEATS = 3;

// Scroll distance per beat. Desktop 700px is a single big readable change per
// beat (below ~350px a wheel flick skips it); phones get 60% because a thumb
// fling covers far more document px. Never more than 90% of the viewport, so a
// short landscape screen doesn't feel frozen.
export const beatPx = () =>
  Math.round(Math.min(window.innerWidth < 768 ? 420 : 700, window.innerHeight * 0.9));

// Per-thread pseudo-random value in [0,1): the ikat mis-registration of each
// thread. Same formula as the shader's hash().
export const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
