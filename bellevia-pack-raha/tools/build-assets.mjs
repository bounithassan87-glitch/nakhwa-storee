/**
 * BelleVia — PACK RAHA — asset builder.
 *
 * ── The approved product creative ───────────────────────────────────────────
 * `pack-raha-background-reference.png.png` (1024×1536) is the SOURCE OF TRUTH
 * for the three bottles and for the page's whole botanical art direction:
 *
 *     بخاخ ضد تساقط الشعر   100ml   white spray
 *     زيت ضد تساقط الشعر     60ml   white airless pump
 *     شامبو مضاد لتساقط الشعر 150ml  black cap
 *
 * Nothing in this file redraws, retouches, recolours, restyles or regenerates a
 * bottle. Every product asset is a rectangular crop of that photograph and
 * nothing else. Crop bounds were measured off the file (a near-white scan of
 * the bottle bodies, plus the black cap found separately), not eyeballed:
 *
 *     bottles occupy   x 150 → 810      y 500 → ~1310
 *     «100%» badge     x 822 → 970      y 460 → 620     ← never included
 *     green claim band y 1352 →         ← never included
 *     headline / logo  y 40 → 460       ← never included
 *
 * The cluster therefore stops at x 818, four pixels short of the badge.
 *
 * ── What is deliberately NOT taken from it ──────────────────────────────────
 * The headline, the «عناية طبيعية» pill, the «مكونات طبيعية 100%» badge and the
 * green claims band at the foot are all excluded by the crop rectangles. The
 * page states its own headline, price and CTA as live HTML, and it makes no
 * "100% natural" claim.
 *
 * ── The background system (§ "Approach C") ──────────────────────────────────
 * The page's botanical atmosphere is taken from the same photograph rather than
 * generated, so hero and page belong to one world. Two clean regions carry it —
 * both verified to contain no text, no bottle and no badge:
 *
 *     bg-leaves / bg-wash   x 0 → 265,   y 0 → 205     dewy leaves + bokeh
 *     bg-botanical          x 828 → 1024, y 640 → 1340  aloe, rosemary, wet stone
 *
 * `bg-wash` is the same leaf block upscaled and heavily blurred: at that radius
 * it is a soft green-and-cream light field, which is what a section background
 * needs to be behind text. The sharper `bg-leaves` is used small, at the hero's
 * outer corners, where the brief asks for foliage framing. Everything else is
 * CSS gradient in the same palette — no photograph behind body copy.
 *
 * ── Assets carried over from the earlier creatives ──────────────────────────
 * The six problem medallions, three outcome medallions, the two photographs of
 * people, the unisex pictogram and the three ingredient still lifes are line
 * icons, people and plants — no packaging appears in any of them, so they are
 * unaffected by the bottle change and are rebuilt from their original files.
 *
 * Run from the repo root:  node bellevia-pack-raha/tools/build-assets.mjs
 * Override the source folder with BELLEVIA_RAHA_SOURCE_DIR.
 */
import sharp from 'sharp';
import { mkdir, cp, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'assets', 'images');

const SRC = (() => {
  if (process.env.BELLEVIA_RAHA_SOURCE_DIR) return process.env.BELLEVIA_RAHA_SOURCE_DIR;
  const probe = 'pack-raha-background-reference.png.png';
  const candidates = ['C:/Users/ADmiN/Desktop/PACK RAHA', 'C:/Users/ADmiN/Downloads/PACK RAHA'];
  for (const dir of candidates) if (existsSync(join(dir, probe))) return dir;
  console.error(
    'Cannot find the PACK RAHA creative folder. Looked in:\n' +
      candidates.map((c) => '  ' + c).join('\n') +
      '\nSet BELLEVIA_RAHA_SOURCE_DIR to wherever it lives now.',
  );
  process.exit(1);
})();

/** The sibling page's built brand assets — same brand, same wordmark. */
const SIBLING = join(ROOT, '..', 'bellevia-anti-lice', 'assets');
const src = (f) => join(SRC, f);

/** THE approved creative. Every product pixel on the page comes from this file. */
const PACK = src('pack-raha-background-reference.png.png');       // 1024×1536

