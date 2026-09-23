#!/usr/bin/env node
/**
 * motion-qa.mjs — evidence gathering for immersive-motion-qa.
 *
 * Drives six viewports x nine scroll depths (54 captures), plus the
 * reduced-motion, no-WebGL and no-JS passes. Writes screenshots and a
 * report.json, prints a summary, and exits non-zero on any console error,
 * page error, or failed request.
 *
 * It gathers evidence. It does NOT decide the verdict — naming the signature
 * interaction is a judgement made by looking at the frames.
 *
 *   node motion-qa.mjs http://localhost:5173
 *   node motion-qa.mjs https://staging.example.com --out ./qa-run --settle 900
 *
 * Exit: 0 clean, 1 errors found, 2 could not run.
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// This script normally lives outside the project it is testing (in the skill
// directory), and Node resolves bare imports from the *importing module's*
// location. So a plain `import 'playwright'` looks next to this file and misses
// the copy installed in the project under test. Resolve from the working
// directory first, then fall back to the ordinary lookup.
async function loadPlaywright() {
  try {
    const req = createRequire(join(process.cwd(), 'package.json'));
    return await import(pathToFileURL(req.resolve('playwright')).href);
  } catch { /* not installed in the project; try this script's own tree */ }
  try {
    return await import('playwright');
  } catch { return null; }
}

const pwModule = await loadPlaywright();
// Playwright is CommonJS. Importing it by file URL yields a namespace whose
// named exports depend on static analysis, so take `default` when present.
const pw = pwModule && (pwModule.chromium ? pwModule : pwModule.default);
if (!pw || !pw.chromium) {
  console.error('Playwright is not available.\n');
  console.error('  npm i -D playwright   (run this in the project you are testing;');
  console.error('                         Chromium is already installed in this environment,');
  console.error('                         so do not run "playwright install")');
  process.exit(2);
}
const { chromium } = pw;

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'));
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

if (!url) {
  console.error('Usage: node motion-qa.mjs <url> [--out ./qa-run] [--settle 700] [--timeout 30000]');
  process.exit(2);
}

const outDir = resolve(opt('out', './qa-run'));
const SETTLE = Number(opt('settle', 700));   // ms after each scroll for motion to land
const TIMEOUT = Number(opt('timeout', 30000));

const VIEWPORTS = [
  { name: 'small-phone',      width: 320,  height: 568 },
  { name: 'modern-phone',     width: 390,  height: 844 },
  { name: 'tablet-portrait',  width: 768,  height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'laptop',           width: 1440, height: 900 },
  { name: 'desktop',          width: 1920, height: 1080 },
];

const DEPTHS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

// Makes every WebGL context request return null, without touching 2d.
const KILL_WEBGL = () => {
  const real = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (/webgl|experimental-webgl/i.test(String(type))) return null;
    return real.call(this, type, ...rest);
  };
};

// Records enough per-element state to tell a transformation from a fade.
const FINGERPRINT = () => {
  const out = { transforms: {}, opacities: {}, canvases: [], fixed: 0 };
  const els = document.querySelectorAll('body *');
  const cap = Math.min(els.length, 400);
  for (let i = 0; i < cap; i++) {
    const el = els[i];
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') out.fixed++;
    const key = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${(el.className && typeof el.className === 'string' ? el.className.split(/\s+/)[0] : '') || i}`;
    if (cs.transform && cs.transform !== 'none') out.transforms[key] = cs.transform;
    if (cs.opacity !== '1') out.opacities[key] = cs.opacity;
  }
  document.querySelectorAll('canvas').forEach((c) => {
    out.canvases.push({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight });
  });
  return out;
};

function attachCollectors(page, bucket) {
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error') bucket.consoleErrors.push(m.text());
    else if (t === 'warning') bucket.consoleWarnings.push(m.text());
  });
  page.on('pageerror', (e) => bucket.pageErrors.push(String(e && e.message ? e.message : e)));
  page.on('requestfailed', (r) => {
    const f = r.failure();
    // Aborted requests are routine (cancelled media, prefetch); not a failure.
    if (f && /ERR_ABORTED/.test(f.errorText)) return;
    bucket.failedRequests.push(`${r.url()} — ${f ? f.errorText : 'failed'}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) bucket.failedRequests.push(`${r.url()} — HTTP ${r.status()}`);
  });
}

