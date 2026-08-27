// The dashboard's view of Space Seller state.
//
// These exist because a SYNCED order rendered as "never attempted" in
// production. The list endpoint never returned the block, nothing fetched the
// detail endpoint, and the optimistic update bailed out when the block was
// absent — three separate ways to show the wrong thing about a real parcel.
//
// The functions under test are the ones the app actually runs: the endpoints
// build their block with toSpaceSellerBlock, the drawer renders spacesellerView,
// and the retry handler folds its response with mergeSpaceSellerResult.
import test from "node:test";
import assert from "node:assert/strict";

import {
  toSpaceSellerBlock,
  spacesellerView,
  mergeSpaceSellerResult,
  EMPTY_SPACESELLER,
  SPACESELLER_META,
} from "../shared/spaceseller-view.js";

/** An order row as Prisma hands it to either endpoint. */
function row(over = {}) {
  return {
    id: "ord_1",
    orderNumber: "NK-TEST-0001",
    spacesellerSyncStatus: null,
    spacesellerOrderId: null,
    spacesellerUuid: null,
    spacesellerStatus: null,
    spacesellerDeliveryStatus: null,
    spacesellerTrackingNumber: null,
    spacesellerSyncedAt: null,
    spacesellerLastError: null,
    ...over,
  };
}

/* ── 1. The list endpoint must carry a synced order's identity ──────────── */

test("a SYNCED order maps to a block carrying its status and Space Seller id", () => {
  // The real production row: NK-MTBIK6Y0-7L3Q, Space Seller order 507071.
  const block = toSpaceSellerBlock(
    row({
      spacesellerSyncStatus: "SYNCED",
      spacesellerOrderId: "507071",
      spacesellerUuid: "c0eb975e-9a96-5066-bdbe-e582e34b9194",
      spacesellerSyncedAt: new Date("2026-08-27T11:27:40.427Z"),
    }),
  );
  assert.equal(block.syncStatus, "SYNCED");
  assert.equal(block.orderId, "507071");
  assert.equal(block.uuid, "c0eb975e-9a96-5066-bdbe-e582e34b9194");
  assert.ok(block.syncedAt, "the sync time travels with it");
  assert.equal(block.error, null);
});

test("the block always has all eight keys, so the drawer never reads undefined", () => {
  for (const r of [row(), row({ spacesellerSyncStatus: "SYNCED" }), null, undefined]) {
    const block = toSpaceSellerBlock(r);
    assert.deepEqual(Object.keys(block).sort(), Object.keys(EMPTY_SPACESELLER).sort());
  }
});

test("an untouched order maps to all-null rather than to missing keys", () => {
  assert.deepEqual(toSpaceSellerBlock(row()), { ...EMPTY_SPACESELLER });
});

test("a SYNCED order renders as sent, never as 'not attempted'", () => {
  const view = spacesellerView(toSpaceSellerBlock(row({
    spacesellerSyncStatus: "SYNCED",
    spacesellerOrderId: "507071",
  })));
  assert.equal(view.label, SPACESELLER_META.SYNCED.label);
  assert.equal(view.tone, "success");
  assert.notEqual(view.label, "ما تجرباتش بعد", "this exact confusion is the bug being fixed");
});

/* ── 2. A never-attempted order still reads as never attempted ──────────── */

test("a NULL status still displays 'ما تجرباتش بعد'", () => {
  for (const ss of [toSpaceSellerBlock(row()), null, undefined, {}, { syncStatus: null }]) {
    const view = spacesellerView(ss);
    assert.equal(view.label, "ما تجرباتش بعد");
    assert.equal(view.tone, "neutral");
    assert.equal(view.retryable, true, "the Retry button is the cure, so it must be offered");
    assert.equal(view.noteTone, "muted", "never-attempted is not an error");
  }
});

test("never-attempted and SKIPPED do not share wording", () => {
  const never = spacesellerView(null).label;
  const skipped = spacesellerView({ syncStatus: "SKIPPED" }).label;
  assert.notEqual(never, skipped, "these were identical, which is what misled the operator");
});

test("out of scope stays its own state, and offers no retry", () => {
  const view = spacesellerView({ syncStatus: "SKIPPED", error: "out_of_scope" });
  assert.match(view.label, /خارج نطاق/);
  assert.equal(view.retryable, false, "retrying a product somebody else ships is meaningless");
});

