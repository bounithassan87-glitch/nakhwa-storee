// The customer upsert in `persist()`, against a real PostgreSQL.
//
// This file exists because of a defect that a mocked test could not have found
// and that no endpoint can repair once it happens.
//
// `Customer` is deduplicated by **phone, across every storefront**. The upsert
// used to write `address` unconditionally, so a three-field landing page — one
// that does not ask for a street at all — replaced whatever address a
// four-field page had stored for the same person. There is no way back:
// `admin/customers/[id].ts` is GET-only, and the order PATCH accepts only
// `{status, note}`. Nothing in the dashboard writes that column.
//
// So the guard is: a request that carries no address must leave the stored one
// alone, and a request that carries one must behave exactly as it always did.
// Both halves are asserted here against real rows, because "did Prisma actually
// leave the column alone" is a question only the database can answer — a mock
// would just be re-stating the conditional back to itself.
//
// It uses the embedded Postgres the project already ships for local dev, on its
// own port and its own throwaway data directory. It never touches the dev
// database on 5434 and never touches production. If it cannot start here, the
// tests SKIP with the reason rather than pretending to pass.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";

const ROOT = path.resolve(import.meta.dirname, "..");
const USER = "postgres";
const PASSWORD = "postgres";
const DB = "persisttest";

/**
 * A free port clear of the dev database on 5434 and of the two sibling pg
 * suites, which hold 5436-5441 and 5442-5447.
 *
 * A fixed port makes these suites flaky: a run killed before its cleanup hook
 * leaves a listening socket behind, and on Windows that socket can outlive its
 * process — after which every later run skips instead of testing anything.
 */
async function freePort() {
  const net = await import("node:net");
  for (const candidate of [5448, 5449, 5450, 5451, 5452, 5453]) {
    const free = await new Promise((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(candidate, "127.0.0.1");
    });
    if (free) return candidate;
  }
  throw new Error("no free port in 5448-5453 for the test database");
}

let PORT = null;
let URL = null;
let server = null;
let dataDir = null;
let prisma = null;
let skipReason = null;

/** Marks a test skipped when Postgres is unavailable, instead of failing it. */
const guard = (t) => {
  if (skipReason) {
    t.skip(`no local PostgreSQL: ${skipReason}`);
    return true;
  }
  return false;
};

before(async () => {
  try {
    PORT = await freePort();
    URL = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}?schema=public`;
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    dataDir = await mkdtemp(path.join(tmpdir(), "order-persist-pg-"));
    server = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: USER,
      password: PASSWORD,
      port: PORT,
      persistent: false,
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
    });
    await server.initialise();
    await server.start();
    await server.createDatabase(DB);

    // Build the schema from prisma/schema.prisma itself, so `Customer.address`
    // under test carries its real NOT NULL constraint rather than a
    // hand-written approximation. `--from-empty` touches no database; it only
    // renders DDL.
    // Invoked through node rather than the npx shim: on Windows, spawning a
    // .cmd without a shell fails with EINVAL.
    const ddl = execFileSync(
      process.execPath,
      [
        path.join(ROOT, "node_modules", "prisma", "build", "index.js"),
        "migrate", "diff",
        "--from-empty",
        "--to-schema-datamodel", path.join(ROOT, "prisma", "schema.prisma"),
        "--script",
      ],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );

    const { default: pg } = await import(`file:///${ROOT.replace(/\\/g, "/").replace(/ /g, "%20")}/node_modules/pg/lib/index.js`);
    const client = new pg.Client({ connectionString: URL });
    await client.connect();
    await client.query(ddl);
    await client.end();

    const { PrismaClient } = await import(
      `file:///${ROOT.replace(/\\/g, "/").replace(/ /g, "%20")}/node_modules/@prisma/client/default.js`
    );
    prisma = new PrismaClient({ datasources: { db: { url: URL } } });
  } catch (err) {
    skipReason = err instanceof Error ? err.message.split("\n")[0] : String(err);
  }
});

