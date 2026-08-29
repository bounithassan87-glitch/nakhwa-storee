/**
 * BelleVia — Pack الراحة (شامبو + سيروم ضد القمل) — asset builder.
 *
 * Every pixel on the landing page comes from the client's official folder
 * (`Downloads/pack`). Nothing is redrawn, recoloured, re-labelled or
 * substituted, and no burned-in text is edited or covered.
 *
 * Seven files were supplied. How each one is used, and why:
 *
 *   bc230de6…png  «باك متكامل» — FOUR products (شامبو، سيروم، زيت علاج، بلسم).
 *                 NEVER shown whole. Pack الراحة is two products; a picture of
 *                 four next to a two-product price is the one mistake a COD
 *                 page cannot make — it is the buyer refusing the parcel at the
 *                 door. Only the shampoo+serum pair is cropped out of it, and
 *                 that crop is the hero.
 *   5486848a…png  «المكونات» — the shampoo and the serum, alone, on a podium,
 *                 with the ingredient list. Shown WHOLE in the ingredients
 *                 section, and cropped twice for the two product cards.
 *   1bffcf91…png  «المشكلة» — shown WHOLE in the problem section.
 *   ad13e0a1…png  «الفوائد» — the three benefit lines. The three gold medallions
 *                 are cut out and used as the icons of live-text cards. The
 *                 creative's own wording is repeated verbatim as HTML instead of
 *                 shipping a 1254px picture of Arabic text to a 390px phone.
 *   5ae418cd…png  «كيفية الاستخدام» — same treatment: the five step photographs
 *                 are cut out, the steps are typed as text.
 *
 * Two files are deliberately not built:
 *
 *   606b31d2…png  a second «المشكلة» grid — same message as 1bffcf91, plus a
 *                 clinical scalp close-up. One problem visual is the brief.
 *   60ca241d…png  the usage/precautions sheet without the product photographs —
 *                 the same content as 5ae418cd, which is the richer file.
 *
 * Both are one line each to restore: add them to WHOLE below.
 *
 * Fonts, logo and favicons are shared with the sibling Bellevia pages and are
 * copied rather than rebuilt, so all three carry an identical wordmark.
 *
 * Run from the repo root:  node bellevia-anti-lice/tools/build-assets.mjs
 * Override the source folder with BELLEVIA_LICE_SOURCE_DIR.
 */
import sharp from 'sharp';
import { mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'assets', 'images');
/**
 * The client's creative folder. It has already been renamed once, so rather
 * than hard-coding one path this tries the known locations and says plainly
 * what to do when none of them is there.
 */
const SRC = (() => {
  if (process.env.BELLEVIA_LICE_SOURCE_DIR) return process.env.BELLEVIA_LICE_SOURCE_DIR;
  const probe = '1bffcf91-188c-4105-8a9d-f47a588cb51a.png'; // «المشكلة»
  const candidates = ['C:/Users/ADmiN/Downloads/pack 2', 'C:/Users/ADmiN/Downloads/pack'];
  for (const dir of candidates) if (existsSync(join(dir, probe))) return dir;
  console.error(
    'Cannot find the BelleVia creative folder. Looked in:\n' +
      candidates.map((c) => '  ' + c).join('\n') +
      '\nSet BELLEVIA_LICE_SOURCE_DIR to wherever it lives now, e.g.\n' +
      '  BELLEVIA_LICE_SOURCE_DIR="D:/creatives/pack" node bellevia-anti-lice/tools/build-assets.mjs',
  );
  process.exit(1);
})();
/** The sibling page's built brand assets — same brand, same wordmark. */
const SIBLING = join(ROOT, '..', 'bellevia-weight-gain', 'assets');

const src = (f) => join(SRC, f);

/**
 * Studio mockups: the two bottles rendered on transparent backgrounds at
 * 2048², supplied by the client in `Downloads/9OML`. These beat every crop out
 * of a lifestyle composite — full resolution, no background to fight, and the
 * product can be floated in a scene instead of parked in a white box. They are
 * the client's own renders; nothing here redraws a bottle or a label.
 */
/**
 * The hero artwork, supplied finished by the client: the Belle Via wordmark, the
 * two bottles, the shield, the plinth and the foliage, all in one 1537×1023
 * frame.
 *
 * It is re-encoded and nothing else — no crop, no retouch, no recolour, no
 * overlay. The page renders it with `object-fit: contain`, so every edge stays
 * visible at every viewport; when there is not enough room the image gets
 * smaller rather than losing any of itself.
 *
 * 1537 is the largest variant because that is the file's own width; asking for
 * more would be an upscale. The page therefore caps the displayed width at
 * 768 CSS px, which is exactly 2× on a retina screen.
 */
