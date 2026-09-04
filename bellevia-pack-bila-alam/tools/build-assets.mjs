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
 *                 with the brand's own «الثمن 329 DH» plate. Labels are crisp
 *                 and correct here, so THIS file is the source of every close
 *                 product shot on the page — the hero duo, the two product
 *                 cards, and the offer plate. Its left third is a burned-in
 *                 Arabic headline; the page types that live instead of shipping
 *                 a picture of Arabic text to a 390px phone.
 *   ac4d37ae…png  «مكونات الكبسولات» — shown WHOLE in the ingredients section.
 *   ca1b16e4…png  «مكونات الكريم» — shown WHOLE in the ingredients section.
 *   فوائد…png     «فوائد باك آلام المفاصل» — the six benefit lines. The six
 *                 photographic medallions are cut out and become the icons of
 *                 live-text cards carrying the sheet's own wording verbatim.
 *                 The sheet itself is also shown whole in the campaign strip.
 *   020911af…jpg  «طريقة الاستعمال» + «تحذيرات هامة» — the usage doses and the
 *                 full warning list. Typed live (same reason as above); the
 *                 sheet is also shown whole so the original stays readable.
 *   lsu08u…jpg    The official «باك بلا ألم» advert, 1343×800: the product name,
 *                 the strap line, 450 → 329, and six benefit chips. Shown WHOLE
 *                 in the campaign strip, and it is the OpenGraph cover.
 *   gyacqa…jpg    A Moroccan salon; a man rising from the sofa, hand on his
 *                 knee. Used CROPPED, left 900px only — see below.
 *
 * Four files are deliberately not built:
 *
 *   bn8soq…jpg    A second studio duo, with «SOULAGEMENT COMPLET» /
 *                 «APPLICATION FACILE» hang-tags. Beautiful, but its bottle
 *                 label reads «30 Capsules» where 7fd0bc28 and the ingredient
 *                 sheets read «60 Capsules». Two counts on one page is the
 *                 mistake a COD page cannot make — it is the buyer refusing the
 *                 parcel at the door. One family ships, and it is the 60 one.
 *                 The page itself states no capsule count.
 *   ctag61…jpg    ┐ Three lifestyle scenes whose product is an ORANGE
 *   l8cg0z…jpg    ├ «ANTI-JOINTS» carton that does not exist: the real pack is
 *   vj7mf4…jpg    ┘ the white/green bottle and tube. Showing them would be
 *                 showing packaging the customer will never receive. Their
 *                 fourth sibling, gyacqa, survives — and only because the wrong
 *                 carton is confined to a television in its right third, which
 *                 the crop drops. What is left is a room and a man, no product,
 *                 used purely as atmosphere and named «صورة تعبيرية» in its alt.
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
  advert: 'Gemini_Generated_Image_lsu08ulsu08ulsu0.jpg', // 1343×800
  salon: 'Gemini_Generated_Image_gyacqagyacqagyac.jpg', // 1408×768
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
await variants(sharp(src(F.advert)), 'advert', [680, 1343], 1343);

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

console.log('atmosphere — the salon, left 900px only (the wrong carton is on the TV at x>900)');
await variants(sharp(src(F.salon)).extract({ left: 0, top: 0, width: 900, height: 768 }), 'life-salon', [450, 900], 900);

console.log('OpenGraph cover — the official advert, centre-cropped to 1200×630');
await sharp(src(F.advert))
  .extract({ left: 0, top: 47, width: 1343, height: 705 })
  .resize(1200, 630)
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(join(OUT, 'og-cover.jpg'));
console.log('  og-cover.jpg');

console.log('brand assets — copied from the sibling BelleVia page, not rebuilt');
for (const dir of ['fonts', 'logo', 'favicon']) {
  await cp(join(SIBLING, dir), join(ROOT, 'assets', dir), { recursive: true });
  console.log('  assets/' + dir + '/');
}
