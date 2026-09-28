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
 * ⚠️ Since 2026-09-28 none of the older batches' PEOPLE photographs is built.
 * The outdoor hero, the gym and home frames, the right half of before-after,
 * the lifestyle strip's five panels and the poster's three benefit photos were
 * all replaced by the fourth batch (see `F`). What the older batches still
 * supply is the product itself and how to put it on: the four angles, the
 * Arabic diagram and the four fitting steps — nothing in the fourth batch shows
 * either.
 *
 * Steps can be run on their own: `node build-assets.mjs scenes` rebuilds only
 * the fourth batch. No argument builds everything.
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

  /* ── Third batch, 2026-09-27: the full Arabic sales poster, 1024×1536 ──────
     A finished one-page design, not raw photography. Two rows of photographs
     inside it are things the page did not have, so those are cut out; nothing
     else from it is built.

     TAKEN — the four fitting photos (y 858–974). Hands opening the brace,
     placing it on a knee, fastening the straps, checking the fit. The steps
     section had been illustrating those four actions with studio shots of the
     product lying still, which showed the object but never the procedure.
     Each frame carries the poster's own green ①②③④ badge, and it is kept:
     the numbers are correct, they are part of the supplied artwork, and the
     page drops its own gold badge for these rather than stack two numbers in
     one corner.

     TAKEN — three of the four benefit photos (y 621–744): a man running, the
     hinge in close-up, and an older couple walking. The hinge frame is tighter
     than any product shot in the first batch.

     ⚠️ NOT TAKEN — the fourth benefit photo, a knee lit with an orange pain
     glow under «تخفيف الألم والضغط / تساعد على تقليل الألم والتورم». Pain and
     swelling are the claims this page does not make, and the picture makes
     them without a word of text.
     ⚠️ NOT TAKEN — the three testimonial portraits with names, cities and
     stars. No review was ever supplied as real.
     ⚠️ NOT TAKEN — «ضمان الرضا أو استرجاع الأموال 100%», «ضمان الاستبدال
     والاسترجاع», «خدمة ما بعد البيع» — none is a confirmed policy.
     ⚠️ NOT TAKEN — the struck «299 DH». There is no confirmed former price.
     ⚠️ NOT TAKEN — the poster's hero, VS-panel and podium product shots. Not
     for any policy reason: the first batch simply has the same subjects at
     higher resolution (800×800 and 400×400 against this poster's ~180px). */
  poster: "poster-ar.webp",

  /* ── Fourth batch, 2026-09-28: five lifestyle photographs ─────────────────
     Supplied to replace every people photograph on the page. Three are plain
     photography; two are finished graphics with claims burned in, and from
     those only the photograph is cut. Every box in the `scenes` step was
     measured on a 100px grid laid over the source.

     runner-seaside.webp  1448×1086. A man running on a seaside promenade at
                          sunset, brace on the right knee. No text. → the HERO.
     footballer.webp      1448×1086. A player on the ball under stadium lights.
                          No text (the LED boards read CHAMPIONSHIP, out of
                          focus). → strip «أثناء لعب الكرة», and OpenGraph.
     sofa-fitting.webp    1448×1086. An older man on a sofa fastening the
                          brace. No text. → strip «تركيبها فالدار», cut below
                          his face: 192:123 cannot hold his face and the brace
                          together, and the brace is the subject.
     walker-poles.webp    1448×1086. An older man walking with Nordic poles in a
                          park. → the offer section's portrait, x 358–870 only.
                          ⚠️ NOT built — both text blocks. The right column
                          credits the brace with what walking does: heart and
                          lungs, pain and stiffness, fall risk, the spine, mood,
                          sleep. None is a property of a knee brace, most are
                          medical claims, and the traffic is Meta ads. (The left
                          headline also drops the article in «مع التقدم في السن».)
     lunge-panel.webp     1254×1254. A sprinter's lunge inside a sales graphic.
                          → strip «المفصل المعدني عن قرب»: the brace on the bent
                          knee, nothing else.
                          ⚠️ NOT built — the icon column (its second line is a
                          pain-relief claim), the brush-stroke slogan, and the
                          four product thumbnails (the angles batch has the same
                          views at twice their size). The column runs right up
                          to his left hand, so no crop of the whole figure is
                          clean; the close-up is. */
  runner: "runner-seaside.webp",
  football: "footballer.webp",
  sofa: "sofa-fitting.webp",
  walker: "walker-poles.webp",
  lunge: "lunge-panel.webp",
};

