#!/usr/bin/env node
/**
 * Create or update one catalog product from the command line.
 *
 * The admin dashboard's "منتج جديد" form is the normal way to do this. This
 * script exists for the case the form cannot cover: seeding a product into an
 * environment before anyone has logged into the dashboard, or scripting a
 * launch. It writes the same columns the form writes and nothing else — there
 * is no second catalog and no second orders system.
 *
 * ── Safety ────────────────────────────────────────────────────────────────
 * `.env` in this repo points at the **production** Neon database. This script
 * therefore refuses to run unless you name the target explicitly:
 *
 *   Local:
 *     DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5434/nakhwa?schema=public" \
 *       node scripts/upsert-product.mjs --slug bellevia-anti-joint-pain
 *
 *   Production (deliberate, and it will print the host and ask):
 *     node scripts/upsert-product.mjs --slug bellevia-anti-joint-pain --production
 *
 * ── Prices ────────────────────────────────────────────────────────────────
 * Three columns, one of which is the only figure a customer ever sees:
 *
 *   compareAtPrice  the struck-through "was" price
 *   basePrice       the regular price
 *   offerPrice      the discounted price, when an offer is running
 *
 * `/api/orders` charges `offerPrice ?? basePrice` — read from the row, never
 * from the storefront — so that is the selling price, and this script prints it
 * back so it can be checked against what the landing page quotes.
 */
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { landingStatusFor } from "../shared/landing-pages.js";

/** The products this script knows how to seed, in dirhams. */
const PRESETS = {
  "bellevia-anti-joint-pain": {
    name: "BelleVia Anti Joint Pain",
    sku: "BVP-AJP-001",
    category: "مكمل غذائي",
    description:
      "مكمل غذائي للراحة المفصلية. يساهم في الحفاظ على وظيفة المفاصل الطبيعية. تركيبة من Glucosamine و Chondroitin و MSM و Curcumine. 30 كبسولة.",
    compareAt: 349,
    base: 259,
    offer: 199,
    status: "ACTIVE",
  },
  // The figures the landing page quotes: 349 DH, struck through from 400 DH.
  // `offer` is the one that reaches a customer, so it must equal `price` in
  // bellevia-pack-raha/config.js, and `base` must equal its `oldPrice`.
  "bellevia-pack-raha": {
    name: "BelleVia PACK RAHA",
    sku: "BVP-RAHA-001",
    category: "العناية بالشعر",
    description:
      "باك متكامل للعناية بالشعر من ثلاثة منتوجات: زيت ضد تساقط الشعر 60ml، شامبو ضد تساقط الشعر 150ml، ورشاش ضد تساقط الشعر 100ml.",
    compareAt: 400,
    base: 400,
    offer: 349,
    status: "ACTIVE",
  },
};

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1]?.startsWith("--") ? true : (args[i + 1] ?? true)) : undefined;
};

const slug = flag("slug");
if (!slug || typeof slug !== "string") {
  console.error("usage: node scripts/upsert-product.mjs --slug <slug> [--production]");
  console.error("known slugs: " + Object.keys(PRESETS).join(", "));
  process.exit(1);
}
const preset = PRESETS[slug];
if (!preset) {
  console.error(`no preset for "${slug}". Known: ${Object.keys(PRESETS).join(", ")}`);
  process.exit(1);
}

const wantsProduction = flag("production") === true;
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const host = new URL(url.replace(/^postgres(ql)?:/, "http:")).host;
const isLocal = /^(127\.0\.0\.1|localhost)/.test(host);

if (!isLocal && !wantsProduction) {
  console.error(
    `\nRefusing to write to ${host}: that is not localhost.\n` +
      `Re-run with --production if you really mean to change the live catalog.\n`,
  );
  process.exit(1);
}

// Centimes, never floats: the whole system stores money as integers.
const dh = (n) => Math.round(n * 100);
const data = {
  name: preset.name,
  sku: preset.sku,
  category: preset.category,
  description: preset.description,
  compareAtPrice: dh(preset.compareAt),
  basePrice: dh(preset.base),
  offerPrice: dh(preset.offer),
  currency: "MAD",
  status: preset.status,
  isActive: preset.status === "ACTIVE",
};
const selling = (data.offerPrice ?? data.basePrice) / 100;

console.log(`\n  target      ${host}${isLocal ? " (local)" : "  ← PRODUCTION"}`);
console.log(`  slug        ${slug}`);
console.log(`  name        ${data.name}`);
console.log(`  sku         ${data.sku}`);
console.log(`  old price   ${preset.compareAt} DH`);
console.log(`  regular     ${preset.base} DH`);
console.log(`  selling     ${selling} DH   ← what /api/orders will charge`);
console.log(`  status      ${data.status}\n`);

if (!isLocal) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type the slug to confirm writing to PRODUCTION: `);
  rl.close();
  if (answer.trim() !== slug) {
    console.error("Aborted — nothing was written.");
    process.exit(1);
  }
}

const pool = new pg.Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const before = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  const product = await prisma.product.upsert({
    where: { slug },
    create: { slug, ...data },
    update: data,
  });
  const link = landingStatusFor(product.slug, product);
  console.log(`${before ? "updated" : "created"}  ${product.id}`);
  console.log(`landing page  ${link.url ?? "— none deployed"}  (${link.status})`);
  console.log(`order endpoint  POST /api/orders   productSlug="${product.slug}"`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