test("contention is muted, a real failure is not", () => {
  for (const err of ["claim_lost", "already_pending"]) {
    assert.equal(spacesellerView({ syncStatus: "PENDING", error: err }).noteTone, "muted", err);
  }
  assert.equal(spacesellerView({ syncStatus: "FAILED", error: "422: bad sku" }).noteTone, "danger");
});

/* ── 3. The optimistic update must survive a missing block ──────────────── */

test("a successful retry updates the drawer even when no block was loaded", () => {
  // The exact production case: the list returned no spaceseller block, so the
  // old guard `sel.spaceseller && …` was falsy and the update was skipped —
  // a real sync looked like it had done nothing.
  const merged = mergeSpaceSellerResult(undefined, {
    ok: true,
    status: "SYNCED",
    spacesellerOrderId: "507071",
    spacesellerUuid: "c0eb975e-9a96-5066-bdbe-e582e34b9194",
    error: null,
  });
  assert.equal(merged.syncStatus, "SYNCED");
  assert.equal(merged.orderId, "507071");
  assert.equal(merged.uuid, "c0eb975e-9a96-5066-bdbe-e582e34b9194");
});

test("the merge tolerates null, undefined and an empty previous block alike", () => {
  for (const prev of [null, undefined, {}, { ...EMPTY_SPACESELLER }]) {
    const merged = mergeSpaceSellerResult(prev, { status: "SYNCED", spacesellerOrderId: "1" });
    assert.equal(merged.syncStatus, "SYNCED");
    assert.equal(merged.orderId, "1");
  }
});

test("a refresh folds in delivery status and tracking without losing the ids", () => {
  const prev = toSpaceSellerBlock(row({
    spacesellerSyncStatus: "SYNCED",
    spacesellerOrderId: "507071",
  }));
  const merged = mergeSpaceSellerResult(prev, {
    ok: true,
    upstreamStatus: "CONFIRMED",
    deliveryStatus: "P_UNPACKED",
    trackingNumber: "TRK-9",
    error: null,
  });
  assert.equal(merged.orderId, "507071", "a refresh must not drop the id it already had");
  assert.equal(merged.status, "CONFIRMED");
  assert.equal(merged.deliveryStatus, "P_UNPACKED");
  assert.equal(merged.trackingNumber, "TRK-9");
});

test("a response that omits a field never erases what is already known", () => {
  const prev = toSpaceSellerBlock(row({
    spacesellerSyncStatus: "SYNCED",
    spacesellerOrderId: "507071",
    spacesellerTrackingNumber: "TRK-9",
  }));
  const merged = mergeSpaceSellerResult(prev, { ok: false, error: "network" });
  assert.equal(merged.orderId, "507071");
  assert.equal(merged.trackingNumber, "TRK-9");
  assert.equal(merged.error, "network");
});

test("a success clears a stale error", () => {
  const prev = { ...EMPTY_SPACESELLER, syncStatus: "FAILED", error: "422: bad sku" };
  const merged = mergeSpaceSellerResult(prev, { ok: true, status: "SYNCED", spacesellerOrderId: "9" });
  assert.equal(merged.error, null, "a resolved order must not keep showing the old reason");
});

/* ── 4. Existing protections are untouched by any of this ───────────────── */

test("the view layer never invents an id, a SKU or a status", () => {
  const view = spacesellerView(toSpaceSellerBlock(row()));
  const block = toSpaceSellerBlock(row());
  assert.equal(block.orderId, null, "no id is fabricated for an unsynced order");
  assert.equal(block.syncStatus, null);
  assert.ok(!("sku" in block), "the view carries no SKU at all");
  assert.equal(view.retryable, true);
});

test("presentation cannot mark an order synced — only the server writes that", () => {
  // mergeSpaceSellerResult only ever reflects what the endpoint returned.
  const merged = mergeSpaceSellerResult(null, { ok: false, status: "FAILED", error: "422" });
  assert.equal(merged.syncStatus, "FAILED");
  assert.equal(merged.orderId, null, "a failure must not leave an id behind");
});

test("an already-synced order keeps its id through any later response", () => {
  const prev = { ...EMPTY_SPACESELLER, syncStatus: "SYNCED", orderId: "507071" };
  for (const res of [
    { ok: false, error: "network" },
    { ok: true, status: "SYNCED", alreadySynced: true, spacesellerOrderId: "507071" },
    { ok: false, status: "PENDING", error: "claim_lost" },
  ]) {
    assert.equal(mergeSpaceSellerResult(prev, res).orderId, "507071");
  }
});
