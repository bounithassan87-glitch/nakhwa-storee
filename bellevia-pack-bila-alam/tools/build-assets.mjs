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
  // The hero creative, 1024×1536. Only its PHOTOGRAPHY is used — see HERO_SCENE
  // below for what is cut away and why. Its predecessor, hero-scene-couple.png,
  // is still in the source folder but no longer built: its couple read as
  // generic Europeans, and this one is recognisably Moroccan.
  heroScene: 'hero-scene-riad.png', // 1024×1536
  // The four «لمن هذا الباك؟» photographs, in card order. Supplied by the
  // client for that section; used whole, never cropped.
  whoPain: 'who-pain.jpg',     // 1408×768
  whoActive: 'who-active.jpg', // 1408×768
  whoWork: 'who-work.jpg',     // 1408×768 — the office scene
  whoElder: 'who-elder.webp',  // 1536×1024
  // The three lifestyle scenes, in the order the strip shows them.
  // الوقفة — replaced the gyacqa scene. That one was a man rising from a sofa
  // beside a television carrying an ANTI-JOINTS carton that does not exist; this
  // one is a man on a sofa with the joint rendered over his knee, which is the
  // visual direction the client asked for. gyacqa stays in the folder, unused.
  salon: 'life-salon-anatomy.jpg', // 928×1152 — الوقفة
  // الدرج — replaced the vj7mf4 riad-stairs scene. NOTE: this picture has no
  // stairs in it. It is a labourer resting on breeze blocks with the spine and
  // both knees rendered, chosen because it was the closest available match for
  // the card's theme of load and effort; none of the supplied images contains a
  // staircase. The «الدرج» caption therefore no longer describes what is in the
  // frame. Flagged to the client.
  stairs: 'life-stairs-anatomy.jpg', // 928×1152 — الدرج
  // Third lifestyle scene. The old ctag61 prayer shot is no longer built: the
  // client replaced every picture in this section with the anatomy-overlay set.
  jeep: 'life-jeep-anatomy.jpg',   // 928×1152 — 3 · long-distance driving
  office: 'life-office-anatomy.jpg', // 928×1152 — 2 · long hours at a desk
  gift: 'life-gift-anatomy.jpg',   // 928×1152 — 4 · a son bringing the pack home
  // 6 · the pack with its ingredients.
  // ⚠️ SHIPPED AT THE CLIENT'S EXPLICIT INSTRUCTION, AND IT CONTRADICTS THE
  // PAGE. Its bottle reads «30 Capsules», large and perfectly legible, while
  // this page states 60 in five places — meta description, JSON-LD, the hero
  // lede, the product card and the footer. Its French reads «COMPLEMENT
  // AUMENTAIRE» rather than ALIMENTAIRE. No crop removes either: the number
  // sits mid-label and the whole frame is product.
  // This was raised twice with evidence and the client chose to ship it. The
  // fix is a corrected export, not code.
  packShot: 'life-pack-ingredients.jpg', // 928×1152
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
  // الوقفة — the packaging sits on a low table at x 95-400, y 770-1050, and it
  // is fabricated: gibberish Arabic on the bottle and an illegible cream label.
  // A horizontal cut at y=730 drops all of it and keeps the man, the room and
  // BOTH knee overlays, which are the point of the picture. Verified by sampling
  // the strip above the cut: zero near-white pixels, so no cap peeks through.
  salon: { left: 0, top: 0, width: 928, height: 730 },
  // الدرج — fabricated packaging sits at x 640-870, y 800-1090. A horizontal cut
  // at y=785 drops it and keeps the man, the site and the full spine + knee
  // overlay, which is the point of the picture.
  stairs: { left: 0, top: 0, width: 928, height: 785 },
  // Fabricated packaging sits at x 620-900, y 810-1140. A horizontal cut at
  // y=795 drops it and keeps the man, the kasbah and the whole spine overlay.
  jeep: { left: 0, top: 0, width: 928, height: 795 },
  // Packaging sits LEFT here, on the desk at x 125-250, so this one is cut
  // vertically rather than horizontally. The window keeps the face and the
  // spine; the knee falls below it, and between the two the spine is the
  // overlay this frame is built around.
  office: { left: 270, top: 170, width: 658, height: 530 },
  // NOT cropped clear of the pack: this slide IS the pack being handed over,
  // and its small print is an out-of-focus blur rather than a legible wrong
  // number. Framed only to fit the card.
  gift: { left: 50, top: 250, width: 878, height: 700 },
  // Framed to the card ratio only — nothing is cropped away for content.
  packShot: { left: 0, top: 300, width: 928, height: 742 },
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

