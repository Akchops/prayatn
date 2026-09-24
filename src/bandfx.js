// The brushable header. On every inner page the header's background is the
// page photo woven at one thread per pixel (the .woven CSS background). With
// WebGL this module redraws that same weave on a canvas and lets you brush it:
// where the mouse or a finger passes, the pile is pushed along the stroke, the
// dark veil lifts off the dyed threads and they catch a marigold sheen, then
// everything settles back. After the page's opening lands, one stroke sweeps
// across by itself to show that it can be done. The photo card also leans a
// little towards the pointer.
//
// Loaded lazily from main.js, never with reduced motion. Without WebGL (or on
// a software renderer) nothing changes: the CSS background stays.
import { probeWebGL } from './weave/probe.js';

const N = 12;          // trail points (uniform arrays sized for the 64-vector minimum on phones)

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform sampler2D uTex;   // the weave image: one pixel per thread cell
uniform vec2 uSize;       // canvas size in CSS px
uniform float uDpr;       // device px per CSS px
uniform vec2 uGrid;       // the weave image's size in cells (160 x rows)
uniform float uT;         // one thread cell in CSS px (the --t custom property)
uniform vec2 uOff;        // where cell (0,0) starts, CSS px (the image is centred, as in CSS)
uniform float uR;         // brush radius, CSS px
uniform vec4 uP[${N}];    // trail: x, y (CSS px, y down), push x, push y (CSS px)
uniform float uA[${N}];   // trail strength 0..1

const vec3 INDIGO = vec3(0.118, 0.141, 0.251);
const vec3 SHEEN  = vec3(0.95, 0.72, 0.26);