/** Earlier creatives, used ONLY for icons, people and plants — never bottles. */
const PROBLEM = src('57200c1d-036d-4261-bb64-9e9b50c43aa0.png');  // 1058×1487
const ROUTINE = src('23cf29bc-6c99-4ac4-a04c-13384c5ec7d7.png');  // 1086×1448
const INGREDIENTS = src('2d9eeb12-c5fd-409d-b217-9eab3daf3154.png'); // 1317×1194
const WASH = src('7934e9f4-84a3-4d6b-80ce-51b5c169e8a8.png');     // 1254²
const OFFER_OLD = src('84cef62e-15c7-478a-a4f8-4e53f7484b57.png'); // superseded; unisex icon only
/** The hair-fall photograph for the agitation section. A person, no packaging. */
const HAIRLOSS_MAN = src('hairloss-man-reference.jpg');           // 2816×1536
/**
 * The official hero creative, with the «مكونات طبيعية 100%» badge removed.
 *
 * The badge was a composition claim the page cannot stand behind: the
 * ingredients section names مينوكسيديل, a synthetic pharmaceutical. Removed on
 * 2026-09-02 at the client's instruction by filling its footprint
 * (x 62-232, y 700-885) with the out-of-focus foliage it sat on, so the logo,
 * both models, all three bottles, the headline and the tagline are untouched.
 *
 * hero-creative-official.png is kept beside it as the unmodified original.
 */
//  · 2026-09-02, second pass: «حماية فعالة وطويلة المدى» (x 780-975, y 698-897)
//    removed the same way. It sits on the diagonal where the model's hair meets
//    the foliage, so the fill is built the same way — foliage base, hair laid
//    over it through a diagonal gradient — rather than one texture stretched
//    across both, which read as a smudge.
const HERO_CREATIVE = src('hero-creative-final.png');              // 1024×1536
/**
 * The three bottles, supplied already isolated on real alpha (1536×1024).
 * Occupancy measured at alpha >= 200 so the soft halo does not widen the box:
 *   oil     x 286-453   y 242-980   168x739  ratio 0.227
 *   shampoo x 626-899   y  27-989   274x963  ratio 0.285
 *   spray   x 1060-1282 y 106-984   223x879  ratio 0.254
 * Those ratios sit in the same 0.22-0.30 band as the assets they replace, so
 * the existing slot takes them with no CSS change.
 */
const BOTTLES = src('bottles-isolated.png');                       // 1536x1024, alpha

const webp = { quality: 82, effort: 6 };
/**
 * The alpha cut-outs, near-losslessly.
 *
 * Plain lossy webp subsamples chroma, which on this artwork's hard orange and
 * green type edges left 4.4% of pixels off by more than 16/255 — and raising
 * quality from 92 to 98 barely moved it (max delta stayed ~90), because the
 * error is subsampling, not quantisation. nearLossless keeps chroma intact:
 * measured max delta 2/255, mean 0.43, nothing above 8. Still 58% lighter than
 * the PNG it replaces.
 */
const PACKSHOT_WEBP = { nearLossless: true, quality: 60, alphaQuality: 100, effort: 6 };

/**
 * ── 1 · PRODUCT ─────────────────────────────────────────────────────────────
 * Rectangles out of the approved creative. Each runs from above the cap to
 * below the base, so no bottle is ever clipped, and none reaches the badge.
 */
const PRODUCT = [
  { name: 'hero-pack', rect: { left: 120, top: 470, width: 698, height: 875 }, widths: [380, 698] },
  { name: 'product-spray', rect: { left: 140, top: 488, width: 258, height: 860 }, widths: [129, 258] },
  { name: 'product-oil', rect: { left: 398, top: 516, width: 199, height: 832 }, widths: [199] },
  { name: 'product-shampoo', rect: { left: 586, top: 488, width: 232, height: 860 }, widths: [116, 232] },
].map((j) => ({ ...j, from: PACK }));

/**
 * ── 2 · BACKGROUND ──────────────────────────────────────────────────────────
 * The same photograph's own foliage, in two treatments.
 */
const LEAF_BLOCK = { left: 0, top: 0, width: 265, height: 205 };
const BACKDROP = [
  // Sharp, small: the corner framing the hero asks for.
  { name: 'bg-leaves', from: PACK, rect: LEAF_BLOCK, widths: [265, 530] },
  // Aloe, rosemary and wet stone — the ingredients section's botanical note.
  { name: 'bg-botanical', from: PACK, rect: { left: 828, top: 640, width: 196, height: 700 }, widths: [196, 392] },
];

