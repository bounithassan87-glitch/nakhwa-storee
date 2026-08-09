/**
 * Bellevia Weight Gain — photographic assets.
 *
 * Companion to build-assets.mjs (which cuts the label panels, the logo and the
 * icons). This one handles the photography, and every pixel of it comes out of
 * the same client folder — there is no stock photography on the page.
 *
 * The brand supplied finished ad creatives: a bottle render or a model, with a
 * headline, benefit pills and badges all flattened into one image. Those are
 * ads, not web assets. Dropping one whole into the page would drag its baked-in
 * text along with it — "100% طبيعي", "بدون آثار جانبية", "+5000 عميل راضي",
 * "95% نسبة رضا العملاء" — claims and numbers the page deliberately does not
 * make and cannot verify.
 *
 * So each crop below is a window onto the *photographic* part only: the bottle,
 * the stone, the stump, a face. Every headline, pill, badge and counter is left
 * outside the frame. What the page asserts lives in its own HTML, where it can
 * be read and reviewed.
 *
 * Run from the repo root:  node bellevia-weight-gain/tools/build-shots.mjs
 * Override the source folder with BELLEVIA_SOURCE_DIR.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'assets', 'images');
const SRC = process.env.BELLEVIA_SOURCE_DIR || 'C:/Users/ADmiN/Desktop/wieght gain';

const src = (f) => join(SRC, f);

/** Bottle on a stone, flowering greenery behind. 1536 × 1024. */
const STONE = src('079ac1cb-9d22-4d78-a458-e8467459c156.png');
/** Bottle on a tree stump, leaves. 1536 × 1024. */
const STUMP = src('738ac82d-6eff-4d9e-a23b-968d5a7fdbc5.png');
/** Bottle on a table with capsules and a bowl of powder. 1024 × 1536. */
const TABLE = src('932ce3c4-386b-47c0-8dca-5f0e3c2f0bdf.png');
/** Model + bottle render. 1254 × 1254. Its pack footer band is the clean one. */
const WOMAN = src('bb9d0e41-559a-481c-b376-6d48812c24b8.png');
/** Ingredient infographic — photos in ringed circles. 1254 × 1254. */
const INGREDIENTS = src('d325531b-ed43-4f77-8282-38e0cb395c77.png');

const webp = { quality: 80, effort: 6 };

/**
 * Rectangular crops.
 *
 * `widths` always starts at the crop's own width, so the 1× variant is a
 * downscale or a 1:1 copy and never an enlargement; the second entry covers 2×
 * screens at an enlargement a photograph tolerates (≤ 1.75×).
 */
const SHOTS = [
  {
    // Hero. The creative's headline and its "100% NATUREL" seal both sit in the
    // left third; starting at x=600 leaves them behind and keeps the bottle,
    // the stone and the daisies.
    name: 'hero-bottle',
    from: STONE,
    crop: { left: 600, top: 0, width: 936, height: 918 },
    widths: [700, 1050],
  },
  {
    // Same bottle, warmer setting. Used in the gallery and the closing panel.
    // The benefit pills down the right edge start at x≈1190 and the green pill
    // bar at y≈780, so the window stops short of both.
    name: 'product-stump',
    from: STUMP,
    crop: { left: 755, top: 25, width: 440, height: 760 },
    widths: [440, 720],
  },
  {
    // The only shot that shows the capsules themselves, plus a bowl of powder.
    // The creative's card stack begins at x≈510; this stays well inside it.
    name: 'product-table',
    from: TABLE,
    crop: { left: 25, top: 455, width: 480, height: 730 },
    widths: [480, 760],
  },
  {
    // The bottle render, tight and on its own, for the offer card.
    name: 'product-bottle',
    from: WOMAN,
    crop: { left: 470, top: 545, width: 405, height: 585 },
    widths: [405, 680],
  },
  {
    // The page speaks to women, so this is its lifestyle image and it is used
    // large. The window still stops above the waist: the full figure holds a
    // tape measure there, and on a weight-gain page that gesture reads as
    // measuring a result — precisely the implication the page must not make.
    // It also keeps the crop off the midriff, so the shot stays about a person
    // rather than about a body.
    name: 'portrait-woman',
    from: WOMAN,
    crop: { left: 60, top: 30, width: 420, height: 530 },
    widths: [420, 760],
  },
];