void main() {
  // This pixel in CSS px, top-left origin like the page.
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;

  // The brush: each trail point pushes the pile near it along its stroke
  // (Gaussian falloff, so there is no hard edge) and lifts the veil there.
  vec2 push = vec2(0.0);
  float lift = 0.0;
  for (int i = 0; i < ${N}; i++) {
    vec2 d = p - uP[i].xy;
    float g = exp(-dot(d, d) / (2.0 * uR * uR)) * uA[i];
    push += uP[i].zw * g;
    lift += g;
  }
  lift = min(lift, 1.0);

  // Read the thread that has been pushed into this spot.
  vec2 q = (p - push - uOff) / uT;
  vec2 cell = floor(q);
  vec2 f = fract(q);
  vec2 uv = (mod(cell, uGrid) + 0.5) / uGrid;
  vec3 col = texture2D(uTex, uv).rgb;

  // Over and under: on alternate cells the warp (vertical) or the weft
  // (horizontal) thread is on top; each is rounded, bright along its middle.
  float warpOnTop = mod(cell.x + cell.y, 2.0);
  float across = warpOnTop > 0.5 ? f.x : f.y;
  float round1 = 1.0 - pow(abs(across - 0.5) * 2.0, 2.0);
  col *= 0.6 + 0.36 * round1;   // as dark on average as the CSS thread shading

  // The indigo veil the CSS lays over the weave (55% at the top to 72% at the
  // bottom), lifted where the brush has passed.
  float veil = mix(0.55, 0.72, clamp(p.y / uSize.y, 0.0, 1.0)) * (1.0 - 0.82 * lift);
  col = mix(col, INDIGO, veil);

  // Brushed pile catches the light along the tops of the threads.
  col += SHEEN * 0.2 * lift * round1;
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function start(band) {
  const caps = probeWebGL({ allowSoftware: /[?&]tier=1\b/.test(location.search) });
  if (!caps || caps.tier === 'low') return;

  const cs = getComputedStyle(band);
  const url = (cs.getPropertyValue('--weave-img').match(/url\(["']?([^"')]+)["']?\)/) || [])[1];
  if (!url) return;
  let img;
  try { img = await loadImage(url); } catch { return; }

  const canvas = document.createElement('canvas');
  canvas.className = 'band__gl';
  canvas.setAttribute('aria-hidden', 'true');
  let gl;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: !/[?&]tier=1\b/.test(location.search) });
  } catch { gl = null; }
  if (!gl) return;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (vs && fs) { gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); }
  if (!vs || !fs || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  // Not a power of two: no mipmaps, clamp, and read cell centres exactly.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const U = {};
  for (const n of ['uTex', 'uSize', 'uDpr', 'uGrid', 'uT', 'uOff', 'uR', 'uP', 'uA']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(U.uTex, 0);
  gl.uniform2f(U.uGrid, img.naturalWidth, img.naturalHeight);

  // The trail: slot 0 follows the resting mouse; the rest are recent strokes.
  const P = new Float32Array(N * 4), A = new Float32Array(N);
  let head = 1;
  let W = 0, H = 0, dpr = 1, t = 10;
  const size = () => {
    const r = band.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    t = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t')) || 10;
    gl.uniform2f(U.uSize, W, H);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uT, t);
    // background-position: center, as in the CSS.
    gl.uniform2f(U.uOff, (W - img.naturalWidth * t) / 2, (H - img.naturalHeight * t) / 2);
    gl.uniform1f(U.uR, Math.max(46, Math.min(W, H) * 0.09));
    draw();
  };
  const draw = () => {
    gl.uniform4fv(U.uP, P);
    gl.uniform1fv(U.uA, A);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Strokes.
  let last = null, hovering = false, raf = 0;
  const addPoint = (x, y) => {
    let dx = 0, dy = 0;
    if (last) { dx = x - last.x; dy = y - last.y; }
    const len = Math.hypot(dx, dy);
    if (last && len < 3) return;
    const k = len > 26 ? 26 / len : 1;
    const i = head * 4;
    P[i] = x; P[i + 1] = y; P[i + 2] = dx * k * 0.9; P[i + 3] = dy * k * 0.9;
    A[head] = 1;
    head = head + 1 >= N ? 1 : head + 1;
    last = { x, y };
  };
  const hover = (x, y) => { P[0] = x; P[1] = y; P[2] = 0; P[3] = 0; };
  const step = () => {
    raf = 0;
    let live = false;
    for (let i = 1; i < N; i++) { A[i] *= 0.955; if (A[i] < 0.01) A[i] = 0; else live = true; }
    A[0] += ((hovering ? 0.75 : 0) - A[0]) * 0.12;
    if (A[0] > 0.01) live = true; else A[0] = 0;
    draw();
    if (live || sweeping) raf = requestAnimationFrame(step);
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(step); };

  const local = (cx, cy) => { const r = band.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
  band.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = local(e.clientX, e.clientY);
    hovering = true; hover(x, y); addPoint(x, y); wake();
    tilt(x, y);
  });
  band.addEventListener('pointerleave', () => { hovering = false; last = null; wake(); tilt(null); });
  // Touch: a finger brushes it while the page scrolls (passive, never blocks).
  band.addEventListener('touchmove', (e) => {
    const tt = e.touches[0];
    if (!tt) return;
    const [x, y] = local(tt.clientX, tt.clientY);
    addPoint(x, y); wake();
  }, { passive: true });
  band.addEventListener('touchend', () => { last = null; }, { passive: true });

  // The photo card leans towards the mouse.
  const pic = band.querySelector('.band__card picture');
  const tilt = (x, y) => {
    if (!pic) return;
    if (x === null) { pic.style.transform = ''; return; }
    const r = pic.getBoundingClientRect(), b = band.getBoundingClientRect();
    const nx = ((x + b.left) - (r.left + r.width / 2)) / b.width, ny = ((y + b.top) - (r.top + r.height / 2)) / b.height;
    pic.style.transform = `perspective(900px) rotateY(${(nx * 7).toFixed(2)}deg) rotateX(${(-ny * 6).toFixed(2)}deg)`;
  };

  // One stroke across by itself, once the header is on show.
  let sweeping = false;
  const sweep = () => {
    if (hovering) return;
    sweeping = true; last = null;
    const t0 = performance.now(), dur = 1500;
    const go = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      addPoint(W * (-0.05 + 1.1 * e), H * (0.62 + 0.16 * Math.sin(e * Math.PI * 2)));
      wake();
      if (k < 1) requestAnimationFrame(go); else { sweeping = false; last = null; }
    };
    requestAnimationFrame(go);
  };

  // Swap the CSS background for the canvas.
  band.prepend(canvas);
  band.classList.add('band--gl');
  size();
  addEventListener('resize', size);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    canvas.remove();
    band.classList.remove('band--gl');
  });

  const root = document.documentElement;
  const later = () => setTimeout(sweep, 500);
  if (root.classList.contains('opening')) {
    const mo = new MutationObserver(() => { if (!root.classList.contains('opening')) { mo.disconnect(); later(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  } else later();
}
