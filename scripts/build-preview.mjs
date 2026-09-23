#!/usr/bin/env node
/**
 * Builds self-contained, single-file previews of the site into preview/:
 * every script, stylesheet, font and photo is inlined, so each page opens
 * straight from disk (or in a file viewer) with no server.
 *
 * For checking only: pages carry a "pre-launch preview" bar and noindex, and
 * photos are inlined as a single JPEG each (no AVIF, no srcset), so the files
 * are larger than the real site. The real site is `npm run build` -> dist/.
 *
 *   npm run build && node scripts/build-preview.mjs
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const out = join(root, 'preview');
if (!existsSync(join(dist, 'index.html'))) { console.error('Run npm run build first.'); process.exit(2); }
mkdirSync(out, { recursive: true });

const images = JSON.parse(readFileSync(join(root, 'src/data/images.json'), 'utf8'));
const b64 = (p) => readFileSync(p).toString('base64');
const mime = { woff2: 'font/woff2', svg: 'image/svg+xml', jpg: 'image/jpeg' };
const dataUri = (p) => `data:${mime[p.split('.').pop()]};base64,${b64(p)}`;

// One classic script with every dynamic import (GSAP, the weave) bundled in.
const js = (await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true, format: 'iife', minify: true, write: false, target: 'es2019',
  define: { 'import.meta.env': '{"DEV":false}' },
  logLevel: 'error',
})).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const pages = {
  'index.html': 'prayatn-home.html',
  'about/index.html': 'prayatn-about.html',
  'get-involved/index.html': 'prayatn-get-involved.html',
};
const link = (href) => {
  if (href === '/' ) return 'prayatn-home.html';
  if (href.startsWith('/#')) return 'prayatn-home.html' + href.slice(1);
  if (href.startsWith('/about/')) return 'prayatn-about.html' + href.slice(7);
  if (href.startsWith('/get-involved/')) return 'prayatn-get-involved.html' + href.slice(14);
  return href;
};

for (const [src, name] of Object.entries(pages)) {
  let html = readFileSync(join(dist, src), 'utf8');

  // Stylesheet, with fonts and the rug inlined.
  html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (_, href) => {
    const css = readFileSync(join(dist, href), 'utf8')
      .replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (m, q, u) => `url(${dataUri(join(dist, u))})`);
    return `<style>${css}</style>`;
  });

  // Scripts: drop the module entry and preloads; add the bundle at the end.
  html = html.replace(/<script type="module"[^>]*><\/script>/g, '')
    .replace(/<link rel="modulepreload"[^>]*>/g, '')
    .replace('</body>', `<script>${js}</script></body>`);

  // Photos: one JPEG each, at native width for the hero (so the native-size
  // cap is exercised) and at most 800px for the rest.
  html = html.replace(/<source type="image\/avif"[^>]*>/g, '')
    .replace(/<img src="\/img\/([\w-]+)-\d+\.jpg" srcset="[^"]*" sizes="[^"]*"/g, (_, n) => {
      const im = images[n];
      const w = n === 'gallery-81' ? im.width : (im.widths.filter((x) => x <= 800).at(-1) ?? im.widths[0]);
      return `<img src="${dataUri(join(dist, 'img', `${n}-${w}.jpg`))}"`;
    })
    .replace(/<link rel="preload" as="image"[^>]*>/g, '')
    .replace(/<meta property="og:image"[^>]*>/g, '')
    .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${dataUri(join(dist, 'favicon.svg'))}">`);

  // Links between pages point at the sibling preview files.
  html = html.replace(/href="(\/[^"]*)"/g, (_, h) => `href="${link(h)}"`);

  // Clearly a preview: not indexed, and a bar saying so above the header.
  html = html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow">')
    .replace(/<body([^>]*)>/, `<body$1>\n    <div style="background:#1E2440;color:#F3ECDF;font:600 13px/1.4 system-ui,sans-serif;padding:6px 16px;text-align:center">Pre-launch preview · not the live site</div>`);

  writeFileSync(join(out, name), html);
  console.log(`${name}  ${(html.length / 1024).toFixed(0)} kB`);
}
