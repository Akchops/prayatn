import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
// BASE: where the site is served from ("/" for the real domain, "/prayatn/"
// for a GitHub Pages preview). PREVIEW: adds noindex and a preview bar.
const BASE = process.env.BASE || '/';
const PREVIEW = Boolean(process.env.PREVIEW);
const withBase = (html) => BASE === '/' ? html : html
  .replace(/(href|src|data-preview)="\/(?!\/|src\/)/g, `$1="${BASE}`)
  .replace(/(srcset|imagesrcset)="([^"]*)"/g, (m, a, v) => `${a}="${v.replace(/(^|, )\//g, `$1${BASE}`)}"`)
  .replace(/url\('\/(?!\/)/g, `url('${BASE}`);
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tel = (n) => 'tel:+91' + n.replace(/^0/, '').replace(/\D/g, '');

// <picture> for an owner photo. The width/height attributes are the native
// size and --native caps the CSS width at it, so no photo is ever shown wider
// than it was taken.
function picture(name, attrs, images) {
  const im = images[name];
  if (!im) throw new Error(`{{img ${name}}}: not in src/data/images.json (run npm run images)`);
  const a = Object.fromEntries([...attrs.matchAll(/(\w[\w-]*)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const sizes = a.sizes ?? `(min-width: 900px) 50vw, 100vw`;
  const set = (ext) => im.widths.map((w) => `/img/${name}-${w}.${ext} ${w}w`).join(', ');
  const fallback = im.widths.find((w) => w >= 800) ?? im.widths.at(-1);
  const loading = a.loading ?? 'lazy';
  return `<picture class="${esc(a.class ?? 'photo')}"><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><img src="/img/${name}-${fallback}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${im.width}" height="${im.height}" alt="${esc(a.alt ?? im.alt)}" loading="${loading}" decoding="async"${a.fetchpriority ? ` fetchpriority="${a.fetchpriority}"` : ''} style="--native:${im.width}px"${a.id ? ` id="${a.id}"` : ''}></picture>`;
}

// More photos for a programme-page story step, in order of preference. On a
// PC, src/story.js lays them out with the step's own photo so the panel fills
// without any photo being enlarged. Inside a <template>, so nothing is fetched
// on phones or without JS.
function more(names, images) {
  return `<template class="story__more">${names.trim().split(/\s+/).map((n) => picture(n, 'sizes="40vw" loading="eager"', images)).join('')}</template>`;
}

const CATS = { health: 'Healthcare', school: 'Education', women: 'Women development', events: 'Events' };

// A grid of every photo in a category (or all of them, grouped), each with its
// description as the caption. Figures carry data-cat for the gallery filter.
function gallery(which, images) {
  const names = Object.keys(images).filter((n) => images[n].use !== 'hero' && (which === 'all' || images[n].use === which));
  const fig = (n) => `<figure class="g-item" data-cat="${images[n].use}">${picture(n, 'sizes="(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw"', images)}<figcaption>${esc(images[n].alt)}</figcaption></figure>`;
  if (which !== 'all') return `<div class="g-grid">${names.map(fig).join('')}</div>`;
  return Object.entries(CATS).map(([cat, label]) => {
    const list = names.filter((n) => images[n].use === cat);
    return `<section class="g-group" data-cat="${cat}" aria-labelledby="g-${cat}"><h2 id="g-${cat}" class="g-group__title">${label}</h2><div class="g-grid">${list.map(fig).join('')}</div></section>`;
  }).join('');
}

// The photo card in a page's header band. The same photo is already the
// woven background, so this copy is decorative (alt=""). Its width is capped
// at the photo's native size in CSS (--native).
function bandImg(name, images) {
  const im = images[name];
  if (!im) throw new Error(`{{bandimg ${name}}}: unknown photo`);
  const set = (ext) => im.widths.map((w) => `/img/${name}-${w}.${ext} ${w}w`).join(', ');
  const sizes = '(min-width: 1000px) 46vw, 92vw';
  return `<div class="band__card" aria-hidden="true" style="--native:${im.width}px;--ar:${im.width}/${im.height};--weave-img:url('/img/${name}-weave.png')"><picture><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><img src="/img/${name}-${im.widths.find((w) => w >= 800) ?? im.widths.at(-1)}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${im.width}" height="${im.height}" alt="" fetchpriority="high" decoding="async"></picture></div>`;
}

// A horizontal reel of every photo in one category, in two rows, each photo
// with its caption.
// Without JS or with reduced motion it is a swipeable row; with motion it is
// pinned and driven by vertical scroll (src/reel.js).
function reel(which, images) {
  const names = Object.keys(images).filter((n) => images[n].use === which);
  const card = (n, i) => `<figure class="reel__card"><div class="reel__img">${picture(n, 'sizes="(min-width: 900px) 440px, 60vw"', images)}</div><figcaption><span class="reel__n">${String(i + 1).padStart(2, '0')}</span>${esc(images[n].alt)}</figcaption></figure>`;
  const cards = names.map(card);
  // Two rows: alternate photos, so neighbours differ in both rows.
  const rowA = cards.filter((_, i) => i % 2 === 0), rowB = cards.filter((_, i) => i % 2 === 1);
  return `<div class="reel__rows"><div class="reel__track" data-reel-track>${rowA.join('')}</div><div class="reel__track reel__track--b" data-reel-track>${rowB.join('')}</div></div>`;
}

// Partners and supporters, from src/data/partners.json: one card each, the
// logo on a white panel (or the name set as a wordmark when there is no logo)
// and the name below. Renders nothing while the list is empty: no
// placeholder names ever reach the page.
function partnersBlock(list, variant) {
  if (!list.length) return '';
  const card = (p, i) => {
    const mark = p.logo
      ? `<img src="/partners/${esc(p.logo)}" alt="" loading="lazy">`
      : `<span class="pcard__word">${esc(p.name)}</span>`;
    const inner = `<span class="pcard__panel">${mark}</span><span class="pcard__name">${esc(p.name)}</span>${p.what ? `<span class="pcard__what">${esc(p.what)}</span>` : ''}`;
    return `<li class="pcard" style="--r:${i}">${p.url ? `<a class="pcard__face" href="${esc(p.url)}" rel="noopener" target="_blank">${inner}</a>` : `<div class="pcard__face">${inner}</div>`}</li>`;
  };
  return `<section class="partners partners--${variant}" aria-labelledby="partners-${variant}"><div class="partners__inner"><p class="eyebrow">With thanks</p><h2 id="partners-${variant}" class="rv">Our partners &amp; supporters</h2><ul class="pcards" data-partners>${list.map(card).join('')}</ul></div></section>`;
}

// A large link to another programme page: its header photo, first as the
// woven thread picture, resolving into the photograph on hover (or, on a
// phone, as it comes into view: src/motion.js).
const PROGRAMMES = {
  healthcare: { href: '/healthcare/', title: 'Healthcare', img: 'school-health-clinic-09', line: 'Swaasthya Kendra and the School Health Program.' },
  education: { href: '/education/', title: 'Education', img: 'gallery-53', line: 'Seth Vidyalaya, Project Savera, and scholarships for meritorious students.' },
  women: { href: '/women-development/', title: 'Women development', img: 'women-development-33', line: 'Ten Mahila Panchayats, Crisis Management Centres, a weekly Legal Help Desk, and young people as agents of change.' },
};
function nextCard(key, label, images) {
  const p = PROGRAMMES[key];
  const im = p && images[p.img];
  if (!p || !im) throw new Error(`{{nextcard ${key}}}: unknown`);
  const prev = label === 'Previous';
  return `<a class="ncard${prev ? ' ncard--prev' : ''}" href="${p.href}" style="--weave-img:url('/img/${p.img}-weave.png');--weave-rows:${im.rows}"><span class="ncard__weave woven" aria-hidden="true"></span><span class="ncard__photo">${picture(p.img, 'sizes="(min-width: 800px) 50vw, 100vw" alt=""', images)}</span><span class="ncard__body"><span class="ncard__k">${esc(label)}</span><span class="ncard__t">${esc(p.title)}</span><span class="ncard__d">${esc(p.line)}</span><span class="ncard__go" aria-hidden="true">${prev ? '←' : '→'}</span></span></a>`;
}

function bankBlock(site) {
  const b = site.bank;
  const phones = site.phones.map((p) => `<a href="${tel(p)}">${p}</a>`).join(' or ');
  if (!b) {
    return `<p class="bank bank--pending">For bank transfer details, call ${phones}, or email <a href="mailto:${site.email}?subject=Bank%20transfer%20details">${site.email}</a>. We will send them to you.</p>`;
  }
  const row = (k, v) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`;
  return `<dl class="bank">${row('Account name', b.accountName)}${row('Account number', b.accountNumber)}${row('IFSC', b.ifsc)}${row('Bank', b.bank)}${row('Branch', b.branch)}</dl>`;
}

// The full donate panel (Get involved): three steps, send, tell us, receipt.
// Bank details, the bank's QR and the 80G number appear only once they are
// filled in src/data/site.json; nothing is shown in their place until then.
function giveBlock(site) {
  const phones = site.phones.map((p) => `<a href="${tel(p)}">${p}</a>`).join(' or ');
  const b = site.bank;
  const copy = (v) => `<button type="button" class="give__copy" data-copy="${esc(v)}" hidden>Copy</button>`;
  const row = (k, v) => `<div><dt>${k}</dt><dd><span>${esc(v)}</span>${copy(v)}</dd></div>`;
  const bank = b
    ? `<dl class="bank">${row('Account name', b.accountName)}${row('Account number', b.accountNumber)}${row('IFSC', b.ifsc)}${row('Bank', b.bank)}${row('Branch', b.branch)}</dl>`
    : `<p class="bank bank--pending">Call ${phones}, or email <a href="mailto:${site.email}?subject=Bank%20transfer%20details">${site.email}</a>, and we will send you the account details.</p>`;
  const qr = site.bankQr ? `<figure class="give__qr"><img src="/${esc(site.bankQr)}" alt="QR code for Prayatn's bank account" width="200" height="200" loading="lazy"><figcaption>Scan with your bank's app</figcaption></figure>` : '';
  const body = encodeURIComponent('Name:\nPostal address:\nPAN (for the 80G receipt):\nAmount:\nDate:\nTransaction reference or cheque number:\n');
  const g = site.eightyG || {};
  const reg = g.number ? `<p class="give__reg">80G registration: <b>${esc(g.number)}</b>${g.validity ? `, valid ${esc(g.validity)}` : ''}</p>` : '';
  return `<ol class="give">
  <li class="give__step"><span class="give__n" aria-hidden="true">1</span><h3>Send your gift</h3>
    <h4>By bank transfer</h4>${bank}${qr}
    <h4>By cheque</h4><p>${esc(site.chequePayee)}</p><p class="small">Post it to Prayatn, ${site.address.map(esc).join(', ')}.</p></li>
  <li class="give__step"><span class="give__n" aria-hidden="true">2</span><h3>Tell us</h3>
    <p>Email us your name, postal address, PAN, the amount, the date and the transaction reference or cheque number.</p>
    <p><a class="btn btn--donate" href="mailto:${site.email}?subject=Donation%20receipt&amp;body=${body}">Email us the details</a></p>
    <p class="small">Or call ${phones}.</p></li>
  <li class="give__step"><span class="give__n" aria-hidden="true">3</span><h3>Get your receipt</h3>
    <p>${esc(site.receiptLine)}</p>
    <p class="tax">* ${esc(site.taxLine)}</p>${site.registration ? `<p class="tax">${esc(site.registration)}</p>` : ''}${reg}</li>
</ol>`;
}

// Feature 3 (switchable in site.json: features.giftSlider): what a gift can
// do, from the one real per-unit figure we have: a scholarship is Rs 1,000 a
// month for each student. Renders nothing when switched off.
function giftBlock(site) {
  if (!site.features?.giftSlider) return '';
  return `<div class="gift" data-gift>
  <p class="gift__label" id="gift-l">What your gift can do</p>
  <p class="gift__amount"><output data-gift-out for="gift-range">₹3,000</output></p>
  <input id="gift-range" class="gift__range" type="range" min="1000" max="36000" step="1000" value="3000" aria-labelledby="gift-l" data-gift-range>
  <div class="gift__months" aria-hidden="true" data-gift-months></div>
  <p class="gift__says" data-gift-says aria-live="polite">keeps a scholar in school for 3 months.</p>
  <p class="gift__note">A scholarship is Rs 1,000 a month for each student, Rs 12,000 a year. To give to the Scholarship Scheme, say so when you tell us about your gift.</p>
</div>`;
}

// The slider again on Home, woven into the scroll: the band is pinned and
// scrolling through it slides the amount up (src/features/gift.js).
function giftBand(site) {
  if (!site.features?.giftSlider) return '';
  return `<section class="giftband" aria-labelledby="giftband-h" data-gift-scroll>
  <div class="giftband__inner">
    <div class="giftband__text">
      <h2 id="giftband-h" class="giftband__h rv">What ₹1,000 does</h2>
      <p class="giftband__p">It keeps one of our scholars in school for a month. Keep scrolling, or slide, to see what your gift would cover.</p>
      <p><a class="btn btn--donate" href="/get-involved/#donate">Give now</a></p>
    </div>
    ${giftBlock(site)}
  </div>
</section>`;
}

// Feature 2 (switchable in site.json: features.whereMap): the woven map of
// where Prayatn works, on About. Positions are approximate (the map says so);
// what is listed at each place comes from the Annual Report 2025-26.
const PLACES = [
  { id: 'kalkaji', name: 'Kalkaji', lat: 28.5465, lon: 77.2595, office: true, text: 'Our office, E-103, G.F., Kalkaji. Where the work is planned and run from.' },
  { id: 'sriniwaspuri', name: 'Sriniwaspuri', lat: 28.5655, lon: 77.2480, text: 'A Mahila Panchayat, and families in the Jagruk Pariwar programme.' },
  { id: 'ashram', name: 'Ashram', lat: 28.5725, lon: 77.2555, text: 'A Mahila Panchayat, including Double Storey. English conversation classes for young people, Jagruk Pariwar families, a Self-Help Group, and Women’s Day 2025 at the Ashram Community Centre.' },
  { id: 'nizamuddin', name: 'Nizamuddin', lat: 28.5893, lon: 77.2440, below: true, text: 'A Mahila Panchayat and a Community Resource Centre. Jagruk Pariwar families, a Self-Help Group, and Eid at the Nizamuddin centre.' },
  { id: 'sarai', name: 'Sarai Kale Khan', lat: 28.5905, lon: 77.2585, text: 'A Mahila Panchayat.' },
  { id: 'okhla', name: 'Okhla', lat: 28.5480, lon: 77.2800, text: 'A Mahila Panchayat in Okhla Basti and a Community Resource Centre in Okhla Phase II. Beauty culture and English classes for young people.' },
  { id: 'harkesh', name: 'Harkesh Nagar', lat: 28.5335, lon: 77.2735, text: 'A Mahila Panchayat, and families in the Jagruk Pariwar programme.' },
  { id: 'gautampuri', name: 'Gautampuri', lat: 28.5245, lon: 77.2960, text: 'A Mahila Panchayat, a Self-Help Group, Jagruk Pariwar families and beauty culture training. Diwali at the Gautampuri centre.' },
  { id: 'madanpur', name: 'Madanpur Khadar', lat: 28.5165, lon: 77.3110, text: 'Seth Vidyalaya and Project Savera, about 900 children. The Swaasthya Kendra. Mahila Panchayats at Seth Vidyalaya, A1 and Babloo Dairy, beauty culture and English classes, and Self-Help Groups.' },
];
function whereMap(site) {
  if (!site.features?.whereMap) return '';
  const X = (lon) => +((lon - 77.232) * 5600).toFixed(1), Y = (lat) => +((28.603 - lat) * 6360).toFixed(1);
  const W = 560, H = 640;
  const river = [[28.606, 77.2685], [28.585, 77.2715], [28.566, 77.2835], [28.548, 77.3005], [28.530, 77.3155], [28.500, 77.3270]]
    .map(([la, lo], i) => `${i ? 'L' : 'M'}${X(lo)} ${Y(la)}`).join(' ');
  const route = PLACES.map((p, i) => `${i ? 'L' : 'M'}${X(p.lon)} ${Y(p.lat)}`).join(' ');
  const knots = PLACES.map((p, i) => {
    const x = X(p.lon), y = Y(p.lat), right = x < W * 0.62;
    return `<g class="wmap__place${p.office ? ' wmap__place--office' : ''}" data-i="${i}" transform="translate(${x} ${y})"><circle class="wmap__ring" r="18"/><circle class="wmap__knot" r="${p.office ? 11 : 8}"/><text x="${p.below ? 0 : right ? 16 : -16}" y="${p.below ? 28 : 5}" text-anchor="${p.below ? 'middle' : right ? 'start' : 'end'}">${esc(p.name)}</text></g>`;
  }).join('');
  const items = PLACES.map((p, i) => `<li class="wmap__item" data-i="${i}"><span class="wmap__n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(p.name)}${p.office ? ' <small>our office</small>' : ''}</h3><p>${esc(p.text)}</p></li>`).join('');
  return `<div class="wmap" data-wmap>
  <div class="wmap__stick">
    <figure class="wmap__fig">
      <svg class="wmap__svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="wmap-t">
        <title id="wmap-t">A woven map of South and South-East Delhi, showing the nine places where Prayatn works, from its office in Kalkaji to Madanpur Khadar by the Yamuna. Not to scale.</title>
        <defs><pattern id="wmap-weave" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#1E2440"/><rect width="6" height="6" fill="#262D4D"/><rect x="6" y="6" width="6" height="6" fill="#262D4D"/></pattern></defs>
        <rect width="${W}" height="${H}" fill="url(#wmap-weave)"/>
        <path class="wmap__river" d="${river}"/>
        <text class="wmap__rivername" x="${X(77.3)}" y="${Y(28.566)}" transform="rotate(-52 ${X(77.3)} ${Y(28.566)})">Yamuna</text>
        <path class="wmap__route-under" d="${route}"/>
        <path class="wmap__route" d="${route}" pathLength="1"/>
        ${knots}
      </svg>
      <figcaption>Not to scale: positions are approximate. A Legal Help Desk is held every week in each project community.</figcaption>
    </figure>
    <ol class="wmap__list">${items}</ol>
  </div>
</div>`;
}

// Feature 4 (switchable in site.json: features.findMap): our own street map
// of the office's neighbourhood on Get involved, drawn from OpenStreetMap data
// saved in src/data/findmap.json (npm run map-data). Until that file exists,
// or with the feature off, the Google map is shown as before.
const GOOGLE_Q = 'E-103%2C%20Kalkaji%2C%20New%20Delhi%20110019';
function findMap(site) {
  const file = resolve(root, 'src/data/findmap.json');
  if (!site.features?.findMap || !existsSync(file)) {
    return `<iframe class="findmap__frame" title="Map showing Prayatn, E-103, Kalkaji, New Delhi" src="https://www.google.com/maps?q=${GOOGLE_Q}&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  }
  const m = JSON.parse(readFileSync(file, 'utf8'));
  const [W, H] = m.size;
  const join = (list) => list.join('');
  // Rough width of a label in map units at font size f, to skip names that
  // will not fit along their street.
  const fits = (n, f) => n.name.length * f * 0.56 < n.len * 0.8;
  const roads = ['path', 'service', 'minor', 'tertiary', 'secondary', 'major'];
  const casings = roads.filter((c) => c !== 'path' && m.roads[c]?.length).map((c) => `<path class="fmap__case fmap__case--${c}" d="${join(m.roads[c])}"/>`).join('');
  const fills = roads.filter((c) => m.roads[c]?.length).map((c) => `<path class="fmap__road fmap__road--${c}" d="${join(m.roads[c])}"/>`).join('');
  const names = m.names.filter((n) => fits(n, n.cls === 'minor' ? 10 : 12));
  const defs = names.map((n, i) => `<path id="fmap-n${i}" d="${n.d}"/>`).join('');
  const streetLabels = names.map((n, i) => `<text class="fmap__street fmap__street--${n.cls}"><textPath href="#fmap-n${i}" startOffset="50%">${esc(n.name)}</textPath></text>`).join('');
  const rail = m.rail.map((r) => `<path class="fmap__rail${r.under ? ' fmap__rail--under' : ''}" d="${r.d}"/>`).join('');
  const stations = m.stations.map((st) => `<g class="fmap__station" transform="translate(${st.at[0]} ${st.at[1]})"><g class="fmap__keep"><circle r="7"/><text x="11" y="4">${esc(st.name)}</text></g></g>`).join('');
  const places = m.places.map((p) => `<text class="fmap__place" x="${p.at[0]}" y="${p.at[1]}">${esc(p.name)}</text>`).join('');
  const pois = m.pois.filter((p) => p.kind !== 'school').map((p) => `<g class="fmap__poi fmap__poi--${p.kind}" transform="translate(${p.at[0]} ${p.at[1]})"><g class="fmap__keep"><circle r="4"/><text y="-8">${esc(p.name)}</text></g></g>`).join('');
  const view = site.findMap.view ?? 1500;
  return `<div class="fmap" data-fmap data-w="${W}" data-h="${H}" data-view="${view}" tabindex="0" aria-label="Map of the streets around our office. Drag, or use the buttons, to move and zoom.">
  <svg class="fmap__svg" viewBox="${-view / 2} ${-view / 2 * 0.6} ${view} ${view * 0.6}" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="fmap-t">
    <title id="fmap-t">Map of the streets around Prayatn's office at E-103, G.F., Kalkaji, New Delhi, with the nearest metro stations.</title>
    <defs>
      <pattern id="fmap-twill" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#F3ECDF"/><path d="M0 8 8 0M-2 2 2-2M6 10 10 6" stroke="#EAE1CF" stroke-width="1.6"/></pattern>
      <pattern id="fmap-green" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#CFDDCB"/><path d="M0 5h10" stroke="#BCD0B8" stroke-width="2"/></pattern>
      ${defs}
    </defs>
    <rect x="${-W / 2}" y="${-H / 2}" width="${W}" height="${H}" fill="url(#fmap-twill)"/>
    <path class="fmap__bld" d="${m.buildings[0] || ''}"/>
    <g class="fmap__green">${m.green.map((d) => `<path d="${d}"/>`).join('')}</g>
    <g class="fmap__water">${m.water.map((d) => `<path d="${d}"/>`).join('')}${m.rivers.map((d) => `<path class="fmap__river" d="${d}"/>`).join('')}</g>
    <g class="fmap__roads">${casings}${fills}</g>
    ${rail}
    <g class="fmap__labels">${places}${streetLabels}</g>
    ${pois}${stations}
    <g class="fmap__office"><g class="fmap__keep"><circle class="fmap__ring" r="16"/><circle class="fmap__knot" r="9"/><g class="fmap__flag" transform="translate(16 -46)"><rect width="142" height="44" rx="2"/><text x="12" y="20" class="fmap__flagname">Prayatn</text><text x="12" y="36" class="fmap__flagaddr">E-103, G.F., Kalkaji</text></g></g></g>
  </svg>
  <div class="fmap__ui">
    <button type="button" class="fmap__btn" data-zoom="in" aria-label="Zoom in">+</button>
    <button type="button" class="fmap__btn" data-zoom="out" aria-label="Zoom out">−</button>
    <button type="button" class="fmap__btn fmap__btn--home" data-zoom="home" aria-label="Back to our office"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="10" r="2" fill="currentColor"/><path d="M10 0v4M10 16v4M0 10h4M16 10h4" stroke="currentColor" stroke-width="2"/></svg></button>
  </div>
  <p class="fmap__hint" aria-hidden="true"></p>
  <p class="fmap__credit">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</p>
</div>`;
}
// The footer's small map box: a link to our map once it exists, otherwise the
// button that loads Google's map on request (src/ui.js).
function footMap(site) {
  const ours = site.features?.findMap && existsSync(resolve(root, 'src/data/findmap.json'));
  const google = `<a class="map__open" href="https://www.google.com/maps/search/?api=1&amp;query=${GOOGLE_Q}" target="_blank" rel="noopener">${ours ? 'Directions' : 'Open in Google Maps'} ↗</a>`;
  return ours
    ? `<div class="map map--ours"><div class="map__btns"><a class="map__load" href="/get-involved/#map">See our map</a>${google}</div></div>`
    : `<div class="map" data-map>${google}</div>`;
}

function templates() {
  return {
    name: 'prayatn-templates',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const site = json('src/data/site.json');
        const images = json('src/data/images.json');
        const partners = json('src/data/partners.json').partners || [];
        const year = new Date().getFullYear();
        const page = (ctx.path.match(/\/([\w-]+)\/index\.html$/)?.[1]) ?? (ctx.path === '/404.html' ? '404' : 'home');
        const vars = {
          years: String(year - site.founded),
          year: String(year),
          founded: String(site.founded),
          email: site.email,
          phone1: site.phones[0],
          tel1: tel(site.phones[0]),
          address: site.address.map(esc).join('<br>'),
          addressLine: site.address.map(esc).join(', '),
          cheque: esc(site.chequePayee),
          taxLine: esc(site.taxLine),
          registration: esc(site.registration || ''),
          credit: esc(site.credit),
          tagline: esc(site.tagline),
          blurb: esc(site.blurb),
          // Pages with a header band get the full-screen opening (src/opening.js).
          opening: String(!['home', '404'].includes(page)),
          home: String(page === 'home'),
          bank: bankBlock(site),
          gift: giftBlock(site),
          wheremap: whereMap(site),
          // Switchable features (site.json features), read by the inline script in head.html.
          features: Object.entries(site.features || {}).filter(([, on]) => on).map(([k]) => k).join(' '),
          give: giveBlock(site),
          receiptLine: esc(site.receiptLine),
          partnersHome: partnersBlock(partners, 'home'),
          partnersAbout: partnersBlock(partners, 'about'),
        };
        const fill = (s) => s
          .replace(/<!--@(\w+)-->/g, (_, p) => fill(read(`src/partials/${p}.html`)))
          .replace(/\{\{img ([\w-]+)([^}]*)\}\}/g, (_, n, a) => picture(n, a, images))
          .replace(/\{\{more ([\w\s-]+)\}\}/g, (_, n) => more(n, images))
          .replace(/\{\{giftband (\w+)\}\}/g, () => giftBand(site))
          .replace(/\{\{findmap\}\}/g, () => findMap(site))
          .replace(/\{\{footmap\}\}/g, () => footMap(site))
          .replace(/\{\{gallery ([\w-]+)\}\}/g, (_, w) => gallery(w, images))
          .replace(/\{\{reel ([\w-]+)\}\}/g, (_, w) => reel(w, images))
          .replace(/\{\{nextcard ([\w-]+) ([\w-]+)\}\}/g, (_, k, l) => nextCard(k, l, images))
          .replace(/\{\{bandimg ([\w-]+)\}\}/g, (_, n) => bandImg(n, images))
          .replace(/\{\{weave ([\w-]+)\}\}/g, (_, n) => { if (!images[n]) throw new Error(`{{weave ${n}}}: unknown photo`); return `--weave-img:url('/img/${n}-weave.png');--weave-rows:${images[n].rows}`; })
          .replace(/\{\{(\w+)\}\}/g, (m, k) => {
            if (!(k in vars)) throw new Error(`Unknown template variable ${m} in ${ctx.path}`);
            return vars[k];
          })
          .replace(/ data-nav="(\w+)"/g, (_, n) => (n === page ? ' aria-current="page"' : ''));
        let out = withBase(fill(html));
        if (PREVIEW) {
          out = out.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow">')
            .replace(/<body([^>]*)>/, '<body$1>\n    <div class="preview-bar">Pre-launch preview · not the live site</div>');
        }
        return out;
      },
    },
    handleHotUpdate({ file, server }) {
      if (/src\/(partials|data)\//.test(file)) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [templates()],
  build: {
    target: 'es2019',
    rollupOptions: {
      input: {
        home: resolve(root, 'index.html'),
        about: resolve(root, 'about/index.html'),
        involved: resolve(root, 'get-involved/index.html'),
        healthcare: resolve(root, 'healthcare/index.html'),
        education: resolve(root, 'education/index.html'),
        women: resolve(root, 'women-development/index.html'),
        gallery: resolve(root, 'gallery/index.html'),
        notfound: resolve(root, '404.html'),
      },
    },
  },
});
