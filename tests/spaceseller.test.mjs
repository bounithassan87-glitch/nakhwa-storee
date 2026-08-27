// Space Seller integration — mapping, the once-only claim, and error handling.
//
// No network and no database. The mapping layer is pure, and the sync decision
// is exercised against an in-memory order store and a mock transport, so the
// suite can never reach Space Seller or create a real parcel.
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSpaceSellerOrder,
  centimesToMad,
  shouldRefresh,
  OPPORTUNISTIC_REFRESH_MS,
  classifyStatus,
  isRetriable,
  scrubUpstream,
  MAPPING_ERRORS,
  MAPPING_ERROR_LABELS,
  SPACESELLER_PRODUCTS,
  isInSpaceSellerScope,
  orderInSpaceSellerScope,
  PACK_COMPOSITION,
  packComponents,
} from "../shared/spaceseller-mapping.js";

/* ── Fixtures ─────────────────────────────────────────────────────────── */

function anOrder(over = {}) {
  return {
    id: "ord_1",
    orderNumber: "NK-TEST-0001",
    quantity: 1,
    totalPrice: 29900, // centimes
    note: null,
    spacesellerOrderId: null,
    spacesellerUuid: null,
    spacesellerSyncStatus: null,
    spacesellerSyncedAt: null,
    customer: { fullName: "Ahmed Benali", phone: "0612345678", city: "الدار البيضاء", address: "123 شارع مثال" },
    // A genuine single product. Both local "PACK" products decompose into
    // several Space Seller lines, so neither can stand in for the simple case.
    items: [{ product: { sku: "BEL-WG-001", name: "Bellevia Weight Gain", slug: "bellevia-weight-gain" } }],
    ...over,
  };
}

/* ── 1. Mapping ───────────────────────────────────────────────────────── */

test("centimes convert to decimal MAD only at the boundary", () => {
  assert.equal(centimesToMad(29900), 299);
  assert.equal(centimesToMad(44900), 449);
  assert.equal(centimesToMad(32050), 320.5);
});

test("a valid order maps to the documented body", () => {
  const r = buildSpaceSellerOrder(anOrder());
  assert.equal(r.ok, true);
  assert.equal(r.body.fullname, "Ahmed Benali");
  assert.equal(r.body.phone, "0612345678");
  assert.equal(r.body.total_price, 299);
  assert.deepEqual(r.body.products, [{ sku: "BEL-WG-001", quantity: 1, unit_price: 299 }]);
});

test("id_city is never sent — no verified mapping exists", () => {
  const r = buildSpaceSellerOrder(anOrder());
  assert.ok(!("id_city" in r.body), "id_city must be absent rather than guessed");
});

test("the city is preserved by appending it to the address", () => {
  const r = buildSpaceSellerOrder(anOrder());
  assert.match(r.body.address, /123 شارع مثال/);
  assert.match(r.body.address, /الدار البيضاء/);
});

test("the local order number travels in the note, for human tracing", () => {
  const r = buildSpaceSellerOrder(anOrder({ note: "قبل 18h" }));
  assert.match(r.body.note, /قبل 18h/);
  assert.match(r.body.note, /NK-TEST-0001/);
});

test("phone is sent in the stored Moroccan local form, not rewritten", () => {
  // Space Seller's own example uses 0612345678. Unlike WhatsApp, normalising to
  // 212… here would be inventing a format the API never asked for.
  const r = buildSpaceSellerOrder(anOrder({ customer: { ...anOrder().customer, phone: "0655112233" } }));
  assert.equal(r.body.phone, "0655112233");
});

/* ── 2. Pack pricing: the total is authoritative ──────────────────────── */

test("unit_price is sent when the discounted total divides exactly", () => {
  // 5 × 349 = 1745 — divides cleanly, so the line reconciles with the total.
  const r = buildSpaceSellerOrder(anOrder({ quantity: 5, totalPrice: 174500 }));
  assert.equal(r.body.total_price, 1745);
  assert.equal(r.body.products[0].quantity, 5);
  assert.equal(r.body.products[0].unit_price, 349);
});

