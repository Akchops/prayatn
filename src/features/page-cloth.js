// Feature (switch: site.json features.pageCloth). The page as a piece of cloth.
// Arriving (following a link here, or opening the home page), the page lies
// under a woven durrie that is taken by the middle of its top edge and pulled
// up and away; it gathers into folds as it goes, and the page is revealed.
// Leaving by a link, the durrie drops back over the page, rippling, and the
// next page opens from under it.
//
// The cloth is simulated (Verlet points joined by stretch, shear and bend
// springs) and drawn with plain WebGL, lit so that its folds show. Without
// WebGL the cover simply slides up. Never with reduced motion; the inline
// script in <head> decides whether to cover the page before it paints.
import { probeWebGL } from '../weave/probe.js';

const KEY = 'pc';
const COLORS = { indigo: [30, 36, 64], khadi: [243, 236, 223], marigold: [226, 160, 25], rani: [194, 47, 102], neem: [29, 110, 98] };
const rgb = (c, a = 1) => `rgba(${COLORS[c].join(',')},${a})`;

// ---------- the durrie, drawn once onto a canvas ----------
function weaveTexture(name, aspect) {
  const W = 1024, H = Math.round(W / aspect);
  const c = document.createElement('canvas');
  c.width = W; c.height = Math.min(H, 2400);
  const h = c.height;
  const x = c.getContext('2d');
  x.fillStyle = rgb('indigo'); x.fillRect(0, 0, W, h);
  // Over-and-under weave, thread by thread.
  // Fine threads: warp and weft, each a little uneven.
  for (let yy = 0; yy < h; yy += 3) {
    x.fillStyle = `rgba(255,255,255,${0.018 + Math.random() * 0.03})`;
    x.fillRect(0, yy, W, 1);
  }
  for (let xx = 0; xx < W; xx += 3) {
    x.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`;
    x.fillRect(xx, 0, 1, h);
  }
  // Striped ends, as on a durrie, with a fringe below.
  const band = (y0, dir) => {
    const seq = ['marigold', 'indigo', 'rani', 'indigo', 'neem', 'indigo', 'khadi'];
    let y = y0;
    seq.forEach((k, i) => {
      const hh = [22, 8, 16, 8, 16, 8, 6][i];
      x.fillStyle = rgb(k, k === 'indigo' ? 1 : .92);
      x.fillRect(0, dir > 0 ? y : y - hh, W, hh);
      y += dir * hh;
    });
    // A row of small diamonds between the stripes.
    x.fillStyle = rgb('khadi', .8);
    const yd = y0 + dir * 150;
    for (let xx = 24; xx < W; xx += 48) {
      x.beginPath(); x.moveTo(xx, yd - 10); x.lineTo(xx + 10, yd); x.lineTo(xx, yd + 10); x.lineTo(xx - 10, yd); x.fill();
    }
  };
  band(40, 1);
  band(h - 40, -1);
  // The page's name, woven in large, with Prayatn above it.
  const css = getComputedStyle(document.documentElement);
  const display = css.getPropertyValue('--display') || 'sans-serif';
  const body = css.getPropertyValue('--body') || 'sans-serif';
  x.textAlign = 'center';
  let size = Math.min(170, W * 0.16);
  x.font = `800 ${size}px ${display}`;
  while (x.measureText(name).width > W * 0.84 && size > 40) { size -= 4; x.font = `800 ${size}px ${display}`; }
  x.fillStyle = rgb('khadi');
  x.fillText(name, W / 2, h / 2 + size * 0.35);
  x.fillStyle = rgb('marigold');
  x.font = `700 ${Math.round(size * 0.22)}px ${body}`;
  x.fillText(name === 'Prayatn' ? 'A  D E V E L O P M E N T A L   E F F O R T' : 'P R A Y A T N', W / 2, h / 2 - size * 0.62);
  x.fillRect(W / 2 - 60, h / 2 + size * 0.62, 120, 6);
  return c;
}

// ---------- WebGL ----------
const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv;
uniform float uAspect, uF;
varying vec3 vNor; varying vec2 vUv; varying float vZ;
void main() {
  // Perspective from a camera at z = uF looking at the screen plane z = 0.
  float k = uF / (uF - aPos.z);
  gl_Position = vec4(aPos.x * k / uAspect, aPos.y * k, 0.0, 1.0);
  vNor = aNor; vUv = aUv; vZ = aPos.z;
}`;
const FS = `
precision mediump float;
uniform sampler2D uTex; uniform float uShadow;
varying vec3 vNor; varying vec2 vUv; varying float vZ;
void main() {
  if (uShadow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.22); return; }
  vec3 n = normalize(vNor);
  bool back = !gl_FrontFacing;
  if (back) n = -n;
  vec3 L = normalize(vec3(-0.35, 0.55, 1.0));
  float diff = max(dot(n, L), 0.0);
  // Folds: light on the faces turned to the light, shade in the creases.
  float light = 0.42 + 0.72 * diff;
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0) * 0.12;
  vec3 col = back ? vec3(0.13, 0.15, 0.25) : texture2D(uTex, vUv).rgb;
  gl_FragColor = vec4(col * light + spec, 1.0);
}`;

function makeGL(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  gl.useProgram(p);
  return { gl, p };
}

// ---------- the cloth ----------
function makeCloth(aspect) {
  // About 1,400 points, in nearly square cells, a little larger than the screen.
  const nx = Math.max(16, Math.round(Math.sqrt(1400 * aspect)));
  const ny = Math.max(16, Math.round(Math.sqrt(1400 / aspect)));
  const w = aspect * 2.04, h = 2.04;
  const n = nx * ny;
  const pos = new Float32Array(n * 3), prev = new Float32Array(n * 3), rest = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2), pin = new Uint8Array(n), inv = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      rest[k * 3] = -w / 2 + (i / (nx - 1)) * w;
      rest[k * 3 + 1] = h / 2 - (j / (ny - 1)) * h;
      rest[k * 3 + 2] = (Math.random() - 0.5) * 0.004; // enough to let it buckle
      uv[k * 2] = i / (nx - 1); uv[k * 2 + 1] = j / (ny - 1);
      inv[k] = 0.85 + Math.random() * 0.3;
    }
  }
  pos.set(rest); prev.set(rest);
  // Springs: [a, b, rest length, stiffness].
  const springs = [];
  const add = (a, b, s) => {
    const dx = rest[a * 3] - rest[b * 3], dy = rest[a * 3 + 1] - rest[b * 3 + 1];
    springs.push(a, b, Math.hypot(dx, dy), s);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (i < nx - 1) add(k, k + 1, 1);
      if (j < ny - 1) add(k, k + nx, 1);
      if (i < nx - 1 && j < ny - 1) { add(k, k + nx + 1, 0.6); add(k + 1, k + nx, 0.6); }
      if (i < nx - 2) add(k, k + 2, 0.12);
      if (j < ny - 2) add(k, k + 2 * nx, 0.12);
    }
  }
  const S = new Float32Array(springs);
  // Triangles.
  const idx = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      idx.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
    }
  }
  const index = n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  const nor = new Float32Array(n * 3);

  function step(dt, gravity, damp) {
    const g = gravity * dt * dt;
    for (let k = 0; k < n; k++) {
      if (pin[k]) continue;
      const o = k * 3;
      for (let a = 0; a < 3; a++) {
        const cur = pos[o + a];
        const v = (cur - prev[o + a]) * damp;
        prev[o + a] = cur;
        pos[o + a] = cur + v + (a === 1 ? g * inv[k] : 0);
      }
    }
    for (let it = 0; it < 9; it++) {
      for (let s = 0; s < S.length; s += 4) {
        const a = S[s] * 3, b = S[s + 1] * 3, L = S[s + 2], st = S[s + 3];
        const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const pa = pin[S[s]], pb = pin[S[s + 1]];
        if (pa && pb) continue;
        const f = ((d - L) / d) * st * (pa || pb ? 1 : 0.5);
        if (!pa) { pos[a] += dx * f; pos[a + 1] += dy * f; pos[a + 2] += dz * f; }
        if (!pb) { pos[b] -= dx * f; pos[b + 1] -= dy * f; pos[b + 2] -= dz * f; }
      }
    }
  }
  function normals() {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const l = j * nx + Math.max(0, i - 1), r = j * nx + Math.min(nx - 1, i + 1);
        const u = Math.max(0, j - 1) * nx + i, d = Math.min(ny - 1, j + 1) * nx + i;
        const ax = pos[r * 3] - pos[l * 3], ay = pos[r * 3 + 1] - pos[l * 3 + 1], az = pos[r * 3 + 2] - pos[l * 3 + 2];
        const bx = pos[u * 3] - pos[d * 3], by = pos[u * 3 + 1] - pos[d * 3 + 1], bz = pos[u * 3 + 2] - pos[d * 3 + 2];
        nor[k * 3] = ay * bz - az * by; nor[k * 3 + 1] = az * bx - ax * bz; nor[k * 3 + 2] = ax * by - ay * bx;
      }
    }
  }
  return { nx, ny, n, pos, prev, rest, uv, pin, nor, index, step, normals, w, h };
}