const HERO_ART = (() => {
  if (process.env.BELLEVIA_LICE_HERO_ART) return process.env.BELLEVIA_LICE_HERO_ART;
  const f = 'C:/Users/ADmiN/Downloads/bb685055-2302-4724-a533-fef9df7179a2.png';
  return existsSync(f) ? f : null;
})();

/**
 * The AVANT / APRÈS comparison, supplied finished by the client (1402×1122).
 * Re-encoded and nothing else: no crop, no retouch, no recolour. Shown whole.
 */
const BEFORE_AFTER = (() => {
  if (process.env.BELLEVIA_LICE_BEFORE_AFTER) return process.env.BELLEVIA_LICE_BEFORE_AFTER;
  const p = 'C:/Users/ADmiN/Downloads/24e54b42-44de-4889-aeb7-8549accd2cc2.png';
  return existsSync(p) ? p : null;
})();

/**
 * The family hero, supplied finished by the client (1536×1024): two children,
 * the real shampoo and serum, and the brand's own captions. Re-encoded and
 * nothing else — no crop, no retouch, no recolour. Rendered with
 * `object-fit: contain`, so no face and no bottle is ever cut.
 */
const HERO_KIDS = (() => {
  if (process.env.BELLEVIA_LICE_HERO_KIDS) return process.env.BELLEVIA_LICE_HERO_KIDS;
  const p = 'C:/Users/ADmiN/Downloads/9a70a398-3ea5-47b4-8901-d0cca39ea93a.png';
  return existsSync(p) ? p : null;
})();

const MOCK_DIR = (() => {
  if (process.env.BELLEVIA_LICE_MOCKUP_DIR) return process.env.BELLEVIA_LICE_MOCKUP_DIR;
  const probe = 'mockup-white-champo-150ml-main.png';
  for (const dir of ['C:/Users/ADmiN/Downloads/9OML']) if (existsSync(join(dir, probe))) return dir;
  return null;
})();
const mock = (f) => (MOCK_DIR ? join(MOCK_DIR, f) : null);

const PACK4 = src('bc230de6-ac0f-4043-9a8d-4590843710c6.png');   // 1024×1536
const DUO = src('5486848a-087e-4360-9309-bbc067cddac6.png');     // 1536×1024
const PROBLEM = src('1bffcf91-188c-4105-8a9d-f47a588cb51a.png'); // 1254²
const GRID = src('606b31d2-3973-4478-9397-ce868d8653da.png');    // 1254², six cards
const BENEFITS = src('ad13e0a1-2be9-4fa0-9984-3c843c7ef5bf.png');// 1254²
const USAGE = src('5ae418cd-b35d-4537-9ce6-cf269936e9b9.png');   // 1198×1313

const webp = { quality: 82, effort: 6 };

/**
 * ── 1 · WHOLE ───────────────────────────────────────────────────────────────
 * The supplied frame, re-encoded and nothing else. `widths` ends at the file's
 * own width, so the largest variant is never an enlargement.
 */
const WHOLE = [
  // The ingredient panel. It is the only supplied photograph that shows the two
  // products of this pack — and only those two — so it doubles as proof of what
  // is in the box. Shown uncropped; the ingredient names are also typed out.
  { name: 'panel-ingredients', from: DUO, widths: [760, 1400] },
];
// «المشكلة» is no longer emitted whole. The page shows the child cropped out of
// it at full resolution instead (see `problem-girl` below), and shipping the
// composite as well was 164KB nobody downloaded.

/**
 * ── 2 · FRAMED ──────────────────────────────────────────────────────────────
 * Windows onto pixels the brand supplied, cut because a layout slot needs a
 * shape the delivered frame cannot give.
 */
/* The hero and the two product cards used to be crops out of lifestyle
   composites. They are now built from the transparent studio renders at the top
   of this file, which are higher resolution and can float in a lit scene. */
const FRAMED = [
  {
    // «هاد الباك لمن؟» — the family photograph out of the six-card grid. The page
    // needed a human, non-clinical picture for the audience section and the brand
    // had already shot one; nothing is generated to fill the slot.
    //
    // The tile is only 320px wide in the creative — that is the whole photograph
    // the brand supplied — so 600 is a sharpened upscale, not new detail. The
    // page caps this image at 300 CSS px so the upscale stays mild. If a larger
    // family photograph ever arrives, raise both numbers here and the cap in
    // `.who .split__shot img`.
    name: 'who-family',
    from: GRID,
    crop: { left: 105, top: 720, width: 320, height: 270 },
    widths: [320, 600],
  },
  {
    // The problem, on a face — cropped from «المشكلة», where the child is shot at
    // full resolution, rather than from the 320px thumbnail of the same idea in
    // the six-card grid. The clinical scalp close-up two tiles along is left out
    // on purpose: a lice page has to stay readable by someone eating lunch.
    name: 'problem-girl',
    from: PROBLEM,
    crop: { left: 30, top: 330, width: 600, height: 720 },
    widths: [360, 720],
  },
];

