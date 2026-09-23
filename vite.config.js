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
  return `<picture class="${esc(a.class ?? 'photo')}"><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><img src="/img/${name}-${fallback}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${im.width}" height="${im.height}" alt="${esc(im.alt)}" loading="${loading}" decoding="async"${a.fetchpriority ? ` fetchpriority="${a.fetchpriority}"` : ''} style="--native:${im.width}px"${a.id ? ` id="${a.id}"` : ''}></picture>`;
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

// A horizontal reel of one category's photos (up to 9), each with its caption.
// Without JS or with reduced motion it is a swipeable row; with motion it is
// pinned and driven by vertical scroll (src/reel.js).
function reel(which, images) {
  const names = Object.keys(images).filter((n) => images[n].use === which).slice(0, 9);
  const card = (n, i) => `<figure class="reel__card"><div class="reel__img">${picture(n, 'sizes="(min-width: 900px) 42vw, 80vw"', images)}</div><figcaption><span class="reel__n">${String(i + 1).padStart(2, '0')}</span>${esc(images[n].alt)}</figcaption></figure>`;
  return `<div class="reel__track" data-reel-track>${names.map(card).join('')}</div>`;
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

function templates() {
  return {
    name: 'prayatn-templates',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const site = json('src/data/site.json');
        const images = json('src/data/images.json');
        const year = new Date().getFullYear();
        const page = (ctx.path.match(/\/([\w-]+)\/index\.html$/)?.[1]) ?? (ctx.path === '/404.html' ? '404' : 'home');
        const vars = {
          years: String(year - site.founded),
          year: String(year),
          founded: String(site.founded),
          email: site.email,
          phone1: site.phones[0],
          phone2: site.phones[1],
          tel1: tel(site.phones[0]),
          tel2: tel(site.phones[1]),
          address: site.address.map(esc).join('<br>'),
          addressLine: site.address.map(esc).join(', '),
          cheque: esc(site.chequePayee),
          taxLine: esc(site.taxLine),
          credit: esc(site.credit),
          tagline: esc(site.tagline),
          blurb: esc(site.blurb),
          bank: bankBlock(site),
        };
        const fill = (s) => s
          .replace(/<!--@(\w+)-->/g, (_, p) => fill(read(`src/partials/${p}.html`)))
          .replace(/\{\{img ([\w-]+)([^}]*)\}\}/g, (_, n, a) => picture(n, a, images))
          .replace(/\{\{gallery ([\w-]+)\}\}/g, (_, w) => gallery(w, images))
          .replace(/\{\{reel ([\w-]+)\}\}/g, (_, w) => reel(w, images))
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