test("unit_price is OMITTED when a pack discount will not divide evenly", () => {
  // The real case: three weight-gain at a catalog 199 are charged 449, not 597.
  // 44900 / 3 = 14966.67 centimes — no honest 2-decimal unit price exists, so
  // none is sent. total_price is what the courier collects.
  const r = buildSpaceSellerOrder(anOrder({ quantity: 3, totalPrice: 44900 }));
  assert.equal(r.body.total_price, 449);
  assert.equal(r.body.products[0].quantity, 3);
  assert.ok(!("unit_price" in r.body.products[0]), "must not invent a rounded unit price");
});

test("a sent unit_price always multiplies back to total_price", () => {
  for (const [qty, total] of [[1, 29900], [2, 54900], [5, 174500], [3, 44900], [4, 32000]]) {
    const r = buildSpaceSellerOrder(anOrder({ quantity: qty, totalPrice: total }));
    const line = r.body.products[0];
    if ("unit_price" in line) {
      assert.equal(
        Math.round(line.unit_price * line.quantity * 100),
        total,
        `qty ${qty} total ${total}: unit_price must reconcile exactly`,
      );
    }
  }
});

/* ── 3. Safe refusals — never a guessed value ─────────────────────────── */

test("a missing SKU refuses rather than substituting one", () => {
  const r = buildSpaceSellerOrder(anOrder({ items: [{ product: { sku: null, name: "BelleVia Anti-Lice" } }] }));
  assert.equal(r.ok, false);
  assert.equal(r.error, MAPPING_ERRORS.MISSING_SKU);
  assert.match(r.detail, /Anti-Lice/);
  assert.ok(MAPPING_ERROR_LABELS[r.error], "the admin gets a readable reason");
});

test("an empty-string SKU is treated as missing", () => {
  const r = buildSpaceSellerOrder(anOrder({ items: [{ product: { sku: "   ", name: "X" } }] }));
  assert.equal(r.ok, false);
  assert.equal(r.error, MAPPING_ERRORS.MISSING_SKU);
});

test("a missing phone refuses", () => {
  const r = buildSpaceSellerOrder(anOrder({ customer: { ...anOrder().customer, phone: "" } }));
  assert.equal(r.ok, false);
  assert.equal(r.error, MAPPING_ERRORS.MISSING_PHONE);
});

test("a missing name refuses", () => {
  const r = buildSpaceSellerOrder(anOrder({ customer: { ...anOrder().customer, fullName: "  " } }));
  assert.equal(r.ok, false);
  assert.equal(r.error, MAPPING_ERRORS.MISSING_NAME);
});

test("an order with no items refuses", () => {
  const r = buildSpaceSellerOrder(anOrder({ items: [] }));
  assert.equal(r.ok, false);
  assert.equal(r.error, MAPPING_ERRORS.MISSING_PRODUCT);
});

test("a nonsensical quantity refuses", () => {
  for (const q of [0, -1, 1.5, "two", null]) {
    const r = buildSpaceSellerOrder(anOrder({ quantity: q }));
    assert.equal(r.ok, false, `quantity ${q} must refuse`);
    assert.equal(r.error, MAPPING_ERRORS.INVALID_QUANTITY);
  }
});

test("the mapper never throws, whatever it is handed", () => {
  for (const bad of [null, undefined, {}, { customer: null }, { items: "x" }]) {
    const r = buildSpaceSellerOrder(bad);
    assert.equal(r.ok, false);
    assert.ok(typeof r.error === "string");
  }
});

/* ── 4. The once-only claim ───────────────────────────────────────────── */

/* SQL three-valued logic.

   The previous version of this mock evaluated the WHERE in plain JavaScript,
   where `null !== "PENDING"` is simply true. PostgreSQL says otherwise: any
   comparison against NULL is UNKNOWN, only TRUE matches a row, and NOT UNKNOWN
   is still UNKNOWN. That difference let a claim which matched 0 of 92
   production rows pass its test. So the mock now models SQL, not JavaScript. */
const TRUE = true;
const FALSE = false;
const UNKNOWN = null;

const and3 = (a, b) => (a === FALSE || b === FALSE ? FALSE : a === UNKNOWN || b === UNKNOWN ? UNKNOWN : TRUE);
const or3 = (a, b) => (a === TRUE || b === TRUE ? TRUE : a === UNKNOWN || b === UNKNOWN ? UNKNOWN : FALSE);
const not3 = (a) => (a === UNKNOWN ? UNKNOWN : !a);

