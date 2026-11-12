#!/usr/bin/env node
/**
 * Generates the bundled default background (assets/background.jpg).
 *
 * Tavakkol ships a background image behind the main and settings screens. This
 * script paints a dark, calm placeholder so the app never ships with a missing
 * asset — replace it with your own photo via `node scripts/set-background.js
 * <image>` (it crops to 1080x1920 and writes assets/background.jpg).
 *
 *   node scripts/make-background.js
 */
const path = require('path');
const Jimp = require('jimp-compact');

const W = 1080;
const H = 1920;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function build() {
  const data = Buffer.alloc(W * H * 4);

  // Vertical base gradient: near-black emerald at the top, colder at the bottom.
  const top = [8, 17, 16];
  const mid = [11, 26, 25];
  const bottom = [5, 9, 13];

  // Two soft light sources (emerald + cold teal) to keep the plate from looking flat.
  const glows = [
    { x: W * 0.62, y: H * 0.24, r: W * 0.95, color: [38, 122, 88], strength: 0.55 },
    { x: W * 0.18, y: H * 0.78, r: W * 1.15, color: [28, 78, 104], strength: 0.4 },
  ];

  for (let y = 0; y < H; y += 1) {
    const py = y / (H - 1);
    // Three-stop gradient: 0..0.55 top->mid, 0.55..1 mid->bottom.
    const base =
      py < 0.55
        ? top.map((c, i) => c + (mid[i] - c) * (py / 0.55))
        : mid.map((c, i) => c + (bottom[i] - c) * ((py - 0.55) / 0.45));

    for (let x = 0; x < W; x += 1) {
      let r = base[0];
      let g = base[1];
      let b = base[2];

      for (const glow of glows) {
        const dx = (x - glow.x) / glow.r;
        const dy = (y - glow.y) / glow.r;
        const d = Math.sqrt(dx * dx + dy * dy);
        const falloff = 1 - smoothstep(0.1, 1, d);
        const amount = falloff * falloff * glow.strength;
        r += glow.color[0] * amount;
        g += glow.color[1] * amount;
        b += glow.color[2] * amount;
      }

      // Fine diagonal hatching — visible only as texture, not as a pattern.
      const hatch = Math.sin((x + y * 0.55) * 0.09) * 0.5 + 0.5;
      const hatchAmount = (hatch - 0.5) * 3.2;
      r += hatchAmount;
      g += hatchAmount;
      b += hatchAmount;

      // Vignette: darken the corners so centred text always sits on the darkest area.
      const nx = (x / W - 0.5) * 2;
      const ny = (y / H - 0.5) * 2;
      const vignette = 1 - smoothstep(0.55, 1.5, Math.sqrt(nx * nx + ny * ny)) * 0.65;
      r *= vignette;
      g *= vignette;
      b *= vignette;

      // Dithering noise: kills gradient banding on 8-bit phone panels.
      const noise = (Math.random() - 0.5) * 3;
      r += noise;
      g += noise;
      b += noise;

      const offset = (y * W + x) * 4;
      data[offset] = clamp(Math.round(r), 0, 255);
      data[offset + 1] = clamp(Math.round(g), 0, 255);
      data[offset + 2] = clamp(Math.round(b), 0, 255);
      data[offset + 3] = 255;
    }
  }

  return new Jimp({ data, width: W, height: H });
}

const target = path.join(__dirname, '..', 'assets', 'background.jpg');
build().quality(88).write(target, (error) => {
  if (error) {
    console.error(`Could not write ${target}: ${error.message}`);
    process.exit(1);
  }
  console.log(`wrote ${target} (${W}x${H})`);
});
