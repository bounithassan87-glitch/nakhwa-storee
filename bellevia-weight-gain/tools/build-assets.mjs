/**
 * Bellevia Weight Gain — asset builder.
 *
 * Every image on the landing page is derived here, from the two source files the
 * brand supplied: the print label artwork and the logo. Nothing is redrawn or
 * generated: the crops below are rectangles cut out of the original label, so
 * the pack wording, the ingredient percentages and the logo on the page are
 * literally the ones on the box.
 *
 * Run from the repo root:  node bellevia-weight-gain/tools/build-assets.mjs
 *
 * The sources live outside the repo (they are print masters, ~1 MB). Override
 * their location with BELLEVIA_SOURCE_DIR if they move.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..');
const SRC_DIR = process.env.BELLEVIA_SOURCE_DIR || 'C:/Users/ADmiN/Desktop/wieght gain';

const LABEL = join(SRC_DIR, 'نسخة من 30 capsules 13,5x5,5 cm زیادة الوزن.png'); // 1594 × 650
const LOGO = join(SRC_DIR, 'png.png'); // 756 × 330

/** Brand green, read off the label artwork. Used for the app icons. */
const GREEN = { r: 0x27, g: 0x44, b: 0x2c };

/**
 * Rectangles cut from the label (coordinates in the 1594 × 650 original).
 *
 * These two panels are shown on the page as proof: the ingredient percentages
 * and the warnings are photographs of the actual box, sitting next to the same
 * words typed out as live text.
 *
 * There is no crop of the label's front face any more. The brand later supplied
 * a photographed bottle, and a real product shot beats flat artwork in the hero.
 */
const CROPS = {
  ingredients: { left: 1050, top: 0, width: 544, height: 490 },
  usage: { left: 0, top: 0, width: 505, height: 620 },
};

/**
 * Trims transparent margins.
 *
 * The supplied logo master is already a clean alpha PNG — 95% of it is fully
 * transparent and there is not a single opaque white pixel — so it needs no
 * background removal, only tightening. Trimming is what lets the mark be
 * centred exactly inside an app icon, and what stops the header lockup from
 * carrying a slab of empty space around it.
 */
async function trimAlpha(input) {
  return sharp(input).trim({ threshold: 1 }).toBuffer();
}

/**
 * The label art is flat vector-derived text, so it survives a modest enlargement
 * far better than a photograph would. Lanczos plus a light unsharp pass keeps
 * the wordmark crisp on 2× screens; anything beyond ~1.7× starts to soften, so
 * the page caps the pack card's rendered width accordingly.
 */
function upscale(pipeline, width) {
  return pipeline.resize({ width, kernel: 'lanczos3' }).sharpen({ sigma: 0.6, m1: 0.5, m2: 0.9 });
}

const webp = { quality: 86, effort: 6 };

async function main() {
  for (const d of ['assets/images', 'assets/logo', 'assets/favicon']) await mkdir(join(OUT, d), { recursive: true });

  // ── Label panels — shown as proof next to the typed-out copy ────────────
  for (const name of ['ingredients', 'usage']) {
    const panel = () => sharp(LABEL).extract(CROPS[name]).flatten({ background: '#ffffff' });
    const base = CROPS[name].width;
    for (const w of [base, Math.round(base * 1.6)]) {
      await upscale(panel(), w).webp(webp).toFile(join(OUT, `assets/images/label-${name}-${w}.webp`));
    }
  }

  // ── Logo ────────────────────────────────────────────────────────────────
  const logoTrimmed = await trimAlpha(LOGO);
  await sharp(logoTrimmed).toFile(join(OUT, 'assets/logo/logo.png'));
  // 342 px is all the ink there is in the master, so the page never renders the
  // wordmark wider than ~170 CSS px and this pair covers 1× and 2×.
  for (const w of [171, 342]) {
    await sharp(logoTrimmed).resize({ width: w, kernel: 'lanczos3' }).webp({ quality: 92, effort: 6 })
      .toFile(join(OUT, `assets/logo/logo-${w}.webp`));
  }

  // The leaf that sits above the wordmark, lifted out for the app icon. The
  // window is deliberately generous and then trimmed back to the ink, so the
  // exact bounds of the leaf cluster don't have to be hand-measured.
  const { width: lw, height: lh } = await sharp(logoTrimmed).metadata();
  const mark = await sharp(logoTrimmed)
    .extract({ left: Math.round(lw * 0.34), top: 0, width: Math.round(lw * 0.32), height: Math.round(lh * 0.3) })
    .toBuffer();
  const markTrimmed = await trimAlpha(mark);
  await sharp(markTrimmed).toFile(join(OUT, 'assets/logo/logo-mark.png'));

  // ── Icons — gold leaf on the brand green ────────────────────────────────
  async function icon(size, padding) {
    const inner = Math.round(size * (1 - padding * 2));
    const leaf = await sharp(markTrimmed).resize({ width: inner, fit: 'inside' }).toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: { ...GREEN, alpha: 1 } } })
      .composite([{ input: leaf, gravity: 'centre' }])
      .png({ compressionLevel: 9 });
  }
  await (await icon(16, 0.12)).toFile(join(OUT, 'assets/favicon/favicon-16.png'));
  await (await icon(32, 0.12)).toFile(join(OUT, 'assets/favicon/favicon-32.png'));
  await (await icon(180, 0.16)).toFile(join(OUT, 'assets/favicon/apple-touch-icon.png'));
  await (await icon(192, 0.16)).toFile(join(OUT, 'assets/favicon/icon-192.png'));
  await (await icon(512, 0.16)).toFile(join(OUT, 'assets/favicon/icon-512.png'));
  await (await icon(512, 0.28)).toFile(join(OUT, 'assets/favicon/icon-512-maskable.png'));

  console.log('assets built ->', join(OUT, 'assets'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
