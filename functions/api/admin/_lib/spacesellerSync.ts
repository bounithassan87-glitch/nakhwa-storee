// Sending an order to Space Seller, at most once.
//
// Three callers share this: the checkout (automatic, right after the sale
// commits), the admin's Retry button, and the admin's Refresh Status button.
// They differ only in what they are allowed to do, so the rules live here once.
//
// Nothing in this file may fail an order. By the time it runs the sale is
// committed and the customer has been told it succeeded; an unreachable
// fulfilment partner is something to retry, never a reason to undo a sale.
import type { PrismaClient } from "@prisma/client";
import { log } from "../../../_lib/http";
import {
  spaceSellerClient,
  type SpaceSellerClient,
  type SpaceSellerEnv,
} from "../../_lib/spaceseller";
import {
  buildSpaceSellerOrder,
  MAPPING_ERRORS,
  shouldRefresh,
  OPPORTUNISTIC_REFRESH_MS,
  orderInSpaceSellerScope,
} from "../../../../shared/spaceseller-mapping.js";

// Re-exported so callers import the refresh decision from the sync module they
// already use, while the logic itself stays pure and unit-testable in shared/.
export { shouldRefresh, OPPORTUNISTIC_REFRESH_MS };

/** What the order column holds, and what the dashboard renders. */
export type SyncStatus = "PENDING" | "SYNCED" | "FAILED" | "SKIPPED";

/** Recorded when the product is fulfilled by someone other than Space Seller. */
export const SCOPE_ERROR = "out_of_scope";

export interface SyncOutcome {
  attempted: boolean;
  status?: SyncStatus;
  /** Set when the once-only claim was already taken — nothing was sent. */
  alreadySynced?: boolean;
  orderId?: string;
  uuid?: string;
  error?: string;
}

/** Selected once so every caller agrees on the shape the mapper receives. */
const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  quantity: true,
  totalPrice: true,
  note: true,
  spacesellerOrderId: true,
  spacesellerUuid: true,
  spacesellerSyncStatus: true,
  customer: { select: { fullName: true, phone: true, city: true, address: true } },
  // slug decides whether Space Seller fulfils this product at all; sku decides
  // what to call it once it does. quantity is 1 on every row written so far,
  // but it is read rather than assumed — see the mapper.
  items: {
    select: { quantity: true, product: { select: { sku: true, name: true, slug: true } } },
  },
} as const;

/**
 * Create the Space Seller order for one local order.
 *
 * The safety rules, in the order they apply:
 *
 * 1. An order that already carries an upstream id is never sent again. Not by
 *    the checkout, not by Retry, not by anything — there is no `force` here on
 *    purpose, because a duplicate is a real parcel to a real address.
 * 2. The claim is taken with a conditional UPDATE before the request leaves, so
 *    two concurrent callers cannot both reach the API.
 * 3. A definite refusal (4xx) releases the claim to FAILED, which is retryable.
 * 4. An indefinite result — timeout, 5xx, or a 2xx carrying no id — leaves the
 *    claim held at PENDING and is NOT retried automatically. The order may
 *    already exist upstream and the API offers no idempotency key and no lookup
 *    by our reference, so only a human who has checked the Space Seller
 *    dashboard may release it.
 */
