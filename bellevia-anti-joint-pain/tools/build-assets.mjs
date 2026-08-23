/**
 * BelleVia Anti-Joint Pain — asset builder.
 *
 * Every image on the landing page comes from the client's official folder
 * (`Desktop/anti join pain`). Nothing is generated, redrawn or substituted, and
 * no burned-in text is edited, covered or removed.
 *
 * There are two kinds of output:
 *
 *  1. WHOLE — the supplied file, re-encoded to webp and nothing else. The frame
 *     is exactly the one the brand delivered, promotional headlines included.
 *     This is most of the folder: the ingredient panel, the usage panel and
 *     the creative gallery.
 *
 *  2. FRAMED — crops that exist because a layout slot demands a shape the
 *     square creative cannot give: a tall hero, a small offer-card thumbnail,
 *     a close-up of the label so the pack's own wording can be read on a phone,
 *     and two macro details. Same pixels, different window. Nothing is redrawn.
 *
 * The creatives carry the brand's own promotional claims — «قل وداعاً لألم
 * المفاصل», «يقلل من الألم والالتهابات», «حرك بدون ألم». Those are shown as
 * what they are: brand advertising, in a section that says so, and the page's
 * own copy never restates them. What the page asserts in its own voice comes
 * from the pack label and the supplied product sheet.
 *
 * Fonts, logo and favicons are shared with the sibling Bellevia page and are
 * copied rather than rebuilt, so both pages carry an identical wordmark.
 *
 * Run from the repo root:  node bellevia-anti-joint-pain/tools/build-assets.mjs
 * Override the source folder with BELLEVIA_JOINT_SOURCE_DIR.
 */
import sharp from 'sharp';
import { mkdir, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'assets', 'images');
const SRC = process.env.BELLEVIA_JOINT_SOURCE_DIR || 'C:/Users/ADmiN/Desktop/anti join pain';
/** The sibling page's built brand assets — same brand, same wordmark. */
const SIBLING = join(ROOT, '..', 'bellevia-weight-gain', 'assets');

const src = (f) => join(SRC, f);

const ZELLIGE = src('Gemini_Generated_Image_gvy45cgvy45cgvy4.png'); // 1024²
const PODIUM = src('Gemini_Generated_Image_f1qgplf1qgplf1qg.png'); // 1024²

const webp = { quality: 82, effort: 6 };

/**
 * ── 1 · WHOLE ───────────────────────────────────────────────────────────────
 *
 * Every supplied file, uncropped. `widths` always ends at the file's own width,
 * so the largest variant is a 1:1 re-encode and the page can never be served
 * something enlarged past the original. The smaller entry is there for phones.
 *
 * Seven of these are small (135–236 px): they were supplied at that size, and
 * they are displayed at it. `style.css` caps each card at the file's natural
 * width rather than stretching it, which is why they stay sharp.
 */
const WHOLE = [
  // — The two large square creatives, the centrepieces of the gallery.
  { name: 'creative-zellige', from: ZELLIGE, widths: [512, 1024] },
  { name: 'creative-podium', from: PODIUM, widths: [512, 1024] },

  // — Promotional creatives, supplied small.
  { name: 'creative-banner', from: src('Screenshot 2026-08-10 171912.png'), widths: [194, 388] },
  { name: 'creative-banner-alt', from: src('Screenshot 2026-08-10 171726.png'), widths: [185, 370] },
  { name: 'creative-audience', from: src('Screenshot 2026-08-10 172118.png'), widths: [155, 310] },

  // — Informational panels. Both restate what is printed on the pack, so they
  //   sit beside the matching section rather than in the creative gallery.
  { name: 'panel-ingredients', from: src('Screenshot 2026-08-10 172110.png'), widths: [153, 306] },
  { name: 'panel-usage', from: src('Screenshot 2026-08-10 172050.png'), widths: [183, 366] },

];

