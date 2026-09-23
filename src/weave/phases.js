// The Weave's beat sheet, as a function of scroll progress p (0..1).
// Both tiers read these, so timing lives in one place.
//
// 3 beats, pinned:
//   beat 1 (0 → .33)  the weft shuttles through, row after row, over and
//                     under loose, mis-registered warp threads
//   beat 2 (.30 → .62) the threads tighten and slide into register: the
//                     photograph appears in the middle of the rug
//   beat 3 (.64 → 1)  the photo resolves to full detail and the caption
//                     arrives; then the rug's weft withdraws, leaving the warp
//                     threads that continue into the next section

// Smooth 0..1 ramp between a and b. Used on time only, never on space, so the
// C1 kink at its ends never shows as an edge in the image.
export const ramp = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function phases(p) {
  return {
    weft: ramp(p, 0.0, 0.33),
    tight: ramp(p, 0.3, 0.62),
    resolve: ramp(p, 0.64, 0.8),
    hand: ramp(p, 0.82, 1.0),
    caption: ramp(p, 0.72, 0.8),
    hint: 1 - ramp(p, 0.02, 0.1),
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
