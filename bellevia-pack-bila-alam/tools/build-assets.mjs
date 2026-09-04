/**
 * BelleVia — باك بلا ألم (كبسولات + كريم المفاصل) — asset builder.
 *
 * Every pixel on the landing page comes from the client's own folder. Nothing
 * is redrawn, recoloured, re-labelled or substituted, and no text burned into a
 * creative is edited or covered over.
 *
 * Eleven files were supplied. How each is used, and why:
 *
 *   7fd0bc28…png  The studio pack shot: bottle + tube on white, on a podium,
 *                 with the brand's own «الثمن 329 DH» plate. Its bottle label
 *                 reads «60 Capsules» — the count the client confirmed — and
 *                 every label on it is crisp, so THIS file is the source of
 *                 every product image the page ships:
 *                   · `pack-duo`      — the HERO composition
 *                   · `pack-capsules` / `pack-cream` — the two product cards
 *                   · `pack-podium`   — the offer plate
 *                   · `og-cover.jpg`  — the OpenGraph / Twitter share image
 *                 Its left third is a burned-in Arabic headline; the page types
 *                 that live instead of shipping a picture of Arabic text to a
 *                 390px phone.
 *   ac4d37ae…png  «مكونات الكبسولات» — shown WHOLE in the ingredients section.
 *   ca1b16e4…png  «مكونات الكريم» — shown WHOLE in the ingredients section.
 *   فوائد…png     «فوائد باك آلام المفاصل» — the six benefit lines. The six
 *                 photographic medallions are cut out and become the icons of
 *                 live-text cards carrying the sheet's own wording verbatim.
 *                 The sheet itself is also shown whole, inside a `<details>`
 *                 under the benefits section.
 *   020911af…jpg  «طريقة الاستعمال» + «تحذيرات هامة» — the usage doses and the
 *                 full warning list. Typed live (same reason as above); the
 *                 sheet is also shown whole so the original stays readable.
 *   gyacqa…jpg    ┐ Three Moroccan lifestyle scenes, each CROPPED so the orange
 *   vj7mf4…jpg    ├ «ANTI-JOINTS» carton that is not the product falls outside
 *   ctag61…jpg    ┘ the frame. In the strip's own order:
 *                   · الوقفة (gyacqa) — a man rising from a sofa
 *                   · الدرج  (vj7mf4) — a woman climbing the stairs of a riad
 *                   · الصلاة (ctag61) — a woman at prayer, «بلا ألم» painted on
 *                                       the wall behind her
 *                 No product appears in any of them; each is named «صورة
 *                 تعبيرية» in its alt text.
 *
 * Three files are deliberately not built:
 *
 *   amal.jpg      The official «باك بلا ألم» advert, 1343×800 (renamed by the
 *                 client from Gemini_…lsu08u….jpg): the product name, the strap
 *                 line, 450 → 329, and six benefit chips.
 *                 ⚠️ Its bottle label reads «30 Capsules» where the confirmed
 *                 count is 60. It was tried as the page hero and taken back
 *                 out, because no crop removes that line without cutting the
 *                 product itself. It is NOT the hero and NOT the OpenGraph
 *                 source — both come from 7fd0bc28, whose label reads 60. The
 *                 artwork is the client's and is not retouched here. It stays
 *                 in the F map below so a corrected export can be dropped in
 *                 under the same name. Flagged in CREDITS.md.
 *   bn8soq…jpg    A second studio duo, with «SOULAGEMENT COMPLET» /
 *                 «APPLICATION FACILE» hang-tags. Beautiful, but its bottle
 *                 label reads «30 Capsules» where 7fd0bc28 and the ingredient
 *                 sheets read «60 Capsules». Two counts on one page is the
 *                 mistake a COD page cannot make — it is the buyer refusing the
 *                 parcel at the door. One family ships, and it is the 60 one.
 *                 The client has since confirmed the correct count is 60, so
 *                 this file is not merely inconsistent — it is wrong, and no
 *                 crop saves it: the count sits on the label of the product
 *                 itself.
 *   l8cg0z…jpg    The fourth lifestyle scene. Unlike its three siblings it
 *                 cannot be cropped clear of the orange carton: the billboard
 *                 carrying it stands directly behind the couple's heads, so
 *                 every frame that contains them contains it too.
 *
 * Fonts, logo and favicons are copied from the sibling BelleVia pages rather
 * than rebuilt, so every BelleVia page carries an identical wordmark.
 *
 * Run from the repo root:  node bellevia-pack-bila-alam/tools/build-assets.mjs
 * Override the source folder with BELLEVIA_JOINT_PACK_SOURCE_DIR.
 */