/** One `field: condition` pair, with NULL handled the way Postgres handles it. */
function evalCond(value, cond) {
  const isNull = value === null || value === undefined;
  // `field: null` compiles to IS NULL, which is a real true/false test.
  if (cond === null) return isNull ? TRUE : FALSE;
  // `field: { not: v }` compiles to `field <> v` — UNKNOWN when field is NULL.
  if (cond && typeof cond === "object" && "not" in cond) {
    return isNull ? UNKNOWN : value !== cond.not ? TRUE : FALSE;
  }
  return isNull ? UNKNOWN : value === cond ? TRUE : FALSE;
}

function matchesWhere(row, where) {
  let acc = TRUE;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      let any = FALSE;
      for (const c of cond) any = or3(any, matchesWhere(row, c));
      acc = and3(acc, any);
    } else if (key === "NOT") {
      acc = and3(acc, not3(matchesWhere(row, cond)));
    } else {
      acc = and3(acc, evalCond(row[key], cond));
    }
  }
  return acc;
}

/** The claim predicate exactly as spacesellerSync.ts issues it. */
const claimWhere = (id) => ({
  id,
  spacesellerOrderId: null,
  spacesellerUuid: null,
  OR: [{ spacesellerSyncStatus: null }, { spacesellerSyncStatus: { not: "PENDING" } }],
});

/* An in-memory stand-in for Prisma, reproducing the one behaviour that makes
   the claim atomic: updateMany reports how many rows its WHERE actually
   matched — and only rows where the predicate is TRUE, never UNKNOWN. */
function mockDb(order) {
  const row = { ...order };
  return {
    row,
    order: {
      findUnique: async () => ({ ...row }),
      update: async ({ data }) => {
        for (const [k, v] of Object.entries(data)) if (v !== undefined) row[k] = v;
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        if (matchesWhere(row, where) !== TRUE) return { count: 0 };
        for (const [k, v] of Object.entries(data)) row[k] = v;
        return { count: 1 };
      },
    },
  };
}

test("a NULL sync status IS claimable — the regression that broke every order", async () => {
  // Every order that has never been attempted carries NULL here. When the
  // predicate excluded NULL, 0 of 92 production orders could be claimed and the
  // sync could not fire for anything, ever.
  const db = mockDb(anOrder());
  assert.equal(db.row.spacesellerSyncStatus, null, "precondition: never attempted");
  const res = await db.order.updateMany({
    where: claimWhere("ord_1"),
    data: { spacesellerSyncStatus: "PENDING" },
  });
  assert.equal(res.count, 1, "a never-attempted order must be claimable");
  assert.equal(db.row.spacesellerSyncStatus, "PENDING", "and the row must actually flip");
});

test("the OLD predicate is still proven broken, so it cannot quietly come back", async () => {
  const db = mockDb(anOrder());
  const res = await db.order.updateMany({
    // The shape that shipped. Under SQL semantics it matches nothing.
    where: {
      id: "ord_1",
      spacesellerOrderId: null,
      spacesellerUuid: null,
      NOT: { spacesellerSyncStatus: "PENDING" },
    },
    data: { spacesellerSyncStatus: "PENDING" },
  });
  assert.equal(res.count, 0, "NOT status = 'PENDING' is UNKNOWN for NULL — this was the defect");
});

test("two concurrent claims produce exactly one winner", async () => {
  const db = mockDb(anOrder());
  const claim = () =>
    db.order.updateMany({ where: claimWhere("ord_1"), data: { spacesellerSyncStatus: "PENDING" } });
  const [a, b] = await Promise.all([claim(), claim()]);
  assert.equal([a.count, b.count].filter((c) => c === 1).length, 1, "exactly one caller may send");
});

test("an order that already carries an upstream id can never claim again", async () => {
  const db = mockDb(anOrder({ spacesellerOrderId: "SS-1001", spacesellerSyncStatus: "SYNCED" }));
  const res = await db.order.updateMany({
    where: claimWhere("ord_1"),
    data: { spacesellerSyncStatus: "PENDING" },
  });
  assert.equal(res.count, 0, "a synced order must never be re-sent");
});

test("an order carrying only an upstream uuid can never claim again", async () => {
  const db = mockDb(anOrder({ spacesellerUuid: "u-2002", spacesellerSyncStatus: "SYNCED" }));
  const res = await db.order.updateMany({
    where: claimWhere("ord_1"),
    data: { spacesellerSyncStatus: "PENDING" },
  });
  assert.equal(res.count, 0, "the uuid alone also proves it exists upstream");
});