const newBucket = () => ({ consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] });
const isClean = (b) => !b.consoleErrors.length && !b.pageErrors.length && !b.failedRequests.length;

async function scrollTo(page, fraction) {
  await page.evaluate((f) => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(max * f));
  }, fraction);
  await page.waitForTimeout(SETTLE);
  // Two frames after the settle, so anything driven by rAF has painted. This is
  // best-effort: it cannot run with scripting disabled, and a page that is
  // already idle can have the promise collected before it resolves.
  try {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  } catch { /* no scripting, or already settled */ }
}

async function runMatrix(browser, report) {
  for (const vp of VIEWPORTS) {
    const bucket = newBucket();
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    attachCollectors(page, bucket);

    try {
      await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT });
      await page.waitForTimeout(SETTLE);
    } catch (e) {
      bucket.pageErrors.push(`navigation failed: ${e.message}`);
      report.matrix.push({ viewport: vp.name, ...bucket, captures: [] });
      await ctx.close();
      continue;
    }

    const dir = join(outDir, 'matrix', vp.name);
    mkdirSync(dir, { recursive: true });

    const captures = [];
    let prev = null;
    for (const d of DEPTHS) {
      await scrollTo(page, d);
      const label = String(Math.round(d * 1000) / 10).replace('.', '_');
      const file = join(dir, `${label}pct.png`);
      await page.screenshot({ path: file });
      const fp = await page.evaluate(FINGERPRINT);

      let changed = null;
      if (prev) {
        const tKeys = new Set([...Object.keys(prev.transforms), ...Object.keys(fp.transforms)]);
        const oKeys = new Set([...Object.keys(prev.opacities), ...Object.keys(fp.opacities)]);
        let tChanged = 0, oChanged = 0;
        tKeys.forEach((k) => { if (prev.transforms[k] !== fp.transforms[k]) tChanged++; });
        oKeys.forEach((k) => { if (prev.opacities[k] !== fp.opacities[k]) oChanged++; });
        changed = { transform: tChanged, opacity: oChanged };
      }
      prev = fp;

      captures.push({
        depth: d, screenshot: file, fixedElements: fp.fixed,
        canvases: fp.canvases, changedSincePrevious: changed,
      });
      process.stdout.write(`  ${vp.name} ${String(Math.round(d * 100)).padStart(3)}%  ok\n`);
    }

    report.matrix.push({ viewport: vp.name, ...bucket, captures });
    await ctx.close();
  }
}

async function runPass(browser, name, contextOptions, initScript) {
  const bucket = newBucket();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...contextOptions });
  if (initScript) await ctx.addInitScript(initScript);
  const page = await ctx.newPage();
  attachCollectors(page, bucket);

  const dir = join(outDir, name);
  mkdirSync(dir, { recursive: true });
  const shots = [];

  // With scripting disabled, page.evaluate cannot run at all — not the scroll,
  // not the text measurement. That pass uses a full-page screenshot and reads
  // the served markup instead.
  const scripting = contextOptions.javaScriptEnabled !== false;

  try {
    await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT });
    await page.waitForTimeout(SETTLE);

    if (scripting) {
      for (const d of [0, 0.25, 0.5, 0.75, 1]) {
        await scrollTo(page, d);
        const file = join(dir, `${Math.round(d * 100)}pct.png`);
        await page.screenshot({ path: file });
        shots.push(file);
      }
      // Emptiness heuristic: how much text is actually rendered. A near-zero
      // figure here means content exists only in the animated path.
      bucket.visibleTextLength = await page.evaluate(() => (document.body.innerText || '').trim().length);
      bucket.imageCount = await page.evaluate(
        () => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length
      );
    } else {
      const file = join(dir, 'fullpage.png');
      await page.screenshot({ path: file, fullPage: true });
      shots.push(file);
      // Text from the served markup. This measures what was SENT, so compare it
      // against the screenshot: markup present but nothing visible means the
      // base stylesheet is hiding content that JS was meant to reveal.
      const html = await page.content();
      const text = html
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      bucket.visibleTextLength = text.length;
      bucket.markupTextLength = text.length;
      bucket.imageCount = (html.match(/<img\b/gi) || []).length;
      bucket.note = 'text and image counts are from served markup; confirm visibility in fullpage.png';
    }
  } catch (e) {
    bucket.pageErrors.push(`navigation failed: ${e.message}`);
  }

  await ctx.close();
  return { pass: name, ...bucket, screenshots: shots };
}