/**
 * Ingredient photos, lifted from the circles of the brand's own infographic.
 *
 * Only the four whose identity the brand itself states next to the circle are
 * taken. The infographic's fifth circle is captioned "مستخلص البذور الحمراء",
 * a name that appears nowhere on the pack, so which of the label's ingredients
 * it depicts is a guess — and it is left out rather than captioned wrongly.
 *
 * Centres are in the 1254 × 1254 original. The window is pulled inside the
 * green ring so the ring itself is not baked into the cut-out.
 */
const RING_INNER = 158;
const CIRCLES = [
  { name: 'ing-maca', cx: 1098, cy: 418 }, // جذور الماكا
  { name: 'ing-ginger', cx: 155, cy: 688 }, // مستخلص الزنجبيل
  { name: 'ing-vitamins', cx: 155, cy: 960 }, // فيتامينات ومعادن
  { name: 'ing-hyaluronic', cx: 1098, cy: 960 }, // حمض الهيالورونيك
  { name: 'ing-maca-powder', cx: 155, cy: 418 }, // مسحوق الماكا — accent only
];

await mkdir(OUT, { recursive: true });

for (const shot of SHOTS) {
  for (const w of shot.widths) {
    const h = Math.round((shot.crop.height / shot.crop.width) * w);
    let pipe = sharp(shot.from).extract(shot.crop).resize({ width: w, height: h, kernel: 'lanczos3' });
    if (w > shot.crop.width) pipe = pipe.sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 });
    await pipe.webp(webp).toFile(join(OUT, `${shot.name}-${w}.webp`));
    console.log(`${shot.name}-${w}.webp  ${w}×${h}`);
  }
}

/**
 * Circular cut-outs on transparent ground, so a card can sit them on cream or
 * on green without a seam. The mask is drawn one pixel inside the edge to keep
 * the rim anti-aliased rather than stair-stepped.
 */
for (const c of CIRCLES) {
  const flat = await sharp(c.from || INGREDIENTS)
    .extract({
      left: Math.round(c.cx - RING_INNER / 2),
      top: Math.round(c.cy - RING_INNER / 2),
      width: RING_INNER,
      height: RING_INNER,
    })
    .toBuffer();

  for (const w of [176, 320]) {
    const mask = Buffer.from(
      `<svg width="${w}" height="${w}"><circle cx="${w / 2}" cy="${w / 2}" r="${w / 2 - 1}" fill="#fff"/></svg>`,
    );
    await sharp(flat)
      .resize({ width: w, height: w, kernel: 'lanczos3' })
      .sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 })
      .composite([{ input: mask, blend: 'dest-in' }])
      .webp({ quality: 86, effort: 6, alphaQuality: 100 })
      .toFile(join(OUT, `${c.name}-${w}.webp`));
  }
  console.log(`${c.name}-{176,320}.webp`);
}

/**
 * Open Graph card — the bottle on the brand cream, closed by the green band
 * from the pack footer. No overlaid copy: the product name is already on the
 * label, and text drawn here would depend on whatever fonts the build machine
 * happens to have.
 */
const CREAM = { r: 0xfa, g: 0xf6, b: 0xec, alpha: 1 };
const GREEN = { r: 0x27, g: 0x44, b: 0x2c, alpha: 1 };

const ogBottle = await sharp(WOMAN)
  .extract(SHOTS.find((s) => s.name === 'product-bottle').crop)
  .resize({ height: 470, kernel: 'lanczos3' })
  .toBuffer();
const { width: obw } = await sharp(ogBottle).metadata();
const band = await sharp({ create: { width: 1200, height: 54, channels: 4, background: GREEN } }).png().toBuffer();

await sharp({ create: { width: 1200, height: 630, channels: 4, background: CREAM } })
  .composite([
    { input: ogBottle, top: 55, left: Math.round((1200 - obw) / 2) },
    { input: band, top: 576, left: 0 },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(join(OUT, 'og-cover.jpg'));

console.log('og-cover.jpg');
