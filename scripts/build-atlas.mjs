#!/usr/bin/env node
/**
 * Builds the texture atlas for The Loom (the gallery's woven photo field):
 * every photo on the site as a 4:3 tile, 8 tiles across, one image. The GPU
 * draws the whole field from this single texture.
 *
 * Tiles are ordered round-robin across categories, so neighbours in the field
 * come from different programmes. Writes public/img/atlas.{avif,jpg} and
 * src/data/atlas.json (tile order, category, caption, full-size photo).
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const images = JSON.parse(readFileSync(join(root, 'src/data/images.json'), 'utf8'));
const photos = JSON.parse(readFileSync(join(root, 'src/data/photos.json'), 'utf8'));

const TW = 256, TH = 192, COLS = 8;
const CATS = ['health', 'school', 'women', 'events'];
const byCat = Object.fromEntries(CATS.map((c) => [c, []]));
for (const [n, im] of Object.entries(images)) (byCat[im.use === 'hero' ? 'women' : im.use] ??= []).push(n);
const order = [];
for (let i = 0; order.length < Object.keys(images).length; i++) {
  for (const c of CATS) if (byCat[c][i]) order.push(byCat[c][i]);
}
const ROWS = Math.ceil(order.length / COLS);

const tiles = [];
for (let k = 0; k < order.length; k++) {
  const n = order[k];
  const file = readdirSync(join(root, 'uploads')).find((f) => f.replace(/\.[^.]+$/, '') === n);
  let img = sharp(join(root, 'uploads', file)).rotate();
  const crop = photos[n].crop;
  if (crop) {
    const { data, info } = await img.toBuffer({ resolveWithObject: true });
    const top = Math.round(info.height * (crop.top ?? 0)), bottom = Math.round(info.height * (crop.bottom ?? 0));
    img = sharp(data).extract({ left: 0, top, width: info.width, height: info.height - top - bottom });
  }
  const input = await img.resize(TW, TH, { fit: 'cover', position: 'attention' }).toBuffer();
  tiles.push({ input, left: (k % COLS) * TW, top: Math.floor(k / COLS) * TH });
}

const sheet = sharp({ create: { width: COLS * TW, height: ROWS * TH, channels: 3, background: '#1E2440' } }).composite(tiles);
const buf = await sheet.png().toBuffer();
await sharp(buf).jpeg({ quality: 72, mozjpeg: true }).toFile(join(root, 'public/img/atlas.jpg'));
await sharp(buf).avif({ quality: 50, effort: 4 }).toFile(join(root, 'public/img/atlas.avif'));

const big = (n) => images[n].widths.filter((w) => w <= 1280).at(-1);
writeFileSync(join(root, 'src/data/atlas.json'), JSON.stringify({
  cols: COLS, rows: ROWS, tw: TW, th: TH, count: order.length,
  tiles: order.map((n) => ({
    cat: CATS.indexOf(images[n].use === 'hero' ? 'women' : images[n].use),
    src: `/img/${n}-${big(n)}.jpg`,
    alt: images[n].alt,
  })),
}) + '\n');
console.log(`atlas: ${order.length} tiles, ${COLS}x${ROWS} -> public/img/atlas.{avif,jpg}`);