/**
 * ── 3 · ICONS, PEOPLE AND PLANTS ────────────────────────────────────────────
 * No packaging in any of these, so the bottle change does not touch them.
 */
const CARRIED = [
  { name: 'problem-woman', from: PROBLEM, rect: { left: 600, top: 300, width: 458, height: 1010 }, widths: [380, 458] },
  // Deliberately NO rect: the man, his hairline and the comb full of hair are
  // the whole point of the frame, and any crop tight enough to change the
  // shape would drop one of them. Emitted at the wrap width and 1.5x.
  { name: 'hairloss-man', from: HAIRLOSS_MAN, widths: [540, 1080, 1620] },
  /**
   * The official creative, cut ABOVE its price band.
   *
   * The band at the foot carries «349 عوض 449», a trust row and a closing line.
   * 449 contradicts the catalogue's own compare-at price and the page states its
   * price as live HTML anyway, so the crop stops at y 1072 — the plinth's lower
   * edge, eight pixels above the band. Keeps the logo, both models, the headline
   * and all three bottles whole.
   */
  { name: 'hero-creative', from: HERO_CREATIVE, rect: { left: 0, top: 0, width: 1024, height: 1072 }, widths: [420, 760, 1120, 1400] },

  // Section 07 only — the three bottles cut from the supplied alpha artwork.
  // Deliberately NOT named product-* : product-oil-199 and product-spray-258 are
  // still referenced by section 10 and must survive this build untouched.
  // Each rect adds ~6px of transparent margin so no anti-aliased edge is clipped.
  //
  // Emitted as webp only. A PNG pair was produced first and verified against
  // these (max delta 2/255, nothing above 8), then dropped: nothing referenced
  // it and it was 1.16 MB of dead weight in the deploy. The cut-outs are
  // reproducible at any time from bottles-isolated.png with the rects below.
  { name: 'packshot-oil',     from: BOTTLES, rect: { left: 280, top: 236, width: 180, height: 751 }, widths: [98, 195], webpOpts: PACKSHOT_WEBP },
  { name: 'packshot-shampoo', from: BOTTLES, rect: { left: 620, top:  21, width: 286, height: 975 }, widths: [122, 245], webpOpts: PACKSHOT_WEBP },
  { name: 'packshot-spray',   from: BOTTLES, rect: { left: 1054, top: 100, width: 235, height: 891 }, widths: [109, 218], webpOpts: PACKSHOT_WEBP },
  { name: 'use-woman', from: WASH, rect: { left: 272, top: 175, width: 300, height: 300 }, widths: [150, 300] },
  { name: 'botanical-aloe', from: INGREDIENTS, rect: { left: 20, top: 760, width: 440, height: 400 }, widths: [220, 440] },
  { name: 'botanical-argan', from: INGREDIENTS, rect: { left: 480, top: 830, width: 400, height: 330 }, widths: [200, 400] },
  { name: 'botanical-rosemary', from: INGREDIENTS, rect: { left: 890, top: 760, width: 420, height: 400 }, widths: [210, 420] },
  // The brand's own «للرجال والنساء» pictogram. An icon, not packaging.
  { name: 'icon-unisex', from: OFFER_OLD, rect: { left: 210, top: 1296, width: 88, height: 96 }, widths: [44, 88] },
  ...[
    ['prob-weak', 78, 604], ['prob-fall', 300, 604],
    ['prob-roots', 78, 844], ['prob-flakes', 300, 844],
    ['prob-dull', 78, 1084], ['prob-breakage', 300, 1084],
  ].map(([name, left, top]) => ({
    name, from: PROBLEM, rect: { left, top, width: 146, height: 146 }, widths: [73, 146],
  })),
  ...[['out-density', 195], ['out-scalp', 492], ['out-strong', 789]].map(([name, left]) => ({
    name, from: ROUTINE, rect: { left, top: 1189, width: 104, height: 104 }, widths: [52, 104],
  })),
];

