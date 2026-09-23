#!/usr/bin/env node
// QA helper: frame times through the pinned weave vs. an ordinary stretch of
// page, under CPU throttling.  node scripts/perf-weave.mjs 390x844 <tier 1|2> <throttle>
import { chromium } from 'playwright';
const [vp, tier, rate='4'] = process.argv.slice(2);
const [w, h] = vp.split('x').map(Number);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 800 ? 2.625 : 1 });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await p.goto(`http://localhost:4173/?tier=${tier}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.dataset.weaveTier);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) });
const res = await p.evaluate(async () => {
  const run = async (from, range) => { const d = []; let last = performance.now(); let y = from;
    await new Promise((done) => { function f(t) { d.push(t - last); last = t; y += range / 120; window.scrollTo(0, y); if (y < from + range) requestAnimationFrame(f); else done(); } requestAnimationFrame(f); });
    d.shift(); d.sort((a, b) => a - b); return { med: +d[d.length >> 1].toFixed(1), p95: +d[Math.floor(d.length * .95)].toFixed(1) }; };
  const range = document.querySelector('.pin-spacer').offsetHeight - document.querySelector('.weave__stage').offsetHeight;
  const weave = await run(0, range);
  const work = document.querySelector('.work'); const top = work.getBoundingClientRect().top + scrollY;
  const plain = await run(top, 1500);
  return { weave, plain, tierAfter: document.documentElement.dataset.weaveTier };
});
console.log(vp, 'tier', tier, 'x' + rate, JSON.stringify(res));
await b.close();