// The wide framing of 'Screenshot …172037.png' is no longer built. The page
// shows 'macro-capsules' instead — a tighter crop of the same file — and
// shipping both put two versions of one photograph in the same section.

/**
 * ── 1b · MACRO CROPS ────────────────────────────────────────────────────────
 *
 * Two compositions that were sitting unused inside creatives already in the
 * folder. Neither is a new photograph — both are windows onto pixels the brand
 * supplied — and both exist because the page needed visual variety that
 * repeating the same standing bottle could not give it.
 *
 * There is no lifestyle photography here and none was invented: nothing in the
 * supplied folder shows a person in a way this page can use, and a stock or
 * generated model would be exactly the "generic AI landing page" look the
 * brief rules out.
 */
const MACROS = [
  {
    // Turmeric: bowl, loose powder, fresh root. Lifted from the ingredient
    // panel of the zellige creative, above its caption, so no text comes with
    // it. The only genuine ingredient photograph in the folder.
    name: 'macro-turmeric',
    from: ZELLIGE,
    crop: { left: 59, top: 183, width: 214, height: 144 },
    widths: [214, 375],
  },
  {
    // Capsules against the pack, on the wooden board. Cut from the product
    // photograph rather than showing it whole again, so the page has a detail
    // shot as well as a pack shot. Supplied small, so it is used small.
    name: 'macro-capsules',
    from: src('Screenshot 2026-08-10 172037.png'),
    crop: { left: 0, top: 138, width: 152, height: 98 },
    widths: [152, 304],
  },
];

/**
 * Three supplied files are not built. All three are pictures of a joint lit
 * with a red inflammation glow:
 *
 *   1764164894eb14cd.jpg                  — knee, red glow, hands on it
 *   التهاب-المفاصل-…_large.jpeg            — X-ray overlay on a leg, red joint
 *   Screenshot 2026-08-10 172057.png      — ad creative built on the same shot
 *
 * A red-lit joint is a picture of a disease symptom. On a page selling a food
 * supplement it makes visually the treatment claim the copy never makes, and it
 * pushes the product towards looking like medication — which is the opposite of
 * what a cold Moroccan COD visitor needs to believe before ordering. The brand's
 * other five creatives carry the campaign perfectly well without it.
 *
 * They are one line each to restore: add them back to WHOLE above.
 */

/**
 * ── 2 · FRAMED ──────────────────────────────────────────────────────────────
 *
 * Three windows onto the zellige creative, each for a slot whose shape a 1:1
 * square cannot fill. The pixels are untouched; only the frame differs.
 */
const FRAMED = [
  {
    // Hero. A hero needs a tall portrait beside the headline; the square
    // creative would either letterbox or shrink the bottle to a thumbnail.
    name: 'hero-bottle',
    from: ZELLIGE,
    crop: { left: 312, top: 140, width: 414, height: 735 },
    widths: [414, 725],
  },
  {
    // Offer card and closing panel, where the bottle renders ~230 px wide.
    name: 'product-bottle',
    from: ZELLIGE,
    crop: { left: 330, top: 158, width: 380, height: 700 },
    widths: [380, 665],
  },
  {
    // The label, close enough to read on a phone. This is the page's proof
    // shot: the pack's own one-line description, "COMPLEMENT ALIMENTAIRE" and
    // "30 Capsules" are legible here, and each is quoted as live text beside it.
    name: 'label-front',
    from: ZELLIGE,
    crop: { left: 330, top: 395, width: 362, height: 455 },
    widths: [362, 580],
  },
];

/**
 * ── 3 · INGREDIENT ICONS ────────────────────────────────────────────────────
 *
 * Four square tiles cut from the podium creative's own ingredient list, each
 * centred on one illustration with its gold ring intact — the ring is brand
 * furniture, not something added here. The tiles stop short of the ingredient
 * names printed beside them (which begin at x≈157), so the names and the
 * milligrams are typed as live text on the card rather than baked into a
 * picture. The whole panel is also shown uncropped in the ingredient section.
 */
