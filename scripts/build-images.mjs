#!/usr/bin/env node
/**
 * Builds responsive images from uploads/ (the owner's photos, the only image
 * source for this site) into public/img/, and writes src/data/images.json.
 *
 * Rule: no output is ever wider than its source. The photos are phone
 * snapshots (500–1280px), and upscaling would only add bytes and blur.
 * The CSS side of the same rule (never display wider than native CSS px)
 * lives in the {{img}} helper in vite.config.js.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const photos = JSON.parse(readFileSync(join(root, 'src/data/photos.json'), 'utf8'));
const out = join(root, 'public/img');
mkdirSync(out, { recursive: true });

const STEPS = [360, 560, 800, 1108, 1280];
const manifest = {};

for (const name of Object.keys(photos)) {
  const file = readdirSync(join(root, 'uploads')).find((f) => f.replace(/\.[^.]+$/, '') === name);
  if (!file) throw new Error(`uploads/ has no file for ${name}`);
  // Honour EXIF orientation, then apply any crop from photos.json (used to
  // remove things that must not be shown yet, e.g. a supporter's signboard).
  const oriented = await sharp(join(root, 'uploads', file)).rotate().toBuffer({ resolveWithObject: true });
  let { width, height } = oriented.info;
  let src = sharp(oriented.data);
  const crop = photos[name].crop;
  if (crop) {
    const top = Math.round(height * (crop.top ?? 0));
    const bottom = Math.round(height * (crop.bottom ?? 0));
    src = sharp(await src.extract({ left: 0, top, width, height: height - top - bottom }).toBuffer());
    height = height - top - bottom;
  }
  const widths = [...new Set([...STEPS.filter((w) => w < width), width])];

  for (const w of widths) {
    const base = join(out, `${name}-${w}`);
    if (!existsSync(`${base}.avif`) || crop) {
      await src.clone().resize({ width: w }).avif({ quality: 52, effort: 4 }).toFile(`${base}.avif`);
    }
    if (!existsSync(`${base}.jpg`) || crop) {
      await src.clone().resize({ width: w }).jpeg({ quality: 74, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
    }
  }
  // A thread-resolution copy: 160 threads across, an even number of rows,
  // for the woven-photo backgrounds (.woven). Shown with image-rendering:
  // pixelated at exactly one pixel per thread, so it reads as cloth, never as
  // a blurry upscale.
  const rows = Math.max(2, Math.round((160 * height) / width / 2) * 2);
  const weave = join(out, `${name}-weave.png`);
  if (!existsSync(weave) || crop) {
    await src.clone().resize(160, rows, { fit: 'cover' }).png({ palette: true, colours: 96, dither: 0 }).toFile(weave);
  }
  manifest[name] = { width, height, widths, rows, alt: photos[name].alt, use: photos[name].use };
}

writeFileSync(join(root, 'src/data/images.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`images: ${Object.keys(manifest).length} photos -> public/img/`);
