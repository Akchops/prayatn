#!/usr/bin/env node
// Records a screen video of the site scrolling, with every animation running,
// so it can be reviewed anywhere (phones, chat apps) without running the site.
//   node scripts/record-demo.mjs http://localhost:4173 390x844 out/
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
const [url, vp = '390x844', out = 'demo'] = process.argv.slice(2);
const [w, h] = vp.split('x').map(Number);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: out, size: { width: w, height: h } } });
const p = await ctx.newPage();
const smooth = async (to, ms) => p.evaluate(([to, ms]) => new Promise((done) => {
  const from = scrollY, t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(f) : done(); };
  requestAnimationFrame(f);
}), [to, ms]);
await p.goto(url + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2600);                                    // load intro
const pin = await p.evaluate(() => document.querySelector('.pin-spacer')?.offsetHeight - document.querySelector('.weave__stage').offsetHeight || 0);
await smooth(pin, 9000); await p.waitForTimeout(1200);          // the weave
const plist = await p.evaluate(() => document.querySelector('.projects').getBoundingClientRect().top + scrollY - 70);
await smooth(plist, 2500); await p.waitForTimeout(600);
if (w >= 900) {                                                  // hover the project rows
  const rows = await p.$$('.plist__row');
  for (const r of rows.slice(0, 7)) { const bb = await r.boundingBox(); await p.mouse.move(bb.x + bb.width * .4, bb.y + bb.height / 2, { steps: 8 }); await p.waitForTimeout(450); }
  await p.mouse.move(5, 300);
}
const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
await smooth(H, 22000); await p.waitForTimeout(1000);
await p.goto(url + '/women-development/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await smooth(1800, 5000); await p.waitForTimeout(800);
const v = p.video(); await ctx.close(); await b.close();
renameSync(await v.path(), `${out}/prayatn-${vp}.webm`);
console.log(`${out}/prayatn-${vp}.webm`);
