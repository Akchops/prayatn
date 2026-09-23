#!/usr/bin/env node
// QA helper: full-page and scrolled screenshots of any page at any viewport.
//   node scripts/page-shots.mjs <url> <WxH> <outfile> [scrollY|full] [--no-js] [--reduced]
import { chromium } from 'playwright';
const [url, vp, out, where = 'full', ...flags] = process.argv.slice(2);
const [width, height] = vp.split('x').map(Number);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: !flags.includes('--no-js'), reducedMotion: flags.includes('--reduced') ? 'reduce' : 'no-preference' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => logs.push(`failed: ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`${r.status()}: ${r.url()}`); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
if (where === 'full') {
  // Walk the page so lazy images load and scroll-driven state settles, then return.
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += height) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(800);
  await page.screenshot({ path: out, fullPage: true });
} else {
  await page.evaluate((y) => window.scrollTo(0, y), Number(where)); await page.waitForTimeout(900);
  await page.screenshot({ path: out });
}
const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));
console.log(JSON.stringify({ out, ...m, logs }));
await browser.close();