function stage(name) {
  // A real GPU only (a software renderer is too slow, and noisy); ?tier=1
  // forces it for QA.
  const caps = probeWebGL({ allowSoftware: new URLSearchParams(location.search).get('tier') === '1' });
  if (!caps || caps.tier === 'low') return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'pc';
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  document.body.appendChild(canvas);
  const g = makeGL(canvas);
  if (!g) { canvas.remove(); return null; }
  const { gl, p } = g;
  const aspect = innerWidth / innerHeight;
  const cloth = makeCloth(aspect);
  const buf = (data, attr, size, target = gl.ARRAY_BUFFER, usage = gl.DYNAMIC_DRAW) => {
    const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage);
    if (attr) { const loc = gl.getAttribLocation(p, attr); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); }
    return b;
  };
  const bPos = buf(cloth.pos, 'aPos', 3);
  const bNor = buf(cloth.nor, 'aNor', 3);
  buf(cloth.uv, 'aUv', 2, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
  buf(cloth.index, null, 0, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
  if (cloth.index instanceof Uint32Array) gl.getExtension('OES_element_index_uint');
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, weaveTexture(name, aspect));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1f(gl.getUniformLocation(p, 'uAspect'), aspect);
  gl.uniform1f(gl.getUniformLocation(p, 'uF'), 3.2);
  const uShadow = gl.getUniformLocation(p, 'uShadow');
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const count = cloth.index.length, type = cloth.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  function draw() {
    cloth.normals();
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cloth.pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, bNor); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cloth.nor);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uShadow, 0);
    gl.drawElements(gl.TRIANGLES, count, type, 0);
  }
  return { canvas, cloth, draw, dispose: () => { gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); } };
}

