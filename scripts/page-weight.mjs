#!/usr/bin/env node
// QA helper: bytes over the wire for a page, first view and after a full scroll.
//   node scripts/page-weight.mjs http://localhost:4173/ 390x844
import { chromium } from 'playwright';
const [url, vp = '390x844'] = process.argv.slice(2);
const [w, h] = vp.split('x').map(Number);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 800 ? 2.625 : 1 });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable');
const bytes = new Map();
cdp.on('Network.loadingFinished', (e) => bytes.set(e.requestId, e.encodedDataLength));
const types = new Map();
cdp.on('Network.responseReceived', (e) => types.set(e.requestId, { type: e.type, url: e.response.url }));
const sum = () => { const by = {}; let t = 0; for (const [id, n] of bytes) { const k = types.get(id)?.type ?? 'Other'; by[k] = (by[k] ?? 0) + n; t += n; } return { totalKB: +(t / 1024).toFixed(1), byType: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v / 1024).toFixed(1)])) }; };
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const first = sum();
const H = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y <= H; y += h / 2) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(80); }
await p.waitForLoadState('networkidle');
console.log(JSON.stringify({ vp, firstView: first, afterFullScroll: sum() }, null, 1));
await b.close();
