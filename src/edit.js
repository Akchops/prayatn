// "Edit the words" (/edit/): a plain copy of every sentence on the website,
// for the owner to change. It fetches the real pages and lists their text in
// order, each sentence in a box that can be typed in. Changes are kept in
// this browser (localStorage) and sent as one WhatsApp message (or copied),
// each change with a short code (E12) and the old and new words, so it can be
// found in the source and applied. Nothing here changes the site itself.
import './styles/edit.css';

const BASE = import.meta.env.BASE_URL;
const PAGES = [
  { key: 'home', code: 'H', name: 'Home', path: '' },
  { key: 'about', code: 'A', name: 'About', path: 'about/' },
  { key: 'healthcare', code: 'HC', name: 'Healthcare', path: 'healthcare/' },
  { key: 'education', code: 'E', name: 'Education', path: 'education/' },
  { key: 'women', code: 'W', name: 'Women development', path: 'women-development/' },
  { key: 'gallery', code: 'G', name: 'Gallery', path: 'gallery/' },
  { key: 'involved', code: 'J', name: 'Get involved', path: 'get-involved/' },
  { key: 'footer', code: 'F', name: 'Bottom of every page', path: '', footer: true },
];
const STORE = 'prayatn-edits-v1';
const WA_MAX = 6000; // longer messages are copied instead

// The text-holding elements, in reading order. An element inside another one
// already taken is skipped (a paragraph inside a quote, say).
const SEL = 'h1,h2,h3,h4,p,li,figcaption,blockquote,dt,dd,th,td,address,.way__t,.way__d';
// Numbers in front of list rows and captions (01, 02…) are not words to edit.
const SKIP = '[aria-hidden="true"],.visually-hidden,script,style,noscript,template,.preview-bar,.ticker,svg,.reel__n,.plist__n,.pindex__n,.way__n,.give__n,.wmap__n,.menu__n';

const $ = (s, r = document) => r.querySelector(s);
const tabs = $('[data-tabs]'), holder = $('[data-page]'), status = $('[data-status]');
const countEl = $('[data-count]'), noteEl = $('[data-note]');
const sendBtn = $('[data-send]'), copyBtn = $('[data-copy]'), clearBtn = $('[data-clear]');

// ---------- saved changes ----------
let saved = { edits: {}, notes: {} };
try { saved = { edits: {}, notes: {}, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { /* starts empty */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* kept for this visit only */ } };

// ---------- reading a page's text ----------
// Words separated only by markup (<b>884</b><span>students</span>) get a space.
function textOf(el) {
  let out = '';
  const walk = (n, boundary) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const t = c.nodeValue.replace(/\s+/g, ' ');
        if (boundary.v && /[\p{L}\p{N}]$/u.test(out) && /^[\p{L}\p{N}]/u.test(t)) out += ' ';
        out += t; boundary.v = false;
      } else if (c.nodeType === 1 && !c.matches(SKIP)) {
        if (c.tagName === 'BR') { out += ' '; continue; }
        boundary.v = true; walk(c, boundary); boundary.v = true;
      }
    }
  };
  walk(el, { v: false });
  return out.replace(/\s+/g, ' ').trim();
}
function kindOf(el) {
  const t = el.tagName, c = el.classList;
  if (t === 'H1') return 'Page title';
  if (t === 'H2') return 'Heading';
  if (t === 'H3' || t === 'H4' || c.contains('way__t')) return 'Small heading';
  if (c.contains('eyebrow') || c.contains('story__kicker') || c.contains('prog__num') || c.contains('band__kicker')) return 'Small label';
  if (c.contains('big')) return 'Large text';
  if (t === 'FIGCAPTION') return 'Photo caption';
  if (t === 'BLOCKQUOTE') return 'Quote';
  if (t === 'LI') return 'List item';
  if (t === 'TH' || t === 'TD') return 'Table';
  if (t === 'ADDRESS') return 'Address';
  return 'Text';
}
const cache = new Map();
async function blocksFor(page) {
  if (cache.has(page.key)) return cache.get(page.key);
  const res = await fetch(BASE + page.path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(String(res.status));
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const root = page.footer ? doc.querySelector('.site-foot') : doc.querySelector('main');
  const out = [];
  if (root) {
    const taken = [];
    for (const el of root.querySelectorAll(SEL)) {
      if (el.closest(SKIP) || taken.some((t) => t.contains(el))) continue;
      const text = textOf(el);
      if (text.length < 2 || !/[\p{L}]/u.test(text)) continue;
      taken.push(el);
      out.push({ code: `${page.code}${out.length + 1}`, kind: kindOf(el), text });
    }
  }
  cache.set(page.key, out);
  return out;
}

// ---------- showing a page ----------
const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };
let current = null;

