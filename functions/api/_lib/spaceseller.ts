// Space Seller — order fulfilment API, for the Workers runtime.
//
// Transport only: it speaks HTTP and classifies the answer. What to send is
// decided by shared/spaceseller-mapping.js, and whether to send at all by
// admin/_lib/spacesellerSync.ts. Splitting it this way is what lets the mapping
// and the once-only rules be tested without a network.
//
// The token is read from the environment, sent in an Authorization header, and
// appears nowhere else — not in a URL, not in a log line, not in a returned
// error. Every error body is scrubbed before it leaves this file.
//
// Nothing here may ever fail an order. By the time it runs the sale is already
// committed; an unreachable fulfilment partner is something to retry, never a
// reason to lose a customer's order.
import { log } from "../../_lib/http";
import { classifyStatus, scrubUpstream } from "../../../shared/spaceseller-mapping.js";

const DEFAULT_API_BASE = "https://drop.spaceseller.ma/api/v1";

/** Space Seller gets 10 seconds per attempt, then the attempt is abandoned. */
const TIMEOUT_MS = 10_000;
/** One retry, and only for failures that retrying can actually fix. */
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 500;

export interface SpaceSellerEnv {
  SPACESELLER_TOKEN?: string;
  /** Test seam only, mirroring WHATSAPP_API_BASE. Never set in production. */
  SPACESELLER_API_BASE?: string;
}

/**
 * How a call ended.
 *
 * `outcome` is the part that matters for safety:
 *   ok        — Space Seller accepted it; ids are present
 *   rejected  — it answered, and said no (4xx). Retrying changes nothing.
 *   unknown   — timeout or network failure. The order MAY exist upstream.
 *
 * `unknown` is deliberately distinct from `rejected`. The API exposes no
 * idempotency key and no way to look an order up by our reference, so a request
 * that timed out cannot be safely repeated by a machine.
 */
export type SpaceSellerOutcome = "ok" | "rejected" | "unknown" | "not_configured";

export interface SpaceSellerResult {
  outcome: SpaceSellerOutcome;
  status?: number;
  /** Upstream message, truncated and scrubbed. Safe to store and display. */
  detail?: string;
  data?: {
    order_id?: string;
    uuid?: string;
    status?: string;
    created_at?: string;
  };
}

export interface SpaceSellerStatus {
  outcome: SpaceSellerOutcome;
  status?: number;
  detail?: string;
  orderStatus?: string;
  deliveryStatus?: string;
  trackingNumber?: string;
}

/** The transport, injectable so tests never reach the real API. */
export interface SpaceSellerClient {
  createOrder(body: unknown): Promise<SpaceSellerResult>;
  getOrder(id: string): Promise<SpaceSellerStatus>;
}

// `scrub` and `isTransient` now live in shared/spaceseller-mapping.js so the
// classification can be unit-tested; these are thin local aliases.
const scrub = (t: string): string => scrubUpstream(t);

function parse(text: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

/**
 * Build a client bound to its credentials.
 *
 * The token is captured in the closure; callers pass only order data, so it
 * cannot leak through a call site.
 */
export function spaceSellerClient(env: SpaceSellerEnv, reqId?: string): SpaceSellerClient | null {
  const token = env.SPACESELLER_TOKEN;
  if (!token) return null;
  const base = (env.SPACESELLER_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");

  async function call(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown },
  ): Promise<{ status?: number; text: string; timedOut: boolean }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${path}`, {
        method: init.method,
        headers: {
          // The only place the token ever appears.
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
      return { status: res.status, text: await res.text(), timedOut: false };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return { status: undefined, text: aborted ? "timeout" : "network_error", timedOut: true };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async createOrder(body: unknown): Promise<SpaceSellerResult> {
      let last: SpaceSellerResult = { outcome: "unknown", detail: "no_attempt" };

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));

        const res = await call("/orders", { method: "POST", body });

        // Timeout or connection failure: the order may or may not exist
        // upstream. Reported as `unknown` so no caller repeats it blindly.
        if (res.status === undefined) {
          last = { outcome: "unknown", detail: res.text };
          // A retry here is a duplicate risk, so it is only taken on the very
          // first attempt, where the request most likely never left.
          if (attempt < MAX_RETRIES && res.text === "network_error") continue;
          break;
        }

        const parsed = parse(res.text);
        // One classifier, shared with the tests — the transport never keeps its
        // own opinion about what a status means.
        const kind = classifyStatus(res.status);

        if (kind === "ok") {
          const data = (parsed?.data ?? parsed) as Record<string, unknown> | undefined;
          const orderId = str(data?.order_id);
          const uuid = str(data?.uuid);
          // A 2xx with neither id is not a success we can record or ever
          // reconcile — treated as unknown rather than silently "synced".
          if (!orderId && !uuid) {
            last = { outcome: "unknown", status: res.status, detail: scrub(res.text) };
            break;
          }
          return {
            outcome: "ok",
            status: res.status,
            data: { order_id: orderId, uuid, status: str(data?.status), created_at: str(data?.created_at) },
          };
        }

        const detail = scrub(
          str(parsed?.message) ?? (parsed ? JSON.stringify(parsed) : res.text),
        );
        log("warn", { reqId, msg: "spaceseller_create_failed", status: res.status, detail });

        if (kind === "unknown") {
          last = { outcome: "unknown", status: res.status, detail };
          continue;
        }
        // 401, 404, 422 and friends: it answered and said no. Definitive.
        return { outcome: "rejected", status: res.status, detail };
      }
      return last;
    },

    async getOrder(id: string): Promise<SpaceSellerStatus> {
      const res = await call(`/orders/${encodeURIComponent(id)}`, { method: "GET" });
      if (res.status === undefined) return { outcome: "unknown", detail: res.text };

      const parsed = parse(res.text);
      const kind = classifyStatus(res.status);
      if (kind === "ok") {
        const d = (parsed?.data ?? parsed) as Record<string, unknown> | undefined;
        const orderStatus = d?.order_status as Record<string, unknown> | undefined;
        const deliveryStatus = d?.delivery_status as Record<string, unknown> | undefined;
        return {
          outcome: "ok",
          status: res.status,
          orderStatus: str(orderStatus?.code) ?? str(d?.status),
          deliveryStatus: str(deliveryStatus?.code),
          trackingNumber: str(d?.tracking_number),
        };
      }

      const detail = scrub(str(parsed?.message) ?? res.text);
      log("warn", { reqId, msg: "spaceseller_get_failed", status: res.status, detail });
      return { outcome: kind, status: res.status, detail };
    },
  };
}
