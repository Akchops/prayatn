// Page openings. The first time a page is opened in a visit, its header photo
// is built full-screen out of tiles, each page in its own way, and then the
// finished photo flies into its card in the header while the page's own title
// animation plays:
//   healthcare (pulse)  a heartbeat line crosses the screen; the photo grows out of it
//   education  (pages)  columns turn in like the pages of a book
//   women      (circle) the pieces sit in a circle, turn, and come together
//   about      (hands)  the pieces fly in from everywhere and join
//   involved   (weft)   rows are woven in from alternate sides
//   gallery    (deal)   the pieces are dealt out from a deck
// A tap, a key, a scroll or the wheel skips to the end. Not run with reduced
// motion or without JS (the inline script in <head> decides; see head.html),
// and a CSS timer removes the cover on its own if anything here fails.

const STYLE = { weave: 'pulse', wipe: 'pages', circle: 'circle', swing: 'hands', slats: 'weft', deal: 'deal' };
const EASE = 'cubic-bezier(.2,.8,.2,1)';

export async function start() {
  const root = document.documentElement;
  const band = document.querySelector('[data-band]');
  const img = band?.querySelector('.band__card img');
  const end = () => root.classList.remove('opening');
  if (!band || !img) { end(); return; }
  try { sessionStorage.setItem('opened:' + location.pathname, '1'); } catch { /* fine */ }

  // Wait (briefly) for the header photo.
  if (!img.complete || !img.naturalWidth) {
    await Promise.race([img.decode?.().catch(() => {}) ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  }
  const src = img.currentSrc || img.src;
  if (!img.naturalWidth || !src) { end(); return; }

  const style = STYLE[band.dataset.intro] || 'hands';
  const W = innerWidth, H = innerHeight;
  const cols = W >= 900 ? 10 : 6;
  const rows = Math.max(4, Math.round(cols * H / W));
  const tw = W / cols, th = H / rows;
  // The photo covers the screen (cropped like object-fit: cover).
  const a = img.naturalWidth / img.naturalHeight;
  const pw = W / H > a ? W : H * a, ph = W / H > a ? W / a : H;
  const ox = (W - pw) / 2, oy = (H - ph) / 2;

  const stage = document.createElement('div');
  stage.className = 'opening';
  stage.setAttribute('aria-hidden', 'true');
  const field = document.createElement('div');
  field.className = 'opening__field';
  stage.appendChild(field);

  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = document.createElement('i');
      const x = c * tw, y = r * th;
      t.style.cssText = `left:${x}px;top:${y}px;width:${Math.ceil(tw) + 1}px;height:${Math.ceil(th) + 1}px;background-image:url("${src}");background-size:${pw}px ${ph}px;background-position:${ox - x}px ${oy - y}px`;
      field.appendChild(t);
      tiles.push({ el: t, c, r, x, y, cx: x + tw / 2, cy: y + th / 2 });
    }
  }

  // The page's name, large, while the photo comes together.
  // The page's short name (data-open-name), not its longer header line.
  const name = (band.dataset.openName || band.querySelector('.band__title')?.textContent || '').trim();
  const title = document.createElement('p');
  title.className = 'opening__title';
  let li = 0;
  title.innerHTML = name.split(/\s+/).map((w) => `<span>${[...w].map((ch) => `<b style="--i:${li++}">${ch}</b>`).join('')}</span>`).join(' ');
  stage.appendChild(title);

  let pulse = null;
  if (style === 'pulse') {
    // A heartbeat across the middle of the screen.
    const ns = 'http://www.w3.org/2000/svg';
    pulse = document.createElementNS(ns, 'svg');
    pulse.setAttribute('class', 'opening__pulse');
    pulse.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const m = H / 2, beat = Math.min(W, 900) / 9;
    let d = `M0 ${m}`;
    for (const at of [0.22, 0.52, 0.8]) {
      const x = W * at;
      d += ` L${x - beat} ${m} L${x - beat * 0.6} ${m - H * 0.03} L${x - beat * 0.35} ${m} L${x - beat * 0.15} ${m + H * 0.05} L${x} ${m - H * 0.22} L${x + beat * 0.2} ${m + H * 0.12} L${x + beat * 0.4} ${m}`;
    }
    d += ` L${W} ${m}`;
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    pulse.appendChild(p);
    stage.appendChild(pulse);
  }

  document.body.appendChild(stage);
  root.classList.add('opening--on');

  // Each style: where every tile starts, and when it sets off.
  const N = tiles.length;
  const order = tiles.map((_, i) => i).sort(() => Math.random() - 0.5);
  const R = Math.min(W, H) * 0.34;
  const plan = (t, i) => {
    const toCentre = `translate(${W / 2 - t.cx}px, ${H / 2 - t.cy}px)`;
    switch (style) {
      case 'pulse':
        return { from: [{ transform: `translateY(${H / 2 - t.cy}px) scaleY(.02)`, opacity: 1 }], delay: 520 + (t.c / cols) * 650 + Math.abs(t.r - rows / 2) * 22, dur: 850 };
      case 'pages':
        return { from: [{ transform: 'perspective(1400px) rotateY(-100deg)', opacity: 0 }], delay: t.c * 95 + t.r * 12, dur: 950, origin: '0 50%' };
      case 'circle': {
        const k = i / N * Math.PI * 2;
        const ring = (turn) => `translate(${W / 2 + Math.cos(k + turn) * R - t.cx}px, ${H / 2 + Math.sin(k + turn) * R - t.cy}px) rotate(${(k + turn) * 57.3 + 90}deg) scale(.32)`;
        return { from: [{ transform: ring(0), opacity: 0 }, { transform: ring(0.9), opacity: 1, offset: 0.45 }], delay: 80 + (i % cols) * 10, dur: 1700 };
      }
      case 'weft': {
        const dir = t.r % 2 ? 1 : -1;
        return { from: [{ transform: `translateX(${dir * (W + tw)}px)`, opacity: 1 }], delay: t.r * 85 + (dir > 0 ? cols - t.c : t.c) * 18, dur: 900 };
      }
      case 'deal':
        return { from: [{ transform: `${toCentre} rotate(${(Math.random() - 0.5) * 24}deg) scale(.55)`, opacity: 0 }, { opacity: 1, offset: 0.1 }], delay: order.indexOf(i) * (1100 / N), dur: 650 };
      default: { // hands
        const ang = Math.random() * Math.PI * 2, far = 0.75 + Math.random() * 0.6;
        return { from: [{ transform: `translate(${Math.cos(ang) * W * far}px, ${Math.sin(ang) * H * far}px) rotate(${(Math.random() - 0.5) * 300}deg) scale(${0.2 + Math.random() * 0.4})`, opacity: 0 }, { opacity: 1, offset: 0.25 }], delay: Math.random() * 520, dur: 1250 };
      }
    }
  };

  let last = 0;
  const anims = tiles.map((t, i) => {
    const p = plan(t, i);
    if (p.origin) t.el.style.transformOrigin = p.origin;
    last = Math.max(last, p.delay + p.dur);
    return t.el.animate([...p.from, { transform: 'none', opacity: 1 }], { duration: p.dur, delay: p.delay, easing: EASE, fill: 'both' });
  });

  // Skipping: any input finishes the build and goes straight to the landing.
  let done = false, landing = false;
  const skip = (e) => { if (e?.type === 'keydown' && e.key === 'Tab') return; land(true); };
  const opts = { passive: true, capture: true };
  addEventListener('pointerdown', skip, opts);
  addEventListener('wheel', skip, opts);
  addEventListener('touchstart', skip, opts);
  addEventListener('keydown', skip, true);
  const timer = setTimeout(() => land(false), last + 280);

  function land(fast) {
    if (landing) return;
    landing = true;
    clearTimeout(timer);
    anims.forEach((an) => { try { an.finish(); } catch { /* fine */ } });
    // Let the page's title play as the photo lands.
    root.classList.remove('opening');
    root.classList.add('opened');
    const card = band.querySelector('.band__card')?.getBoundingClientRect();
    const dur = fast ? 420 : 820;
    stage.classList.add('is-landing');
    stage.style.setProperty('--land', `${dur}ms`);
    const ok = card && card.width > 20 && card.top < H && card.bottom > 0;
    tiles.forEach((t, i) => {
      let to;
      if (ok) {
        const sx = card.width / W, sy = card.height / H;
        to = `translate(${card.left + t.x * sx - t.x}px, ${card.top + t.y * sy - t.y}px) scale(${sx}, ${sy})`;
      } else {
        to = `translate(${(W / 2 - t.cx) * 0.6}px, ${(H / 2 - t.cy) * 0.6}px) scale(.4)`;
      }
      t.el.style.transformOrigin = '0 0';
      t.el.animate([{ transform: 'none', opacity: 1 }, { transform: to, opacity: 1, offset: 0.82 }, { transform: to, opacity: 0 }],
        { duration: dur, delay: fast ? 0 : (t.c + t.r) * 6, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
    });
    setTimeout(finish, dur + (fast ? 0 : (cols + rows) * 6) + 40);
  }
  function finish() {
    if (done) return;
    done = true;
    removeEventListener('pointerdown', skip, opts);
    removeEventListener('wheel', skip, opts);
    removeEventListener('touchstart', skip, opts);
    removeEventListener('keydown', skip, true);
    root.classList.remove('opening--on');
    stage.remove();
  }
}