async function show(page) {
  current = page;
  tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.key === page.key)));
  status.hidden = false; status.textContent = 'Loading the website’s words…';
  holder.replaceChildren();
  let blocks;
  try { blocks = await blocksFor(page); } catch {
    status.textContent = 'This page could not be loaded. Check the internet connection and try again.';
    return;
  }
  if (current !== page) return;
  status.hidden = true;

  const head = document.createElement('div');
  head.className = 'ed-pagehead';
  head.innerHTML = `<h2></h2><a target="_blank" rel="noopener">See this page on the website ↗</a>`;
  head.querySelector('h2').textContent = page.name;
  head.querySelector('a').href = BASE + page.path + (page.footer ? '#main' : '');
  holder.append(head);

  for (const b of blocks) {
    const ed = saved.edits[b.code];
    // A change that is now on the site, or was made to words that have since
    // changed, is dropped.
    if (ed && (ed.orig !== b.text || ed.now === b.text)) delete saved.edits[b.code];
    const row = document.createElement('div');
    row.className = 'ed-row';
    row.dataset.kind = b.kind;
    const id = `t-${b.code}`;
    row.innerHTML = `<label class="ed-row__k" for="${id}"></label><textarea id="${id}" rows="1" spellcheck="true"></textarea><div class="ed-row__ch"><span>Changed</span><button type="button">Undo</button></div>`;
    row.querySelector('label').textContent = b.kind;
    const ta = row.querySelector('textarea');
    ta.value = saved.edits[b.code]?.now ?? b.text;
    const mark = () => row.classList.toggle('is-changed', ta.value.trim() !== b.text);
    mark();
    ta.addEventListener('input', () => {
      grow(ta); mark();
      const now = ta.value.replace(/\s+/g, ' ').trim();
      if (now === b.text) delete saved.edits[b.code];
      else saved.edits[b.code] = { page: page.name, kind: b.kind, orig: b.text, now };
      save(); tally();
    });
    row.querySelector('button').addEventListener('click', () => {
      ta.value = b.text; delete saved.edits[b.code]; save(); grow(ta); mark(); tally(); ta.focus();
    });
    holder.append(row);
  }

  // Anything else for this page: a photo to add, a section to remove...
  const note = document.createElement('div');
  note.className = 'ed-note';
  note.innerHTML = `<label for="note-${page.key}">Anything else for this page? (add a photo, remove a part, a new section…)</label><textarea id="note-${page.key}" rows="3" placeholder="Write it here in your own words"></textarea>`;
  const nta = note.querySelector('textarea');
  nta.value = saved.notes[page.key] || '';
  nta.addEventListener('input', () => {
    grow(nta);
    const v = nta.value.trim();
    if (v) saved.notes[page.key] = v; else delete saved.notes[page.key];
    save(); tally();
  });
  holder.append(note);
  save(); tally();
  requestAnimationFrame(() => holder.querySelectorAll('textarea').forEach(grow));
}

// ---------- the changes, as one message ----------
function message() {
  const lines = [];
  let n = 0;
  for (const p of PAGES) {
    const eds = Object.entries(saved.edits).filter(([, e]) => e.page === p.name);
    const note = saved.notes[p.key];
    if (!eds.length && !note) continue;
    lines.push('', `*${p.name.toUpperCase()}*`);
    for (const [code, e] of eds) {
      n++;
      lines.push(`[${code}] ${e.kind}`, `Was: ${e.orig}`, `Now: ${e.now || '(delete this)'}`, '');
    }
    if (note) { n++; lines.push(`Also: ${note}`, ''); }
  }
  return { n, text: `Prayatn website changes (${n})\n${lines.join('\n').trim()}` };
}
function tally() {
  const { n } = message();
  countEl.textContent = n === 0 ? 'No changes yet' : n === 1 ? '1 change' : `${n} changes`;
  sendBtn.disabled = copyBtn.disabled = clearBtn.disabled = n === 0;
  // Changed pages are marked on their tabs.
  tabs.querySelectorAll('button').forEach((b) => {
    const p = PAGES.find((x) => x.key === b.dataset.key);
    const has = Object.values(saved.edits).some((e) => e.page === p.name) || saved.notes[p.key];
    b.classList.toggle('has-changes', Boolean(has));
  });
  clearBtn.textContent = 'Start again';
  delete clearBtn.dataset.sure;
}
sendBtn.addEventListener('click', () => {
  const { text } = message();
  if (text.length > WA_MAX) {
    noteEl.textContent = 'That is too long for one WhatsApp message. Press “Copy changes”, then paste it into WhatsApp.';
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  noteEl.textContent = 'WhatsApp is opening. Choose the person who looks after the website and press send.';
});
copyBtn.addEventListener('click', async () => {
  const { text } = message();
  try {
    await navigator.clipboard.writeText(text);
    noteEl.textContent = 'Copied. Now paste it into WhatsApp or an email.';
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.className = 'ed-copybox'; ta.setAttribute('readonly', '');
    noteEl.replaceChildren('Select all of this and copy it:', ta);
    ta.focus(); ta.select();
  }
});
clearBtn.addEventListener('click', () => {
  if (!clearBtn.dataset.sure) {
    clearBtn.dataset.sure = '1';
    clearBtn.textContent = 'Yes, remove all my changes';
    return;
  }
  saved = { edits: {}, notes: {} }; save();
  noteEl.textContent = 'All changes removed.';
  if (current) show(current);
});

// ---------- tabs ----------
for (const p of PAGES) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.key = p.key; b.textContent = p.name;
  b.addEventListener('click', () => { show(p); try { history.replaceState(null, '', `#${p.key}`); } catch { /* fine */ } window.scrollTo({ top: 0 }); });
  tabs.append(b);
}
show(PAGES.find((p) => `#${p.key}` === location.hash) || PAGES[0]);
