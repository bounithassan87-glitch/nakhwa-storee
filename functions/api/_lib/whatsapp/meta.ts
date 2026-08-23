// Meta WhatsApp Cloud API — the official gateway.
//
// Business-initiated messages must use a template Meta has approved; free-form
// text is only permitted inside a 24-hour customer-initiated window, and a COD
// order does not open one. So this provider ignores the rendered `message` and
// sends `template` instead. A caller that supplies no template gets a clean
// `no_template` skip rather than a rejected send.
//
// The access token is read from the environment, captured in a closure, sent in
// an Authorization header, and never logged — not on success, not on failure,
// not in an error detail. Meta echoes no credential in its responses, and the
// error bodies stored on the order are truncated provider text.
import { log } from "../../../_lib/http";
import type { SendWhatsAppInput, WhatsAppResult, WhatsAppSender } from "./types";
// Wire format and phone form live in plain JS so the test suite exercises the
// same code this does, rather than a mirror of it kept in step by hand.
import {
  toMetaPhone,
  isSendablePhone,
  buildMetaMessageBody,
  describeMetaError,
} from "../../../../shared/whatsapp-meta-payload.js";

/** Meta is given 8 seconds, then the attempt is abandoned. Same as before. */
const TIMEOUT_MS = 8000;

/**
 * Graph API version.
 *
 * Pinned, never floating: an unpinned Graph call silently changes behaviour the
 * day Meta promotes a new default. It defaults to the version the Conversions
 * API already uses in this project so there is one number to keep current, and
 * `WHATSAPP_GRAPH_VERSION` overrides it without a code change.
 */
const DEFAULT_GRAPH_VERSION = "v21.0";

export interface MetaWhatsAppEnv {
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_VERSION?: string;
  /**
   * Overrides the language code the template registry declares.
   *
   * Meta matches the language EXACTLY: a template registered as `ar_AR` and
   * sent as `ar` is rejected with error 132001, which reads like "the template
   * does not exist" and sends whoever debugs it looking in the wrong place.
   * The registry says `ar`; if WhatsApp Manager disagrees, correcting one
   * environment variable fixes it without shipping code.
   */
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  /** Test seam: point the sender at a local mock. Never set in production. */
  WHATSAPP_API_BASE?: string;
}

/** True when this provider has everything it needs to attempt a send. */
export function isMetaConfigured(env: MetaWhatsAppEnv): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Bind the configured credentials to a sender. The token stays in the closure. */
export function metaWhatsAppSender(env: MetaWhatsAppEnv, reqId?: string): WhatsAppSender {
  return (input) => sendViaMeta(env, input, reqId);
}

export async function sendViaMeta(
  env: MetaWhatsAppEnv,
  { phone, template }: SendWhatsAppInput,
  reqId?: string,
): Promise<WhatsAppResult> {
  if (!isMetaConfigured(env)) return { ok: false, skipped: "not_configured" };
  if (!template) return { ok: false, skipped: "no_template" };

  // Orders store the Moroccan local form (06…/07…), which routes nowhere.
  // `toMetaPhone` yields 212XXXXXXXXX — the form Meta wants, no `+`. The stored
  // number is never modified; this is only what goes on the wire.
  const to = toMetaPhone(phone);
  if (!to || !isSendablePhone(to)) return { ok: false, skipped: "invalid_phone" };

  const version = env.WHATSAPP_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
  const base = env.WHATSAPP_API_BASE || "https://graph.facebook.com";
  const url = `${base}/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const body = buildMetaMessageBody(to, {
    ...template,
    language: env.WHATSAPP_TEMPLATE_LANGUAGE || template.language,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        // The only place the token appears. Never a query string, which would
        // land it in access logs and proxy traces.
        authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    if (!res.ok) {
      // Meta's shape: { error: { message, type, code, error_subcode, fbtrace_id } }
      const e = (parsed as { error?: Record<string, unknown> } | null)?.error;
      const detail = describeMetaError(parsed, text);
      log("warn", {
        reqId, msg: "whatsapp_meta_send_failed", status: res.status,
        code: e?.code ?? null, subcode: e?.error_subcode ?? null,
        fbtrace: e?.fbtrace_id ?? null, detail: String(detail).slice(0, 200),
      });
      return { ok: false, status: res.status, detail: String(detail).slice(0, 300) };
    }

    // Success: { messages: [{ id: "wamid.…" }] }. The id is what support uses
    // to trace a specific message, so it is stored on the order.
    const messages = (parsed as { messages?: { id?: string }[] } | null)?.messages;
    const messageId = messages?.[0]?.id;
    if (!messageId) {
      log("warn", { reqId, msg: "whatsapp_meta_no_message_id", status: res.status });
      return { ok: false, status: res.status, detail: "accepted without a message id" };
    }
    return { ok: true, status: res.status, messageId: String(messageId).slice(0, 120) };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    log("warn", { reqId, msg: "whatsapp_meta_unreachable", aborted });
    return { ok: false, skipped: undefined, detail: aborted ? "timeout after 8s" : "network error" };
  } finally {
    clearTimeout(timer);
  }
}