/** `node build-assets.mjs scenes angles` runs just those steps; no args, all. */
const ONLY = process.argv.slice(2);
const want = (step) => ONLY.length === 0 || ONLY.includes(step);

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
  if (ONLY.length) console.log(`[build-assets] only: ${ONLY.join(", ")}`);

  /* ── Scenes: the fourth batch ────────────────────────────────────────────
     Each box is the largest rectangle of its slot's shape that holds the
     subject whole and none of the burned-in text. No width above a crop's
     own is ever requested — `webp()` would return the same pixels under a
     bigger name. */
  if (want("scenes")) {
    /* Hero — the runner at full length, square, centred on him. The hero
       frame is 1:1; full length because a runner cut at the shins is a crop,
       and one with both feet on the promenade is a photograph. The storefront
       card covers this same file into 4:5, trimming 10% off each side, and he
       stands in the middle third. 1086 is the source's height, so 800 is a
       true downscale. */
    console.log("hero:");
    await webp("runner", "hero-run", [400, 800], {
      extract: { left: 262, top: 0, width: 1086, height: 1086 },
      quality: 84,
    });

    /* The value strip — three tiles, each cut at the tiles' own 192:123. */
    console.log("strip:");
    // The brace on the bent knee, the hinge plate mid-frame. left ≥ 340 keeps
    // the icon column out: its text ends at x≈328.
    await webp("lunge", "scene-knee", [320, 562], {
      extract: { left: 340, top: 487, width: 562, height: 360 },
      quality: 84,
    });
    // Head to boots across the full width. No 192:123 box holds him AND the
    // whole ball, so the ball loses its lower part rather than he his head.
    await webp("football", "scene-football", [320, 704], {
      extract: { left: 0, top: 40, width: 1448, height: 928 },
      quality: 84,
    });
    // Both hands fastening the brace, the sofa behind.
    await webp("sofa", "scene-home", [320, 704], {
      extract: { left: 260, top: 400, width: 937, height: 600 },
      quality: 84,
    });

    /* The offer section's portrait: the walker alone, between the two blocks
       of burned-in text — both edges MEASURED off the pixels, not the grid.
       The headline's third line, «تقدم في السن», is its longest and its ink
       ends at x=350; a grid estimate of 318 let «تق» into the frame. The icon
       discs start at x=885 and the bottom banner at x=882. The price of
       x ≥ 358 is the lower half of his left pole, which slants out under the
       headline and now leaves the frame at the edge. Displayed at ≤240 CSS
       px, so 512 is a 2×+. */
    console.log("offer:");
    await webp("walker", "scene-walk", [280, 512], {
      extract: { left: 358, top: 0, width: 512, height: 1086 },
      quality: 84,
    });

    /* OpenGraph, 1200×630: the footballer from his face to below the brace.
       A new file name rather than a new og-cover.jpg — WhatsApp and Facebook
       cache a preview by URL, and the old URL would keep the old picture.
       JPEG, not webp: some Moroccan WhatsApp builds still refuse a webp. */
    console.log("og:");
    const og = await sharp(must("football"))
      .extract({ left: 0, top: 30, width: 1448, height: 758 })
      .resize({ width: 1200, height: 630, fit: "cover", position: "centre" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(join(IMG, "og-football.jpg"));
    console.log(`  og-football.jpg  ${og.width}×${og.height}  ${(og.size / 1024).toFixed(0)}KB`);
  }

  /* ── Four angles ─────────────────────────────────────────────────────────
     The contact sheet's quadrants, in reading order on the sheet itself:
       top-left     front, hinge toward the camera
       top-right    back, the open channel behind the knee
       bottom-left  bent, the hinge folded
       bottom-right seen end-on, the padded inside of the sleeve
     Each card is displayed at ~160–200 CSS px, so 400×400 is a comfortable 2×. */
  if (want("angles")) {
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
  if (want("diagram")) {
    console.log("diagram:");
    // Native width. The source composite is 1024px across and this region is
    // 655 of them, so 655 IS the maximum — a second, larger variant would be
    // the same file under a bigger name.
    await webp("infographic", "diagram-ar", [655], {
      extract: { left: 0, top: 130, width: 655, height: 585 },
      quality: 86,
    });
  }

  /* The lifestyle strip's five ~205px panels (`use-*`) are no longer built:
     the fourth batch supplied the same kinds of scene as full-size
     photographs, which is exactly what their size ceiling was waiting for. */

  /* ── The four fitting photos ─────────────────────────────────────────────
     Cut at their frame edges, badge included. Boxes measured off the poster by
     scanning for columns that are not the cream page background; the fourth is
     placed on the 232px pitch the first three establish, because its own frame
     is too light to detect the same way.

     ⚠️ ONE width, and it is the ceiling. Each frame is ~178px across in a
     1024px poster, so a `srcset` would be a lie — the builder never enlarges
     and a larger request returns the same file. They are displayed small
     enough to stay sharp. Showing the procedure any bigger needs the four
     photographs supplied on their own, not baked into a poster. */
  /* ⚠️ The poster is RIGHT-TO-LEFT, so its first step is its RIGHTMOST frame.
     Reading these boxes left to right gives 4, 3, 2, 1 — naming them 1..4 by
     x position puts the last photo on the first step, which is a set of
     instructions that shows the wrong picture for every line. Each x below was
     checked against the green badge burned into that frame. */
  if (want("steps")) {
    console.log("fitting steps:");
    const STEP = [
      ["step-open", 769],     // ① hands holding the brace open   — rightmost
      ["step-place", 537],    // ② placing it around the knee
      ["step-strap", 305],    // ③ fastening the straps
      ["step-check", 64],     // ④ checking the fit               — leftmost
    ];
    for (const [name, left] of STEP) {
      await webp("poster", name, [178], {
        extract: { left, top: 858, width: 178, height: 116 },
        quality: 86,
      });
    }
  }

  /* The poster's three ~190px benefit photos (`ben-*`) are no longer built —
     replaced in the strip by full-size frames from the fourth batch. The
     row's fourth frame, the orange pain glow, never was; see `poster` above.
     The outdoor OpenGraph image (`og-cover.jpg`) is retired the same way:
     `og-football.jpg` is built in the scenes step. */

  /* ── Shared brand assets ─────────────────────────────────────────────────
     Copied, never regenerated: the wordmark has to be identical across every
     BelleVia page or the store reads as several stores. */
  if (want("brand")) {
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
  }

  console.log("[build-assets] done.");
})();
