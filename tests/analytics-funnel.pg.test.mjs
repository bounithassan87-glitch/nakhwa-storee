// The funnel aggregation, against a real PostgreSQL.
//
// The abandonment figure is a set difference over session ids, not a
// subtraction, and the difference between those two only shows up on real rows:
// a visitor who starts the form twice, or returns the next day, makes
// `form_starts - orders` produce a number that can even go negative. So the
// query runs here against a real database rather than a mock.
//
// Uses the embedded Postgres the project already ships, on its own free port
// and a throwaway data directory. Production is never touched. If Postgres
// cannot start, the tests SKIP with the reason rather than pretending to pass.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const USER = "postgres";
const PASSWORD = "postgres";
const DB = "funneltest";

/** A free port well clear of the dev database on 5434. */
async function freePort() {
  const net = await import("node:net");
  for (const candidate of [5442, 5443, 5444, 5445, 5446, 5447]) {
    const free = await new Promise((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(candidate, "127.0.0.1");
    });
    if (free) return candidate;
  }
  throw new Error("no free port in 5442-5447 for the test database");
}

let PORT = null;
let URL = null;
let server = null;
let dataDir = null;
let prisma = null;
let skipReason = null;

const guard = (t) => {
  if (skipReason) {
    t.skip(`no local PostgreSQL: ${skipReason}`);
    return true;
  }
  return false;
};

const url = (p) => `file:///${ROOT.replace(/\\/g, "/").replace(/ /g, "%20")}/${p}`;

before(async () => {
  try {
    PORT = await freePort();
    URL = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}?schema=public`;
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    dataDir = await mkdtemp(path.join(tmpdir(), "nk-funnel-pg-"));
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

    // Schema rendered from prisma/schema.prisma itself — no database is read.
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

    const { default: pg } = await import(url("node_modules/pg/lib/index.js"));
    const client = new pg.Client({ connectionString: URL });
    await client.connect();
    await client.query(ddl);
    await client.end();

    const { PrismaClient } = await import(url("node_modules/@prisma/client/default.js"));
    prisma = new PrismaClient({ datasources: { db: { url: URL } } });
  } catch (err) {
    skipReason =
      (err instanceof Error && err.message ? err.message.split("\n")[0] : String(err)) ||
      `could not start on port ${PORT ?? "?"}`;
  }
});

after(async () => {
  try { await prisma?.$disconnect(); } catch { /* exiting anyway */ }
  try { await server?.stop(); } catch { /* exiting anyway */ }
  if (dataDir) await rm(dataDir, { recursive: true, force: true }).catch(() => {});
});

let seq = 0;
const sid = () => `nks_${String(++seq).padStart(4, "0")}abcdefghijkl`;

async function ev(type, sessionId, landingPage, extra = {}) {
  return prisma.trackingEvent.create({
    data: { type, sessionId, landingPage, ...extra },
  });
}

/**
 * The abandonment set difference, expressed exactly as
 * functions/api/admin/_lib/funnel.ts expresses it.
 *
 * That module is TypeScript with extensionless imports and cannot be loaded
 * into a plain node test, so the same SQL shape is exercised here against the
 * same schema. What is being proven is the query's semantics — that a set
 * difference and a subtraction give different answers, and which one is right.
 */
async function abandonedFor(landingPage) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n
       FROM (SELECT DISTINCT landing_page, session_id FROM "TrackingEvent" WHERE type='form_start') s
      WHERE s.landing_page = $1
        AND NOT EXISTS (
          SELECT 1 FROM (SELECT DISTINCT landing_page, session_id FROM "TrackingEvent" WHERE type='order_success') x
           WHERE x.landing_page = s.landing_page AND x.session_id = s.session_id
        )`,
    landingPage,
  );
  return rows[0].n;
}

