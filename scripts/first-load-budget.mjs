#!/usr/bin/env node
/**
 * first-load-budget.mjs — Gate 4 verification.
 *
 * Measures what a browser must fetch and execute before the page is
 * interactive: the HTML document, render-blocking stylesheets, and entry
 * JavaScript together with its statically-imported chunks (which bundlers
 * declare as <link rel="modulepreload">).
 *
 * Images, video and fonts are excluded, per the gate's definition.
 * Dynamic imports are excluded too — that is exactly what the gate rewards.
 *
 *   node first-load-budget.mjs dist/            # 100 kB default
 *   node first-load-budget.mjs dist/ --limit 120
 *   node first-load-budget.mjs dist/ --html dist/index.html
 *
 * Exit code 0 = pass, 1 = over budget, 2 = could not measure.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve, dirname, relative } from 'node:path';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const root = resolve(positional[0] ?? 'dist');
const limitKb = Number(flag('limit', 100));
const htmlPath = resolve(flag('html', join(root, 'index.html')));

if (!existsSync(htmlPath)) {
  console.error(`Cannot measure: no HTML at ${htmlPath}`);
  console.error('Build first, or pass --html <path>.');
  process.exit(2);
}

const html = readFileSync(htmlPath, 'utf8');
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

/** Resolve an href from the HTML against the dist root or the document dir. */
function resolveAsset(href) {
  const clean = href.split('?')[0].split('#')[0];
  if (/^(https?:)?\/\//.test(clean) || clean.startsWith('data:')) return null; // external
  const candidates = clean.startsWith('/')
    ? [join(root, clean)]
    : [join(dirname(htmlPath), clean), join(root, clean)];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) ?? null;
}

const entries = [];
const seen = new Set();

function add(kind, href, note) {
  const path = resolveAsset(href);
  if (!path || seen.has(path)) return;
  seen.add(path);
  entries.push({ kind, note, path, bytes: gz(readFileSync(path)) });
}

// The document itself is part of first load.
entries.push({ kind: 'html', note: 'document', path: htmlPath, bytes: gz(Buffer.from(html)) });

// Render-blocking stylesheets. rel="preload"/"prefetch" are not blocking.
for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
  const tag = m[0];
  const rel = (tag.match(/\brel=["']?([^"'\s>]+)/i) || [])[1]?.toLowerCase();
  const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
  if (!href) continue;
  if (rel === 'stylesheet') add('css', href, 'render-blocking');
  // modulepreload declares the entry's static import graph: it is fetched
  // eagerly and is part of what must execute, so it counts.
  if (rel === 'modulepreload') add('js', href, 'static import');
}

// Scripts with a src. async/defer still execute before the page is usable in
// any meaningful sense for an interactive build, so they count.
for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
  const attrs = m[1];
  const src = (attrs.match(/\bsrc=["']([^"']+)["']/i) || [])[1];
  if (!src) continue;
  const defer = /\bdefer\b/i.test(attrs) ? 'defer' : /\basync\b/i.test(attrs) ? 'async' : 'blocking';
  add('js', src, defer);
}

// Inline styles and scripts ship inside the HTML and are already counted in the
// document figure above; note them so a large inline bundle is not a surprise.
const inlineJs = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .reduce((n, m) => n + m[1].length, 0);
const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  .reduce((n, m) => n + m[1].length, 0);

const total = entries.reduce((n, e) => n + e.bytes, 0);
const limit = limitKb * 1024;
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' kB';

console.log(`\nFirst-load budget — ${relative(process.cwd(), htmlPath)}\n`);
console.log('  KIND  GZIP        NOTE            FILE');
console.log('  ' + '-'.repeat(72));
for (const e of entries.sort((a, b) => b.bytes - a.bytes)) {
  console.log(
    `  ${e.kind.padEnd(5)}${kb(e.bytes)}  ${String(e.note).padEnd(15)} ${relative(root, e.path)}`
  );
}
console.log('  ' + '-'.repeat(72));
console.log(`  TOTAL ${kb(total)}  (limit ${limitKb} kB, excludes images, video, fonts)`);
if (inlineJs || inlineCss) {
  console.log(`  note: ${inlineJs} B inline JS and ${inlineCss} B inline CSS are inside the document figure.`);
}

// Name the heavy libraries if they made it into first load — that is the
// specific failure the gate exists to catch.
const suspects = entries.filter((e) => /three|gsap|scrolltrigger|lenis/i.test(e.path));
if (suspects.length) {
  console.log('\n  Heavy libraries in first load — these must be dynamically imported:');
  suspects.forEach((s) => console.log(`    ${relative(root, s.path)} (${kb(s.bytes).trim()})`));
}

if (total > limit) {
  console.log(`\n  FAIL — ${((total - limit) / 1024).toFixed(1)} kB over budget.\n`);
  process.exit(1);
}
console.log(`\n  PASS — ${((limit - total) / 1024).toFixed(1)} kB of headroom.\n`);
