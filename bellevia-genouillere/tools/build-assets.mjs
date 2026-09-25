/**
 * BelleVia — دعامة الركبة الاحترافية — asset builder.
 *
 * Every pixel on the landing page comes from the supplier's own files.
 * Nothing is redrawn, recoloured, re-labelled or substituted, and no text
 * burned into a creative is edited or covered over. Where a creative carries a
 * claim in English that the page will not make in Arabic, the creative is
 * CROPPED away from it — never painted over.
 *
 * First batch: six files, 800×800 each. How each is used, and why:
 *
 *   life-outdoor.jpg  The brace worn on a bent knee, outdoors, natural light.
 *                     The sharpest and largest view of the assembled product on
 *                     a real leg — the hinge plate, all four straps and the
 *                     patella opening are all legible at once. It is therefore
 *                     the HERO (`hero-knee`) and the OpenGraph image, because a
 *                     buyer's first question about this object is "what is it
 *                     and where does it go", and a worn shot answers it faster
 *                     than a product floating on white.
 *   life-gym.jpg      A lunge in a gym. Life grid → «الرياضة».
 *   life-home.jpg     Sitting on the floor at home, leggings. Life grid →
 *                     «الراحة فالدار».
 *   angles-grid.jpg   A 2×2 contact sheet on white: front, back, bent, and the
 *                     opening seen end-on. Split into its four quadrants and
 *                     shipped as the four cards of «من كل الجهات» — each is
 *                     400×400, and each card is displayed well under that.
 *   before-after.jpg  A split creative. Its RIGHT half is the brace worn on a
 *                     bare leg against a clean studio grey — that half becomes
 *                     `worn-clean`, the offer section's shot, cut ABOVE the
 *                     burned-in black caption bar.
 *                     ⚠️ Its LEFT half (a knee with a red pain glow, captioned
 *                     «BEFORE: KNEE PAIN & DISCOMFORT») and both caption bars
 *                     («AFTER: PREMIUM SUPPORT & RELIEF») are NOT built. That
 *                     pairing is a relief claim, and this page describes what
 *                     the brace IS — fabric, straps, a hinge — not what it will
 *                     do to anyone's pain. See CREDITS.md.
 *   callouts.jpg      The supplier's first annotated diagram, labelled in
 *                     English. **No longer built** — `infographic-ar.jpg` from
 *                     the second batch says the same five things in Arabic, and
 *                     that is the one the page now shows. Kept here because it
 *                     is still the only English-labelled version, and because a
 *                     file that vanishes from this list looks like an oversight.
 *                     It was never the hero either: its leader lines land ON the
 *                     product and run off every side, so no crop yields a clean
 *                     brace.
 *
 * Fonts, logo and favicon are copied from the Weight Gain page, so the BelleVia
 * wordmark is byte-for-byte the same on every page of the store.
 *
 * Run from the repo root:  node bellevia-genouillere/tools/build-assets.mjs
 */
import { mkdirSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const page = join(here, "..");
const root = join(page, "..");

const SRC =
  process.env.BELLEVIA_KNEE_SOURCE_DIR ||
  "C:/Users/ADmiN/OneDrive/Nouveau dossier/mochid rokba";

const IMG = join(page, "assets", "images");
mkdirSync(IMG, { recursive: true });

/** The supplied files, by the name this builder expects on disk. */
const F = {
  callouts: "callouts.jpg",
  beforeAfter: "before-after.jpg",
  gym: "life-gym.jpg",
  home: "life-home.jpg",
  outdoor: "life-outdoor.jpg",
  angles: "angles-grid.jpg",

  /* ── Second batch, 2026-09-14: four 1024×1024 Arabic marketing composites ──
     These are finished graphics, not raw photography, and only the parts that
     state facts are built. What is taken and what is left, per file:

     infographic-ar.jpg   «المكوّنات والدَّور: دليلُك الشامل». Its LEFT HALF is the
                          product with five Arabic callouts — breathable fabric,
                          twin side hinges, open patella, non-slip lining,
                          adjustable straps. All five are things the page
                          already says in live text, so the diagram becomes the
                          Arabic original those words can be checked against,
                          replacing the English `callouts.jpg` behind the same
                          tap.
                          ⚠️ Its RIGHT PANEL («الدَّور والفوائد الرئيسيَّة») is NOT
                          built. It promises «تخفيف الألم»، «تقليل التورم»،
                          «تسريع الشفاء» and «حماية من الإصابات» — pain relief,
                          reduced swelling, faster healing, injury prevention.
                          Those are medical claims, they are the exact wording
                          this page's brief forbids, and the traffic is Meta
                          ads. The crop stops at x=655, before that panel.
                          ⚠️ Also excluded: the bottom-right «من الألم إلى
                          الحركة» red-glow knee, same reason.
     lifestyle-strip.jpg  Five aligned lifestyle panels — gym, running,
                          football, a senior walking, tennis — each with the
                          brace worn and in focus. The photography is the asset;
                          the burned-in captions are not, so the crop takes the
                          picture band (y 118–763) and leaves both caption rows
                          out. They are duplicated top and bottom, carry typos
                          («كمال اكمال»، «واللليافة»), and the sheet ends with the
                          SP wordmark printed twice.

     Two files are deliberately not built at all:

     quad-composite.jpg   Four quadrants. Its callout diagram mislabels a strap
                          «رحلة الشفاء» (healing journey), its gym panel reads
                          «أداء رياضي متفوق متفوق», its before/after is the same
                          red-glow pain claim, and it burns in an «اطلبه الآن»
                          button that is a picture, not a link. Nothing here is
                          salvageable that the page does not already have.
     lifestyle-strip-alt  The same five scenes plus a climber, but the captions
                          are out of register with the panels beneath them — the
                          football label sits over a frame split between the
                          footballer and the senior. A layout defect, and
                          `lifestyle-strip.jpg` is the same set done right. */
  infographic: "infographic-ar.jpg",
  strip: "lifestyle-strip.jpg",
};

const src = (k) => join(SRC, F[k]);

function must(k) {
  const p = src(k);
  if (!existsSync(p)) {
    console.error(`[build-assets] missing source: ${p}`);
    console.error(`[build-assets] set BELLEVIA_KNEE_SOURCE_DIR, or drop the source files there.`);
    process.exit(1);
  }
  return p;
}

/** webp at a set of widths, from an optional crop box. */
async function webp(key, out, widths, { extract = null, quality = 82, height = null } = {}) {
  for (const w of widths) {
    let p = sharp(must(key));
    if (extract) p = p.extract(extract);
    p = p.resize({
      width: w,
      height: height ? Math.round((height * w) / widths[widths.length - 1]) : null,
      fit: height ? "cover" : "inside",
      withoutEnlargement: true,
    });
    const file = join(IMG, `${out}-${w}.webp`);
    const info = await p.webp({ quality }).toFile(file);
    console.log(`  ${out}-${w}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
  }
}

(async () => {
  console.log(`[build-assets] source: ${SRC}`);

  /* ── Hero ────────────────────────────────────────────────────────────────
     The full outdoor frame, untouched. Cropping it tighter on the knee costs
     the only thing that makes it read instantly — a person, sitting, with the
     brace on. 800w is the supplied maximum, and the hero is displayed at ≤400
     CSS px, so the 800 file is a true 2× on a phone. */
  console.log("hero:");
  await webp("outdoor", "hero-knee", [400, 800], { quality: 84 });

  /* ── Life grid ─────────────────────────────────────────────────────────── */
  console.log("life:");
  await webp("gym", "life-gym", [400, 800]);
  await webp("home", "life-home", [400, 800]);

  /* ── Offer shot ──────────────────────────────────────────────────────────
     The right half of the split creative, cut at y=712 — above the burned-in
     «AFTER: PREMIUM SUPPORT & RELIEF» bar. The left half is never built. */
  console.log("offer:");
  await webp("beforeAfter", "worn-clean", [400], {
    extract: { left: 400, top: 0, width: 400, height: 712 },
    quality: 84,
  });

  /* ── Four angles ─────────────────────────────────────────────────────────
     The contact sheet's quadrants, in reading order on the sheet itself:
       top-left     front, hinge toward the camera
       top-right    back, the open channel behind the knee
       bottom-left  bent, the hinge folded
       bottom-right seen end-on, the padded inside of the sleeve
     Each card is displayed at ~160–200 CSS px, so 400×400 is a comfortable 2×. */
  console.log("angles:");
  const Q = {
    "angle-front": { left: 0, top: 0 },
    "angle-back": { left: 400, top: 0 },
    "angle-bent": { left: 0, top: 400 },
    "angle-inside": { left: 400, top: 400 },
  };
  for (const [name, at] of Object.entries(Q)) {
    await webp("angles", name, [200, 400], {
      extract: { ...at, width: 400, height: 400 },
    });
  }

  /* The English `callouts.jpg` is no longer built. `infographic-ar.jpg` says the
     same five things in Arabic, and a page written for Moroccan readers has no
     use for a picture of English labels once an Arabic one exists. The file
     stays in the source folder and in `F` above, so a future page can pick it
     up without re-deriving where it came from. */

  /* ── The Arabic callout diagram ──────────────────────────────────────────
     Cut at x=655 so the benefits panel — and every claim on it — stays out of
     the frame. This replaces the English sheet behind the same `<details>`:
     same role, same place, a language the reader actually has. */
  console.log("diagram:");
  // Native width. The source composite is 1024px across and this region is
  // 655 of them, so 655 IS the maximum — a second, larger variant would be the
  // same file under a bigger name.
  await webp("infographic", "diagram-ar", [655], {
    extract: { left: 0, top: 130, width: 655, height: 585 },
    quality: 86,
  });

  /* ── Five use-case photographs ───────────────────────────────────────────
     The picture band only: y 118–763 drops the duplicated caption rows top and
     bottom. Panel edges measured off the sheet's own divider lines.

     ⚠️ ONE width, and that is the ceiling, not a choice. The sheet is 1024px
     across and holds five panels, so each is ~205px — roughly a thumbnail. A
     `srcset` here would be a lie: asking for 420 returns the same 205px file,
     because the builder never enlarges. So these ship at native size and the
     page displays them small enough to stay sharp. To show them any larger,
     the five scenes have to be supplied as five separate full-size photographs
     rather than as one composite sheet. */
  console.log("use cases:");
  const EDGE = [0, 205, 408, 615, 819, 1024];
  const USE = ["use-gym", "use-run", "use-football", "use-walk", "use-tennis"];
  for (let i = 0; i < USE.length; i++) {
    await webp("strip", USE[i], [210], {
      extract: { left: EDGE[i], top: 118, width: EDGE[i + 1] - EDGE[i], height: 645 },
      quality: 84,
    });
  }

  /* ── OpenGraph ───────────────────────────────────────────────────────────
     1200×630 is WhatsApp's and Facebook's crop. The square hero is covered into
     it centred, which keeps the brace and loses only sky and floor. JPEG, not
     webp: some Moroccan WhatsApp builds still refuse a webp preview. */
  console.log("og:");
  const og = await sharp(must("outdoor"))
    .resize({ width: 1200, height: 630, fit: "cover", position: "centre" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(join(IMG, "og-cover.jpg"));
  console.log(`  og-cover.jpg  ${og.width}×${og.height}  ${(og.size / 1024).toFixed(0)}KB`);

  /* ── Shared brand assets ─────────────────────────────────────────────────
     Copied, never regenerated: the wordmark has to be identical across every
     BelleVia page or the store reads as several stores. */
  console.log("brand:");
  for (const dir of ["fonts", "logo", "favicon"]) {
    const from = join(root, "bellevia-weight-gain", "assets", dir);
    const to = join(page, "assets", dir);
    if (!existsSync(from)) {
      console.log(`  ${dir}/ — source page not found, kept as-is`);
      continue;
    }
    mkdirSync(to, { recursive: true });
    for (const f of readdirSync(from)) copyFileSync(join(from, f), join(to, f));
    console.log(`  ${dir}/ — ${readdirSync(to).length} files`);
  }

  console.log("[build-assets] done.");
})();
