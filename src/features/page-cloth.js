// Feature (switch: site.json features.pageCloth). The page is a piece of
// cloth. Following a link, the page as it is on the screen becomes the cloth:
// the next page opens underneath it, and the old page is taken by the middle
// of its top edge and pulled up and away, gathering into folds and wrinkles
// as it goes.
//
// How: on the click, the visible part of the page is drawn into a picture
// (modern-screenshot) and kept in sessionStorage; the next page is covered by
// that picture from its first paint (the inline script in head.html), and
// this module turns the picture into a simulated cloth (Verlet points joined
// by stretch, shear and bend springs), drawn with plain WebGL and lit so that
// its folds show, and pulls it off. Without a real GPU the picture slides up
// instead. Never with reduced motion. If the picture cannot be made quickly,
// the link simply opens.
import { domToCanvas } from 'modern-screenshot';
import { probeWebGL } from '../weave/probe.js';

const IMG = 'pc-img';

// ---------- WebGL ----------
const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv;
uniform float uAspect, uF;
varying vec3 vNor; varying vec2 vUv;
void main() {
  // Perspective from a camera at z = uF looking at the screen plane z = 0.
  float k = uF / (uF - aPos.z);
  gl_Position = vec4(aPos.x * k / uAspect, aPos.y * k, 0.0, 1.0);
  vNor = aNor; vUv = aUv;
}`;
const FS = `
precision mediump float;
uniform sampler2D uTex;
varying vec3 vNor; varying vec2 vUv;
void main() {
  vec3 n = normalize(vNor);
  bool back = !gl_FrontFacing;
  if (back) n = -n;
  vec3 L = normalize(vec3(-0.35, 0.55, 1.0));
  // Lit relative to lying flat: flat is exactly the page; folds turned to
  // the light are brighter, creases darker.
  float light = 1.0 + 0.95 * (max(dot(n, L), 0.0) - L.z);
  float bent = smoothstep(0.0, 0.25, 1.0 - n.z);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 20.0) * 0.14 * bent;
  vec3 col = texture2D(uTex, vUv).rgb;
  if (back) col *= 0.55; // the underside of the cloth
  gl_FragColor = vec4(col * clamp(light, 0.25, 1.35) + spec, 1.0);
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
  // About 1,400 points, in nearly square cells, exactly covering the screen.
  const nx = Math.max(16, Math.round(Math.sqrt(1400 * aspect)));
  const ny = Math.max(16, Math.round(Math.sqrt(1400 / aspect)));
  const w = aspect * 2, h = 2;
  const n = nx * ny;
  const pos = new Float32Array(n * 3), prev = new Float32Array(n * 3), rest = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2), pin = new Uint8Array(n), inv = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      rest[k * 3] = -w / 2 + (i / (nx - 1)) * w;
      rest[k * 3 + 1] = h / 2 - (j / (ny - 1)) * h;
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
  return { nx, ny, n, pos, prev, rest, uv, pin, nor, index, step, normals };
}

function stage(img) {
  // A real GPU only (a software renderer is too slow); ?tier=1 forces it for QA.
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
  if (cloth.index instanceof Uint32Array) gl.getExtension('OES_element_index_uint');
  buf(cloth.index, null, 0, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1f(gl.getUniformLocation(p, 'uAspect'), aspect);
  gl.uniform1f(gl.getUniformLocation(p, 'uF'), 3.2);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const count = cloth.index.length, type = cloth.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  function draw() {
    cloth.normals();
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cloth.pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, bNor); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cloth.nor);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, count, type, 0);
  }
  return { cloth, draw, dispose: () => { gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); } };
}

// ---------- arriving: the old page is pulled up and away ----------
function pullOff(img) {
  const root = document.documentElement;
  const s = stage(img);
  if (!s) { fallbackUp(img); return; }
  const { cloth } = s;
  s.draw();
  // The cloth now lies exactly where the cover was.
  root.classList.remove('pc-in');
  // Held by the middle of its top edge, drawn up and a little towards you.
  const mid = [];
  const c0 = Math.floor(cloth.nx / 2);
  for (let i = c0 - 1; i <= c0 + (cloth.nx % 2 ? 1 : 0); i++) mid.push(i);
  mid.forEach((i) => { cloth.pin[i] = 1; });
  // A breath of unevenness, so that it buckles into folds.
  for (let k = 0; k < cloth.n; k++) cloth.pos[k * 3 + 2] = cloth.prev[k * 3 + 2] = (Math.random() - 0.5) * 0.004;
  const start = mid.map((i) => [cloth.pos[i * 3], cloth.pos[i * 3 + 1]]);
  let t = 0, last = performance.now(), speed = 1, done = false;
  const DUR = 1.2;
  const hurry = () => { speed = 2.4; };
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
    cloth.step(dt / 2, -1.6, 0.985);
    cloth.step(dt / 2, -1.6, 0.985);
    s.draw();
    let low = Infinity;
    for (let k = 0; k < cloth.n; k++) low = Math.min(low, cloth.pos[k * 3 + 1] - cloth.pos[k * 3 + 2] * 0.1);
    if ((low > 1.15 || t > DUR + 1.2) && !done) { done = true; s.dispose(); return; }
    requestAnimationFrame(frame);
  }
  // A beat with the old page lying still, then the pull.
  setTimeout(() => { last = performance.now(); requestAnimationFrame(frame); }, 140);
}

