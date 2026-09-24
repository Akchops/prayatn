#!/usr/bin/env node
// Records a phone-sized tour of the inner pages: the menu, each page's
// opening, and the programme reels.  node scripts/record-tour.mjs <url> <out>
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
const [url, out = 'demo'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
const p = await ctx.newPage();
const smooth = (to, ms) => p.evaluate(([to, ms]) => new Promise((done) => {
  const from = scrollY, t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(f) : done(); };
  requestAnimationFrame(f);
}), [to, ms]);
await p.goto(url + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await p.click('.menu summary'); await p.waitForTimeout(1600);
for (const slug of ['healthcare', 'education', 'women-development', 'gallery', 'about', 'get-involved']) {
  if (await p.evaluate(() => document.querySelector('[data-menu]')?.open)) {
    await p.click(`.menu__list a[href="/${slug}/"]`);
  } else {
    await p.goto(`${url}/${slug}/`);
  }
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(3000);
  const reel = await p.evaluate(() => { const r = document.querySelector('[data-reel]'); if (!r) return null; const s = r.parentElement.getBoundingClientRect().top + scrollY; const t = document.querySelector('[data-reel-track]').scrollWidth - document.documentElement.clientWidth; return [s - 60, t]; });
  if (reel) { await smooth(reel[0], 2200); await smooth(reel[0] + reel[1], 5200); await p.waitForTimeout(500); }
  else { await smooth(1400, 2600); await p.waitForTimeout(600); }
  if (slug !== 'get-involved') { await p.evaluate(() => scrollTo(0, 0)); await p.click('.menu summary'); await p.waitForTimeout(1200); }
}
const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
await smooth(H, 3000); await p.waitForTimeout(1500);
const v = p.video(); await ctx.close(); await b.close();
renameSync(await v.path(), `${out}/prayatn-pages-390.webm`);
console.log(`${out}/prayatn-pages-390.webm`);