// ---------------------------------------------------------------- run

mkdirSync(outDir, { recursive: true });
const report = { url, startedAt: new Date().toISOString(), matrix: [], passes: [] };

// Launch. If the installed Playwright expects a browser build that is not
// present — common when the environment ships a pinned Chromium and the project
// installs a different Playwright version — fall back to an explicit binary
// rather than telling the user to download one.
async function launch() {
  const explicit = opt('executable', process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE);
  if (explicit) return chromium.launch({ executablePath: explicit });
  try {
    return await chromium.launch();
  } catch (e) {
    for (const candidate of ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome']) {
      if (!existsSync(candidate)) continue;
      try {
        const b = await chromium.launch({ executablePath: candidate });
        console.log(`  (using ${candidate})`);
        return b;
      } catch { /* try the next one */ }
    }
    throw e;
  }
}

const browser = await launch();

console.log(`\nmotion-qa — ${url}\n`);
console.log('Matrix: 6 viewports x 9 scroll depths');
await runMatrix(browser, report);

console.log('\nFallback passes');
report.passes.push(await runPass(browser, 'reduced-motion', { reducedMotion: 'reduce' }));
console.log('  reduced-motion  ok');
report.passes.push(await runPass(browser, 'no-webgl', {}, KILL_WEBGL));
console.log('  no-webgl        ok');
report.passes.push(await runPass(browser, 'no-js', { javaScriptEnabled: false }));
console.log('  no-js           ok');

await browser.close();

// ---------------------------------------------------------------- summarise

const allBuckets = [...report.matrix, ...report.passes];
const errors = allBuckets.flatMap((b) => [
  ...b.consoleErrors.map((t) => [b.viewport || b.pass, 'console', t]),
  ...b.pageErrors.map((t) => [b.viewport || b.pass, 'pageerror', t]),
  ...b.failedRequests.map((t) => [b.viewport || b.pass, 'network', t]),
]);
const warnings = allBuckets.flatMap((b) => b.consoleWarnings.map((t) => [b.viewport || b.pass, t]));

const captured = report.matrix.reduce((n, m) => n + m.captures.length, 0);
const expected = VIEWPORTS.length * DEPTHS.length;

report.summary = {
  captured, expected,
  consoleErrors: allBuckets.reduce((n, b) => n + b.consoleErrors.length, 0),
  pageErrors: allBuckets.reduce((n, b) => n + b.pageErrors.length, 0),
  failedRequests: allBuckets.reduce((n, b) => n + b.failedRequests.length, 0),
  consoleWarnings: warnings.length,
};

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

console.log(`\n  captures        ${captured}/${expected}`);
console.log(`  console errors  ${report.summary.consoleErrors}`);
console.log(`  page errors     ${report.summary.pageErrors}`);
console.log(`  failed requests ${report.summary.failedRequests}`);
console.log(`  warnings        ${report.summary.consoleWarnings}`);

for (const p of report.passes) {
  console.log(`  ${p.pass.padEnd(15)} text ${String(p.visibleTextLength ?? 0).padStart(6)} chars, ${p.imageCount ?? 0} images loaded`);
}

// Motion-shape hint. Explicitly not a verdict — it is a pointer at which
// frames to look at first.
const totals = report.matrix.flatMap((m) => m.captures.map((c) => c.changedSincePrevious).filter(Boolean));
const tSum = totals.reduce((n, c) => n + c.transform, 0);
const oSum = totals.reduce((n, c) => n + c.opacity, 0);
console.log(`\n  between-depth changes: ${tSum} transform, ${oSum} opacity`);
if (tSum === 0 && oSum > 0) {
  console.log('  HINT: nothing transformed between any two scroll depths — only opacity changed.');
  console.log('        That is the shape of a fade-only build. Confirm against the frames.');
}
console.log(`\n  screenshots and report.json written to ${outDir}\n`);

if (errors.length) {
  console.log('  ERRORS');
  errors.slice(0, 40).forEach(([where, kind, text]) => console.log(`    [${where}] ${kind}: ${text}`));
  if (errors.length > 40) console.log(`    ... and ${errors.length - 40} more (see report.json)`);
  console.log('');
  process.exit(1);
}
if (captured < expected) {
  console.log(`  INCOMPLETE — ${expected - captured} captures missing.\n`);
  process.exit(1);
}
process.exit(0);