test("a held PENDING claim blocks another attempt", async () => {
  const db = mockDb(anOrder({ spacesellerSyncStatus: "PENDING" }));
  const res = await db.order.updateMany({
    where: claimWhere("ord_1"),
    data: { spacesellerSyncStatus: "PENDING" },
  });
  assert.equal(res.count, 0, "an unresolved attempt is never piled on top of");
});

test("FAILED and SKIPPED orders stay claimable, so a human retry can work", async () => {
  for (const status of ["FAILED", "SKIPPED"]) {
    const db = mockDb(anOrder({ spacesellerSyncStatus: status }));
    const res = await db.order.updateMany({
      where: claimWhere("ord_1"),
      data: { spacesellerSyncStatus: "PENDING" },
    });
    assert.equal(res.count, 1, `${status} must be retryable`);
  }
});

test("the mock now models SQL's three-valued logic, not JavaScript's", async () => {
  // Guards the guard: if this ever reverts to JS truthiness, the claim bug
  // becomes invisible again.
  assert.equal(evalCond(null, { not: "PENDING" }), UNKNOWN, "NULL <> 'PENDING' is UNKNOWN in SQL");
  assert.equal(evalCond(null, null), TRUE, "field: null compiles to IS NULL");
  assert.equal(evalCond("FAILED", { not: "PENDING" }), TRUE);
  assert.equal(evalCond("PENDING", { not: "PENDING" }), FALSE);
  assert.equal(not3(UNKNOWN), UNKNOWN, "NOT UNKNOWN stays UNKNOWN");
  assert.equal(and3(TRUE, UNKNOWN), UNKNOWN);
  assert.equal(or3(TRUE, UNKNOWN), TRUE);
});

/* ── 5. Opportunistic refresh threshold ───────────────────────────────── */

test("refresh is skipped for an order that was never synced", () => {
  assert.equal(shouldRefresh({ spacesellerOrderId: null, spacesellerUuid: null }), false);
});

test("refresh triggers only once the stored status is stale", () => {
  const now = Date.now();
  assert.equal(shouldRefresh({ spacesellerOrderId: "SS-1", spacesellerSyncedAt: new Date(now - 60_000) }, now), false);
  assert.equal(shouldRefresh({ spacesellerOrderId: "SS-1", spacesellerSyncedAt: new Date(now - 30 * 60_000) }, now), true);
  assert.equal(shouldRefresh({ spacesellerOrderId: "SS-1", spacesellerSyncedAt: null }, now), true);
});

/* ── 6. Secrets never travel with the data ────────────────────────────── */

test("a mapped body carries no credential of any kind", () => {
  const serialized = JSON.stringify(buildSpaceSellerOrder(anOrder()).body);
  for (const forbidden of ["token", "Bearer", "authorization", "SPACESELLER"]) {
    assert.ok(!serialized.toLowerCase().includes(forbidden.toLowerCase()), `body must not contain ${forbidden}`);
  }
});

/* ── 7. Error classification — the duplicate-safety judgement ─────────────
   This is the most safety-critical decision in the integration. Calling an
   "unknown" a "rejected" invites a second parcel to a real address. */

test("a definite refusal is rejected — nothing was created", () => {
  for (const status of [400, 401, 403, 404, 409, 422]) {
    assert.equal(classifyStatus(status), "rejected", `${status} is a definite no`);
    assert.equal(isRetriable(status), false, `${status} must not be auto-retried as unknown`);
  }
});

test("401 invalid token is rejected, not retried forever", () => {
  assert.equal(classifyStatus(401), "rejected");
});

test("422 validation error is rejected — the payload will not improve on its own", () => {
  assert.equal(classifyStatus(422), "rejected");
});

test("404 order not found is rejected", () => {
  assert.equal(classifyStatus(404), "rejected");
});

test("a timeout or network failure is UNKNOWN — the order may exist upstream", () => {
  assert.equal(classifyStatus(undefined), "unknown");
  assert.equal(classifyStatus(null), "unknown");
});

test("5xx, 408 and 429 are unknown, because the request may have been processed", () => {
  for (const status of [500, 502, 503, 504, 408, 429]) {
    assert.equal(classifyStatus(status), "unknown", `${status} must not be treated as a clean refusal`);
  }
});