after(async () => {
  try { await prisma?.$disconnect(); } catch { /* exiting anyway */ }
  try { await server?.stop(); } catch { /* exiting anyway */ }
  if (dataDir) await rm(dataDir, { recursive: true, force: true }).catch(() => {});
});

/**
 * The customer upsert exactly as `persist()` in `functions/api/orders.ts`
 * issues it.
 *
 * Kept character-for-character in step with the endpoint — the source
 * assertions at the bottom of this file fail if the two drift apart, which is
 * what stops this from becoming a test of a copy.
 */
function upsertCustomer(o) {
  return prisma.customer.upsert({
    where: { phone: o.phone },
    update: {
      fullName: o.fullname,
      city: o.city,
      ...(o.address === undefined ? {} : { address: o.address }),
    },
    create: {
      fullName: o.fullname,
      phone: o.phone,
      city: o.city,
      address: o.address ?? "",
    },
  });
}

/** A phone nobody else in this file uses, so tests cannot collide. */
let seq = 0;
const nextPhone = () => `06${String(10000000 + (seq += 1)).padStart(8, "0")}`;

/* ── 1. The regression this file exists for ─────────────────────────────── */

test("[pg] a request WITHOUT an address leaves a stored address untouched", async (t) => {
  if (guard(t)) return;
  const phone = nextPhone();

  // A four-field storefront ordered first and stored a real street.
  await upsertCustomer({ phone, fullname: "سعاد بنعلي", city: "الدار البيضاء", address: "حي النهضة، زنقة 5، رقم 12" });

  // The same person now orders from the three-field page, which sends no address.
  await upsertCustomer({ phone, fullname: "سعاد بنعلي", city: "الدار البيضاء", address: undefined });

  const after = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(
    after.address,
    "حي النهضة، زنقة 5، رقم 12",
    "a page that does not collect a street must never erase one that was stored",
  );
});

test("[pg] the OLD unconditional write is proven destructive, so it cannot return", async (t) => {
  if (guard(t)) return;
  const phone = nextPhone();
  const street = "شارع الحسن الثاني 40";
  await upsertCustomer({ phone, fullname: "ح", city: "فاس", address: street });

  // What actually shipped: `address` was required, so a three-field page had to
  // put SOMETHING there, and it sent a stand-in sentence. The upsert wrote it
  // unconditionally. Asserting the damage locks in why the update is written
  // with a conditional spread, so nobody "tidies" it back to a plain property.
  await prisma.customer.upsert({
    where: { phone },
    update: { fullName: "ح", city: "فاس", address: "العنوان كيتاخد فمكالمة التأكيد" },
    create: { fullName: "ح", phone, city: "فاس", address: "العنوان كيتاخد فمكالمة التأكيد" },
  });
  const clobbered = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(clobbered.address, "العنوان كيتاخد فمكالمة التأكيد", "the old shape overwrote the street");

  // The guard, on the very same row: put the street back, then run the real
  // upsert with no address at all.
  await prisma.customer.update({ where: { phone }, data: { address: street } });
  await upsertCustomer({ phone, fullname: "ح", city: "فاس", address: undefined });

  const guarded = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(guarded.address, street, "the guard leaves the same write harmless");
});

test("[pg] the create branch may not pass undefined — `?? \"\"` is load-bearing", async (t) => {
  if (guard(t)) return;
  // Prisma rejects a missing required field outright rather than defaulting it,
  // so dropping the `?? ""` from `persist()`'s create would not quietly store a
  // null — it would throw, and every first order from a three-field page would
  // fail. This asserts that failure mode so the fallback cannot be "simplified"
  // away.
  await assert.rejects(
    () => prisma.customer.create({
      data: { fullName: "خ", phone: nextPhone(), city: "وجدة", address: undefined },
    }),
    /Argument `address` is missing|Invalid .*invocation/,
    "a create without an address must be rejected by Prisma, not silently accepted",
  );
});

/* ── 2. A request that DOES carry an address is unchanged ───────────────── */