function fallbackUp(img) {
  // No WebGL: the old page slides up and away.
  const root = document.documentElement;
  const o = document.createElement('div');
  o.className = 'pc-flat';
  o.style.backgroundImage = `url("${img.src}")`;
  document.body.appendChild(o);
  root.classList.remove('pc-in');
  requestAnimationFrame(() => requestAnimationFrame(() => o.classList.add('is-off')));
  setTimeout(() => o.remove(), 1000);
}

// ---------- leaving: a picture of the page as it is on the screen ----------
async function snapshot() {
  const W = innerWidth, H = innerHeight, sy = scrollY, sx = scrollX;
  // What sticks to the screen (the header, pinned panels) is drawn where it
  // is now; everything else is drawn scrolled, as it is.
  const stuck = [];
  for (const el of document.body.querySelectorAll('*')) {
    const pos = getComputedStyle(el).position;
    if (pos !== 'fixed' && pos !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H || !r.width) continue;
    el.setAttribute('data-pc-stuck', String(stuck.length));
    stuck.push(r);
  }
  try {
    return await domToCanvas(document.body, {
      width: W, height: H,
      scale: Math.min(devicePixelRatio || 1, 1.5),
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#F3ECDF',
      style: { margin: '0', marginTop: `${-sy}px`, marginLeft: `${-sx}px` },
      // Waiting for images elsewhere on the page (lazy ones never load) is
      // cut short; those on the screen have loaded already.
      timeout: 700,
      // Not drawn: what is off the screen, and iframes. (WebGL canvases keep
      // their last frame so that they can be drawn: see main.js.)
      filter: (n) => {
        if (!(n instanceof Element)) return true;
        if (n.tagName === 'IFRAME' || n.classList.contains('pc')) return false;
        if (n.hasAttribute('data-pc-stuck')) return true;
        const r = n.getBoundingClientRect();
        return !(r.width && (r.bottom < -40 || r.top > H + 40));
      },
      onCloneEachNode: (c) => {
        const i = c instanceof Element ? c.getAttribute('data-pc-stuck') : null;
        if (i == null) return;
        const r = stuck[+i];
        Object.assign(c.style, { position: 'fixed', top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', transform: 'none' });
      },
    });
  } finally {
    document.querySelectorAll('[data-pc-stuck]').forEach((el) => el.removeAttribute('data-pc-stuck'));
  }
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
  // Arriving: the picture of the page we came from is waiting.
  const src = window.__pcImg;
  window.__pcImg = null;
  if (root.classList.contains('pc-in') && src) {
    const img = new Image();
    img.onload = () => pullOff(img);
    img.onerror = () => root.classList.remove('pc-in');
    img.src = src;
  } else root.classList.remove('pc-in');

  // Leaving: picture the page, then go. If that takes too long, just go.
  let leaving = false;
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    const url = a && eligible(a, e);
    if (!url || leaving) return;
    e.preventDefault();
    leaving = true;
    root.classList.add('pc-busy');
    let gone = false;
    const go = () => { if (gone) return; gone = true; location.href = url.href; };
    const timer = setTimeout(go, 2000);
    snapshot().then((c) => {
      if (gone) return;
      try { sessionStorage.setItem(IMG, c.toDataURL('image/jpeg', 0.84)); } catch { /* too big: just go */ }
      clearTimeout(timer);
      go();
    }).catch(() => { clearTimeout(timer); go(); });
  });
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    root.classList.remove('pc-busy');
    try { sessionStorage.removeItem(IMG); } catch { /* fine */ }
    document.querySelectorAll('.pc, .pc-flat').forEach((o) => o.remove());
  });
}
