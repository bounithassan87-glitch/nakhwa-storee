// Meta Conversions API — server-side events for the Workers runtime.
//
// The browser pixel keeps firing exactly as before; this runs alongside it. The
// two are reconciled by `event_id`: the same id is sent from the browser as
// `eventID` and from here as `event_id`, and Meta keeps whichever arrives first
// and drops the duplicate. Without that shared id every conversion would be
// counted twice and the reported cost per lead would be half the real one.
//
// Why send server-side at all when the pixel already works: the pixel does not
// fire for a customer running a content blocker, on a browser that blocks
// third-party requests, or when a tab is closed before the request leaves. The
// server sees those conversions anyway.
//
// Everything here degrades quietly. A missing token, a Meta outage, a malformed
// response — none of it may ever surface to a customer who is buying something.
import { log } from "../../_lib/http";

/** Public identifier, the same one embedded in the browser pixel. */
export const META_PIXEL_ID = "2808695152828717";

const GRAPH_VERSION = "v21.0";

/** Meta gets 3 seconds per attempt, then the request is abandoned. */
const TIMEOUT_MS = 3000;
/** One retry, for transient failures only. */
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 400;

export type CapiEventName = "PageView" | "InitiateCheckout" | "Lead";

export interface CapiUserData {
  /** The customer's IP, taken from the edge — never from the request body. */
  clientIpAddress?: string;
  clientUserAgent?: string;
  /** Meta's first-party browser cookies, read by the page and passed through. */
  fbp?: string;
  fbc?: string;
  /** Stable per-visitor id. Hashed here; the raw value never leaves. */
  externalId?: string;
  /** Moroccan local format (06…/07…). Normalised then hashed. */
  phone?: string;
  /** Not collected at checkout today; hashed and sent if a caller ever has it. */
  email?: string;
  city?: string;
  /** ISO-3166-1 alpha-2. Defaults to Morocco, the only country served. */
  country?: string;
}

export interface CapiEvent {
  eventName: CapiEventName;
  /** Shared with the browser pixel — this is what makes deduplication work. */
  eventId: string;
  eventSourceUrl?: string;
  user: CapiUserData;
  custom?: Record<string, unknown>;
}

export interface CapiResult {
  ok: boolean;
  /** Set when nothing was attempted; not an error. */
  skipped?: string;
  status?: number;
  /** Meta's own message, kept short. Useful and carries nothing secret. */
  detail?: string;
}

/** SHA-256, lowercase hex — the only format Meta accepts for hashed fields. */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Normalise a Moroccan phone to the digits-only international form Meta wants.
 *
 * Meta hashes and compares exactly, so `0612345678` and `+212612345678` are two
 * different people unless they are normalised to the same string first. The
 * local `0` prefix is replaced by the country code, matching what Meta receives
 * from Facebook profiles in Morocco.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("212")) return digits;
  if (digits.startsWith("0")) return "212" + digits.slice(1);
  if (digits.length === 9) return "212" + digits;
  return digits.length > 0 ? digits : null;
}

/** Build the `user_data` block, hashing everything Meta requires to be hashed. */
async function buildUserData(user: CapiUserData): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  // Sent in the clear by design — Meta matches on these directly and hashing
  // them would make them useless.
  if (user.clientIpAddress) out.client_ip_address = user.clientIpAddress;
  if (user.clientUserAgent) out.client_user_agent = user.clientUserAgent;
  if (user.fbp) out.fbp = user.fbp;
  if (user.fbc) out.fbc = user.fbc;

  if (user.externalId) out.external_id = await sha256Hex(user.externalId.trim().toLowerCase());

  if (user.phone) {
    const phone = normalizePhone(user.phone);
    if (phone) out.ph = await sha256Hex(phone);
  }

  if (user.email) out.em = await sha256Hex(user.email.trim().toLowerCase());

  // Meta's normalisation for these: lowercase, no spaces or punctuation.
  if (user.city) {
    const city = user.city.trim().toLowerCase().replace(/[\s\p{P}]/gu, "");
    if (city) out.ct = await sha256Hex(city);
  }

  // The store ships only to Morocco, so this is known even when a landing page
  // sends nothing about the visitor.
  out.country = await sha256Hex((user.country ?? "MA").trim().toLowerCase());

  return out;
}

/**
 * Extract the visitor's IP and user agent from the request itself.
 *
 * Deliberately not accepted from the request body: a caller that could set its
 * own `client_ip_address` could attribute conversions to any address it liked.
 */
export function clientSignals(request: Request): { clientIpAddress?: string; clientUserAgent?: string } {
  return {
    clientIpAddress:
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined,
    clientUserAgent: request.headers.get("user-agent") ?? undefined,
  };
}

/**
 * Send one event to the Conversions API.
 *
 * Never throws and never rejects: every caller is on a path where a customer is
 * mid-purchase, and analytics does not get to interrupt that.
 */
export async function sendCapiEvent(
  accessToken: string | undefined,
  event: CapiEvent,
  reqId?: string,
  testEventCode?: string,
): Promise<CapiResult> {
  if (!accessToken) return { ok: false, skipped: "not_configured" };

  try {
    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: event.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event.eventId,
          action_source: "website",
          ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
          user_data: await buildUserData(event.user),
          ...(event.custom ? { custom_data: event.custom } : {}),
        },
      ],
      // In the body rather than the query string: a URL carrying a secret ends
      // up in access logs, proxies and error reports.
      access_token: accessToken,
    };
    if (testEventCode) payload.test_event_code = testEventCode;

    const body = JSON.stringify(payload);
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`;

    let last: CapiResult = { ok: false, detail: "no_attempt" };
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);

      const outcome = await attemptSend(url, body, event, reqId);
      if (outcome.ok) return outcome;
      last = outcome;

      // Retry only what retrying can fix. A 400 means the payload is wrong and
      // will be wrong again; a 401 means the token is wrong. Repeating either
      // just burns the request budget and delays nothing into working.
      if (!isTransient(outcome.status)) break;
    }
    return last;
  } catch (err) {
    log("warn", {
      reqId,
      msg: "capi_error",
      event: event.eventName,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** A rejection worth repeating: the network, a rate limit, or Meta's own side. */
function isTransient(status?: number): boolean {
  if (status == null) return true; // network failure or timeout
  return status === 408 || status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attemptSend(
  url: string,
  body: string,
  event: CapiEvent,
  reqId?: string,
): Promise<CapiResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      // Meta is not allowed to hold a request open. This runs inside
      // `waitUntil`, so it is already off the customer's path, but an unbounded
      // fetch would still pin the isolate.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.ok) return { ok: true, status: res.status };

    const detail = (await res.text()).slice(0, 300);
    log("warn", { reqId, msg: "capi_failed", event: event.eventName, status: res.status, detail });
    return { ok: false, status: res.status, detail };
  } catch (err) {
    // A timeout arrives here as an AbortError, with no status — treated as
    // transient, which is what it is.
    const detail = err instanceof Error ? err.message : String(err);
    log("warn", { reqId, msg: "capi_network", event: event.eventName, detail });
    return { ok: false, detail };
  }
}