test("2xx is ok", () => {
  for (const status of [200, 201, 202]) assert.equal(classifyStatus(status), "ok");
});

/* ── 8. No secret ever survives into stored text ─────────────────────────── */

test("an upstream message carrying a bearer token is scrubbed", () => {
  const dirty = 'Unauthenticated. header Authorization: Bearer sk_live_abcdef123456789 rejected';
  const clean = scrubUpstream(dirty);
  assert.ok(!clean.includes("sk_live_abcdef123456789"), "the token must not survive");
  assert.ok(clean.includes("***"), "the redaction marker replaces it");
});

test("a JSON error echoing a token field is scrubbed", () => {
  const clean = scrubUpstream('{"error":"bad","token":"abcdef1234567890"}');
  assert.ok(!clean.includes("abcdef1234567890"));
});

test("scrubbed detail is bounded, so a huge upstream body cannot fill the column", () => {
  assert.ok(scrubUpstream("x".repeat(5000)).length <= 300);
});

test("scrubbing tolerates non-strings without throwing", () => {
  for (const v of [null, undefined, 42, {}]) assert.equal(typeof scrubUpstream(v), "string");
});

/* ── 8. Fulfilment scope ──────────────────────────────────────────────────
   Space Seller ships some of this store's products, not all of them. These
   tests pin the boundary, because getting it wrong in either direction is
   expensive: a product wrongly excluded silently stops being fulfilled, and a
   product wrongly included sends a real parcel to a partner who does not
   stock it. */

test("scope holds exactly the four Bellevia products Space Seller fulfils", () => {
  assert.deepEqual([...SPACESELLER_PRODUCTS].sort(), [
    "bellevia-anti-joint-pain",
    "bellevia-anti-lice",
    "bellevia-pack-raha",
    "bellevia-weight-gain",
  ]);
});

test("cache-terazo and lilya-talon are fulfilled elsewhere, so they never sync", () => {
  assert.equal(isInSpaceSellerScope("cache-terazo"), false);
  assert.equal(isInSpaceSellerScope("lilya-talon"), false);
});

test("being outside the scope is not a missing SKU — the two must not be confused", () => {
  // cache-terazo has no Space Seller SKU and never needs one. It must be
  // recognised as out of scope, which is silent, rather than as a blocked
  // order waiting on a SKU somebody has to go and find.
  const order = anOrder({
    items: [{ product: { sku: null, name: "بوركيني Cache Terazo", slug: "cache-terazo" } }],
  });
  assert.equal(orderInSpaceSellerScope(order).inScope, false);
});

test("an in-scope product with no SKU stays blocked rather than being skipped quietly", () => {
  // The inverse of the cache-terazo case: a product Space Seller DOES fulfil,
  // with no SKU, is a real blocker that must surface — never routed away as
  // though somebody else were shipping it.
  const order = anOrder({
    items: [{ product: { sku: null, name: "Bellevia Weight Gain", slug: "bellevia-weight-gain" } }],
  });
  assert.equal(orderInSpaceSellerScope(order).inScope, true);
  assert.equal(buildSpaceSellerOrder(order).error, MAPPING_ERRORS.MISSING_SKU);
});

test("every in-scope product maps to a sendable body", () => {
  // Two kinds of product, and the difference is the whole point: a single
  // product ships under its own SKU, a pack under its components'.
  const single = {
    "bellevia-weight-gain": "BEL-WG-001",
    "bellevia-anti-joint-pain": "BVP-AJP-001",
  };
  const packs = {
    "bellevia-anti-lice": ["anti-poux", "shampoux"],
    "bellevia-pack-raha": ["huil-anti-chute", "sham-anti-chute", "spray-anti-chute"],
  };

  for (const [slug, sku] of Object.entries(single)) {
    const order = anOrder({ items: [{ product: { sku, name: slug, slug } }] });
    assert.equal(orderInSpaceSellerScope(order).inScope, true, slug);
    const r = buildSpaceSellerOrder(order);
    assert.equal(r.ok, true, slug);
    assert.deepEqual(r.body.products.map((p) => p.sku), [sku], slug);
  }

  for (const [slug, expected] of Object.entries(packs)) {
    // Passing a local SKU here on purpose: a pack must ignore it.
    const order = anOrder({ items: [{ product: { sku: "LOCAL-ONLY", name: slug, slug } }] });
    assert.equal(orderInSpaceSellerScope(order).inScope, true, slug);
    const r = buildSpaceSellerOrder(order);
    assert.equal(r.ok, true, slug);
    assert.deepEqual(r.body.products.map((p) => p.sku).sort(), [...expected].sort(), slug);
  }

  // Every in-scope product is covered by exactly one of the two groups above.
  assert.deepEqual(
    [...Object.keys(single), ...Object.keys(packs)].sort(),
    [...SPACESELLER_PRODUCTS].sort(),
  );
});

