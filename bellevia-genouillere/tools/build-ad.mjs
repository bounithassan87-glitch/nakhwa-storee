/**
 * BelleVia — دعامة الركبة · offer ad creative.
 *
 * Two steps:
 *
 *   1) node bellevia-genouillere/tools/build-ad.mjs
 *        cuts the product out of its studio background → tools/unit-cutout.png
 *
 *   2) chrome --headless=new --window-size=1080,1350 \
 *        --screenshot=ad-offer-1080x1350.png \
 *        file:///…/bellevia-genouillere/tools/ad-offer.html
 *
 * Everything lives in `tools/`, which `scripts/copy-landing-pages.mjs` strips
 * from `dist/` — an ad creative is not part of the page and should not ship
 * with it.
 *
 * ── Why a cutout at all ───────────────────────────────────────────────────
 * `angle-front-400.webp` is the brace photographed on white. Dropped straight
 * onto the ad's dark green field it reads as a white rectangle with a product
 * inside it, which is the single clearest tell of a thrown-together ad.
 *
 * Keying works here for the one reason it does NOT work on the supplement
 * pages: that product is a white bottle on white and has no key at all, while
 * this one is a near-black brace on white — the widest separation a key can
 * ask for. Nothing is redrawn, recoloured or relabelled; the pixels that
 * survive are the supplier's own.
 *
 * ── Why a flood fill and not a threshold ──────────────────────────────────
 * "Light means background" is wrong on this photo: the hinge plates are
 * polished chrome and read brighter than parts of the studio. What separates
 * them is not brightness but REACHABILITY — the studio is the light region
 * connected to the border, while the chrome sits enclosed by black fabric and
 * can never be reached from outside. So the ground is flood filled inward
 * from the four edges, and the hinges keep themselves.
 *
 * ── The shadow ────────────────────────────────────────────────────────────
 * The studio's soft grey shadow pools under the brace below BG_TOL, so the
 * fill stops at it. It is removed by row instead: a row whose opaque pixels
 * are all light is shadow, because every row of the brace itself carries
 * near-black fabric. The ad casts its own shadow in CSS.
 *
 * ── The fringe ────────────────────────────────────────────────────────────
 * An edge pixel is a MIX of brace and studio: `seen = a·brace + (1−a)·ground`.
 * Give it partial alpha and leave its colour alone and it keeps the white half
 * of that mix — over a dark green field the silhouette lights up in a speckled
 * white outline, the halo that gives a cheap composite away. Two things fix
 * it, and both are needed:
 *
 *   ERODE  — the outermost ring is mostly ground and holds no recoverable
 *            brace, so it is cut off rather than corrected. The brace has a
 *            fuzzy neoprene edge; a ring this thin costs no silhouette.
 *   unmix  — the ring behind it is genuinely part brace, so the ground is
 *            divided back out: `brace = (seen − (1−a)·ground) / a`, with the
 *            ground measured off the plate (a uniform 254). That recovers the
 *            colour the fabric already had under the white; it does not tint
 *            it.
 *
 * The alpha used for that division is the one FEATHER assigns by distance,
 * not one guessed from brightness — a luminance ramp badly over-estimates
 * alpha on fuzzy fabric, which is what left a rim behind on the first attempt.
 *
 * ── Resolution ────────────────────────────────────────────────────────────
 * The front view exists only as a 400×400 quadrant of the supplier's
 * angles-grid.jpg (the repo webp matches it at 42 dB PSNR, so there is no
 * better original to go back to), and the ad shows it ~560px tall. Left to
 * the browser, that is a soft bilinear stretch, and the silhouette is cut on
 * the coarse 400px grid. So the photo is resampled once, up front, with
 * Lanczos3 at SCALE× — the same pixels, a sharper filter — and keyed at that
 * size: the contour follows the interpolated edge instead of the source's
 * stair-steps, and the page only ever scales the cutout DOWN. ERODE and
 * FEATHER are in output pixels, so they scale with it.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "assets", "images", "angle-front-400.webp");
const OUT = join(here, "unit-cutout.png");

/** Studio ground, measured: the background median of the plate is 254,254,254. */
const GROUND = 254;
/** A border-connected pixel this light is studio. */
const BG_TOL = 236;
/** Resampling factor applied before keying. */
const SCALE = 2;
/** Pixels within this distance of the studio are dropped outright. */
const ERODE = 1.35 * SCALE;
/** …and the next this-many fade in, which is the anti-aliasing. */
const FEATHER = 1.5 * SCALE;
/** A row is product, not shadow, once this share of it is genuinely dark. */
const DARK_SHARE = 0.25;
const DARK = 150;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

