import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
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
          bank: bankBlock(site),
        };
        const fill = (s) => s
          .replace(/<!--@(\w+)-->/g, (_, p) => fill(read(`src/partials/${p}.html`)))
          .replace(/\{\{img ([\w-]+)([^}]*)\}\}/g, (_, n, a) => picture(n, a, images))
          .replace(/\{\{(\w+)\}\}/g, (m, k) => {
            if (!(k in vars)) throw new Error(`Unknown template variable ${m} in ${ctx.path}`);
            return vars[k];
          })
          .replace(/ data-nav="(\w+)"/g, (_, n) => (n === page ? ' aria-current="page"' : ''));
        return fill(html);
      },
    },
    handleHotUpdate({ file, server }) {
      if (/src\/(partials|data)\//.test(file)) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  plugins: [templates()],
  build: {
    target: 'es2019',
    rollupOptions: {
      input: {
        home: resolve(root, 'index.html'),
        about: resolve(root, 'about/index.html'),
        involved: resolve(root, 'get-involved/index.html'),
        notfound: resolve(root, '404.html'),
      },
    },
  },
});