async function distinctSessions(type, landingPage) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT session_id)::int AS n FROM "TrackingEvent" WHERE type=$1 AND landing_page=$2`,
    type,
    landingPage,
  );
  return rows[0].n;
}

/* ── Abandonment ───────────────────────────────────────────────────────── */

test("[pg] a session that starts the form and never orders is abandoned", async (t) => {
  if (guard(t)) return;
  const page = "page-abandon";
  const s = sid();
  await ev("page_view", s, page);
  await ev("form_view", s, page);
  await ev("form_start", s, page);
  assert.equal(await abandonedFor(page), 1);
});

test("[pg] a session that starts AND orders is not abandoned", async (t) => {
  if (guard(t)) return;
  const page = "page-complete";
  const s = sid();
  await ev("page_view", s, page);
  await ev("form_start", s, page);
  await ev("order_success", s, page, { orderId: `ord_${seq}` });
  assert.equal(await abandonedFor(page), 0);
});

test("[pg] abandonment is a set difference, not form_starts minus orders", async (t) => {
  if (guard(t)) return;
  // One visitor starts twice in the same session, then orders. Subtraction
  // would give 2 - 1 = 1 abandoned; the truth is 0.
  const page = "page-doublestart";
  const s = sid();
  await ev("form_start", s, page);
  await ev("form_start", s, page);
  await ev("order_success", s, page, { orderId: `ord_${seq}_x` });

  const starts = await prisma.trackingEvent.count({ where: { type: "form_start", landingPage: page } });
  assert.equal(starts, 2, "two raw start rows");
  assert.equal(await distinctSessions("form_start", page), 1, "but one session");
  assert.equal(await abandonedFor(page), 0, "subtraction would have said 1 — wrongly");
});

test("[pg] subtraction could go negative where the set difference cannot", async (t) => {
  if (guard(t)) return;
  // Two sessions order; only one of them ever recorded a start (the other began
  // before the window). starts - orders = 1 - 2 = -1. Abandoned is 0.
  const page = "page-negative";
  const a = sid();
  const b = sid();
  await ev("form_start", a, page);
  await ev("order_success", a, page, { orderId: `ord_${seq}_a` });
  await ev("order_success", b, page, { orderId: `ord_${seq}_b` });

  const starts = await distinctSessions("form_start", page);
  const orders = await prisma.trackingEvent.count({ where: { type: "order_success", landingPage: page } });
  assert.equal(starts - orders, -1, "the naive formula is negative here");
  assert.equal(await abandonedFor(page), 0, "the real answer");
});

/* ── Counting ──────────────────────────────────────────────────────────── */

test("[pg] visitors count distinct sessions, so a reload does not inflate them", async (t) => {
  if (guard(t)) return;
  const page = "page-reload";
  const s = sid();
  await ev("page_view", s, page);
  await ev("page_view", s, page);
  await ev("page_view", s, page);
  const rows = await prisma.trackingEvent.count({ where: { type: "page_view", landingPage: page } });
  assert.equal(rows, 3, "three raw rows");
  assert.equal(await distinctSessions("page_view", page), 1, "but one visitor");
});

test("[pg] failed submissions are counted separately from attempts", async (t) => {
  if (guard(t)) return;
  const page = "page-failures";
  const s = sid();
  await ev("form_submit", s, page, { outcome: "attempt" });
  await ev("form_submit", s, page, { outcome: "attempt" });
  await ev("form_submit", s, page, { outcome: "failure", detail: "invalid_phone" });

  const attempts = await prisma.trackingEvent.count({ where: { type: "form_submit", landingPage: page } });
  const failures = await prisma.trackingEvent.count({
    where: { type: "form_submit", landingPage: page, outcome: "failure" },
  });
  assert.equal(attempts, 3);
  assert.equal(failures, 1);
  assert.notEqual(attempts, failures, "a submit attempt is not a failure");
});

/* ── The duplicate guard ───────────────────────────────────────────────── */

test("[pg] an order can only ever record one order_success", async (t) => {
  if (guard(t)) return;
  const page = "page-dupe";
  const s = sid();
  const orderId = `ord_unique_${seq}`;
  await ev("order_success", s, page, { orderId });
  await assert.rejects(
    () => ev("order_success", sid(), page, { orderId }),
    "the unique index must reject a second success for the same order",
  );
  const n = await prisma.trackingEvent.count({ where: { type: "order_success", orderId } });
  assert.equal(n, 1);
});

test("[pg] the duplicate guard does not constrain events without an order", async (t) => {
  if (guard(t)) return;
  // NULLs are distinct in a Postgres unique index, which is what lets every
  // other event type stay unconstrained under the same index.
  const page = "page-nulls";
  const s = sid();
  await ev("page_view", s, page);
  await ev("page_view", s, page);
  await ev("form_view", s, page);
  assert.equal(await prisma.trackingEvent.count({ where: { landingPage: page } }), 3);
});

/* ── Separation and privacy ────────────────────────────────────────────── */

test("[pg] landing pages are counted independently", async (t) => {
  if (guard(t)) return;
  const a = sid();
  const b = sid();
  await ev("form_start", a, "page-alpha");
  await ev("form_start", b, "page-beta");
  await ev("order_success", b, "page-beta", { orderId: `ord_beta_${seq}` });
  assert.equal(await abandonedFor("page-alpha"), 1);
  assert.equal(await abandonedFor("page-beta"), 0);
});

test("[pg] the table holds no personal data at all", async (t) => {
  if (guard(t)) return;
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='TrackingEvent' ORDER BY column_name`,
  );
  const names = cols.map((c) => c.column_name);
  for (const forbidden of ["full_name", "fullname", "phone", "address", "email", "ip", "ip_address", "user_agent"]) {
    assert.ok(!names.includes(forbidden), `TrackingEvent must not have a ${forbidden} column`);
  }
  assert.deepEqual(names.sort(), [
    "created_at", "detail", "id", "landing_page", "order_id", "outcome", "product_slug", "session_id", "type",
  ]);
});