/**
 * ── 3 · BENEFIT MEDALLIONS ──────────────────────────────────────────────────
 * Three square tiles off «الفوائد», each centred on one gold-ringed medallion
 * and stopping well short of the Arabic line printed beside it (which starts at
 * x≈450). The ring is brand furniture, not decoration added here.
 */
const TILE = 190;
const MEDALS = [
  { name: 'benefit-lice', cx: 330, cy: 335 },   // the louse
  { name: 'benefit-natural', cx: 330, cy: 578 },// the sprig
  { name: 'benefit-shield', cx: 330, cy: 826 }, // the shield
];

/**
 * ── 4 · STEP PHOTOGRAPHS ────────────────────────────────────────────────────
 * The five circular photographs inside «كيفية الاستخدام», cut out of their own
 * gold rings. The instructions themselves are typed as text on the cards — a
 * phone should never be asked to read a 1198px picture of a sentence.
 */
const RING = 170;
/**
 * The three the page shows, in routine order: serum, shampoo, comb-through. The rebuilt «كيفاش كتستعمليه» is a
 * three-step sequence — serum on, wait, wash — so the rinse and weekly-use
 * photographs are not built. Their coordinates are kept in the comments so the
 * pair can be restored in one line if the section ever grows back:
 *   step-sh-2 (rinsing)      cx 735, cy 620
 *   step-se-3 (weekly use)   cx 158, cy 793
 */
const STEPS = [
  { name: 'step-se-1', cx: 158, cy: 428 }, // 1 · dropper on dry hair
  { name: 'step-se-2', cx: 158, cy: 605 }, // 2 · hair up, left to sit
  { name: 'step-sh-1', cx: 735, cy: 425 }, // 2 · lathering on wet hair
  { name: 'step-se-3', cx: 158, cy: 793 }, // 3 · finished, hair combed through
];

await mkdir(OUT, { recursive: true });

/* ── The family hero, whole ────────────────────────────────────────────── */
if (HERO_KIDS) {
  const meta = await sharp(HERO_KIDS).metadata();
  for (const w of [400, 768, 1536]) {
    if (w > meta.width) continue; // never enlarge past the source
    await sharp(HERO_KIDS)
      .resize({ width: w, kernel: 'lanczos3' })
      .webp({ quality: 90, effort: 6 })
      .toFile(join(OUT, `hero-kids-${w}.webp`));
  }
  console.log(`hero-kids-{400,768,1536}.webp   (supplied frame ${meta.width}×${meta.height}, uncropped)`);
} else {
  console.warn('! family hero not found — hero-kids-* not rebuilt. Set BELLEVIA_LICE_HERO_KIDS.');
}

/* ── The AVANT / APRÈS comparison, whole ───────────────────────────────── */
if (BEFORE_AFTER) {
  const meta = await sharp(BEFORE_AFTER).metadata();
  for (const w of [480, 960, 1402]) {
    if (w > meta.width) continue; // never enlarge past the source
    await sharp(BEFORE_AFTER)
      .resize({ width: w, kernel: 'lanczos3' })
      .webp({ quality: 88, effort: 6 })
      .toFile(join(OUT, `before-after-${w}.webp`));
  }
  console.log(`before-after-{480,960,1402}.webp   (supplied frame ${meta.width}×${meta.height}, uncropped)`);
} else {
  console.warn('! before/after image not found — before-after-* not rebuilt. Set BELLEVIA_LICE_BEFORE_AFTER.');
}

/* ── The supplied hero artwork, whole ──────────────────────────────────── */
if (HERO_ART) {
  const meta = await sharp(HERO_ART).metadata();
  for (const w of [400, 768, 1537]) {
    if (w > meta.width) continue; // never enlarge past the source
    await sharp(HERO_ART)
      .resize({ width: w, kernel: 'lanczos3' }) // proportional; height follows
      .webp({ quality: 90, effort: 6 })
      .toFile(join(OUT, `hero-art-${w}.webp`));
  }
  console.log(`hero-art-{400,768,1537}.webp   (supplied frame ${meta.width}×${meta.height}, uncropped)`);
} else {
  console.warn('! hero artwork not found — hero-art-* not rebuilt. Set BELLEVIA_LICE_HERO_ART.');
}