test("the scope decision never throws, whatever the order looks like", () => {
  for (const bad of [null, undefined, {}, { items: null }, { items: [{}] }, { items: [{ product: {} }] }]) {
    assert.equal(orderInSpaceSellerScope(bad).inScope, false);
  }
  for (const bad of [null, undefined, 42, {}, ""]) {
    assert.equal(isInSpaceSellerScope(bad), false);
  }
});

test("a slug is matched exactly — no prefix or substring may sneak into scope", () => {
  assert.equal(isInSpaceSellerScope("bellevia"), false);
  assert.equal(isInSpaceSellerScope("bellevia-anti-lice-v2"), false);
  assert.equal(isInSpaceSellerScope("not-bellevia-pack-raha"), false);
  assert.equal(isInSpaceSellerScope("  bellevia-pack-raha  "), true, "stored slugs may carry whitespace");
});

/* ── 9. Per-item quantity ─────────────────────────────────────────────────
   Production writes one OrderItem per unit and leaves quantity at 1, so today
   these two readings agree. The column exists though, and the cart branch
   writes it, so the mapper sums it rather than counting rows. */

test("today's data — one row per unit — maps to Order.quantity", () => {
  const order = anOrder({
    quantity: 3,
    totalPrice: 44900,
    items: Array.from({ length: 3 }, () => ({
      quantity: 1,
      product: { sku: "BEL-WG-001", name: "Weight Gain", slug: "bellevia-weight-gain" },
    })),
  });
  const r = buildSpaceSellerOrder(order);
  assert.equal(r.body.products.length, 1);
  assert.equal(r.body.products[0].quantity, 3);
});

test("a mixed order sums each line's own quantity, never the row count", () => {
  const order = anOrder({
    quantity: 5,
    totalPrice: 100000,
    items: [
      { quantity: 2, product: { sku: "BEL-WG-001", name: "WG", slug: "bellevia-weight-gain" } },
      { quantity: 3, product: { sku: "BVP-AJP-001", name: "AJP", slug: "bellevia-anti-joint-pain" } },
    ],
  });
  const r = buildSpaceSellerOrder(order);
  const bySku = Object.fromEntries(r.body.products.map((p) => [p.sku, p.quantity]));
  assert.deepEqual(bySku, { "BEL-WG-001": 2, "BVP-AJP-001": 3 });
  // Two products means no honest per-line unit price, so none is sent.
  for (const line of r.body.products) {
    assert.ok(!("unit_price" in line), "a mixed order cannot attribute the discount per line");
  }
});

test("a missing or nonsensical item quantity falls back to one unit", () => {
  for (const q of [undefined, null, 0, -2, 1.5, "3"]) {
    const order = anOrder({
      quantity: 1,
      items: [{ quantity: q, product: { sku: "BVP-RAHA-001", name: "RAHA", slug: "bellevia-pack-raha" } }],
    });
    const r = buildSpaceSellerOrder(order);
    assert.equal(r.ok, true, `quantity ${q}`);
    assert.equal(r.body.products[0].quantity, 1);
  }
});

/* ── 10. Packs expand into their components ───────────────────────────────
   Anti-Lice is one product locally and two to Space Seller. These tests pin
   both halves: that a pack expands with the right quantities, and that it
   refuses entirely while any component SKU is still unknown. */

/** The pack, with its component SKUs supplied — as they will be once known. */
function withComponentSkus(a = "SS-SERUM", b = "SS-SHAMPOO") {
  const original = PACK_COMPOSITION["bellevia-anti-lice"].map((c) => ({ ...c }));
  PACK_COMPOSITION["bellevia-anti-lice"][0].sku = a;
  PACK_COMPOSITION["bellevia-anti-lice"][1].sku = b;
  return () => {
    PACK_COMPOSITION["bellevia-anti-lice"].splice(0, 2, ...original);
  };
}