test("[pg] a request WITH an address updates it exactly as before", async (t) => {
  if (guard(t)) return;
  const phone = nextPhone();
  await upsertCustomer({ phone, fullname: "ي", city: "مراكش", address: "درب الجديد 3" });
  await upsertCustomer({ phone, fullname: "ي", city: "مراكش", address: "شارع محمد السادس، إقامة 7" });

  const after = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(after.address, "شارع محمد السادس، إقامة 7", "a storefront that collects a street still writes it");
});

test("[pg] a request without an address still refreshes name and city", async (t) => {
  if (guard(t)) return;
  const phone = nextPhone();
  await upsertCustomer({ phone, fullname: "الاسم القديم", city: "مكناس", address: "زنقة 9" });
  await upsertCustomer({ phone, fullname: "الاسم الجديد", city: "الرباط", address: undefined });

  const after = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(after.fullName, "الاسم الجديد", "the guard must not freeze the whole row");
  assert.equal(after.city, "الرباط");
  assert.equal(after.address, "زنقة 9");
});

/* ── 3. A new customer with no address ──────────────────────────────────── */

test("[pg] a NEW customer with no address is created, and stores no placeholder", async (t) => {
  if (guard(t)) return;
  const phone = nextPhone();

  const created = await upsertCustomer({ phone, fullname: "ن", city: "تطوان", address: undefined });
  assert.equal(created.address, "", "empty, not a sentence pretending to be an address");

  const back = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(back.address, "", "NOT NULL is satisfied without a migration");
  assert.equal(back.city, "تطوان", "order creation is not broken by the missing field");
});

test("[pg] an empty stored address is omitted by the Space Seller mapping, never sent", async (t) => {
  if (guard(t)) return;
  // The reason `""` is the right filler rather than any wording: the courier
  // payload drops a falsy address entirely, so no parcel is ever addressed to
  // a placeholder. The city still travels in its own field.
  const { buildSpaceSellerOrder } = await import("../shared/spaceseller-mapping.js");
  const mapped = buildSpaceSellerOrder({
    orderNumber: "NK-TEST",
    quantity: 1,
    totalPrice: 32900,
    customer: { fullName: "ن", phone: "0612345678", city: "تطوان", address: "" },
    items: [{ unitPrice: 32900, product: { name: "P", sku: "SKU-1", slug: "bellevia-anti-lice" } }],
  });

  assert.ok(mapped.ok, `mapping refused: ${mapped.error}`);
  assert.equal("address" in mapped.body, false, "an empty address must not be sent to the courier");
  assert.equal(mapped.body.city, "تطوان", "the city still travels in its own field");
});

test("[pg] a later order carrying a street fills an empty address in", async (t) => {
  if (guard(t)) return;
  const phone = nextPhone();
  await upsertCustomer({ phone, fullname: "ن", city: "تطوان", address: undefined });
  await upsertCustomer({ phone, fullname: "ن", city: "تطوان", address: "شارع محمد الخامس 12" });

  const after = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(after.address, "شارع محمد الخامس 12", "the empty value is a gap to fill, not a lock");
});

/* ── 4. A new customer WITH an address ──────────────────────────────────── */

test("[pg] a NEW customer with a real address stores it", async (t) => {
  if (guard(t)) return;
  const phone = nextPhone();
  const created = await upsertCustomer({ phone, fullname: "ع", city: "أكادير", address: "حي الداخلة، بلوك 2" });
  assert.equal(created.address, "حي الداخلة، بلوك 2");

  const back = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(back.address, "حي الداخلة، بلوك 2");
});

/* ── 5. The legacy storefront is untouched ──────────────────────────────── */

test("[pg] the legacy storefront, which always sends an address, is unaffected", async (t) => {
  if (guard(t)) return;
  const phone = nextPhone();
  // The Nakhwa payload has no optional address — every request carries one, so
  // the conditional spread never engages and both writes go through as before.
  await upsertCustomer({ phone, fullname: "ل", city: "سلا", address: "تابريكت، زنقة 1" });
  const first = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(first.address, "تابريكت، زنقة 1");

  await upsertCustomer({ phone, fullname: "ل", city: "سلا", address: "تابريكت، زنقة 2" });
  const second = await prisma.customer.findUnique({ where: { phone } });
  assert.equal(second.address, "تابريكت، زنقة 2", "the legacy path must keep overwriting, as it always did");
});