export async function syncOrderToSpaceSeller(
  prisma: PrismaClient,
  env: SpaceSellerEnv,
  orderId: string,
  opts: { reqId?: string; client?: SpaceSellerClient } = {},
): Promise<SyncOutcome> {
  const { reqId } = opts;

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: ORDER_SELECT });
    if (!order) return { attempted: false, error: "order_not_found" };

    // 1 — already upstream. The strongest guard, checked before anything else.
    if (order.spacesellerOrderId || order.spacesellerUuid) {
      return {
        attempted: false,
        alreadySynced: true,
        status: "SYNCED",
        orderId: order.spacesellerOrderId ?? undefined,
        uuid: order.spacesellerUuid ?? undefined,
      };
    }

    // An in-flight or unresolved attempt is never piled on top of.
    if (order.spacesellerSyncStatus === "PENDING") {
      return { attempted: false, status: "PENDING", error: "already_pending" };
    }

    // Space Seller does not fulfil every product this store sells. An order for
    // one it does not handle is not a failure and not a missing SKU — it simply
    // is not theirs to ship. Recorded explicitly so the dashboard can say so,
    // rather than leaving columns null and looking like a sync that never ran.
    const scope = orderInSpaceSellerScope(order);
    if (!scope.inScope) {
      await record(prisma, orderId, { status: "SKIPPED", error: SCOPE_ERROR });
      return { attempted: false, status: "SKIPPED", error: SCOPE_ERROR };
    }

    const client = opts.client ?? spaceSellerClient(env, reqId);
    if (!client) {
      await record(prisma, orderId, { status: "SKIPPED", error: "not_configured" });
      return { attempted: false, status: "SKIPPED", error: "not_configured" };
    }

    // Mapping runs before the claim: a missing SKU is not an attempt, and
    // marking it SKIPPED rather than PENDING keeps the order retryable the
    // moment somebody fills the SKU in.
    const mapped = buildSpaceSellerOrder(order);
    if (!mapped.ok) {
      await record(prisma, orderId, { status: "SKIPPED", error: mapped.error });
      log("warn", {
        reqId,
        msg: "spaceseller_mapping_refused",
        orderNumber: order.orderNumber,
        reason: mapped.error,
        // The product name, not the customer's details.
        detail: mapped.error === MAPPING_ERRORS.MISSING_SKU ? mapped.detail : undefined,
      });
      return { attempted: false, status: "SKIPPED", error: mapped.error };
    }

    // 2 — claim. Only the row still un-synced and not already in flight flips,
    // so of two simultaneous callers exactly one proceeds.
    //
    // The status branch is spelled out rather than written as
    // `NOT: { spacesellerSyncStatus: "PENDING" }`, because Prisma compiles that
    // to a bare `NOT "spaceseller_sync_status" = $1`. For a NULL column SQL
    // evaluates that to UNKNOWN, not TRUE, so the row is excluded — and NULL is
    // exactly the state of every order that has never been attempted. Written
    // the short way, this predicate matched 0 of 92 production orders and the
    // sync could never fire for anything.
    const claim = await prisma.order.updateMany({
      where: {
        id: orderId,
        spacesellerOrderId: null,
        spacesellerUuid: null,
        OR: [
          // never attempted
          { spacesellerSyncStatus: null },
          // attempted before and resolved (SYNCED is unreachable here, since the
          // id guards above already excluded it)
          { spacesellerSyncStatus: { not: "PENDING" } },
        ],
      },
      data: { spacesellerSyncStatus: "PENDING", spacesellerLastError: null },
    });
    if (claim.count === 0) {
      // Another caller holds the claim. Nothing was sent by THIS call, so this
      // is contention, not an ambiguous upstream result — the two must not be
      // reported the same way, or an admin goes hunting for an order that was
      // never created.
      return { attempted: false, status: "PENDING", error: "claim_lost" };
    }

    const result = await client.createOrder(mapped.body);

    if (result.outcome === "ok") {
      await record(prisma, orderId, {
        status: "SYNCED",
        orderId: result.data?.order_id,
        uuid: result.data?.uuid,
        upstreamStatus: result.data?.status,
        syncedAt: new Date(),
      });
      log("info", {
        reqId,
        msg: "spaceseller_synced",
        orderNumber: order.orderNumber,
        spacesellerOrderId: result.data?.order_id,
      });
      return {
        attempted: true,
        status: "SYNCED",
        orderId: result.data?.order_id,
        uuid: result.data?.uuid,
      };
    }

    if (result.outcome === "rejected") {
      // 3 — it answered and said no. Nothing was created, so this is safe to
      // release and safe to retry once the cause is fixed.
      await record(prisma, orderId, {
        status: "FAILED",
        error: `${result.status ?? "error"}: ${result.detail ?? "rejected"}`,
      });
      return { attempted: true, status: "FAILED", error: result.detail };
    }

    // 4 — unknown. The claim stays held at PENDING deliberately.
    await record(prisma, orderId, {
      status: "PENDING",
      error: `unknown_result: ${result.detail ?? "timeout"} — تحقق من Space Seller قبل إعادة المحاولة`,
    });
    log("warn", {
      reqId,
      msg: "spaceseller_unknown_result",
      orderNumber: order.orderNumber,
      detail: result.detail,
    });
    return { attempted: true, status: "PENDING", error: result.detail };
  } catch (err) {
    // Even an unexpected fault must leave the order readable and retryable.
    const message = err instanceof Error ? err.message : String(err);
    await record(prisma, orderId, { status: "FAILED", error: `internal: ${message}`.slice(0, 300) })
      .catch(() => undefined);
    log("error", { reqId, msg: "spaceseller_sync_error", orderId, error: message });
    return { attempted: false, status: "FAILED", error: message };
  }
}

/**
 * Refresh order status, delivery status and tracking number from Space Seller.
 *
 * Read-only upstream: it can never create anything, so it is safe to call as
 * often as anyone likes. Only an order that already carries an id is refreshed.
 */
export async function refreshSpaceSellerStatus(
  prisma: PrismaClient,
  env: SpaceSellerEnv,
  orderId: string,
  opts: { reqId?: string; client?: SpaceSellerClient } = {},
): Promise<{ refreshed: boolean; status?: string; delivery?: string; tracking?: string; error?: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, spacesellerOrderId: true, spacesellerUuid: true },
    });
    if (!order) return { refreshed: false, error: "order_not_found" };

    const upstreamId = order.spacesellerOrderId ?? order.spacesellerUuid;
    if (!upstreamId) return { refreshed: false, error: "not_synced" };

    const client = opts.client ?? spaceSellerClient(env, opts.reqId);
    if (!client) return { refreshed: false, error: "not_configured" };

    const res = await client.getOrder(upstreamId);
    if (res.outcome !== "ok") {
      // A failed read never downgrades what is already known about the order.
      return { refreshed: false, error: res.detail ?? res.outcome };
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        spacesellerStatus: res.orderStatus ?? undefined,
        spacesellerDeliveryStatus: res.deliveryStatus ?? undefined,
        spacesellerTrackingNumber: res.trackingNumber ?? undefined,
        spacesellerSyncedAt: new Date(),
      },
    });

    return {
      refreshed: true,
      status: res.orderStatus,
      delivery: res.deliveryStatus,
      tracking: res.trackingNumber,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("warn", { reqId: opts.reqId, msg: "spaceseller_refresh_error", orderId, error: message });
    return { refreshed: false, error: message };
  }
}


/** One place that writes the outcome columns, so they cannot drift apart. */
async function record(
  prisma: PrismaClient,
  orderId: string,
  patch: {
    status: SyncStatus;
    orderId?: string;
    uuid?: string;
    upstreamStatus?: string;
    error?: string;
    syncedAt?: Date;
  },
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      spacesellerSyncStatus: patch.status,
      spacesellerOrderId: patch.orderId ?? undefined,
      spacesellerUuid: patch.uuid ?? undefined,
      spacesellerStatus: patch.upstreamStatus ?? undefined,
      spacesellerSyncedAt: patch.syncedAt ?? undefined,
      spacesellerLastError: patch.error ?? null,
    },
  });
}