// Names of the pages, for the cloth.
function pageName(path) {
  const base = import.meta.env.BASE_URL;
  const p = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, '');
  const key = p.replace(/\/?index\.html$/, '').replace(/\/$/, '');
  return {
    '': 'Prayatn', about: 'About us', healthcare: 'Healthcare', education: 'Education',
    'women-development': 'Women development', gallery: 'Gallery', 'get-involved': 'Get involved',
  }[key] || 'Prayatn';
}

// ---------- arriving: pull the cloth up and away ----------
function pullOff(onDone) {
  const s = stage(pageName(location.pathname));
  const root = document.documentElement;
  if (!s) { fallbackUp(); onDone(); return; }
  root.classList.remove('pc-in');
  const { cloth } = s;
  // Held along the top edge until the pull starts; then only the middle of
  // the top edge is held, and it is drawn up and a little towards you.
  const mid = [];
  const c0 = Math.floor(cloth.nx / 2);
  for (let i = c0 - 1; i <= c0 + (cloth.nx % 2 ? 1 : 0); i++) mid.push(i);
  mid.forEach((i) => { cloth.pin[i] = 1; });
  const start = mid.map((i) => [cloth.pos[i * 3], cloth.pos[i * 3 + 1], cloth.pos[i * 3 + 2]]);
  let t = 0, last = performance.now(), speed = 1, done = false;
  const DUR = 1.25;
  const hurry = () => { speed = 2.6; };
  addEventListener('wheel', hurry, { passive: true, once: true });
  addEventListener('pointerdown', hurry, { passive: true, once: true });
  addEventListener('keydown', hurry, { once: true });
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000) * speed; last = now;
    t += dt;
    const e = Math.min(1, t / DUR);
    const ease = e * e * (3 - 2 * e) * 0.35 + e * e * e * 0.65; // slow at first, then a yank
    mid.forEach((i, k) => {
      cloth.pos[i * 3] = start[k][0] * (1 - e * 0.6);
      cloth.pos[i * 3 + 1] = start[k][1] + ease * 5.2;
      cloth.pos[i * 3 + 2] = Math.sin(Math.min(1, e * 1.4) * Math.PI) * 0.55;
    });
    // Two sub-steps per frame keep the springs steady at speed.
    cloth.step(dt / 2, -1.6, 0.985);
    cloth.step(dt / 2, -1.6, 0.985);
    s.draw();
    // Gone once every point has left the top of the screen, or after a while.
    let low = Infinity;
    for (let k = 0; k < cloth.n; k++) low = Math.min(low, cloth.pos[k * 3 + 1] - cloth.pos[k * 3 + 2] * 0.1);
    if ((low > 1.15 || t > DUR + 1.2) && !done) { done = true; s.dispose(); onDone(); return; }
    requestAnimationFrame(frame);
  }
  s.draw();
  // A short beat with the cloth lying still, then the pull.
  setTimeout(() => { last = performance.now(); requestAnimationFrame(frame); }, 120);
}

