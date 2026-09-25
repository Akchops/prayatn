// The Loom, tier 1: the whole photo field in one fragment shader and one
// texture (the atlas). The field bends like cloth when dragged, the tile under
// the pointer lifts, filters dim other programmes, and on arrival the tiles
// are woven in from the centre outwards.

const VERT = `
attribute vec2 aPos;
void main() {
  // One triangle overshooting the viewport (aPos spans -1..3) covers it all.
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;   // field coordinates run to tens of thousands of px
#else
precision mediump float;
#endif

uniform vec2 uRes;        // canvas size, device px
uniform float uDpr;       // device px per CSS px
uniform vec2 uOff;        // pan offset of the field, CSS px
uniform vec2 uVel;        // smoothed pan velocity, CSS px per frame
uniform vec2 uPtr;        // pointer position on the stage, CSS px
uniform vec3 uTile;       // tile width, tile height, gap (CSS px)
uniform vec2 uGrid;       // atlas columns, rows
uniform float uCount;     // number of photos
uniform sampler2D uAtlas; // every photo as a 4:3 tile, uploaded with FLIP_Y
uniform vec2 uHover;      // cell under the pointer (cx, cy)
uniform float uHoverAmt;  // 0..1 how lifted that cell is
uniform vec4 uCat[24];    // programme of each photo (0 health .. 3 events), 4 per vec4:
                          // 24 vectors (96 photos), not 96 - iPhones allow only 64 in total
uniform float uSel;       // selected programme, or -1 for all
uniform float uSelAmt;    // 0..1 how far the filter has faded in
uniform float uIntro;     // 0..1 weave-in on arrival

const vec3 INDIGO   = vec3(0.118, 0.141, 0.251);  // #1E2440 ground
const vec3 WARP     = vec3(0.204, 0.235, 0.384);  // #343C62 vertical threads
const vec3 MARIGOLD = vec3(0.886, 0.627, 0.098);  // #E2A019
const vec3 RANI     = vec3(0.761, 0.184, 0.400);  // #C22F66
const vec3 NEEM     = vec3(0.114, 0.431, 0.384);  // #1D6E62
const vec3 KHADI    = vec3(0.953, 0.925, 0.875);  // #F3ECDF frame of a lifted tile

// Per-cell random number in [0,1): constant across a tile, so it cannot draw
// a lattice inside one (known trap #1 does not arise).
float hash(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }

// The programme of photo i. WebGL1 cannot index a uniform array with a
// non-constant, so walk the 24 vectors (constant bound) and pick the one
// holding photo i, then the component i mod 4 within it.
float catOf(float i) {
  float slot = floor(i / 4.0), lane = i - slot * 4.0;
  vec4 v = vec4(0.0);
  for (int k = 0; k < 24; k++) { if (float(k) == slot) v = uCat[k]; }
  return lane < 0.5 ? v.x : (lane < 1.5 ? v.y : (lane < 2.5 ? v.z : v.w));
}

// Weft colour for the gap under row cy: marigold, rani, neem in turn.
vec3 weft(float cy) {
  float r = mod(cy, 3.0);
  return r < 0.5 ? MARIGOLD : (r < 1.5 ? RANI : NEEM);
}

void main() {
  // This pixel in stage CSS px, top-left origin.
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 stage = uRes / uDpr;
  vec2 centre = stage * 0.5;

  // Cloth. Near the pointer the field follows the hand exactly; further away
  // it lags behind the motion, as cloth does when pulled. lag rises from 0 at
  // the pointer to 1 far away along a Gaussian: smooth everywhere, no ring.
  float d = length(p - uPtr);
  float R = max(stage.x, stage.y) * 0.45;
  float lag = 1.0 - exp(-(d * d) / (R * R));
  vec2 q = p - uVel * 9.0 * lag;

  // Moving fast pulls the camera back a little (up to 12%), and the arrival
  // starts slightly further back too.
  float zoom = 1.0 + min(length(uVel) * 0.006, 0.12) + (1.0 - uIntro) * 0.18;
  q = (q - centre) * zoom + centre + uOff;

  // Which cell: pitch = tile + gap; odd rows shifted half a tile (bricks).
  vec2 pitch = uTile.xy + uTile.z;
  float cy = floor(q.y / pitch.y);
  float sx = q.x + mod(cy, 2.0) * 0.5 * pitch.x;
  float cx = floor(sx / pitch.x);
  vec2 f = vec2(sx - cx * pitch.x, q.y - cy * pitch.y);   // px inside the cell
  vec2 cell = vec2(cx, cy);

  // Arrival: tiles weave in from the centre outwards, each with its own delay.
  float far = length((cell + 0.5) * pitch - (centre + uOff)) / length(stage);
  float t = clamp(uIntro * 2.2 - far * 1.4 - hash(cell) * 0.35, 0.0, 1.0);
  float appear = t * t * (3.0 - 2.0 * t);

  // The gap: the rug. Horizontal gaps carry a coloured weft thread; vertical
  // gaps a warp thread; where they cross, over and under alternate.
  bool inX = f.x < uTile.x, inY = f.y < uTile.y;
  vec3 col = INDIGO;
  if (!inY) {
    // A thin weft thread along the middle of the horizontal gap. Gaussian
    // across its width (sigma 14% of the gap): no plateau, no edge (trap #2).
    float w = (f.y - uTile.y) / uTile.z - 0.5;
    col = mix(INDIGO, weft(cy), 0.55 * exp(-(w * w) / (2.0 * 0.14 * 0.14)));
  }
  if (!inX) {
    float w = (f.x - uTile.x) / uTile.z - 0.5;
    vec3 warp = mix(INDIGO, WARP * 1.25, exp(-(w * w) / (2.0 * 0.16 * 0.16)));
    // At a crossing the warp is on top in alternate cells.
    if (inY || mod(cx + cy, 2.0) < 0.5) col = warp;
  }

  if (inX && inY) {
    float idx = mod(cx * 7.0 + cy * 29.0, uCount);
    vec2 uv = f / uTile.xy;

    // Lift: the hovered tile's photo zooms in a touch and gets a khadi frame.
    float lift = (cell == uHover) ? uHoverAmt : 0.0;
    vec2 c = uv - 0.5;
    uv = 0.5 + c * (1.0 - 0.07 * lift);

    // Weave-in: a tile arrives as threads that thicken (like the page
    // headers) and shrinks into place from 8% larger.
    uv = 0.5 + (uv - 0.5) * (1.0 + 0.08 * (1.0 - appear));
    vec2 thread = fract(f / 6.0);
    float open = step(1.0 - appear, max(thread.x, thread.y)) ;

    float colx = mod(idx, uGrid.x), rowy = floor(idx / uGrid.x);
    vec2 auv = vec2((colx + uv.x) / uGrid.x, 1.0 - (rowy + uv.y) / uGrid.y);
    vec3 photo = texture2D(uAtlas, auv).rgb;

    // A faint thread texture over every photo, so the field reads as cloth.
    photo *= 0.965 + 0.035 * sin(f.x * 1.2) * sin(f.y * 1.2);

    // Filter: photos from other programmes fade to dim indigo-grey.
    float other = (uSel >= 0.0 && abs(catOf(idx) - uSel) > 0.5) ? uSelAmt : 0.0;
    float grey = dot(photo, vec3(0.299, 0.587, 0.114));
    photo = mix(photo, mix(INDIGO, vec3(grey), 0.22), other * 0.92);

    // While something is hovered, everything else dims slightly.
    photo *= 1.0 - 0.18 * uHoverAmt * (1.0 - lift);

    // Frame of the lifted tile: 3px of khadi inside its edge.
    vec2 e = min(f, uTile.xy - f);
    float frame = step(min(e.x, e.y), 3.0) * lift;
    photo = mix(photo, KHADI, frame);

    col = mix(col, photo, open);
  }

  // Vignette: the field darkens towards the edges of the stage, so the eye
  // rests in the middle. Smooth power curve on the normalised distance.
  vec2 e2 = (p - centre) / (stage * 0.5);
  float v = clamp(length(e2) / 1.35, 0.0, 1.0);
  col *= 1.0 - 0.5 * pow(v, 2.2);

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

export function create(canvas, atlasImg, meta, { allowSoftware = false, onLost } = {}) {
  let gl;
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: !allowSoftware });
  } catch { return null; }
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    // Release this canvas's context so the caller can fall back cleanly.
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ }
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const L = {};
  for (const n of ['uRes', 'uDpr', 'uOff', 'uVel', 'uPtr', 'uTile', 'uGrid', 'uCount', 'uAtlas', 'uHover', 'uHoverAmt', 'uCat', 'uSel', 'uSelAmt', 'uIntro']) L[n] = gl.getUniformLocation(prog, n);

  // The atlas. NPOT: CLAMP_TO_EDGE + LINEAR + no mipmaps, or it renders black.
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImg); } catch { return null; }
  gl.uniform1i(L.uAtlas, 0);
  gl.uniform2f(L.uGrid, meta.cols, meta.rows);
  gl.uniform1f(L.uCount, meta.count);
  const cats = new Float32Array(96);   // room for 96 photos (see uCat)
  meta.tiles.forEach((t, i) => { cats[i] = t.cat; });
  gl.uniform4fv(L.uCat, cats);

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; onLost?.(); });

  let dpr = 1;
  return {
    kind: 'webgl',
    resize(w, h) {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      dpr = canvas.width / w;
    },
    render(s) {
      if (lost) return;
      gl.uniform2f(L.uRes, canvas.width, canvas.height);
      gl.uniform1f(L.uDpr, dpr);
      gl.uniform2f(L.uOff, s.ox, s.oy);
      gl.uniform2f(L.uVel, s.vx, s.vy);
      gl.uniform2f(L.uPtr, s.px, s.py);
      gl.uniform3f(L.uTile, s.tile.w, s.tile.h, s.tile.gap);
      gl.uniform2f(L.uHover, s.hover ? s.hover.cx : 1e6, s.hover ? s.hover.cy : 1e6);
      gl.uniform1f(L.uHoverAmt, s.hoverAmt);
      gl.uniform1f(L.uSel, s.sel);
      gl.uniform1f(L.uSelAmt, s.selAmt);
      gl.uniform1f(L.uIntro, s.intro);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() { try { gl.deleteTexture(tex); gl.deleteBuffer(buf); gl.deleteProgram(prog); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* gone */ } },
  };
}
