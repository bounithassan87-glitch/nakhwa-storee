// POST /api/track — server-side counterpart to the browser pixel.
//
// Only for the two events the server has no other way of knowing about: a page
// view and a checkout that was started. `Lead` is deliberately NOT accepted
// here — it is fired from the order path itself, where the order is known to
// exist. Accepting it from the browser would let anyone POST leads that never
// happened straight into the ad account, and would train campaign optimisation
// on fabricated conversions.
//
// The response says nothing about whether Meta accepted the event. It is 202 as
// soon as the request is understood, and the send happens after, so a slow or
// failing Meta never delays the page.
import { z } from "zod";
import type { AppFunction } from "../_lib/context";
import { resolveDatabaseUrl } from "../_lib/env";
import { getPrisma } from "../_lib/db";
import { json, log } from "../_lib/http";
import { createRateLimiter } from "./_lib/ratelimit";
import { sendCapiEvent, clientSignals } from "./_lib/capi";
import { validateAnalyticsEvent } from "../../shared/analytics-events.js";

// Generous for a real visitor — a page view plus a checkout, times a few tabs
// and reloads — and low enough that a script cannot flood the ad account.
const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

/**
 * The first-party funnel event, if this request carries one.
 *
 * Entirely separate from the Meta fields below, because the two vocabularies do
 * not line up: `form_start` has no Meta counterpart and must not invent one,
 * and `PageView` must keep reaching Meta exactly as before. A request may carry
 * either, or both — a page view is naturally both.
 *
 * Shapes are re-checked by validateAnalyticsEvent; the bounds here exist so an
 * oversized body is rejected before it is parsed at all.
 */
const analyticsSchema = z.object({
  event: z.string().trim().min(1).max(40),
  sessionId: z.string().trim().min(1).max(64),
  landingPage: z.string().trim().min(1).max(80),
  productSlug: z.string().trim().max(80).optional(),
  outcome: z.string().trim().max(20).optional(),
  detail: z.string().trim().max(120).optional(),
});

const bodySchema = z.object({
  // Lead is absent on purpose; see the note above.
  // Optional since the funnel added events that are ours alone and have no Meta
  // equivalent. When present it behaves exactly as it always has.
  eventName: z.enum(["PageView", "ViewContent", "InitiateCheckout"]).optional(),
  /** Must match the `eventID` the browser passed to fbq, or Meta counts twice. */
  eventId: z.string().trim().min(8).max(100).optional(),
  eventSourceUrl: z.string().trim().url().max(500).optional(),
  fbp: z.string().trim().max(200).optional(),
  fbc: z.string().trim().max(400).optional(),
  externalId: z.string().trim().max(100).optional(),
  value: z.number().nonnegative().max(1_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  // Product identity, so ViewContent tells Meta which item was looked at rather
  // than only that something was. Bounded like every other field here — this
  // endpoint is public.
  contentName: z.string().trim().max(150).optional(),
  contentType: z.string().trim().max(40).optional(),
  contentIds: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  analytics: analyticsSchema.optional(),
});

/**
 * The custom_data block, built only from what the caller actually sent.
 *
 * Omitted entirely when there is nothing to say, which is the previous
 * behaviour for a bare PageView — Meta treats an absent custom_data and an
 * empty one differently in its reporting.
 */
function buildCustomData(b: {
  value?: number;
  currency?: string;
  contentName?: string;
  contentType?: string;
  contentIds?: string[];
}): Record<string, unknown> | undefined {
  const custom: Record<string, unknown> = {};
  if (b.value != null) {
    custom.value = b.value;
    custom.currency = b.currency ?? "MAD";
  }
  if (b.contentName) custom.content_name = b.contentName;
  if (b.contentType) custom.content_type = b.contentType;
  if (b.contentIds?.length) custom.content_ids = b.contentIds;
  return Object.keys(custom).length > 0 ? custom : undefined;
}

export const onRequest: AppFunction = async (ctx) => {
  if (ctx.request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (ctx.request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { ...CORS, allow: "POST, OPTIONS" });
  }

  const ip = ctx.request.headers.get("cf-connecting-ip") ?? "unknown";
  const rl = limiter.hit(ip);
  if (rl.blocked) {
    return json({ ok: false, error: "too_many_requests" }, 429, {
      ...CORS,
      "retry-after": String(rl.retryAfter),
    });
  }

  let raw: unknown;
  try {
    raw = await ctx.request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, CORS);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "validation_error" }, 422, CORS);
  const b = parsed.data;

  // A Meta event needs its id to deduplicate against the pixel copy; without
  // one the server copy would be counted twice.
  const hasMeta = Boolean(b.eventName && b.eventId);
  const analytics = b.analytics ? validateAnalyticsEvent(b.analytics) : null;

  // Something must be asked for. An empty body is a bug in a caller, not a
  // no-op worth accepting.
  if (!hasMeta && !analytics) {
    return json({ ok: false, error: "nothing_to_track" }, 422, CORS);
  }
  if (analytics && !analytics.ok) {
    return json({ ok: false, error: analytics.error }, 422, CORS);
  }

  /* ── Path 1: the first-party funnel row ────────────────────────────────
     Deliberately independent of Meta. A database hiccup must not stop an
     event reaching the ad account, and a Meta outage must not lose the row
     we can still count ourselves. Both run in waitUntil, both swallow their
     own failures, and neither awaits the other. */
  if (analytics?.ok) {
    const dbUrl = resolveDatabaseUrl(ctx.env);
    if (dbUrl) {
      const v = analytics.value;
      const write = (async () => {
        try {
          const prisma = getPrisma(dbUrl);
          await prisma.trackingEvent.create({
            data: {
              type: v.type,
              sessionId: v.sessionId,
              landingPage: v.landingPage,
              productSlug: v.productSlug,
              outcome: v.outcome,
              detail: v.detail,
            },
          });
        } catch (err) {
          // Never surfaced to the caller: analytics is not worth a failed page.
          log("warn", {
            reqId: ctx.data.reqId,
            msg: "tracking_write_failed",
            event: v.type,
            error: err instanceof Error ? err.message.slice(0, 200) : String(err),
          });
        }
      })();
      ctx.waitUntil(write);
    }
  }

  /* ── Path 2: Meta, exactly as before ──────────────────────────────────── */
  if (!hasMeta) return json({ ok: true }, 202, CORS);

  const send = sendCapiEvent(
    ctx.env.META_ACCESS_TOKEN,
    {
      eventName: b.eventName as "PageView" | "ViewContent" | "InitiateCheckout",
      eventId: b.eventId as string,
      eventSourceUrl: b.eventSourceUrl,
      user: {
        // From the edge, not the body — otherwise a caller could attribute
        // conversions to any address it chose.
        ...clientSignals(ctx.request),
        fbp: b.fbp,
        fbc: b.fbc,
        externalId: b.externalId,
      },
      custom: buildCustomData(b),
    },
    ctx.data.reqId,
    ctx.env.META_TEST_EVENT_CODE,
  ).then((result) => {
    if (!result.ok && !result.skipped) {
      log("warn", { reqId: ctx.data.reqId, msg: "track_failed", event: b.eventName, detail: result.detail });
    }
  });

  ctx.waitUntil(send);
  return json({ ok: true }, 202, CORS);
};
