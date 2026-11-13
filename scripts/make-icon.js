#!/usr/bin/env node
/**
 * Builds the launcher icon set from one photo (v1.3.2).
 *
 *   node scripts/make-icon.js /path/to/photo.jpg
 *
 * Writes:
 *   assets/icon.png                   1024x1024, full-bleed square (legacy icon,
 *                                     Play Store listing)
 *   assets/android-icon-foreground.png 1024x1024 transparent canvas with the photo
 *                                     inset in the adaptive-icon safe zone
 *                                     (720x720, rounded) so launcher masks never
 *                                     cut the picture
 *   assets/android-icon-background.png 1024x1024 solid dark canvas
 *
 * The adaptive foreground needs a transparent canvas, which is why the photo is
 * composited in instead of being written straight to the file.
 */
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp-compact');

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/make-icon.js <image path>');
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`not found: ${source}`);
  process.exit(1);
}

const ASSETS = path.join(__dirname, '..', 'assets');
const SIZE = 1024;
const INNER = 760;
const RADIUS = 150;
const BACKGROUND = 0x0b0f14ff;

/** Sets every pixel outside a rounded square to fully transparent. */
function roundCorners(image, radius) {
  const { width, height } = image.bitmap;
  const r = Math.min(radius, Math.floor(Math.min(width, height) / 2));
  image.scan(0, 0, width, height, function scan(x, y, idx) {
    let transparent = false;
    const cx = x < r ? r - x : x >= width - r ? x - (width - r - 1) : 0;
    const cy = y < r ? r - y : y >= height - r ? y - (height - r - 1) : 0;
    if (cx > 0 && cy > 0 && cx * cx + cy * cy > r * r) transparent = true;
    if (transparent) this.bitmap.data[idx + 3] = 0;
  });
  return image;
}

(async () => {
  const photo = await Jimp.read(source);

  // Legacy square icon — the photo itself, centre-cropped.
  await photo
    .clone()
    .cover(SIZE, SIZE)
    .quality(92)
    .writeAsync(path.join(ASSETS, 'icon.png'));

  // Adaptive foreground: transparent canvas, photo inset in the safe zone.
  const foreground = new Jimp(SIZE, SIZE, 0x00000000);
  const inner = photo.clone().cover(INNER, INNER);
  roundCorners(inner, RADIUS);
  foreground.composite(inner, Math.round((SIZE - INNER) / 2), Math.round((SIZE - INNER) / 2));
  await foreground.writeAsync(path.join(ASSETS, 'android-icon-foreground.png'));

  // Adaptive background: flat dark tone so the inset photo keeps its edges.
  const background = new Jimp(SIZE, SIZE, BACKGROUND);
  await background.writeAsync(path.join(ASSETS, 'android-icon-background.png'));

  fs.rmSync(path.join(ASSETS, 'android-icon-monochrome.png'), { force: true });

  for (const name of ['icon.png', 'android-icon-foreground.png', 'android-icon-background.png']) {
    const { size } = fs.statSync(path.join(ASSETS, name));
    console.log(`${name}: ${Math.round(size / 1024)} KB`);
  }
})().catch((error) => {
  console.error(`icon build failed: ${error.message}`);
  process.exit(1);
});
