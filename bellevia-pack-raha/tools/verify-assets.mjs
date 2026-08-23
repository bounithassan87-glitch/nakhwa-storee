/**
 * PACK RAHA — deploy gate for product imagery and claims.
 *
 * Exit non-zero and the page must not ship. Six checks:
 *
 *   1 · every product asset on disk is byte-for-byte the crop the build says it
 *       is, re-derived from the approved creative — provenance, proven, not
 *       asserted in a comment;
 *   2 · every product asset's source IS the approved creative;
 *   3 · no filename from a superseded pack appears in the HTML, CSS or JS;
 *   4 · no orphan file survives in assets/images/;
 *   5 · every asset the page references exists on disk;
 *   6 · no forbidden claim appears anywhere the browser can read — markup and
 *       comments alike, because comments ship.
 *
 * Run:  node bellevia-pack-raha/tools/verify-assets.mjs
 */
import sharp from 'sharp';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'assets', 'images');

const SRC_DIRS = ['C:/Users/ADmiN/Desktop/PACK RAHA', 'C:/Users/ADmiN/Downloads/PACK RAHA'];
const srcPath = (f) => {
  if (process.env.BELLEVIA_RAHA_SOURCE_DIR) return join(process.env.BELLEVIA_RAHA_SOURCE_DIR, f);
  for (const d of SRC_DIRS) if (existsSync(join(d, f))) return join(d, f);
  return null;
};

/**
 * Filenames from the pack this page used before 2026-08-15 — amber dropper oil,
 * white-cap shampoo, «رشاش». If any of these is referenced again, an old bottle
 * is back on the page.
 */
const RETIRED_NAMES = [
  'hero-pack-760', 'hero-pack-1537',
  'product-oil-185', 'product-shampoo-132', 'product-shampoo-265', 'product-spray-200',
  'offer-creative',
];

/**
 * Never publishable — including inside comments, which are served.
 *
 * مينوكسيديل and ساليسيليك came OFF this list on 2026-08-16 at the client's
 * explicit written instruction: the official «المكونات» creative lists both,
 * and the page must match that sheet. They are ingredients the brand declares,
 * not claims this page invents. Note that minoxidil is a regulated
 * pharmaceutical active rather than a cosmetic one — the decision to name it
 * is the client's, and it was taken with that stated.
 *
 * ميتوكسينيل stays: it is a garbled spelling of minoxidil that appeared on one
 * of the early contradictory sheets. Now that the correct spelling is allowed,
 * this entry's job is to stop the wrong one shipping beside it.
 */
const FORBIDDEN = [
  ['القمل', 'lice positioning'],
  ['ميتوكسينيل', 'minoxidil — misspelt; use مينوكسيديل as the sheet spells it'],
  ['100% طبيعي', '100% natural claim'],
  ['طبيعية 100', '100% natural claim'],
  ['مضمون', 'guarantee'],
  ['الصلع', 'baldness'],
  ['قبل وبعد', 'before/after'],
];

const webp = { quality: 82, effort: 6 };
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const manifest = JSON.parse(await readFile(join(HERE, 'asset-manifest.json'), 'utf8'));
const APPROVED = manifest.approvedCreative;

console.log(`\napproved creative: ${APPROVED}\n`);

// ── 1 + 2 · Provenance of every product asset ───────────────────────────────
console.log('── product assets are crops of the approved creative ──');
for (const file of manifest.productAssets) {
  const rec = manifest.files[file];
  if (!rec) { fail(`${file}: not in the manifest`); continue; }
  if (rec.source !== APPROVED) { fail(`${file}: built from "${rec.source}", not the approved creative`); continue; }

  const from = srcPath(rec.source);
  if (!from) { fail(`${file}: source ${rec.source} not found on disk — cannot verify provenance`); continue; }

  // Re-derive the crop and compare bytes with what is on disk.
  const cluster = await sharp(from).extract(rec.rect).toBuffer();
  const rebuilt = file.endsWith('.jpg')
    ? await sharp(cluster).resize(1200, 630, { fit: 'contain', background: '#EAF0DE' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    : await sharp(cluster).resize({ width: rec.width }).webp(webp).toBuffer();

  const onDisk = await readFile(join(OUT, file));
  const a = createHash('sha256').update(rebuilt).digest('hex');
  const b = createHash('sha256').update(onDisk).digest('hex');
  if (a !== b || b !== rec.sha256) {
    fail(`${file}: bytes do not match the documented crop of ${APPROVED}`);
  } else {
    const r = rec.rect;
    ok(`${file}  ← ${APPROVED} [${r.left},${r.top} ${r.width}×${r.height}]`);
  }
}

// ── 3 · No superseded filename anywhere the page can reach ──────────────────
console.log('\n── no superseded bottle referenced in HTML / CSS / JS ──');
const pageFiles = ['index.html', 'style.css', 'script.js', 'config.js'];
const sources = Object.fromEntries(
  await Promise.all(pageFiles.map(async (f) => [f, await readFile(join(ROOT, f), 'utf8')])),
);
let retiredHits = 0;
for (const [f, text] of Object.entries(sources)) {
  for (const name of RETIRED_NAMES) {
    if (text.includes(name)) { fail(`${f} still references the superseded asset "${name}"`); retiredHits++; }
  }
}
if (!retiredHits) ok(`none of ${RETIRED_NAMES.length} superseded names appears in any page file`);

// ── 4 · No orphan in assets/images ──────────────────────────────────────────
console.log('\n── assets/images contains only what the build produced ──');
const onDisk = (await readdir(OUT)).filter((f) => !f.startsWith('.'));
const expected = new Set(Object.keys(manifest.files));
const orphans = onDisk.filter((f) => !expected.has(f));
orphans.length ? orphans.forEach((f) => fail(`orphan asset: ${f}`))
               : ok(`${onDisk.length} files, all accounted for by the manifest`);

// ── 5 · Every referenced asset exists ───────────────────────────────────────
console.log('\n── every referenced asset exists ──');
const refs = new Set();
for (const text of Object.values(sources)) {
  for (const m of text.matchAll(/assets\/images\/([A-Za-z0-9._-]+)/g)) refs.add(m[1]);
}
const missing = [...refs].filter((r) => !onDisk.includes(r));
missing.length ? missing.forEach((r) => fail(`referenced but absent: ${r}`))
               : ok(`${refs.size} referenced assets all present`);

// ── 6 · Claims ──────────────────────────────────────────────────────────────
console.log('\n── forbidden claims (markup and comments alike) ──');
let claimHits = 0;
for (const [f, text] of Object.entries(sources)) {
  for (const [needle, label] of FORBIDDEN) {
    if (text.includes(needle)) { fail(`${f} contains «${needle}» (${label})`); claimHits++; }
  }
}
if (!claimHits) ok(`none of ${FORBIDDEN.length} forbidden strings appears in any page file`);

console.log(`\n${failures === 0 ? 'ASSET GATE: PASS' : `ASSET GATE: FAIL — ${failures} problem(s)`}`);
process.exit(failures === 0 ? 0 : 1);
