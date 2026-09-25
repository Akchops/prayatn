import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
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
  education: { href: '/education/', title: 'Education', img: 'gallery-53', line: 'Seth Vidyalaya and the Scholarship Scheme for Students.' },
  women: { href: '/women-development/', title: 'Women development', img: 'women-development-33', line: 'The Mahila Panchayat, the Legal Help Desk, and Addressing GBV in Communities.' },
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
    <p class="tax">* ${esc(site.taxLine)}</p>${reg}</li>
</ol>`;
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
          credit: esc(site.credit),
          tagline: esc(site.tagline),
          blurb: esc(site.blurb),
          // Pages with a header band get the full-screen opening (src/opening.js).
          opening: String(!['home', '404'].includes(page)),
          bank: bankBlock(site),
          give: giveBlock(site),
          receiptLine: esc(site.receiptLine),
          partnersHome: partnersBlock(partners, 'home'),
          partnersAbout: partnersBlock(partners, 'about'),
        };
        const fill = (s) => s
          .replace(/<!--@(\w+)-->/g, (_, p) => fill(read(`src/partials/${p}.html`)))
          .replace(/\{\{img ([\w-]+)([^}]*)\}\}/g, (_, n, a) => picture(n, a, images))
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