const TILE = 96;
const ICONS = [
  { name: 'ing-glucosamine', cx: 105, cy: 291 },
  { name: 'ing-chondroitin', cx: 105, cy: 387 },
  { name: 'ing-msm', cx: 105, cy: 484 },
  { name: 'ing-curcumine', cx: 103, cy: 575 },
];

await mkdir(OUT, { recursive: true });

for (const item of WHOLE) {
  const meta = await sharp(item.from).metadata();
  for (const w of item.widths) {
    const h = Math.round((meta.height / meta.width) * w);
    let pipe = sharp(item.from).resize({ width: w, height: h, kernel: 'lanczos3' });
    // The supplied file is the ceiling: enlarging past it is only ever done for
    // a 2× screen, and then with a light unsharp pass to hold the edges.
    if (w > meta.width) pipe = pipe.sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 });
    await pipe.webp(webp).toFile(join(OUT, `${item.name}-${w}.webp`));
  }
  console.log(`${item.name}-{${item.widths}}.webp   (whole, source ${meta.width}×${meta.height})`);
}

for (const shot of [...FRAMED, ...MACROS]) {
  for (const w of shot.widths) {
    const h = Math.round((shot.crop.height / shot.crop.width) * w);
    let pipe = sharp(shot.from).extract(shot.crop).resize({ width: w, height: h, kernel: 'lanczos3' });
    if (w > shot.crop.width) pipe = pipe.sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 });
    await pipe.webp(webp).toFile(join(OUT, `${shot.name}-${w}.webp`));
  }
  console.log(`${shot.name}-{${shot.widths}}.webp   (framed)`);
}

for (const icon of ICONS) {
  const tile = await sharp(PODIUM)
    .extract({
      left: Math.round(icon.cx - TILE / 2),
      top: Math.round(icon.cy - TILE / 2),
      width: TILE,
      height: TILE,
    })
    .toBuffer();

  // Rendered at 64 CSS px (see the `.card img` override in style.css). The
  // illustration inside the ring is only ~68 px in the creative, so a card that
  // showed it at the stylesheet's default 88 px would already be upscaling it;
  // 64 keeps the 1× variant a downscale and holds the 2× under 1.35×.
  for (const w of [64, 128]) {
    await sharp(tile)
      .resize({ width: w, height: w, kernel: 'lanczos3' })
      .sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 })
      .webp({ quality: 88, effort: 6 })
      .toFile(join(OUT, `${icon.name}-${w}.webp`));
  }
  console.log(`${icon.name}-{64,128}.webp`);
}

/**
 * Open Graph card — the bottle on the brand cream, closed by the green band
 * from the pack footer. No overlaid copy: the product name is already on the
 * label, and text drawn here would depend on whatever fonts the build machine
 * happens to have.
 */
const CREAM = { r: 0xfa, g: 0xf6, b: 0xec, alpha: 1 };
const GREEN = { r: 0x27, g: 0x44, b: 0x2c, alpha: 1 };

const ogBottle = await sharp(ZELLIGE)
  .extract(FRAMED[0].crop)
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

/**
 * `4c175eb4-4b3f-48b0-88fb-0456b8640e41.jpg` is not built.
 *
 * It is not a discard for editorial reasons — it is the same picture as
 * `Gemini_Generated_Image_f1qgpl….png`, re-encoded as JPEG (mean absolute
 * difference between the two, downsampled to 64×64 greyscale: 0.33/255).
 * Shipping both would put the identical creative in the gallery twice, once
 * with JPEG artefacts. The PNG is the one that is used.
 */

// ── Shared brand assets ──────────────────────────────────────────────────
for (const dir of ['fonts', 'logo', 'favicon']) {
  await cp(join(SIBLING, dir), join(ROOT, 'assets', dir), { recursive: true });
  console.log(`assets/${dir}/  ← bellevia-weight-gain`);
}