import sharp from 'sharp';
import { mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'assets', 'images');

const SRC = (() => {
  if (process.env.BELLEVIA_JOINT_PACK_SOURCE_DIR) return process.env.BELLEVIA_JOINT_PACK_SOURCE_DIR;
  const probe = '7fd0bc28-9f00-4c18-864b-4d67b623d57c.png';
  const candidates = [
    'C:/Users/ADmiN/OneDrive/Nouveau dossier/pack bila alam',
    'C:/Users/ADmiN/Desktop/pack bila alam',
  ];
  for (const dir of candidates) if (existsSync(join(dir, probe))) return dir;
  console.error(
    'Cannot find the «باك بلا ألم» creative folder. Looked in:\n' +
      candidates.map((c) => '  ' + c).join('\n') +
      '\nSet BELLEVIA_JOINT_PACK_SOURCE_DIR to wherever it lives now.',
  );
  process.exit(1);
})();

/** The sibling page's built brand assets — same brand, same wordmark. */
const SIBLING = join(ROOT, '..', 'bellevia-weight-gain', 'assets');
const src = (f) => join(SRC, f);

const F = {
  studio: '7fd0bc28-9f00-4c18-864b-4d67b623d57c.png', // 1536×1024
  capIng: 'ac4d37ae-c4e1-45e3-b724-45787285756a.png', // 1536×1024
  creamIng: 'ca1b16e4-e9c5-4b49-901e-945da0bb7ea1.png', // 1536×1024
  benefits: 'فوائد_باك_آلام_المفاصل.png', // 1470×1440
  usage: '020911af-af59-46e9-8b0a-00d2ab7641bf.jpg', // 1024×930
  // Renamed by the client from Gemini_…lsu08u….jpg. Same 1343×800 file.
  //
  // NOT BUILT into anything. Its bottle carries the superseded capsule count,
  // so it is out of the hero and out of the share card. Kept in this map so a
  // corrected export can be dropped in under the same name and rebuilt.
  amal: 'amal.jpg', // 1343×800 — the official advert
  // The three lifestyle scenes, in the order the strip shows them.
  salon: 'Gemini_Generated_Image_gyacqagyacqagyac.jpg', // 1408×768 — الوقفة
  stairs: 'Gemini_Generated_Image_vj7mf4vj7mf4vj7m.jpg', // 1408×768 — الدرج
  pray: 'Gemini_Generated_Image_ctag61ctag61ctag.jpg', // 1408×768 — الصلاة
};

/**
 * Crops that keep the three lifestyle scenes and drop the carton that is not
 * the product.
 *
 * All three were shot around an ORANGE «ANTI-JOINTS» box that does not exist —
 * the real pack is the white/green bottle and tube. In each of these the wrong
 * box sits in one corner and the person sits in another, so a crop keeps the
 * room and the human and loses the misleading packaging entirely. Nothing is
 * retouched; the frame is simply smaller.
 *
 * Their fourth sibling, l8cg0z, has no such crop: its billboard stands directly
 * behind the couple's heads, so every frame containing them contains it too.
 * That file stays out. See CREDITS.md.
 */
const LIFE = {
  salon: { left: 0, top: 0, width: 900, height: 768 },    // الوقفة — TV with the box is at x>900
  stairs: { left: 520, top: 0, width: 888, height: 768 }, // الدرج  — box on the step is at x<520
  pray: { left: 0, top: 0, width: 880, height: 768 },     // الصلاة — box on the table is at x>880
};

/**
 * Crop boxes into `studio` (1536×1024), measured off the file itself.
 *
 * `duo` stops at y=835 on purpose: the podium and the brand's price plate begin
 * at y≈840, and the hero states its own price in live text a few millimetres
 * away. Two 329s in one glance reads as a bug. `podium` is the same shot WITH
 * the plate, used once — in the offer section, where the brand saying the
 * number in its own artwork is exactly the point.
 */
const BOX = {
  duo: { left: 700, top: 20, width: 836, height: 815 },
  podium: { left: 690, top: 20, width: 846, height: 985 },
  capsules: { left: 725, top: 145, width: 370, height: 675 },
  cream: { left: 1090, top: 55, width: 395, height: 800 },
};

/** The six benefit medallions on the 1470×1440 benefits sheet. */
const MEDALLION = { cx: [293, 742, 1216], cy: [347, 900], r: 142 };

const QUALITY = { quality: 82, effort: 5 };