const plate = await sharp(SRC).metadata();
const { data, info } = await sharp(SRC)
  .resize(plate.width * SCALE, plate.height * SCALE, { kernel: "lanczos3" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const N = W * H;

// ── 1. the ground, flood filled in from the border ────────────────────────
const light = new Uint8Array(N);
for (let p = 0; p < N; p++) {
  const i = p * C;
  light[p] = lum(data[i], data[i + 1], data[i + 2]) >= BG_TOL ? 1 : 0;
}
const bg = new Uint8Array(N);
const stack = [];
const push = (x, y) => {
  const p = y * W + x;
  if (light[p] && !bg[p]) { bg[p] = 1; stack.push(p); }
};
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % W;
  const y = (p / W) | 0;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

// ── 2. distance from every product pixel to the ground (two-pass chamfer) ──
const BIG = 1e6;
const dist = new Float32Array(N);
for (let p = 0; p < N; p++) dist[p] = bg[p] ? 0 : BIG;
const D1 = 1;
const D2 = Math.SQRT2;
const relax = (p, q, w) => { const v = dist[q] + w; if (v < dist[p]) dist[p] = v; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x;
  if (y > 0) relax(p, p - W, D1);
  if (x > 0) relax(p, p - 1, D1);
  if (y > 0 && x > 0) relax(p, p - W - 1, D2);
  if (y > 0 && x < W - 1) relax(p, p - W + 1, D2);
}
for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
  const p = y * W + x;
  if (y < H - 1) relax(p, p + W, D1);
  if (x < W - 1) relax(p, p + 1, D1);
  if (y < H - 1 && x < W - 1) relax(p, p + W + 1, D2);
  if (y < H - 1 && x > 0) relax(p, p + W - 1, D2);
}

// ── 3. alpha from that distance, then unmix the ground back out ───────────
const px = Buffer.alloc(N * 4);
let unmixed = 0;
for (let p = 0; p < N; p++) {
  const i = p * C;
  const j = p * 4;
  const d = dist[p];
  const a = d <= ERODE ? 0
    : d >= ERODE + FEATHER ? 255
    : Math.round((255 * (d - ERODE)) / FEATHER);

  if (a === 0 || a === 255) {
    px[j] = data[i];
    px[j + 1] = data[i + 1];
    px[j + 2] = data[i + 2];
  } else {
    const al = a / 255;
    px[j] = clamp8((data[i] - (1 - al) * GROUND) / al);
    px[j + 1] = clamp8((data[i + 1] - (1 - al) * GROUND) / al);
    px[j + 2] = clamp8((data[i + 2] - (1 - al) * GROUND) / al);
    unmixed++;
  }
  px[j + 3] = a;
}

// ── 4. the cast shadow, from the bottom up ────────────────────────────────
let cut = H;
for (let y = H - 1; y >= 0; y--) {
  let opaque = 0;
  let dark = 0;
  for (let x = 0; x < W; x++) {
    const j = (y * W + x) * 4;
    if (px[j + 3] > 40) {
      opaque++;
      if (lum(px[j], px[j + 1], px[j + 2]) < DARK) dark++;
    }
  }
  if (opaque > 0 && dark / opaque > DARK_SHARE) { cut = y + 1; break; }
}
for (let y = cut; y < H; y++) for (let x = 0; x < W; x++) px[(y * W + x) * 4 + 3] = 0;

const keyed = await sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
const trimmed = await sharp(keyed).trim({ threshold: 1 }).toBuffer();
const meta = await sharp(trimmed).metadata();
writeFileSync(OUT, trimmed);

let ground = 0;
for (let p = 0; p < N; p++) if (bg[p]) ground++;
console.log(`[build-ad] ground flood filled: ${ground} px (${((100 * ground) / N).toFixed(1)}%)`);
console.log(`[build-ad] shadow removed below y=${cut} of ${H}`);
console.log(`[build-ad] ${unmixed} edge px unmixed from the ${GROUND} ground`);
console.log(`[build-ad] ${OUT.split(/[\\/]/).pop()}  ${meta.width}×${meta.height}`);
console.log(`[build-ad] now render tools/ad-offer.html at 1080×1350`);
