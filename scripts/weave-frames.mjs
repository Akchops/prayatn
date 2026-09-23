#!/usr/bin/env node
// QA helper: captures The Weave at fixed points inside its pinned scroll range,
// for a given viewport and tier. Evidence for the signature, not the verdict.
//   node scripts/weave-frames.mjs http://localhost:4173 390x844 tier=1 out/
import { chromium } from 'playwright';
const [url, vp = '390x844', tierArg = '', out = 'qa-run/weave'] = process.argv.slice(2);
const [width, height] = vp.split('x').map(Number);
const tier = tierArg.split('=')[1];
const { mkdirSync } = await import('node:fs'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height } });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url + (tier ? `/?tier=${tier}` : '/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.dataset.weaveTier, null, { timeout: 8000 }).catch(() => {});
const info = await page.evaluate(() => {
  const st = window.ScrollTrigger;
  const pin = document.querySelector('.pin-spacer');
  return { tier: document.documentElement.dataset.weaveTier ?? 'none', pinH: pin?.offsetHeight ?? 0, stageH: document.querySelector('.weave__stage').offsetHeight };
});
const range = info.pinH - info.stageH;
for (const p of [0, 0.15, 0.3, 0.45, 0.6, 0.72, 0.85, 1.0]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(range * p));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${vp}-${info.tier}-${String(Math.round(p * 100)).padStart(3, '0')}.png` });
}
console.log(JSON.stringify({ ...info, range, logs }));
await browser.close();