/* ══ The schema contract ═══════════════════════════════════════════════════
   No database needed. Two halves, and both are necessary:

   - reading `orders.ts` pins the declarations, so this file cannot quietly
     drift into testing a copy of code that no longer exists;
   - running zod on those same chains pins what they MEAN, which is the part a
     string match cannot tell you.
   ═══════════════════════════════════════════════════════════════════════════ */

const ordersSource = await readFile(path.join(ROOT, "functions", "api", "orders.ts"), "utf8");
const between = (start, end) => {
  const a = ordersSource.indexOf(start);
  const b = end ? ordersSource.indexOf(end, a) : ordersSource.length;
  assert.notEqual(a, -1, `could not find "${start}" in orders.ts`);
  return ordersSource.slice(a, b === -1 ? ordersSource.length : b);
};

test("the required address still lives in customerFields, for the legacy payload", () => {
  const block = between("const customerFields = {", "};");
  assert.match(
    block,
    /address:\s*z\.string\(\)\.trim\(\)\.min\(3\)\.max\(200\),/,
    "customerFields must keep address REQUIRED — legacySchema inherits it",
  );

  const legacy = between("const legacySchema = z", "const catalogSchema = z");
  assert.equal(
    /^\s*address:/m.test(legacy),
    false,
    "legacySchema must not override address; it takes the required one unchanged",
  );
});

test("the catalog payload overrides address to optional, after the spread", () => {
  const catalog = between("const catalogSchema = z", "const legacyOnly");
  const spreadAt = catalog.indexOf("...customerFields,");
  const overrideAt = catalog.search(/address:\s*z\.string\(\)\.trim\(\)\.min\(3\)\.max\(200\)\.optional\(\),/);
  assert.notEqual(overrideAt, -1, "catalogSchema must declare address as optional");
  assert.ok(
    spreadAt !== -1 && overrideAt > spreadAt,
    "the override must come AFTER ...customerFields, or the required field wins",
  );
});

test("an empty address is still rejected — on both paths, exactly as before", () => {
  const required = z.string().trim().min(3).max(200);
  const optional = z.string().trim().min(3).max(200).optional();

  // The whole point: making it optional must not make it permissive.
  assert.equal(required.safeParse("").success, false, "legacy: empty rejected");
  assert.equal(optional.safeParse("").success, false, "catalog: empty STILL rejected");
  assert.equal(optional.safeParse("  ").success, false, "catalog: whitespace-only still rejected");
  assert.equal(optional.safeParse("ab").success, false, "catalog: min(3) still enforced");

  // Only a genuinely absent field takes the new path.
  assert.equal(required.safeParse(undefined).success, false, "legacy: absent still rejected");
  assert.equal(optional.safeParse(undefined).success, true, "catalog: absent is the new, allowed case");

  // A real street is accepted identically by both.
  assert.equal(required.safeParse("زنقة 5، رقم 12").success, true);
  assert.equal(optional.safeParse("زنقة 5، رقم 12").success, true);
});

test("persist() still carries the guard this file is asserting", () => {
  const persist = between("async function persist(", "const created = await prisma.order.create");
  assert.match(
    persist,
    /\.\.\.\(o\.address === undefined \? \{\} : \{ address: o\.address \}\)/,
    "the update must skip address when the request carried none",
  );
  assert.match(
    persist,
    /address:\s*o\.address \?\? ""/,
    "the create must fall back to empty, never to a placeholder sentence",
  );
  assert.equal(
    /update:\s*\{\s*fullName:\s*o\.fullname,\s*city:\s*o\.city,\s*address:\s*o\.address\s*\}/.test(persist),
    false,
    "the unconditional write must not come back",
  );
});
