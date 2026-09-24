#!/usr/bin/env node
// Phone-sized recording of a served build (e.g. the /prayatn/ preview build):
// home photos, a programme reel, and dragging the gallery.
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
const [url, out = 'demo'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
const p = await ctx.newPage();
const smooth = (to, ms) => p.evaluate(([to, ms]) => new Promise((done) => { const from = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(f) : done(); }; requestAnimationFrame(f); }), [to, ms]);
await p.goto(url + 'healthcare/', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
const r = await p.evaluate(() => { const s = document.querySelector('.reel').parentElement; return [s.getBoundingClientRect().top + scrollY - 60, s.offsetHeight - document.querySelector('.reel').offsetHeight]; });
await smooth(r[0], 7000); await smooth(r[0] + r[1], 6000); await p.waitForTimeout(600);
await p.goto(url + 'gallery/', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
const y = await p.evaluate(() => document.querySelector('.loom').getBoundingClientRect().top + scrollY - 120);
await smooth(y, 1500); await p.waitForTimeout(2200);
const bb = await (await p.$('.loom__stage')).boundingBox();
for (const [dx, dy] of [[-260, 0], [220, 0], [-180, 0]]) {
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
  for (let i = 1; i <= 16; i++) { await p.mouse.move(bb.x + bb.width / 2 + dx * i / 16, bb.y + bb.height / 2 + dy * i / 16); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(1200);
}
await p.click('[data-gfilter] button[data-f="school"]'); await p.waitForTimeout(1500);
await p.mouse.click(bb.x + bb.width * .5, bb.y + bb.height * .4); await p.waitForTimeout(2000);
const v = p.video(); await ctx.close(); await b.close();
renameSync(await v.path(), `${out}/prayatn-phone-live.webm`);
