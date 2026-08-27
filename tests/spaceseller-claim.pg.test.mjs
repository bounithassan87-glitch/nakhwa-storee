// The Space Seller claim, against a real PostgreSQL.
//
// This file exists because a mocked test said the claim worked while production
// could not claim a single order. The mock reimplemented the predicate in
// JavaScript, where `null !== "PENDING"` is true. PostgreSQL disagrees: for a
// NULL column, `NOT status = 'PENDING'` is UNKNOWN, not TRUE, so the row is
// excluded. Every never-attempted order has a NULL status, so the sync could
// never fire for anything — 0 of 92 production orders were claimable.
//
// A mock cannot catch that, because the thing being mocked is the thing that
// was wrong. So this runs the real Prisma query builder against a real Postgres
// and asserts on real row counts.
//
// It uses the embedded Postgres the project already ships for local dev, on its
// own port and its own throwaway data directory. If that cannot start here, the
// tests SKIP with the reason rather than pretending to pass.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 5436; // deliberately not 5434 — never touch a running dev database
const USER = "postgres";
const PASSWORD = "postgres";
const DB = "claimtest";
const URL = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}?schema=public`;

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
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    dataDir = await mkdtemp(path.join(tmpdir(), "ss-claim-pg-"));
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

    // Build the schema from prisma/schema.prisma itself, so the table under test
    // is the real one rather than a hand-written approximation. `--from-empty`
    // touches no database; it only renders DDL.
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

/** One order row, with only the columns the claim cares about set. */
async function seedOrder(over = {}) {
  const id = `ord_${Math.random().toString(36).slice(2, 12)}`;
  const customer = await prisma.customer.create({
    data: { fullName: "T", phone: `06${Math.floor(10000000 + Math.random() * 89999999)}`, city: "C", address: "A" },
  });
  await prisma.order.create({
    data: {
      id,
      orderNumber: `NK-${id.slice(-8).toUpperCase()}`,
      customerId: customer.id,
      quantity: 1,
      totalPrice: 29900,
      ...over,
    },
  });
  return id;
}

/** The claim exactly as spacesellerSync.ts issues it. */
function claim(orderId) {
  return prisma.order.updateMany({
    where: {
      id: orderId,
      spacesellerOrderId: null,
      spacesellerUuid: null,
      OR: [{ spacesellerSyncStatus: null }, { spacesellerSyncStatus: { not: "PENDING" } }],
    },
    data: { spacesellerSyncStatus: "PENDING", spacesellerLastError: null },
  });
}

/* ── 5. The regression this file exists for ─────────────────────────────── */

test("[pg] a NULL sync status IS claimable — the bug that broke every order", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder(); // spaceseller_sync_status defaults to NULL
  const before = await prisma.order.findUnique({ where: { id }, select: { spacesellerSyncStatus: true } });
  assert.equal(before.spacesellerSyncStatus, null, "precondition: the order has never been attempted");

  const res = await claim(id);
  assert.equal(res.count, 1, "a never-attempted order must be claimable");

  const after = await prisma.order.findUnique({ where: { id }, select: { spacesellerSyncStatus: true } });
  assert.equal(after.spacesellerSyncStatus, "PENDING", "the claim must actually flip the row");
});

test("[pg] the OLD predicate is proven broken, so the regression cannot silently return", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder();
  // This is the shape that shipped. Asserting it fails locks in WHY the fix is
  // written the long way, so nobody "tidies" it back.
  const broken = await prisma.order.updateMany({
    where: {
      id,
      spacesellerOrderId: null,
      spacesellerUuid: null,
      NOT: { spacesellerSyncStatus: "PENDING" },
    },
    data: { spacesellerSyncStatus: "PENDING" },
  });
  assert.equal(broken.count, 0, "NOT status = 'PENDING' is UNKNOWN for NULL — this is the defect");

  const fixed = await claim(id);
  assert.equal(fixed.count, 1, "and the fixed predicate claims the very same row");
});

/* ── 7. PENDING stays blocked ───────────────────────────────────────────── */

test("[pg] a genuinely PENDING order is NOT claimable", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder({ spacesellerSyncStatus: "PENDING" });
  const res = await claim(id);
  assert.equal(res.count, 0, "an unresolved attempt must never be piled on top of");
});

/* ── 8. Already-synced stays blocked ────────────────────────────────────── */

test("[pg] an order with an upstream order_id is NOT claimable", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder({ spacesellerOrderId: "SS-1001", spacesellerSyncStatus: "SYNCED" });
  assert.equal((await claim(id)).count, 0, "a synced order must never be re-sent");
});

test("[pg] an order with only an upstream uuid is NOT claimable", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder({ spacesellerUuid: "u-2002", spacesellerSyncStatus: "SYNCED" });
  assert.equal((await claim(id)).count, 0, "the uuid alone also proves it exists upstream");
});

test("[pg] SYNCED with an id stays blocked even though SYNCED != PENDING", async (t) => {
  if (guard(t)) return;
  // The OR branch makes SYNCED match the status test, so the id guards are what
  // actually stop it. Worth pinning: loosening the status must not open this.
  const id = await seedOrder({ spacesellerOrderId: "SS-3003", spacesellerSyncStatus: "SYNCED" });
  assert.equal((await claim(id)).count, 0);
});

/* ── FAILED is retryable, which is the point of releasing the claim ─────── */

test("[pg] a FAILED order IS claimable, so a human retry can work", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder({ spacesellerSyncStatus: "FAILED", spacesellerLastError: "422: bad sku" });
  assert.equal((await claim(id)).count, 1);
  const row = await prisma.order.findUnique({ where: { id }, select: { spacesellerLastError: true } });
  assert.equal(row.spacesellerLastError, null, "claiming clears the stale error");
});

test("[pg] a SKIPPED order IS claimable, so filling in a SKU unblocks it", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder({ spacesellerSyncStatus: "SKIPPED", spacesellerLastError: "missing_sku" });
  assert.equal((await claim(id)).count, 1);
});

/* ── 6. Concurrency, against a real database this time ──────────────────── */

test("[pg] two concurrent claims produce exactly one winner", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder();
  const [a, b] = await Promise.all([claim(id), claim(id)]);
  assert.equal(
    [a.count, b.count].filter((c) => c === 1).length,
    1,
    "exactly one caller may proceed to send",
  );
});

test("[pg] a burst of eight concurrent claims still yields exactly one winner", async (t) => {
  if (guard(t)) return;
  const id = await seedOrder();
  const results = await Promise.all(Array.from({ length: 8 }, () => claim(id)));
  assert.equal(results.filter((r) => r.count === 1).length, 1, "no duplicate parcel, whatever the load");
});
