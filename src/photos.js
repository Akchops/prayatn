// "Photos and captions" (/photos/): every photo on the website once, with
// its caption (the same wherever the photo is shown) and the pages and
// sections where it is used. The Gallery holds every photo, so it is said
// once at the top instead of under each photo. Captions can be changed;
// changes are kept in this browser and sent as one WhatsApp message (or
// copied), each naming the photo, so it can be applied in photos.json.
import './styles/edit.css';

const BASE = import.meta.env.BASE_URL;
// The pages where photos are used, in the order they are listed. The gallery
// is read only for its captions.
const PAGES = [
  { key: 'home', name: 'Home', path: '' },
  { key: 'about', name: 'About', path: 'about/' },
  { key: 'healthcare', name: 'Healthcare', path: 'healthcare/' },
  { key: 'education', name: 'Education', path: 'education/' },
  { key: 'women', name: 'Women development', path: 'women-development/' },
  { key: 'involved', name: 'Get involved', path: 'get-involved/' },
];
const STORE = 'prayatn-photo-edits-v1';
const WA_MAX = 6000;
const PHOTO = /\/img\/([\w-]+?)-\d+\.(?:jpg|avif|webp)/;

const $ = (s, r = document) => r.querySelector(s);
const list = $('[data-list]'), status = $('[data-status]');
const countEl = $('[data-count]'), noteEl = $('[data-note]');
const sendBtn = $('[data-send]'), copyBtn = $('[data-copy]'), clearBtn = $('[data-clear]');

let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { /* starts empty */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* this visit only */ } };

const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
const fetchDoc = async (path) => {
  const res = await fetch(BASE + path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(String(res.status));
  return new DOMParser().parseFromString(await res.text(), 'text/html');
};
function nameOf(img) {
  const m = (img.getAttribute('src') || '').match(PHOTO);
  return m ? m[1] : null;
}
// A middling size: clear enough to see, light enough for 89 photos.
function thumbOf(img) {
  const set = (img.getAttribute('srcset') || '').split(',').map((c) => c.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 })).filter((c) => c.u);
  return (set.find((c) => c.w >= 560) || set.at(-1))?.u || img.getAttribute('src');
}
// A figure's caption, without the 01, 02… numbers of the photo strips.
function captionOf(fig) {
  const fc = fig?.querySelector(':scope > figcaption');
  if (!fc || fc.hasAttribute('data-label')) return null;
  const c = fc.cloneNode(true);
  c.querySelectorAll('.reel__n').forEach((n) => n.remove());
  return clean(c.textContent);
}

async function load() {
  // Captions: the gallery has every photo but the one at the top of Home.
  const photos = new Map(); // name -> { name, caption, thumb, uses: [{page, where}] }
  const gal = await fetchDoc('gallery/');
  for (const fig of gal.querySelectorAll('.g-item')) {
    const img = fig.querySelector('img'), n = img && nameOf(img);
    if (n) photos.set(n, { name: n, caption: captionOf(fig) ?? '', thumb: thumbOf(img), uses: [], order: Infinity });
  }
  // Where each photo is used: page, and the heading of the part of the page.
  let order = 0;
  const docs = await Promise.all(PAGES.map((p) => fetchDoc(p.path).catch(() => null)));
  PAGES.forEach((page, i) => {
    const doc = docs[i];
    const main = doc?.querySelector('main');
    if (!main) return;
    let heading = page.name;
    for (const el of main.querySelectorAll('h1,h2,h3,img')) {
      if (el.tagName !== 'IMG') {
        if (!el.closest('[aria-hidden="true"],.visually-hidden') || el.tagName === 'H1') heading = clean(el.textContent) || heading;
        continue;
      }
      const n = nameOf(el);
      if (!n) continue;
      let ph = photos.get(n);
      if (!ph) { // the photo at the top of Home is not in the gallery
        const fig = el.closest('figure');
        ph = { name: n, caption: captionOf(fig) ?? '', thumb: thumbOf(el), uses: [], order: Infinity, notInGallery: true };
        photos.set(n, ph);
      } else if (ph.notInGallery && !ph.caption) {
        ph.caption = captionOf(el.closest('figure')) ?? ph.caption;
      }
      if (ph.order === Infinity) ph.order = order++;
      // The photo at the top of a page has the page's title above it.
      const top = el.closest('.band, .weave, .intro');
      const part = top ? 'top of the page' : el.closest('.ncard') ? 'links to other pages, at the bottom' : heading.length > 70 ? `${heading.slice(0, 67).trim()}…` : heading;
      const where = part === page.name ? page.name : `${page.name} › ${part}`;
      if (!ph.uses.some((u) => u.where === where)) ph.uses.push({ page: page.name, where });
    }
  });
  return [...photos.values()].sort((a, b) => a.order - b.order);
}

