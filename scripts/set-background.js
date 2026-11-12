#!/usr/bin/env node
/**
 * Replaces the bundled background with your own image.
 *
 *   cp /path/to/photo.jpg ~/tavakkol-bg.jpg
 *   node scripts/set-background.js ~/tavakkol-bg.jpg
 *
 * The image is centre-cropped to 1080x1920 (portrait) and re-encoded as JPEG,
 * so any photo size or format works. Writes assets/background.jpg.
 */
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp-compact');

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/set-background.js <image path>');
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`not found: ${source}`);
  process.exit(1);
}

const target = path.join(__dirname, '..', 'assets', 'background.jpg');

Jimp.read(source)
  .then((image) =>
    image
      .cover(1080, 1920)
      .quality(90)
      .writeAsync(target)
      .then(() => {
        const { size } = fs.statSync(target);
        console.log(`wrote ${target} (1080x1920, ${Math.round(size / 1024)} KB)`);
      })
  )
  .catch((error) => {
    console.error(`could not convert ${source}: ${error.message}`);
    process.exit(1);
  });
