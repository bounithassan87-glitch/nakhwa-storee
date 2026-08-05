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
import { json, log } from "../_lib/http";
import { createRateLimiter } from "./_lib/ratelimit";
import { sendCapiEvent, clientSignals } from "./_lib/capi";

// Generous for a real visitor — a page view plus a checkout, times a few tabs
// and reloads — and low enough that a script cannot flood the ad account.
const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const bodySchema = z.object({
  // Lead is absent on purpose; see the note above.
  eventName: z.enum(["PageView", "ViewContent", "InitiateCheckout"]),
  /** Must match the `eventID` the browser passed to fbq, or Meta counts twice. */
  eventId: z.string().trim().min(8).max(100),
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

  const send = sendCapiEvent(
    ctx.env.META_ACCESS_TOKEN,
    {
      eventName: b.eventName,
      eventId: b.eventId,
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