/**
 * ── 0 · The floating product composition ────────────────────────────────────
 * Built from the two transparent studio renders, on a transparent canvas with a
 * blurred contact shadow, so the page can float the pair inside a lit scene
 * rather than sit it in a white rounded card.
 *
 * The renders arrive normalised to one canvas height, so the relative scale is
 * set here: the 30ml serum reads at 0.74 of the 150ml shampoo, which is how the
 * brand stages the pair in its own photographs. Uniform scaling only — the
 * bottles are never stretched, recoloured or re-labelled.
 */
const SHAMPOO = { file: 'mockup-white-champo-150ml-main.png', box: { left: 771, top: 218, width: 449, height: 1644 } };
const SERUM = { file: 'mockup-brown-serum-30ml-main.png', box: { left: 693, top: 205, width: 492, height: 1610 } };

/** Tight alpha bounds → a bottle sized by its own artwork, with a soft shadow. */
async function bottle(spec, height) {
  const w = Math.round(height * (spec.box.width / spec.box.height));
  return {
    buf: await sharp(mock(spec.file)).extract(spec.box).resize({ width: w, height, fit: 'fill' }).toBuffer(),
    w, h: height,
  };
}
function contactShadow(width, height, opacity = 0.4) {
  return sharp(Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <defs><radialGradient id="g" cx="50%" cy="50%" r="50%">
         <stop offset="0%" stop-color="#16281B" stop-opacity="${opacity}"/>
         <stop offset="55%" stop-color="#16281B" stop-opacity="${opacity * 0.45}"/>
         <stop offset="100%" stop-color="#16281B" stop-opacity="0"/>
       </radialGradient></defs>
       <ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="url(#g)"/>
     </svg>`)).blur(9).png().toBuffer();
}

let heroDuoBuf = null;
if (MOCK_DIR) {
  // The pair, for the hero.
  const SH_H = 760;
  const sh = await bottle(SHAMPOO, SH_H);
  const se = await bottle(SERUM, Math.round(SH_H * 0.74));
  const OVERLAP = 46, PAD_X = 60, PAD_TOP = 40, PAD_BOTTOM = 96;
  const contentW = sh.w + se.w - OVERLAP;
  const W = contentW + PAD_X * 2;
  const H = SH_H + PAD_TOP + PAD_BOTTOM;
  const baseline = PAD_TOP + SH_H;
  const shadowW = Math.round(contentW * 1.06);
  const duo = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: await contactShadow(shadowW, 74), left: Math.round((W - shadowW) / 2), top: baseline - 26 },
      { input: sh.buf, left: PAD_X, top: baseline - sh.h },
      { input: se.buf, left: PAD_X + sh.w - OVERLAP, top: baseline - se.h },
    ]).png().toBuffer();
  heroDuoBuf = duo;
  for (const w of [460, 920]) {
    await sharp(duo).resize({ width: w, kernel: 'lanczos3' })
      .webp({ quality: 90, effort: 6, alphaQuality: 90 })
      .toFile(join(OUT, `hero-duo-${w}.webp`));
  }
  console.log(`hero-duo-{460,920}.webp   (composed ${W}×${H} from the two studio renders)`);

  // Each bottle alone, for the showcase cards — same treatment, own shadow.
  for (const [name, spec] of [['pack-shampoo', SHAMPOO], ['pack-serum', SERUM]]) {
    const B_H = 620;
    const b = await bottle(spec, B_H);
    const bottom = 70;
    const shW = Math.round(b.w * 1.5);
    // The canvas has to clear the shadow, which is wider than the bottle.
    const pad = Math.max(40, Math.ceil((shW - b.w) / 2) + 8);
    const cw = b.w + pad * 2, ch = B_H + 24 + bottom;
    const one = await sharp({ create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: await contactShadow(shW, 58, 0.34), left: Math.round((cw - shW) / 2), top: 24 + B_H - 20 },
        { input: b.buf, left: pad, top: 24 },
      ]).png().toBuffer();
    for (const w of [220, 440]) {
      await sharp(one).resize({ width: w, kernel: 'lanczos3' })
        .webp({ quality: 90, effort: 6, alphaQuality: 90 })
        .toFile(join(OUT, `${name}-${w}.webp`));
    }
    console.log(`${name}-{220,440}.webp   (studio render, transparent)`);
  }
} else {
  console.warn('! mockup folder not found — hero-duo / pack-* not rebuilt. Set BELLEVIA_LICE_MOCKUP_DIR.');
}

for (const item of WHOLE) {
  const meta = await sharp(item.from).metadata();
  for (const w of item.widths) {
    const h = Math.round((meta.height / meta.width) * w);
    let pipe = sharp(item.from).resize({ width: w, height: h, kernel: 'lanczos3' });
    if (w > meta.width) pipe = pipe.sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 });
    await pipe.webp(webp).toFile(join(OUT, `${item.name}-${w}.webp`));
  }
  console.log(`${item.name}-{${item.widths}}.webp   (whole, source ${meta.width}×${meta.height})`);
}

for (const shot of FRAMED) {
  for (const w of shot.widths) {
    const h = Math.round((shot.crop.height / shot.crop.width) * w);
    let pipe = sharp(shot.from).extract(shot.crop).resize({ width: w, height: h, kernel: 'lanczos3' });
    if (w > shot.crop.width) pipe = pipe.sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 });
    await pipe.webp(webp).toFile(join(OUT, `${shot.name}-${w}.webp`));
  }
  console.log(`${shot.name}-{${shot.widths}}.webp   (framed)`);
}

// Rendered at 72 CSS px. The medallion inside the ring is ~170 px in the
// creative, so both variants stay downscales.
for (const m of MEDALS) {
  const tile = await sharp(BENEFITS)
    .extract({ left: m.cx - TILE / 2, top: m.cy - TILE / 2, width: TILE, height: TILE })
    .toBuffer();
  for (const w of [72, 144]) {
    await sharp(tile).resize({ width: w, height: w, kernel: 'lanczos3' })
      .sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 })
      .webp({ quality: 88, effort: 6 })
      .toFile(join(OUT, `${m.name}-${w}.webp`));
  }
  console.log(`${m.name}-{72,144}.webp`);
}

// Rendered up to 110 CSS px inside a circular mask, so 240 covers DPR 2.
for (const s of STEPS) {
  const tile = await sharp(USAGE)
    .extract({ left: s.cx - RING / 2, top: s.cy - RING / 2, width: RING, height: RING })
    .toBuffer();
  for (const w of [120, 240]) {
    await sharp(tile).resize({ width: w, height: w, kernel: 'lanczos3' })
      .sharpen({ sigma: 0.5, m1: 0.4, m2: 0.7 })
      .webp({ quality: 88, effort: 6 })
      .toFile(join(OUT, `${s.name}-${w}.webp`));
  }
  console.log(`${s.name}-{120,240}.webp`);
}

/**
 * Open Graph card — the two products on the brand cream, closed by the green
 * band from the pack footer. No overlaid copy: the names are already on the
 * labels, and text drawn here would depend on the build machine's fonts.
 */
const GREEN = { r: 0x27, g: 0x44, b: 0x2c, alpha: 1 };

/* Built from the same floating composition the hero uses, over the brand green
   with a lit centre so the white bottle still reads in a Facebook feed. */
const ogSource = heroDuoBuf
  ? await sharp(heroDuoBuf).resize({ height: 520, kernel: 'lanczos3' }).toBuffer()
  : null;

if (ogSource) {
  const { width: sw } = await sharp(ogSource).metadata();
  const halo = Buffer.from(
    `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
       <defs><radialGradient id="h" cx="50%" cy="48%" r="46%">
         <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.96"/>
         <stop offset="55%" stop-color="#EAF3E4" stop-opacity="0.7"/>
         <stop offset="100%" stop-color="#2D5B2F" stop-opacity="0"/>
       </radialGradient></defs>
       <rect width="1200" height="630" fill="url(#h)"/>
     </svg>`);
  const band = await sharp({ create: { width: 1200, height: 54, channels: 4, background: GREEN } }).png().toBuffer();

  await sharp({ create: { width: 1200, height: 630, channels: 4, background: GREEN } })
    .composite([
      { input: halo, top: 0, left: 0 },
      { input: ogSource, top: 40, left: Math.round((1200 - sw) / 2) },
      { input: band, top: 576, left: 0 },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(join(OUT, 'og-cover.jpg'));
  console.log('og-cover.jpg');
} else {
  console.warn('! og-cover.jpg not rebuilt (no mockup source)');
}

// ── Shared brand assets ──────────────────────────────────────────────────
for (const dir of ['fonts', 'logo', 'favicon']) {
  await cp(join(SIBLING, dir), join(ROOT, 'assets', dir), { recursive: true });
  console.log(`assets/${dir}/  ← bellevia-weight-gain`);
}