/**
 * The hero backdrop, cut from the creative — photography ONLY.
 *
 * The file is a finished advert. Its left column carries a burned-in wordmark,
 * headline, sub-headline and three benefit badges, and its lower-left carries
 * «329 درهم», a struck «450 درهم» and «التوصيل فابور» — every one of which the
 * page already renders as live HTML. Shipping it whole would print all of them
 * twice and turn selectable Arabic into pixels, so the crop starts at x=460,
 * right of the last of them.
 *
 * The crop also stops at y=845, ABOVE the two products, and that is the part
 * that matters most. This creative's bottle reads «30 Capsules», while the
 * client confirmed 60 and the page states 60 in five places. Its Arabic label
 * is mangled too — «لإلئتم», «المفاصليل», «بساعد», «وطيفة», none of which are
 * words. A hero showing 30 over copy saying 60 is a parcel refused at the door,
 * so not one pixel of this file's packaging is used: every product shot on the
 * page still comes from 7fd0bc28, whose label reads 60 and whose Arabic is
 * correct.
 *
 * Compositing the correct pack INTO this scene is not possible here either —
 * it is a white bottle photographed on white, so no luminance key and no blend
 * mode separates it from its background without erasing the product too. Hence
 * the two-layer hero: this scene behind, the verified pack on its own card.
 *
 * What survives: a Moroccan couple on the stairs of a riad, the plants, the
 * light. Which is exactly the mood asked for, and none of the text, none of
 * the prices, and none of the packaging that came with it.
 *
 * NOTE ON RESOLUTION. The source is 1024px wide and the text column eats the
 * first 460 of them, so the clean region is 564px — narrower than the 916 the
 * previous creative allowed. Variants stop at 564 rather than upscaling, which
 * is why `sizes` in index.html asks for a smaller box than the plate's full
 * width. A larger export would lift this ceiling; nothing in code can.
 */
const HERO_SCENE = { left: 460, top: 130, width: 564, height: 715 };

console.log('hero backdrop — the Moroccan couple on the riad stairs, no text, no packaging');
await variants(sharp(src(F.heroScene)).extract(HERO_SCENE), 'hero-scene', [282, 564], HERO_SCENE.width);

/**
 * The four «لمن هذا الباك؟» photographs.
 *
 * Re-encoded at two widths and NOTHING else — no crop, no extract, no resize
 * that changes proportion. The brief was explicit that these keep their own
 * dimensions and lose no part of the frame, so `variants()` only ever scales
 * them down whole.
 *
 * Three are 1408×768 and one, the elderly couple, is 1536×1024. That mismatch
 * is handled in CSS with `object-fit: contain` rather than here with a crop:
 * evening them up at build time would mean cutting the odd one, which is the
 * one thing this set is not allowed to do.
 */
const WHO = { pain: F.whoPain, active: F.whoActive, work: F.whoWork, elder: F.whoElder };

console.log('who it suits — four photographs, re-encoded whole, never cropped');
for (const [name, file] of Object.entries(WHO)) {
  await variants(sharp(src(file)), `who-${name}`, [420, 840], null);
}

console.log('lifestyle — three scenes, each cropped clear of the carton that is not the product');
await variants(sharp(src(F.salon)).extract(LIFE.salon), 'life-salon', [464, 928], LIFE.salon.width);
await variants(sharp(src(F.stairs)).extract(LIFE.stairs), 'life-stairs', [464, 928], LIFE.stairs.width);
await variants(sharp(src(F.jeep)).extract(LIFE.jeep), 'life-jeep', [464, 928], LIFE.jeep.width);
await variants(sharp(src(F.office)).extract(LIFE.office), 'life-office', [329, 658], LIFE.office.width);
await variants(sharp(src(F.gift)).extract(LIFE.gift), 'life-gift', [439, 878], LIFE.gift.width);
await variants(sharp(src(F.packShot)).extract(LIFE.packShot), 'life-pack', [464, 928], LIFE.packShot.width);

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
