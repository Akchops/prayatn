// Tier 1: The Weave in raw WebGL. One full-screen triangle, one fragment
// shader, one texture: the hero photograph. No library.
//
// Every pixel works out which thread it lies on (warp = vertical, weft =
// horizontal), which of the two is on top (chevron twill, like a durrie), and
// what colour that thread is dyed. Inside the photo's frame the threads are
// ikat-dyed with the photograph itself, so the picture only appears when the
// threads are pulled tight and slid into register.

const VERT = `
attribute vec2 aPos;
void main() {
  // aPos spans -1..3, so one triangle overshoots and covers the whole viewport.
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;   // mediump steps visibly across a 1000px-wide photo
#else
precision mediump float;
#endif

uniform vec2 uRes;       // canvas size in device px
uniform float uDpr;      // device px per CSS px
uniform vec2 uStage;     // stage size in CSS px
uniform float uT;        // thread width in CSS px (the --t custom property)
uniform vec4 uFrame;     // the photo's final frame in CSS px, top-left origin: x, y, w, h
uniform vec4 uCover;     // the photo scaled to cover the whole stage (the opening frame)
uniform sampler2D uTex;  // the photograph, uploaded with FLIP_Y

uniform float uShrink;   // 0..1 beat 1: the photo contracts from uCover to uFrame
uniform float uDim;      // brightness of the photo, low behind the opening title

uniform float uWeft;     // 0..1 beat 1: how far the rug's shuttle has travelled around the photo
uniform float uTight;    // 0..1 on load: the photo's threads close up and slide into register
uniform float uResolve;  // 0..1 beat 3: thread texture dissolves to the full photo
uniform float uHand;     // 0..1 beat 3 end: weft withdraws outside the frame

// The palette. Must match src/weave/pattern.js and main.css.
const vec3 KHADI    = vec3(0.953, 0.925, 0.875);  // #F3ECDF warp
const vec3 INDIGO   = vec3(0.118, 0.141, 0.251);  // #1E2440 main weft
const vec3 MARIGOLD = vec3(0.886, 0.627, 0.098);  // #E2A019
const vec3 RANI     = vec3(0.761, 0.184, 0.400);  // #C22F66
const vec3 NEEM     = vec3(0.114, 0.431, 0.384);  // #1D6E62
const vec3 GROUND   = vec3(0.118, 0.141, 0.251);  // gaps between threads show the indigo ground
const vec3 WARP_OUT = vec3(0.851, 0.820, 0.757);  // #D9D1C1 the warp colour of the band below the hero

const float PI = 3.14159265;

// Per-thread random number in [0,1). Indexed by thread number, not by pixel,
// so it is constant along a thread; it is not a noise field and cannot show
// a lattice.
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

// Weft colour by row: broad indigo with single accent picks every 20 rows.
vec3 rowColor(float j) {
  float r = mod(j, 20.0);
  if (abs(r - 7.0) < 0.5) return MARIGOLD;
  if (abs(r - 10.0) < 0.5) return RANI;
  if (abs(r - 17.0) < 0.5) return NEEM;
  return INDIGO;
}

// Chevron twill: a 2/2 twill steps one column per row, drawing diagonals;
// the diagonal direction flips every 8 columns, which makes the zig-zag.
bool warpOnTop(float i, float j) {
  float flip = mod(floor(i / 8.0), 2.0) < 0.5 ? 1.0 : -1.0;
  return mod(i + flip * j, 4.0) < 2.0;
}

// The photo's current rect: full-bleed at the start, its native-size frame
// by the end of beat 1.
vec4 rect() { return mix(uCover, uFrame, uShrink); }

// The photograph at a CSS-px position on the stage. Positions outside the
// rect are clamped to its edge, so displaced threads never sample garbage.
vec3 photo(vec2 p) {
  vec4 r = rect();
  vec2 uv = clamp((p - r.xy) / r.zw, 0.0, 1.0);
  return texture2D(uTex, vec2(uv.x, 1.0 - uv.y)).rgb;   // 1-y: texture was flipped on upload
}

void main() {
  // This pixel in CSS px with a top-left origin, so it lines up with the DOM
  // rug (rug.svg tiled from the section's top-left) and the frame rect.
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;

  // Which thread cell we are in (i = column, j = row), and where inside it.
  vec2 cell = floor(p / uT);
  vec2 f = fract(p / uT);
  float i = cell.x;
  float j = cell.y;

  vec4 r = rect();
  bool inFrame = p.x >= r.x && p.y >= r.y && p.x < r.x + r.z && p.y < r.y + r.w;

  // Thread width as a fraction of its cell. Loose threads (0.42) leave the
  // ground visible between them; at 1.0 neighbours touch and the cloth is
  // closed. The photo's threads close on load; the rug's are always closed. Outside the frame the warp relaxes to 0.6 as the weft leaves, to
  // match the warp lines drawn in CSS below the hero.
  float width = inFrame ? mix(0.42, 1.0, uTight) : 1.0;
  float warpWidth = inFrame ? width : mix(1.0, 0.6, uHand);

  // Position across each thread, 0..1 from edge to edge; outside 0..1 means
  // this pixel is in the gap beside the thread.
  float wx = (f.x - 0.5) / warpWidth + 0.5;
  float wy = (f.y - 0.5) / width + 0.5;
  bool onWarp = wx > 0.0 && wx < 1.0;
  bool onWeftBody = wy > 0.0 && wy < 1.0;

  // The shuttle. Each row starts later the further down it is (0..0.6 of the
  // beat), then crosses the stage left to right in the remaining time.
  float rows = max(uStage.y / uT, 1.0);
  float delay = (j / rows) * 0.6;
  float head = clamp((uWeft - delay) / 0.4, 0.0, 1.0);
  bool weftHere = p.x < head * uStage.x;

  // Outside the frame the weft withdraws again at the end, right to left, top
  // rows first, leaving bare warp to carry into the next section. Inside the
  // photo's rect the weft is always there: the photo is cloth from the start.
  float away = clamp((uHand - delay * 0.5) / 0.7, 0.0, 1.0);
  if (!inFrame) weftHere = weftHere && p.x < (1.0 - away) * uStage.x;
  else weftHere = true;
  bool onWeft = onWeftBody && weftHere;

  // Ikat mis-registration. Each thread's dye is shifted along its length by a
  // random amount that shrinks to zero as the cloth tightens, so the picture
  // starts as scattered colour and only lines up at the end of beat 2.
  float amp = (1.0 - uTight) * r.w * 0.25;
  float warpShift = (hash(i + 1.0) - 0.5) * amp;
  float weftShift = (hash(j + 101.0) - 0.5) * amp;

  // Thread dye. Inside the frame a warp thread carries the photo's column
  // through its centre line, a weft thread its row. Outside, the durrie.
  vec3 warpCol = inFrame ? photo(vec2((i + 0.5) * uT, p.y + warpShift))
                         : mix(KHADI, WARP_OUT, uHand);
  vec3 weftCol = inFrame ? photo(vec2(p.x + weftShift, (j + 0.5) * uT))
                         : rowColor(j);

  // Roundness. A half sine across the thread: 1 at its centre, 0.72 at its
  // edges. It is curved everywhere and has no plateau and no clamp, so there
  // is no crease line along the thread (known trap #2 and #3).
  float warpShade = 0.72 + 0.28 * sin(PI * clamp(wx, 0.0, 1.0));
  float weftShade = 0.72 + 0.28 * sin(PI * clamp(wy, 0.0, 1.0));

  // Over or under. Where both threads cover the pixel the twill decides;
  // where only one does, it shows; where neither does, the ground shows.
  vec3 col = GROUND;
  float shade = 1.0;
  if (onWarp && onWeft) {
    bool top = warpOnTop(i, j);
    col = top ? warpCol : weftCol;
    shade = top ? warpShade : weftShade;
  } else if (onWarp) {
    col = warpCol; shade = warpShade;
  } else if (onWeft) {
    col = weftCol; shade = weftShade;
  }

  // How much of the thread roundness to keep. Inside the frame it dissolves
  // as the photo resolves; outside, the bare warp goes flat to match the CSS.
  float keep = inFrame ? (1.0 - uResolve) : (1.0 - uHand);
  col *= mix(1.0, shade, keep);

  // The final step inside the frame: the thread-quantised picture becomes the
  // photograph itself, pixel for pixel. Only reached once the rect is at its
  // native size, so the sharp photo is never shown enlarged.
  if (inFrame) col = mix(col, photo(p), uResolve);

  // Darken the photo behind the opening title; lifts as the title leaves.
  if (inFrame) col *= uDim;

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    if (import.meta.env?.DEV) console.warn(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function create(canvas, img, { allowSoftware = false, onLost } = {}) {
  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      failIfMajorPerformanceCaveat: !allowSoftware,
      preserveDrawingBuffer: false,
    });
  } catch { return null; }
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const loc = {};
  for (const n of ['uRes', 'uDpr', 'uStage', 'uT', 'uFrame', 'uCover', 'uTex', 'uWeft', 'uTight', 'uResolve', 'uHand', 'uShrink', 'uDim']) {
    loc[n] = gl.getUniformLocation(prog, n);
  }

  // The photo. NPOT is legal in WebGL1 only with CLAMP_TO_EDGE, LINEAR and no
  // mipmaps; anything else renders black without an error.
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  } catch { return null; }
  gl.uniform1i(loc.uTex, 0);

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    // Without preventDefault the context can never come back. We hand over to
    // the Canvas 2D tier rather than wait: visible content now, not a black box.
    e.preventDefault();
    lost = true;
    onLost?.();
  });

  let geom = null;
  return {
    kind: 'webgl',
    resize(g) {
      geom = g;
      // Cap DPR at 1.5: thread edges stay crisp and fill cost stays low on
      // 3x phones, and the photo itself is only 1108px wide.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(g.width * dpr), h = Math.round(g.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      geom.dpr = w / g.width;
    },
    render(ph) {
      if (lost || !geom) return;
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform1f(loc.uDpr, geom.dpr);
      gl.uniform2f(loc.uStage, geom.width, geom.height);
      gl.uniform1f(loc.uT, geom.t);
      gl.uniform4f(loc.uFrame, geom.frame.x, geom.frame.y, geom.frame.w, geom.frame.h);
      gl.uniform4f(loc.uCover, geom.cover.x, geom.cover.y, geom.cover.w, geom.cover.h);
      gl.uniform1f(loc.uShrink, ph.shrink);
      gl.uniform1f(loc.uDim, ph.dim);
      gl.uniform1f(loc.uWeft, ph.weft);
      gl.uniform1f(loc.uTight, ph.tight);
      gl.uniform1f(loc.uResolve, ph.resolve);
      gl.uniform1f(loc.uHand, ph.hand);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      try {
        gl.deleteTexture(tex); gl.deleteBuffer(buf); gl.deleteProgram(prog);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch { /* already gone */ }
    },
  };
}
