// How Space Seller sync state is shaped for the dashboard, and how it reads.
//
// Pure: no React, no Prisma, no network. It lives here rather than inside the
// endpoints and the drawer because those cannot be imported into a test — the
// endpoints are TypeScript with extensionless imports, the drawer is TSX. The
// last time a decision like this was only reachable through a mock, the mock
// disagreed with reality and a broken claim shipped. So the real code is here
// and the tests import the same functions the app runs.

/** The shape every endpoint returns for an order's Space Seller state. */
export const EMPTY_SPACESELLER = Object.freeze({
  syncStatus: null,
  orderId: null,
  uuid: null,
  status: null,
  deliveryStatus: null,
  trackingNumber: null,
  syncedAt: null,
  error: null,
});

/**
 * Order row → the `spaceseller` block.
 *
 * Used by BOTH the list and the detail endpoint. Sharing it is the point: the
 * drawer reads whichever one loaded the order, and a SYNCED order that looked
 * un-synced in the list was exactly the bug this replaces.
 */
export function toSpaceSellerBlock(order) {
  if (!order) return { ...EMPTY_SPACESELLER };
  return {
    syncStatus: order.spacesellerSyncStatus ?? null,
    orderId: order.spacesellerOrderId ?? null,
    uuid: order.spacesellerUuid ?? null,
    status: order.spacesellerStatus ?? null,
    deliveryStatus: order.spacesellerDeliveryStatus ?? null,
    trackingNumber: order.spacesellerTrackingNumber ?? null,
    syncedAt: order.spacesellerSyncedAt ?? null,
    error: order.spacesellerLastError ?? null,
  };
}

/** Badge wording for each resolved sync status. */
export const SPACESELLER_META = Object.freeze({
  SYNCED: { label: "تم الإرسال", tone: "success" },
  PENDING: { label: "غير مؤكد — تحقق", tone: "warning" },
  FAILED: { label: "فشل", tone: "danger" },
  SKIPPED: { label: "ما تصيفطش", tone: "neutral" },
});

/** Errors that mean "someone else is already on it", not "something broke". */
const CONTENTION = new Set(["claim_lost", "already_pending"]);

/**
 * How to present the sync state.
 *
 * Three cases worth keeping apart, because conflating any two of them sends an
 * admin chasing something that did not happen:
 *   never attempted  — nothing has been tried yet; the Retry button is the cure
 *   out of scope     — another partner ships this; not a problem at all
 *   everything else  — a real, resolved outcome
 */
export function spacesellerView(ss) {
  if (ss?.error === "out_of_scope") {
    return {
      label: "خارج نطاق Space Seller",
      tone: "neutral",
      retryable: false,
      note: "هاد المنتج كيتسيفط من جهة أخرى.",
      noteTone: "muted",
    };
  }

  // No status at all means no attempt was ever made — an order placed before
  // the integration existed, or one whose attempt never ran. Saying this in the
  // same words as SKIPPED makes a never-tried order look like a failed one.
  if (!ss?.syncStatus) {
    return {
      label: "ما تجرباتش بعد",
      tone: "neutral",
      retryable: true,
      note: "هاد الطلب مازال ما تصيفطش لـ Space Seller. ضغط «إعادة المحاولة» باش تصيفطو.",
      noteTone: "muted",
    };
  }

  const meta = SPACESELLER_META[ss.syncStatus];
  return {
    label: meta?.label ?? ss.syncStatus,
    tone: meta?.tone ?? "neutral",
    retryable: true,
    note: ss.error ?? undefined,
    noteTone: CONTENTION.has(ss.error) ? "muted" : "danger",
  };
}

/**
 * Fold a retry/refresh response into the order the drawer is showing.
 *
 * `prev` may legitimately be absent — an order loaded before the list carried
 * the block at all. Skipping the update in that case is what made a successful
 * retry look like it had done nothing, so a missing `prev` starts from empty
 * rather than bailing out.
 */
export function mergeSpaceSellerResult(prev, res) {
  const base = prev ?? EMPTY_SPACESELLER;
  if (!res) return { ...base };
  return {
    ...base,
    syncStatus: res.status ?? base.syncStatus,
    orderId: res.spacesellerOrderId ?? base.orderId,
    uuid: res.spacesellerUuid ?? base.uuid,
    // A refresh reports these; a retry leaves them undefined, and undefined
    // must not erase what is already known.
    status: res.upstreamStatus ?? base.status,
    deliveryStatus: res.deliveryStatus ?? base.deliveryStatus,
    trackingNumber: res.trackingNumber ?? base.trackingNumber,
    // `error` is authoritative on every response: a success clears a stale one.
    error: res.error ?? null,
  };
}