const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };

function card(ph) {
  const ed = saved[ph.name];
  if (ed && (ed.orig !== ph.caption || ed.now === ph.caption)) delete saved[ph.name];
  const el = document.createElement('article');
  el.className = 'ph-card';
  const id = `c-${ph.name}`;
  el.innerHTML = `<img class="ph-card__img" alt="" loading="lazy"><div class="ph-card__body"><label class="ed-row__k" for="${id}">Caption</label><textarea id="${id}" rows="2" spellcheck="true" placeholder="(no caption)"></textarea><div class="ed-row__ch"><span>Changed</span><button type="button">Undo</button></div><div class="ph-card__used"><b>Used on:</b><ul></ul></div></div>`;
  el.querySelector('img').src = ph.thumb;
  const ul = el.querySelector('.ph-card__used ul');
  for (const w of (ph.uses.length ? ph.uses.map((u) => u.where) : ['Only in the Gallery'])) {
    const li = document.createElement('li'); li.textContent = w; ul.append(li);
  }
  const ta = el.querySelector('textarea');
  ta.value = saved[ph.name]?.now ?? ph.caption;
  const mark = () => el.classList.toggle('is-changed', clean(ta.value) !== ph.caption);
  mark();
  ta.addEventListener('input', () => {
    grow(ta); mark();
    const now = clean(ta.value);
    if (now === ph.caption) delete saved[ph.name];
    else saved[ph.name] = { orig: ph.caption, now, uses: ph.uses.map((u) => u.where).join(' · ') || 'Gallery' };
    save(); tally();
  });
  el.querySelector('button').addEventListener('click', () => {
    ta.value = ph.caption; delete saved[ph.name]; save(); grow(ta); mark(); tally(); ta.focus();
  });
  return el;
}

// Grouped by the first page each photo is used on; those used only in the
// gallery come last.
function render(photos) {
  list.replaceChildren();
  const groups = new Map();
  for (const ph of photos) {
    const g = ph.uses[0]?.page || 'Only in the Gallery';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(ph);
  }
  for (const [g, phs] of groups) {
    const h = document.createElement('h2');
    h.className = 'ph-group';
    h.textContent = g === 'Only in the Gallery' ? 'Only in the Gallery' : `First seen on ${g}`;
    const grid = document.createElement('div');
    grid.className = 'ph-grid';
    phs.forEach((ph) => grid.append(card(ph)));
    list.append(h, grid);
  }
  save(); tally();
  requestAnimationFrame(() => list.querySelectorAll('textarea').forEach(grow));
}

function message() {
  const keys = Object.keys(saved);
  const lines = keys.map((k) => `[Photo ${k}] Caption (used on: ${saved[k].uses})\nWas: ${saved[k].orig || '(no caption)'}\nNow: ${saved[k].now || '(delete this)'}\n`);
  return { n: keys.length, text: `Prayatn photo captions (${keys.length})\n\n${lines.join('\n').trim()}` };
}
function tally() {
  const { n } = message();
  countEl.textContent = n === 0 ? 'No changes yet' : n === 1 ? '1 change' : `${n} changes`;
  sendBtn.disabled = copyBtn.disabled = clearBtn.disabled = n === 0;
  clearBtn.textContent = 'Start again';
  delete clearBtn.dataset.sure;
}
sendBtn.addEventListener('click', () => {
  const { text } = message();
  if (text.length > WA_MAX) { noteEl.textContent = 'That is too long for one WhatsApp message. Press “Copy changes”, then paste it into WhatsApp.'; return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  noteEl.textContent = 'WhatsApp is opening. Choose the person who looks after the website and press send.';
});
copyBtn.addEventListener('click', async () => {
  const { text } = message();
  try { await navigator.clipboard.writeText(text); noteEl.textContent = 'Copied. Now paste it into WhatsApp or an email.'; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.className = 'ed-copybox'; ta.setAttribute('readonly', '');
    noteEl.replaceChildren('Select all of this and copy it:', ta); ta.focus(); ta.select();
  }
});
let photosCache = [];
clearBtn.addEventListener('click', () => {
  if (!clearBtn.dataset.sure) { clearBtn.dataset.sure = '1'; clearBtn.textContent = 'Yes, remove all my changes'; return; }
  saved = {}; save(); noteEl.textContent = 'All changes removed.'; render(photosCache);
});

load().then((photos) => {
  photosCache = photos;
  status.hidden = true;
  render(photos);
}).catch(() => { status.textContent = 'The photos could not be loaded. Check the internet connection and reload.'; });
