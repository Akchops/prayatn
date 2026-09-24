#!/usr/bin/env node
// Records The Loom and a programme reel on a laptop screen.
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
const [url, out = 'demo'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: out, size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
const smooth = (to, ms) => p.evaluate(([to, ms]) => new Promise((done) => { const from = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(f) : done(); }; requestAnimationFrame(f); }), [to, ms]);
await p.goto(url + '/gallery/?tier=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(2600);
const y = await p.evaluate(() => document.querySelector('.loom').getBoundingClientRect().top + scrollY - 128);
await smooth(y, 1600); await p.waitForTimeout(2200);
const bb = await (await p.$('.loom__stage')).boundingBox();
const drag = async (dx, dy) => { await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); for (let i = 1; i <= 20; i++) { await p.mouse.move(bb.x + bb.width / 2 + dx * i / 20, bb.y + bb.height / 2 + dy * i / 20); await p.waitForTimeout(16); } await p.mouse.up(); await p.waitForTimeout(1300); };
await drag(-520, -140); await drag(420, 260);
for (const [fx, fy] of [[.3, .35], [.5, .5], [.7, .4]]) { await p.mouse.move(bb.x + bb.width * fx, bb.y + bb.height * fy, { steps: 10 }); await p.waitForTimeout(700); }
await p.click('[data-gfilter] button[data-f="women"]'); await p.waitForTimeout(1500);
await drag(-300, 0);
await p.click('[data-gfilter] button[data-f="all"]'); await p.waitForTimeout(900);
await p.mouse.click(bb.x + bb.width * .5, bb.y + bb.height * .45); await p.waitForTimeout(1800);
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await p.goto(url + '/education/', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
const r = await p.evaluate(() => { const s = document.querySelector('.reel').parentElement; return [s.getBoundingClientRect().top + scrollY - 68, s.offsetHeight - document.querySelector('.reel').offsetHeight]; });
await smooth(r[0], 2400); await smooth(r[0] + r[1], 6500); await p.waitForTimeout(800);
const v = p.video(); await ctx.close(); await b.close();
renameSync(await v.path(), `${out}/prayatn-loom-1280.webm`);