function antiLiceOrder(packs) {
  return anOrder({
    quantity: packs,
    totalPrice: 29900 * packs,
    items: Array.from({ length: packs }, () => ({
      quantity: 1,
      product: { sku: null, name: "BelleVia Anti-Lice", slug: "bellevia-anti-lice" },
    })),
  });
}

test("the Anti-Lice pack is declared as two components, not one SKU", () => {
  const comps = packComponents("bellevia-anti-lice");
  assert.equal(comps.length, 2, "the pack holds exactly two products");
  assert.match(comps[0].component, /سيروم/);
  assert.match(comps[1].component, /شامبو/);
  for (const c of comps) assert.equal(c.perPack, 1, "one of each per pack");
});

test("a product that is not a pack has no composition", () => {
  for (const slug of ["bellevia-weight-gain", "bellevia-anti-joint-pain", "cache-terazo", "", null]) {
    assert.equal(packComponents(slug), null, String(slug));
  }
});

test("PACK RAHA is three components, and its local SKU is never sent", () => {
  const comps = packComponents("bellevia-pack-raha");
  assert.equal(comps.length, 3);
  const bySku = Object.fromEntries(comps.map((c) => [c.sku, c.component]));
  assert.match(bySku["huil-anti-chute"], /^زيت/, "huil = the 60ml oil");
  assert.match(bySku["sham-anti-chute"], /^شامبو/, "sham = the 150ml shampoo");
  assert.match(bySku["spray-anti-chute"], /^رشاش/, "spray = the 100ml spray");
  for (const c of comps) assert.equal(c.perPack, 1);

  // The local pack SKU exists in the catalog but must never reach Space Seller,
  // who has no such product to pick.
  const order = anOrder({
    items: [{ quantity: 1, product: { sku: "BVP-RAHA-001", name: "PACK RAHA", slug: "bellevia-pack-raha" } }],
  });
  const skus = buildSpaceSellerOrder(order).body.products.map((p) => p.sku);
  assert.ok(!skus.includes("BVP-RAHA-001"), "BVP-RAHA-001 is local-only");
  assert.deepEqual(skus, ["huil-anti-chute", "sham-anti-chute", "spray-anti-chute"]);
});

test("2 Pack Raha become three lines of quantity 2", () => {
  const order = anOrder({
    quantity: 2,
    totalPrice: 80000,
    items: Array.from({ length: 2 }, () => ({
      quantity: 1,
      product: { sku: "BVP-RAHA-001", name: "PACK RAHA", slug: "bellevia-pack-raha" },
    })),
  });
  const r = buildSpaceSellerOrder(order);
  assert.equal(r.ok, true);
  assert.deepEqual(r.body.products, [
    { sku: "huil-anti-chute", quantity: 2 },
    { sku: "sham-anti-chute", quantity: 2 },
    { sku: "spray-anti-chute", quantity: 2 },
  ]);
  assert.equal(r.body.total_price, 800);
  // 400 MAD across three different bottles cannot be split honestly.
  for (const line of r.body.products) assert.ok(!("unit_price" in line));
});

test("the two packs never contaminate each other's SKUs", () => {
  const lice = packComponents("bellevia-anti-lice").map((c) => c.sku);
  const raha = packComponents("bellevia-pack-raha").map((c) => c.sku);
  assert.equal(lice.filter((s) => raha.includes(s)).length, 0, "no SKU belongs to both packs");
  for (const s of [...lice, ...raha]) {
    assert.equal(s, s.trim(), `${s} must be stored without surrounding whitespace`);
  }
});

test("1 pack becomes two lines, one of each component", () => {
  const r = buildSpaceSellerOrder(antiLiceOrder(1));
  assert.equal(r.ok, true);
  assert.deepEqual(r.body.products, [
    { sku: "anti-poux", quantity: 1 },
    { sku: "shampoux", quantity: 1 },
  ]);
  assert.equal(r.body.total_price, 299);
});