/** Write one image at each width, skipping any that would upscale the source. */
async function variants(pipeline, name, widths, sourceWidth) {
  for (const w of widths) {
    if (sourceWidth && w > sourceWidth) continue;
    const out = join(OUT, `${name}-${w}.webp`);
    await pipeline.clone().resize({ width: w, withoutEnlargement: true }).webp(QUALITY).toFile(out);
    console.log('  ' + `${name}-${w}.webp`);
  }
}

await mkdir(OUT, { recursive: true });

console.log('product shots — cropped from the studio pack shot, nothing retouched');
await variants(sharp(src(F.studio)).extract(BOX.duo), 'pack-duo', [420, 836], BOX.duo.width);
await variants(sharp(src(F.studio)).extract(BOX.podium), 'pack-podium', [380, 760], BOX.podium.width);
await variants(sharp(src(F.studio)).extract(BOX.capsules), 'pack-capsules', [300, 370], BOX.capsules.width);
await variants(sharp(src(F.studio)).extract(BOX.cream), 'pack-cream', [300, 395], BOX.cream.width);

console.log('sheets — shown whole, re-encoded and nothing else');
await variants(sharp(src(F.capIng)), 'sheet-capsules', [760, 1536], 1536);
await variants(sharp(src(F.creamIng)), 'sheet-cream', [760, 1536], 1536);
await variants(sharp(src(F.benefits)), 'sheet-benefits', [735, 1470], 1470);
await variants(sharp(src(F.usage)), 'sheet-usage', [512, 1024], 1024);
// amal.jpg is not built at all — not as a page image, and not as the share
// card either (og-cover below comes from F.studio). Its bottle reads
// «30 Capsules» and the confirmed count is 60. Uncommenting this line is all
// it takes to restore it, once a corrected export arrives.
// await variants(sharp(src(F.amal)), 'hero-amal', [680, 1343], 1343);

console.log('benefit medallions — cut from the client’s own benefits sheet');
{
  const { cx, cy, r } = MEDALLION;
  let n = 0;
  for (const y of cy) {
    for (const x of cx) {
      n += 1;
      const tile = sharp(src(F.benefits)).extract({ left: x - r, top: y - r, width: 2 * r, height: 2 * r });
      await variants(tile, `ic-${n}`, [72, 144], 2 * r);
    }
  }
}

console.log('lifestyle — three scenes, each cropped clear of the carton that is not the product');
await variants(sharp(src(F.salon)).extract(LIFE.salon), 'life-salon', [450, 900], LIFE.salon.width);
await variants(sharp(src(F.stairs)).extract(LIFE.stairs), 'life-stairs', [444, 888], LIFE.stairs.width);
await variants(sharp(src(F.pray)).extract(LIFE.pray), 'life-pray', [440, 880], LIFE.pray.width);

/**
 * The OpenGraph / Twitter share image.
 *
 * Built from the studio pack shot, NOT from the advert: the advert's bottle
 * carries the superseded capsule count, and a share card is the first thing a
 * customer sees when the link is passed around WhatsApp — the one place a wrong
 * number travels furthest. This shot's label reads 60.
 *
 * `fit: 'contain'` rather than a crop. The artwork's content is ~920px tall in a
 * 1536×1024 frame, and a 1200×630 window over that source is only 806px tall, so
 * every crop loses either the wordmark at the top or the brand's «الثمن 329 DH»
 * plate at the bottom. Containing it keeps the whole composition — wordmark,
 * headline, six benefit medallions, both products, the price plate — and the
 * padding is invisible because the source background is already pure white,
 * which is sampled from the file itself rather than assumed.
 */
console.log('OpenGraph cover — the 60-capsule studio shot, contained in 1200×630');
{
  const corner = await sharp(src(F.studio)).extract({ left: 4, top: 4, width: 2, height: 2 })
    .removeAlpha().raw().toBuffer();
  const background = { r: corner[0], g: corner[1], b: corner[2] };
  await sharp(src(F.studio))
    .flatten({ background })
    .resize(1200, 630, { fit: 'contain', background })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(OUT, 'og-cover.jpg'));
  console.log('  og-cover.jpg  (background sampled from the source: ' + JSON.stringify(background) + ')');
}

console.log('brand assets — copied from the sibling BelleVia page, not rebuilt');
for (const dir of ['fonts', 'logo', 'favicon']) {
  await cp(join(SIBLING, dir), join(ROOT, 'assets', dir), { recursive: true });
  console.log('  assets/' + dir + '/');
}
