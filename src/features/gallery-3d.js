// Feature: the gallery as a corridor you walk through (switch: features.gallery3d
// in src/data/site.json). Every photo hangs on the walls of a long indigo
// corridor, one programme after another; scrolling carries you down it.
// Each programme's photos are strung on a thread of its colour, its name
// hangs across the corridor to walk through, and a photo arrives as a woven
// swatch of that colour that is woven into the picture when it has loaded.
// Hover lifts a photo and shows its description; a tap brings it up to fill
// the screen and opens it in the lightbox, where the arrows walk on.
//
// Loaded lazily from main.js (never under reduced motion). Returns false if
// it cannot run (no WebGL 2), and main.js then starts the older Loom instead.
// The plain list of every photo stays in the page underneath either way.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Fog, Color, ColorManagement, PlaneGeometry, ShaderMaterial,
  Mesh, Group, CatmullRomCurve3, TubeGeometry, MeshBasicMaterial, Vector3, Vector2, Raycaster,
  BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, CanvasTexture, TextureLoader,
  LinearMipmapLinearFilter, LinearFilter, DoubleSide, LinearSRGBColorSpace,
} from 'three';
import images from '../data/images.json';
import { probeWebGL } from '../weave/probe.js';

const BASE = import.meta.env.BASE_URL;
const CHAPTERS = [
  { key: 'health', label: 'Healthcare', color: '#C22F66' },
  { key: 'school', label: 'Education', color: '#E2A019' },
  { key: 'women', label: 'Women development', color: '#35A08C' },
  { key: 'events', label: 'Events', color: '#7F8CD6' },
];
const INDIGO = '#1E2440', KHADI = '#F3ECDF';
const SPACING = 1.45;     // corridor length per photo (each wall gets one every 2.9)
const GAP = 7;            // before and after a programme's name
const SCREENS_PER_UNIT = 0.085; // page scroll (in screens) per unit of corridor

ColorManagement.enabled = false; // colours and photos in, as they are, out