test("2 packs become two lines of quantity 2 — never one line of 2", () => {
  const r = buildSpaceSellerOrder(antiLiceOrder(2));
  assert.equal(r.ok, true);
  assert.deepEqual(r.body.products, [
    { sku: "anti-poux", quantity: 2 },
    { sku: "shampoux", quantity: 2 },
  ]);
  assert.equal(r.body.total_price, 598);
});

test("a pack never carries unit_price — 299 cannot be split between two items", () => {
  for (const packs of [1, 2, 3]) {
    const r = buildSpaceSellerOrder(antiLiceOrder(packs));
    for (const line of r.body.products) {
      assert.ok(!("unit_price" in line), `${packs} pack(s): no honest per-component price exists`);
    }
  }
});

test("the whole order refuses while EITHER component SKU is unknown", () => {
  // Half a pack shipped is worse than nothing shipped: it looks complete.
  for (const [a, b] of [[null, "SS-SHAMPOO"], ["SS-SERUM", null], [null, null], ["  ", "SS-SHAMPOO"]]) {
    const restore = withComponentSkus(a, b);
    try {
      const r = buildSpaceSellerOrder(antiLiceOrder(1));
      assert.equal(r.ok, false, `serum=${a} shampoo=${b}`);
      assert.equal(r.error, MAPPING_ERRORS.MISSING_COMPONENT_SKU);
      assert.ok(MAPPING_ERROR_LABELS[r.error], "the admin gets a readable reason");
    } finally {
      restore();
    }
  }
});

test("the configured SKUs are the confirmed ones, each on the right component", () => {
  // Pinned verbatim. These two are easy to transpose — "shampoux" is the
  // shampoo and "anti-poux" the serum — and a swap would send the warehouse
  // the wrong bottle without anything failing.
  const bySku = Object.fromEntries(
    packComponents("bellevia-anti-lice").map((c) => [c.sku, c.component]),
  );
  assert.match(bySku["shampoux"], /^شامبو/, "shampoux must be the 150ml shampoo");
  assert.match(bySku["anti-poux"], /^سيروم/, "anti-poux must be the 30ml serum");
  assert.equal(Object.keys(bySku).length, 2);
});

test("as configured today, a live Anti-Lice order maps to both real SKUs", () => {
  const r = buildSpaceSellerOrder(antiLiceOrder(1));
  assert.equal(r.ok, true);
  assert.deepEqual(r.body.products, [
    { sku: "anti-poux", quantity: 1 },
    { sku: "shampoux", quantity: 1 },
  ]);
});

test("the pack's own slug is never sent as a SKU", () => {
  for (const packs of [1, 2, 3]) {
    const skus = buildSpaceSellerOrder(antiLiceOrder(packs)).body.products.map((p) => p.sku);
    assert.ok(!skus.includes("bellevia-anti-lice"), "the pack has no Space Seller SKU of its own");
    assert.deepEqual(skus.sort(), ["anti-poux", "shampoux"]);
  }
});

test("a pack ordered alongside a normal product keeps both mappings straight", () => {
  const r = buildSpaceSellerOrder(
    anOrder({
      quantity: 3,
      totalPrice: 90000,
      items: [
        { quantity: 2, product: { sku: null, name: "Anti-Lice", slug: "bellevia-anti-lice" } },
        { quantity: 1, product: { sku: "BEL-WG-001", name: "WG", slug: "bellevia-weight-gain" } },
      ],
    }),
  );
  assert.equal(r.ok, true);
  const bySku = Object.fromEntries(r.body.products.map((p) => [p.sku, p.quantity]));
  assert.deepEqual(bySku, { "anti-poux": 2, shampoux: 2, "BEL-WG-001": 1 });
});

test("two different packs in one order expand independently", () => {
  const r = buildSpaceSellerOrder(
    anOrder({
      quantity: 3,
      totalPrice: 109700,
      items: [
        { quantity: 1, product: { sku: null, name: "Anti-Lice", slug: "bellevia-anti-lice" } },
        { quantity: 2, product: { sku: "BVP-RAHA-001", name: "RAHA", slug: "bellevia-pack-raha" } },
      ],
    }),
  );
  assert.equal(r.ok, true);
  const bySku = Object.fromEntries(r.body.products.map((p) => [p.sku, p.quantity]));
  assert.deepEqual(bySku, {
    "anti-poux": 1,
    shampoux: 1,
    "huil-anti-chute": 2,
    "sham-anti-chute": 2,
    "spray-anti-chute": 2,
  });
});
