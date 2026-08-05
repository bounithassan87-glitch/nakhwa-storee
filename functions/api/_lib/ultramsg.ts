// UltraMsg — the confirmation WhatsApp sent when an admin confirms an order.
//
// Nothing here may ever fail an order transition. The admin has already changed
// the status and the database has already committed; if WhatsApp is unreachable
// that is a message worth retrying later, not a reason to undo a confirmation
// the shop has acted on.
//
// The token is read from the environment and never appears in this file, in the
// URL, or in any log line. UltraMsg accepts it in the POST body, which keeps it
// out of access logs and proxy traces the way a query string would not.
import { log } from "../../_lib/http";
import { normalizePhone } from "./capi";

/** The confirmation text, exactly as the shop wrote it. */
export const CONFIRMATION_MESSAGE = [
  "السلام عليكم،",
  "",
  "شكراً لاختياركم Nakhwa Store 🌿",
  "",
  "تم التوصل بطلبكم بنجاح ✅",
  "",
  "سيتواصل معكم فريقنا قريباً لتأكيد الطلب والعنوان قبل الشحن.",
  "",
  "شكراً على ثقتكم 💚",
].join("\n");

/** UltraMsg is given 8 seconds, then the attempt is abandoned. */
const TIMEOUT_MS = 8000;

export interface WhatsAppResult {
  ok: boolean;
  /** Set when nothing was attempted — missing config, unusable phone. */
  skipped?: string;
  status?: number;
  /** UltraMsg's own message, truncated. Carries no credential. */
  detail?: string;
}

/**
 * Send one WhatsApp message.
 *
 * Never throws: every caller is on a path where an order has already been
 * confirmed in the database.
 */
export async function sendWhatsApp(
  instanceId: string | undefined,
  token: string | undefined,
  toPhone: string,
  body: string,
  reqId?: string,
): Promise<WhatsAppResult> {
  if (!instanceId || !token) return { ok: false, skipped: "not_configured" };

  // WhatsApp addresses are international. Orders store the Moroccan local form
  // (06…/07…), which routes nowhere on its own, so it is normalised to 2126… —
  // the same helper the Conversions API already uses, so one definition of a
  // Moroccan number serves both.
  const phone = normalizePhone(toPhone);
  if (!phone || phone.length < 11) return { ok: false, skipped: "invalid_phone" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      // Token in the body, never the query string.
      body: new URLSearchParams({ token, to: phone, body, priority: "10" }),
      signal: controller.signal,
    });

    const text = await res.text();

    // UltraMsg answers 200 with {"sent":"false","message":"..."} for a rejected
    // send, so the status code alone does not mean the message went out.
    let sent = res.ok;
    try {
      const parsed: unknown = JSON.parse(text);
      const s = (parsed as { sent?: unknown }).sent;
      if (s !== undefined) sent = s === true || s === "true";
    } catch {
      /* not JSON — fall back to the status code */
    }

    if (!sent) {
      log("warn", { reqId, msg: "whatsapp_send_failed", status: res.status, detail: text.slice(0, 200) });
      return { ok: false, status: res.status, detail: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    log("warn", {
      reqId,
      msg: aborted ? "whatsapp_timeout" : "whatsapp_error",
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, detail: aborted ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