function fallbackUp() {
  // No WebGL: the cover slides up and away.
  const root = document.documentElement;
  const o = document.createElement('div');
  o.className = 'pc-flat';
  document.body.appendChild(o);
  root.classList.remove('pc-in');
  requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('is-off')));
  setTimeout(() => o.remove(), 1000);
}

// ---------- leaving: the cloth drops over the page ----------
function dropOver(url) {
  const s = stage(pageName(new URL(url).pathname));
  if (!s) { location.href = url; return; }
  const { cloth } = s;
  // Start hanging above the screen, held along its top edge; the held edge
  // comes down to the top of the screen and the cloth ripples as it lands.
  const lift = 2.3;
  for (let k = 0; k < cloth.n; k++) { cloth.pos[k * 3 + 1] += lift; cloth.prev[k * 3 + 1] += lift; }
  for (let i = 0; i < cloth.nx; i++) cloth.pin[i] = 1;
  let t = 0, last = performance.now(), gone = false;
  const DUR = 0.42;
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    t += dt;
    const e = Math.min(1, t / DUR);
    // The whole cloth is carried down with its held edge (the rest of it
    // keeps a little of that speed, so it sways and settles when it lands).
    const y = cloth.rest[1] + lift * Math.pow(1 - e, 3);
    const dy = y - cloth.pos[1];
    for (let k = cloth.nx; k < cloth.n; k++) { cloth.pos[k * 3 + 1] += dy; cloth.prev[k * 3 + 1] += dy; }
    for (let i = 0; i < cloth.nx; i++) {
      cloth.pos[i * 3 + 1] = y;
      cloth.pos[i * 3 + 2] = Math.sin(e * Math.PI) * 0.1 * Math.sin(i * 0.5);
    }
    // Ripples running down the cloth as it falls.
    for (let k = cloth.nx; k < cloth.n; k++) {
      const row = Math.floor(k / cloth.nx);
      cloth.pos[k * 3 + 2] += Math.sin(row * 0.45 - t * 22) * 0.004 * (1 - e * 0.7);
    }
    cloth.step(dt / 2, -3, 0.96);
    cloth.step(dt / 2, -3, 0.96);
    s.draw();
    if (t > DUR + 0.2 && !gone) {
      gone = true;
      try { sessionStorage.setItem(KEY, '1'); } catch { /* the next page opens without the cloth */ }
      location.href = url;
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // If the next page is slow, the cloth stays over this one; if we come back
  // (bfcache), it is cleared below.
  return s;
}

function eligible(a, e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname === location.pathname && url.search === location.search) return false;
  if (/\.(jpe?g|png|webp|avif|pdf|svg)$/i.test(url.pathname)) return false;
  return url;
}

export function start() {
  const root = document.documentElement;
  if (root.classList.contains('pc-in')) {
    const go = () => pullOff(() => {});
    // The page's name is drawn in the site's font: wait for it, briefly.
    Promise.race([document.fonts?.load?.('800 100px "Bricolage Grotesque"') ?? Promise.resolve(), new Promise((r) => setTimeout(r, 400))]).then(go, go);
  }
  let leaving = null;
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    const url = a && eligible(a, e);
    if (!url || leaving) return;
    e.preventDefault();
    leaving = dropOver(url.href) || true;
  });
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    if (leaving && leaving.dispose) leaving.dispose();
    leaving = null;
    document.querySelectorAll('.pc, .pc-flat').forEach((o) => o.remove());
  });
}