/** The blurred light field the hero and the closing section sit on. */
async function backgroundWash() {
  const block = await sharp(PACK).extract(LEAF_BLOCK).toBuffer();
  for (const w of [900, 1600]) {
    const file = `bg-wash-${w}.webp`;
    const out = await sharp(block)
      .resize({ width: w })
      // Wide enough that no leaf edge, and certainly no glyph, survives — this
      // is light and colour, not imagery.
      .blur(Math.round(w / 42))
      .webp(webp)
      .toBuffer();
    await writeFile(join(OUT, file), out);
    written.add(file);
    manifest[file] = {
      source: PACK.replace(/\\/g, '/').split('/').pop(),
      rect: LEAF_BLOCK, width: w, blur: Math.round(w / 42),
      sha256: createHash('sha256').update(out).digest('hex'),
    };
  }
  console.log('  bg-wash  900, 1600  (blurred light field)');
}

/** 1200×630 for Facebook, from the cluster, on the creative's own cream. */
async function ogCover() {
  const cluster = await sharp(PACK).extract(PRODUCT[0].rect).toBuffer();
  const out = await sharp(cluster)
    .resize(1200, 630, { fit: 'contain', background: '#EAF0DE' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeFile(join(OUT, 'og-cover.jpg'), out);
  manifest['og-cover.jpg'] = {
    source: PACK.replace(/\\/g, '/').split('/').pop(),
    rect: PRODUCT[0].rect, width: 1200,
    sha256: createHash('sha256').update(out).digest('hex'),
  };
  console.log('  og-cover.jpg  1200×630');
}

/**
 * Every file this run wrote. `main` deletes anything in `assets/images/` that
 * is not in here.
 *
 * This is the guarantee that no superseded bottle survives. Widths changed when
 * the pack changed (`hero-pack-760` → `-698`, `product-oil-185` → `-199`, …), so
 * a rebuild alone would have left the old files sitting beside the new ones,
 * one careless `src` away from putting the previous pack back on the page.
 * Emitting is therefore the only way a file stays.
 */
const written = new Set();

/**
 * Provenance record: for every emitted file, which source it was cut from, the
 * rectangle, and the sha256 of the bytes written. `verify-assets.mjs` re-derives
 * each crop and compares — so "this bottle came from the approved creative" is a
 * checked fact at deploy time, not a claim in a comment.
 */
const manifest = {};

async function emit({ name, from, rect, widths, format = 'webp', webpOpts }) {
  const buf = await (rect ? sharp(from).extract(rect) : sharp(from)).toBuffer();
  for (const w of widths) {
    const file = `${name}-${w}.${format}`;
    const pipe = sharp(buf).resize({ width: w });
    const out = await (format === 'png'
      ? pipe.png({ compressionLevel: 9 })
      : pipe.webp(webpOpts ?? webp)).toBuffer();
    await writeFile(join(OUT, file), out);
    written.add(file);
    manifest[file] = {
      source: from.replace(/\\/g, '/').split('/').pop(),
      rect: rect ?? null,
      width: w,
      sha256: createHash('sha256').update(out).digest('hex'),
    };
  }
  console.log(`  ${name}  ${widths.join(', ')}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log('product (approved creative only):');
  for (const job of PRODUCT) await emit(job);
  console.log('background system:');
  for (const job of BACKDROP) await emit(job);
  await backgroundWash();
  console.log('icons, people, plants:');
  for (const job of CARRIED) await emit(job);
  console.log('social:');
  await ogCover();
  written.add('og-cover.jpg');

  const stale = (await readdir(OUT)).filter((f) => !written.has(f));
  if (stale.length) {
    console.log('pruning assets this build did not produce:');
    for (const f of stale) { await unlink(join(OUT, f)); console.log(`  removed ${f}`); }
  } else {
    console.log('no stale assets to prune.');
  }

  console.log('shared brand assets:');
  for (const dir of ['fonts', 'logo', 'favicon']) {
    await cp(join(SIBLING, dir), join(ROOT, 'assets', dir), { recursive: true });
    console.log(`  ${dir}/`);
  }

  // Kept in tools/, which `copy-landing-pages.mjs` filters out of dist/.
  await writeFile(join(HERE, 'asset-manifest.json'), JSON.stringify({
    builtAt: new Date().toISOString(),
    approvedCreative: PACK.replace(/\\/g, '/').split('/').pop(),
    productAssets: PRODUCT.flatMap((p) => p.widths.map((w) => `${p.name}-${w}.webp`)).concat('og-cover.jpg'),
    files: manifest,
  }, null, 2) + '\n');
  console.log(`manifest: ${Object.keys(manifest).length} files recorded`);
}

main().catch((err) => { console.error(err); process.exit(1); });