// ---------- photo material: woven swatch, woven into the photo ----------
const vert = /* glsl */`
  uniform float uVel;     // walking speed: the photo billows back like cloth
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec3 p = position;
    float across = sin(uv.x * 3.14159);
    p.z -= across * uVel * 0.35;
    p.z += sin(uTime * 0.9 + uPhase + uv.y * 2.5) * 0.025 * across;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const frag = /* glsl */`
  uniform sampler2D uMap;
  uniform float uHas;     // 1 once the photo has loaded
  uniform float uReveal;  // 0..1, the weaving-in of the photo
  uniform float uHover;
  uniform float uAspect;
  uniform vec3 uColor;    // the programme's colour
  uniform vec3 uFog;
  uniform float uNear, uFar, uFade;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    // Woven swatch: over-under threads in the programme's colour.
    vec2 g = vUv * vec2(uAspect, 1.0) * 26.0;
    vec2 c = fract(g);
    float warp = step(0.5, mod(floor(g.x) + floor(g.y), 2.0));
    float thread = warp > 0.5 ? smoothstep(0.0, 0.25, c.x) * smoothstep(1.0, 0.75, c.x)
                              : smoothstep(0.0, 0.25, c.y) * smoothstep(1.0, 0.75, c.y);
    vec3 swatch = uColor * (0.55 + 0.35 * thread);

    // The photo is woven in row by row, alternate rows from opposite sides.
    float rows = 14.0;
    float r = floor(vUv.y * rows);
    float along = mod(r, 2.0) < 0.5 ? vUv.x : 1.0 - vUv.x;
    float lag = fract(sin(r * 12.9898) * 43758.5453) * 0.35;
    float shown = uHas * smoothstep(along - 0.02, along + 0.02, uReveal * 1.4 - lag);
    vec3 photo = texture2D(uMap, vUv).rgb;
    vec3 col = mix(swatch, photo, shown);
    // A thin khadi mount, and a colour bar at the foot while hovered.
    vec2 b = min(vUv, 1.0 - vUv) * vec2(uAspect, 1.0);
    float mount = 1.0 - step(0.022, min(b.x, b.y));
    col = mix(col, vec3(0.953, 0.925, 0.875), mount);
    float bar = step(vUv.y, 0.035 * uHover) * (1.0 - mount);
    col = mix(col, uColor, bar);
    col *= 0.9 + 0.14 * uHover;
    float f = smoothstep(uNear, uFar, vDepth);
    gl_FragColor = vec4(mix(col, uFog, f), uFade);
  }`;

function chapterCard(ch, n, index) {
  // A programme's name, drawn on a canvas in the site's display font.
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 640;
  const x = c.getContext('2d');
  const display = getComputedStyle(document.documentElement).getPropertyValue('--display') || 'sans-serif';
  const body = getComputedStyle(document.documentElement).getPropertyValue('--body') || 'sans-serif';
  x.textAlign = 'center';
  x.fillStyle = ch.color;
  x.font = `600 64px ${body}`;
  x.fillText(index, 1024, 150);
  x.fillStyle = KHADI;
  let size = 260;
  do { x.font = `800 ${size}px ${display}`; size -= 10; } while (x.measureText(ch.label).width > 1900 && size > 80);
  x.fillText(ch.label, 1024, 420);
  x.fillStyle = ch.color;
  x.fillRect(1024 - 90, 470, 180, 10);
  x.fillStyle = 'rgba(243,236,223,.8)';
  x.font = `600 64px ${body}`;
  x.fillText(n, 1024, 590);
  const t = new CanvasTexture(c);
  t.minFilter = LinearFilter; t.generateMipmaps = false;
  return t;
}

export function start(section) {
  // A real GPU with WebGL 2 (software renderers are too slow for this).
  const force = new URLSearchParams(location.search).get('tier') === '1';
  const caps = probeWebGL({ allowSoftware: force });
  if (!caps || caps.tier === 'low' || typeof WebGL2RenderingContext === 'undefined') return false;

  let renderer;
  const canvas = document.createElement('canvas');
  canvas.className = 'corr__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: !force });
  } catch { return false; }
  renderer.outputColorSpace = LinearSRGBColorSpace;

  // ---------- the photos, programme by programme ----------
  const names = Object.keys(images).filter((n) => images[n].use !== 'hero');
  const photos = [];
  CHAPTERS.forEach((ch, ci) => names.filter((n) => images[n].use === ch.key).forEach((n) => photos.push({ name: n, ch: ci, ...images[n] })));
  if (!photos.length) return false;

  // ---------- page structure ----------
  section.classList.add('loom--corr');
  const wrap = document.createElement('div');
  wrap.className = 'corr';
  wrap.innerHTML = `
    <div class="corr__stick">
      <div class="corr__hud" aria-hidden="true">
        <p class="corr__where"><span class="corr__ch"></span><span class="corr__n"></span></p>
        <p class="corr__hint"><span class="corr__mouse"></span>Scroll to walk through</p>
      </div>
      <nav class="corr__rail" aria-label="Jump to a programme"><span class="corr__fill"></span></nav>
      <p class="corr__chip" aria-hidden="true"></p>
    </div>`;
  const stick = wrap.querySelector('.corr__stick');
  stick.prepend(canvas);
  section.insertBefore(wrap, section.querySelector('.loom__list-toggle'));
  document.documentElement.classList.add('has-loom');
  section.dataset.tier = 'corridor';

  const chEl = wrap.querySelector('.corr__ch'), nEl = wrap.querySelector('.corr__n');
  const hint = wrap.querySelector('.corr__hint'), chip = wrap.querySelector('.corr__chip');
  const rail = wrap.querySelector('.corr__rail'), fill = wrap.querySelector('.corr__fill');

  // ---------- the corridor ----------
  const scene = new Scene();
  const bg = new Color(INDIGO);
  scene.background = bg;
  scene.fog = new Fog(bg, 6, 26);
  const camera = new PerspectiveCamera(58, 1, 0.05, 60);
  const loader = new TextureLoader();
  const geo = new PlaneGeometry(1, 1, 20, 6);
  const meshes = [];
  const cards = [];
  let aspect = 1, spreadX = 2, spreadY = 1;

  // Layout depends on the shape of the screen: on a tall phone the photos
  // hang closer to the middle and further up and down.
  function place() {
    const narrow = aspect < 0.9;
    spreadX = narrow ? 0.66 : Math.min(2.1, 0.9 + aspect * 0.7);
    spreadY = narrow ? 0.95 : 0.62;
    const h = narrow ? 1.05 : 1.55;
    let z = -6;
    const chapterZ = [];
    photos.forEach((p, i) => {
      if (i === 0 || photos[i - 1].ch !== p.ch) {
        if (i) z -= GAP * 0.6;
        chapterZ[p.ch] = z;
        z -= GAP;
      }
      const k = photos.slice(0, i).filter((q) => q.ch === p.ch).length;
      const side = k % 2 ? 1 : -1;
      const ar = p.width / p.height;
      const w = Math.min(h * ar, narrow ? 1.35 : 2.4), hh = w / ar;
      // Salon hang: on each wall, one high, one low, one high...
      const high = Math.floor(k / 2) % 2 ? -1 : 1;
      const lift = high * (0.62 + ((k * 37) % 7) / 40);
      p.base = new Vector3(side * (spreadX + w * 0.34), lift * spreadY * 1.6, z);
      p.side = side;
      p.rotY = -side * (narrow ? 0.5 : 0.42);
      p.w = w; p.h = hh;
      z -= SPACING;
    });
    return { chapterZ, endZ: z + 1.2, lastZ: z };
  }

  let layout;
  const threads = [];
  // A durrie runs the length of the corridor: stripes across it, and a band
  // of the programme's colour down each side.
  const floor = new Mesh(new PlaneGeometry(1, 1, 1, 1), new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uFog: { value: bg }, uZ: { value: [0, 0, 0, 0] }, uC: { value: CHAPTERS.map((c) => new Color(c.color)) } },
    vertexShader: `varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uFog; uniform float uZ[4]; uniform vec3 uC[4]; varying vec3 vW; varying float vDepth;
      void main(){
        vec3 c = uC[0];
        for (int i = 1; i < 4; i++) { if (vW.z < uZ[i]) c = uC[i]; }
        float z = vW.z;
        float stripe = step(0.5, fract(z * 0.9));
        vec3 base = mix(vec3(0.16,0.19,0.33), vec3(0.2,0.235,0.39), stripe);
        float ax = abs(vW.x);
        float band = step(0.62, ax * 0.55) * (1.0 - step(0.78, ax * 0.55));
        float fine = step(0.94, fract(z * 3.6)) * step(ax * 0.55, 0.62);
        vec3 col = mix(base, c * 0.8, band * 0.85);
        col = mix(col, vec3(0.953,0.925,0.875), fine * 0.12);
        float g = fract(vW.x * 14.0) ; col *= 0.94 + 0.06 * step(0.5, g);
        float f = smoothstep(4.0, 24.0, vDepth);
        float edge = smoothstep(1.0, 0.75, ax / 5.0);
        gl_FragColor = vec4(mix(col, uFog, f), edge);
      }`,
  }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  function build() {
    layout = place();
    floor.material.uniforms.uZ.value = CHAPTERS.map((_, ci) => (layout.chapterZ[ci] ?? -1e4) + 2);
    photos.forEach((p, i) => {
      let m = meshes[i];
      if (!m) {
        const mat = new ShaderMaterial({
          vertexShader: vert, fragmentShader: frag, transparent: true, side: DoubleSide,
          uniforms: {
            uMap: { value: null }, uHas: { value: 0 }, uReveal: { value: 0 }, uHover: { value: 0 },
            uAspect: { value: 1 }, uColor: { value: new Color(CHAPTERS[p.ch].color) }, uFog: { value: bg },
            uNear: { value: 6 }, uFar: { value: 26 }, uVel: { value: 0 }, uTime: { value: 0 }, uPhase: { value: i * 1.7 }, uFade: { value: 1 },
          },
        });
        m = new Mesh(geo, mat);
        m.userData.i = i;
        scene.add(m);
        meshes[i] = m;
      }
      m.position.copy(p.base);
      m.rotation.set(0, p.rotY, 0);
      m.scale.set(p.w, p.h, 1);
      m.material.uniforms.uAspect.value = p.w / p.h;
    });
    // Threads: each programme's photos strung on one thread of its colour,
    // passing behind every photo.
    threads.forEach((t) => { scene.remove(t); t.geometry.dispose(); });
    threads.length = 0;
    // One thread down each wall, so none crosses the middle of the corridor.
    CHAPTERS.forEach((ch, ci) => [-1, 1].forEach((side) => {
      const pts = photos.filter((p) => p.ch === ci && p.side === side).map((p) => p.base.clone().add(new Vector3(side * 0.05, 0, 0)));
      if (!pts.length) return;
      const first = pts[0], last = pts[pts.length - 1];
      pts.unshift(new Vector3(first.x * 1.25, -first.y * 0.4, first.z + 3));
      pts.push(new Vector3(last.x * 1.25, -last.y * 0.4, last.z - 3));
      const curve = new CatmullRomCurve3(pts, false, 'centripetal');
      const t = new Mesh(new TubeGeometry(curve, pts.length * 16, 0.014, 5, false), new MeshBasicMaterial({ color: ch.color, fog: true }));
      scene.add(t);
      threads.push(t);
    }));
    // The durrie down the floor.
    floor.position.set(0, -(spreadY * 1.6 + (aspect < 0.9 ? 1.25 : 1.35)), (zStart + layout.endZ) / 2 - 4);
    floor.scale.set(spreadX * 7, zStart - layout.endZ + 20, 1);
    // Programme names across the corridor.
    cards.forEach((c) => {
      const z = c.userData.ch === 'intro' ? -1.5 : c.userData.ch === 'end' ? layout.lastZ - GAP * 0.5 : layout.chapterZ[c.userData.ch];
      c.position.set(0, 0, z);
      c.scale.setScalar(aspect < 0.9 ? 2.3 : 5.2); c.scale.y *= 640 / 2048;
    });
  }

  // Fibres drifting in the air.
  const fib = new BufferGeometry();
  const count = 900, pos = new Float32Array(count * 3);
  // (positions set after the first layout, when the length is known)
  fib.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const fibres = new Points(fib, new PointsMaterial({ color: KHADI, size: 0.028, transparent: true, opacity: 0.55, fog: true, depthWrite: false }));
  scene.add(fibres);

  // ---------- sizing ----------
  let W = 0, H = 0, stickH = 0, zStart = 3, zEnd = -100;
  const filter = document.querySelector('[data-gfilter]');
  function size() {
    const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head')) || 60;
    const fh = filter && !filter.hidden ? filter.offsetHeight : 0;
    wrap.style.setProperty('--top', `${head + fh}px`);
    stickH = innerHeight - head - fh;
    W = stick.clientWidth; H = stickH;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, W < 700 ? 2 : 1.5));
    renderer.setSize(W, H, false);
    aspect = W / H;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    build();
    zStart = 3; zEnd = layout.endZ;
    const len = (zStart - zEnd) * SCREENS_PER_UNIT;
    wrap.style.height = `${stickH * (len + 1)}px`;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spreadX * 5;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = zStart - Math.random() * (zStart - zEnd + 8);
    }
    fib.attributes.position.needsUpdate = true;
    // Rail: one mark per programme.
    rail.querySelectorAll('button').forEach((b) => b.remove());
    CHAPTERS.forEach((ch, ci) => {
      if (layout.chapterZ[ci] === undefined) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.style.setProperty('--at', String(progressAt(layout.chapterZ[ci] + 5)));
      b.style.setProperty('--c', ch.color);
      b.innerHTML = `<span>${ch.label}</span>`;
      b.addEventListener('click', () => jump(ci));
      rail.appendChild(b);
    });
    wake();
  }
  const progressAt = (camZ) => Math.min(1, Math.max(0, (zStart - camZ) / (zStart - zEnd)));

  // Scroll position that puts the camera just before a programme's name.
  function jump(ci, smooth = true) {
    const top = wrap.getBoundingClientRect().top + scrollY;
    const p = progressAt(layout.chapterZ[ci] + 5);
    scrollTo({ top: top + p * (wrap.offsetHeight - stickH), behavior: smooth ? 'smooth' : 'instant' });
  }
  function jumpToPhoto(i) {
    const top = wrap.getBoundingClientRect().top + scrollY;
    const p = progressAt(photos[i].base.z + 3.2);
    scrollTo({ top: top + p * (wrap.offsetHeight - stickH), behavior: 'instant' });
    cam.z = zStart - p * (zStart - zEnd);
  }

  // The programme buttons above the gallery walk to that programme.
  filter?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]');
    if (!b) return;
    const ci = CHAPTERS.findIndex((c) => c.key === b.dataset.f);
    if (ci >= 0) jump(ci);
    else scrollTo({ top: wrap.getBoundingClientRect().top + scrollY, behavior: 'smooth' });
  });

  // Programme names (drawn once the fonts are ready).
  document.fonts?.ready.then(() => {
    CHAPTERS.forEach((ch, ci) => {
      const n = photos.filter((p) => p.ch === ci).length;
      if (!n) return;
      const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: chapterCard(ch, `${n} photograph${n === 1 ? '' : 's'}`, `0${ci + 1}`), transparent: true, fog: true, depthWrite: false }));
      m.userData.ch = ci;
      cards.push(m);
      scene.add(m);
    });
    const extra = (key, card) => {
      const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: chapterCard(card, card.sub, card.kicker), transparent: true, fog: true, depthWrite: false }));
      m.userData.ch = key; cards.push(m); scene.add(m);
    };
    extra('intro', { label: `${photos.length} photographs`, color: '#E2A019', sub: CHAPTERS.map((c) => c.label).join(' · '), kicker: 'Our work, in pictures' });
    extra('end', { label: 'That is all of them', color: '#E2A019', sub: 'For now. There is a list of every photo below.', kicker: `${photos.length} photographs` });
    size();
  });

  // ---------- photos load as you approach, and are let go far behind ----------
  const want = () => (W < 700 ? 560 : 800);
  let loading = 0;
  function stream() {
    const order = photos.map((p, i) => i).filter((i) => {
      const dz = cam.z - photos[i].base.z;
      return dz > -4 && dz < 30;
    }).sort((a, b) => photos[b].base.z - photos[a].base.z);
    for (const i of order) {
      if (loading >= 4) break;
      const p = photos[i], m = meshes[i];
      if (p.tex || p.pending) continue;
      p.pending = true; loading++;
      const w = p.widths.find((x) => x >= want()) ?? p.widths.at(-1);
      loader.load(`${BASE}img/${p.name}-${w}.jpg`, (t) => {
        loading--; p.pending = false;
        t.minFilter = LinearMipmapLinearFilter; t.anisotropy = 4;
        p.tex = t; p.revealAt = performance.now();
        m.material.uniforms.uMap.value = t;
        m.material.uniforms.uHas.value = 1;
        wake();
      }, undefined, () => { loading--; p.pending = false; p.failed = true; });
    }
    // Far behind or far ahead: let the texture go (phones have little memory).
    photos.forEach((p, i) => {
      if (!p.tex) return;
      const dz = cam.z - p.base.z;
      if (dz < -14 || dz > 48) {
        p.tex.dispose(); p.tex = null;
        const u = meshes[i].material.uniforms;
        u.uMap.value = null; u.uHas.value = 0; u.uReveal.value = 0;
      }
    });
  }

  // ---------- interaction ----------
  const ray = new Raycaster(), ndc = new Vector2();
  const pointer = { x: 0, y: 0, lx: 0, ly: 0, in: false };
  let hover = -1;
  function pick(clientX, clientY) {
    const b = canvas.getBoundingClientRect();
    ndc.set(((clientX - b.left) / b.width) * 2 - 1, -((clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(meshes, false).find((h) => h.distance < 18);
    return hit ? hit.object.userData.i : -1;
  }
  stick.addEventListener('pointermove', (e) => {
    const b = stick.getBoundingClientRect();
    pointer.x = (e.clientX - b.left) / b.width - 0.5;
    pointer.y = (e.clientY - b.top) / b.height - 0.5;
    pointer.in = e.pointerType === 'mouse';
    if (e.pointerType !== 'mouse') return;
    hover = focus.i < 0 ? pick(e.clientX, e.clientY) : -1;
    stick.classList.toggle('is-over', hover >= 0);
    if (hover >= 0) {
      chip.textContent = photos[hover].alt;
      chip.style.translate = `${Math.min(e.clientX - b.left + 18, W - 320)}px ${Math.min(e.clientY - b.top + 22, H - 100)}px`;
      chip.classList.add('is-on');
    } else chip.classList.remove('is-on');
    wake();
  });
  stick.addEventListener('pointerleave', () => { hover = -1; pointer.in = false; chip.classList.remove('is-on'); stick.classList.remove('is-over'); });
  let down = null;
  stick.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  stick.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10 || performance.now() - down.t > 600) { down = null; return; }
    down = null;
    const i = pick(e.clientX, e.clientY);
    if (i >= 0) open(i);
  });

  // ---------- opening a photo: it comes up to fill the screen ----------
  const box = document.querySelector('[data-lightbox]');
  const focus = { i: -1, t: 0, dir: 0, from: null };
  let nav = null;
  if (box && typeof box.showModal === 'function') {
    nav = document.createElement('div');
    nav.className = 'lightbox__nav';
    nav.innerHTML = '<button type="button" data-prev aria-label="Previous photo">←</button><span></span><button type="button" data-next aria-label="Next photo">→</button>';
    box.appendChild(nav);
    nav.addEventListener('click', (e) => {
      if (e.target.closest('[data-prev]')) step(-1);
      if (e.target.closest('[data-next]')) step(1);
    });
    box.addEventListener('keydown', (e) => {
      if (!box.classList.contains('is-corr')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    box.addEventListener('close', () => {
      if (!box.classList.contains('is-corr')) return;
      box.classList.remove('is-corr');
      focus.dir = -1; wake();
    });
  }
  const bestSrc = (p) => `${BASE}img/${p.name}-${p.widths.at(-1)}.jpg`;
  function fillBox(i) {
    const p = photos[i];
    const img = box.querySelector('img'), cap = box.querySelector('.lightbox__cap');
    img.src = bestSrc(p); img.alt = p.alt; cap.textContent = p.alt;
    nav.querySelector('span').textContent = `${CHAPTERS[p.ch].label} · ${i + 1} / ${photos.length}`;
  }
  function open(i) {
    if (!box || typeof box.showModal !== 'function') { location.href = bestSrc(photos[i]); return; }
    chip.classList.remove('is-on');
    focus.i = i; focus.t = 0; focus.dir = 1;
    wake();
    // The photo flies up first, then the lightbox takes over.
    setTimeout(() => { fillBox(i); box.classList.add('is-corr'); box.showModal(); }, 520);
  }
  function step(d) {
    const i = (focus.i + d + photos.length) % photos.length;
    focus.i = i; focus.t = 1; focus.dir = 0;
    fillBox(i);
    jumpToPhoto(i);
  }

  // ---------- the loop ----------
  const cam = { z: zStart, v: 0, lx: 0, ly: 0 };
  let visible = false, raf = 0, last = 0, lastStream = 0, t0 = performance.now(), hinted = false;
  const tmp = new Vector3(), dirV = new Vector3();
  function target() {
    const r = wrap.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - stickH)));
    return { p, z: zStart - p * (zStart - zEnd) };
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const tg = target();
    const prev = cam.z;
    cam.z += (tg.z - cam.z) * (1 - Math.pow(0.0015, dt));
    cam.v = cam.v * 0.85 + ((prev - cam.z) / Math.max(dt, 0.001)) * 0.15 * 0.1;
    const vel = Math.min(1.6, Math.abs(cam.v));
    if (!hinted && tg.p > 0.01) { hinted = true; hint.classList.add('is-gone'); }

    // The walk sways gently from side to side, and the view leans towards
    // the pointer.
    cam.lx += ((pointer.in ? pointer.x : 0) - cam.lx) * 0.06;
    cam.ly += ((pointer.in ? pointer.y : 0) - cam.ly) * 0.06;
    camera.position.set(Math.sin(cam.z * 0.33) * spreadX * 0.14 + cam.lx * 0.3, Math.cos(cam.z * 0.21) * 0.08 - cam.ly * 0.2, cam.z);
    camera.rotation.set(-cam.ly * 0.12, -cam.lx * 0.22 + Math.sin(cam.z * 0.33) * -0.04, 0);
    camera.fov = 58 + vel * 7;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const time = (now - t0) / 1000;
    let settled = Math.abs(tg.z - cam.z) < 0.002;
    // Opening / closing a photo.
    if (focus.i >= 0 && focus.dir) {
      focus.t = Math.min(1, Math.max(0, focus.t + focus.dir * dt / 0.5));
      if (focus.t <= 0 && focus.dir < 0) { focus.i = -1; focus.dir = 0; }
      settled = false;
    }
    const e = focus.t < 0.5 ? 4 * focus.t ** 3 : 1 - (-2 * focus.t + 2) ** 3 / 2;
    meshes.forEach((m, i) => {
      const p = photos[i];
      const u = m.material.uniforms;
      u.uTime.value = time;
      u.uVel.value = vel;
      const h = i === hover ? 1 : 0;
      u.uHover.value += (h - u.uHover.value) * 0.18;
      if (Math.abs(h - u.uHover.value) > 0.01) settled = false;
      if (p.tex && u.uReveal.value < 1) { u.uReveal.value = Math.min(1, (now - p.revealAt) / 900); settled = false; }
      // Hovered photos lean out from the wall.
      tmp.copy(p.base);
      tmp.x -= Math.sign(p.base.x) * u.uHover.value * 0.25;
      tmp.z += u.uHover.value * 0.2;
      let ry = p.rotY * (1 - u.uHover.value * 0.4);
      m.renderOrder = 0;
      if (i === focus.i) {
        // In front of the camera, filling most of the view.
        const fit = Math.min(0.8, 0.8 * aspect * p.h / p.w);
        const d = (p.h / 2) / Math.tan((camera.fov * Math.PI / 360)) / fit;
        camera.getWorldDirection(dirV);
        const front = camera.position.clone().addScaledVector(dirV, d);
        tmp.lerp(front, e);
        ry *= 1 - e;
        m.renderOrder = 10;
      }
      m.position.copy(tmp);
      m.rotation.set(focus.i === i ? camera.rotation.x * e : 0, ry + (focus.i === i ? camera.rotation.y * e : 0), 0);
      u.uFade.value = focus.i >= 0 && i !== focus.i ? 1 - e * 0.85 : 1;
    });
    // Walking through a programme's name: it fades as you reach it.
    cards.forEach((c) => {
      const dz = cam.z - c.position.z;
      c.material.opacity = Math.min(1, Math.max(0, (dz - 0.6) / 3), Math.max(0, (8.5 - dz) / 2.5)) * (focus.i >= 0 ? 1 - e : 1);
    });
    fibres.rotation.z = time * 0.01;

    // Where you are.
    let ci = 0;
    CHAPTERS.forEach((_, k) => { if (layout.chapterZ[k] !== undefined && cam.z < layout.chapterZ[k] + 5) ci = k; });
    let near = 0;
    photos.forEach((p, i) => { if (p.base.z > cam.z - 3) near = i; });
    const label = `${CHAPTERS[ci].label}`;
    if (chEl.textContent !== label) {
      chEl.textContent = label;
      wrap.style.setProperty('--ch', CHAPTERS[ci].color);
      filter?.querySelectorAll('button[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === CHAPTERS[ci].key)));
    }
    nEl.textContent = `${near + 1} / ${photos.length}`;
    fill.style.transform = `scaleY(${tg.p})`;

    if (now - lastStream > 200) { lastStream = now; stream(); }
    renderer.render(scene, camera);
    if (visible && (!settled || vel > 0.001 || pointer.in || time < 2)) raf = requestAnimationFrame(frame);
  }
  function wake() { if (visible && !raf) raf = requestAnimationFrame(frame); }
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', () => { size(); });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; wake(); }).observe(stick);
  canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); visible = false; });
  canvas.addEventListener('webglcontextrestored', () => { photos.forEach((p) => { p.tex = null; }); visible = true; wake(); });

  size();
  cam.z = target().z;
  return true;
}
