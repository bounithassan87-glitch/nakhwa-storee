// The exact JSON Meta's Cloud API expects, and the phone form it expects.
//
// Pure data shaping, deliberately separated from the transport in
// `functions/api/_lib/whatsapp/meta.ts`. Two reasons, and the second is the
// important one:
//
//   1. The wire format is a contract with an external API. It deserves to be
//      read and reasoned about on its own, not buried inside fetch plumbing.
//   2. It is the part most worth testing — a swapped variable puts the
//      customer's city where the price belongs, and Meta validates the COUNT of
//      parameters but never their meaning, so nothing anywhere would complain.
//      Plain JS here means the test exercises THIS function, not a copy of it
//      kept in step by hand.
//
// No credential appears in this file. The token is applied as a header by the
// transport; nothing here ever sees it.

/**
 * A Moroccan number in the form Meta wants: `212XXXXXXXXX`, digits only, no `+`.
 *
 * Orders store the local form (`06…`/`07…`), which routes nowhere on its own.
 * The stored value is never modified — this is only what goes on the wire.
 *
 * Returns `null` when there is nothing usable to send to.
 */
export function toMetaPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  // `00` is the international access prefix — strip it before anything else, or
  // `00212…` takes the leading-zero branch below and comes out as `2120212…`.
  const trunk = digits.startsWith("00") ? digits.slice(2) : digits;
  if (trunk.startsWith("212")) return trunk;
  if (trunk.startsWith("0")) return "212" + trunk.slice(1);
  if (trunk.length === 9) return "212" + trunk;
  return trunk;
}

/** A number Meta could actually deliver to. */
export function isSendablePhone(phone) {
  return typeof phone === "string" && /^212[5-7]\d{8}$/.test(phone);
}

/**
 * Meta rejects a body parameter containing a newline, a tab, or four or more
 * consecutive spaces. Customer-typed names and cities reach these variables
 * directly, so they are flattened rather than allowed to fail the whole send.
 */
export function sanitizeVariable(v) {
  return String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 900);
}

/**
 * The request body for a template message.
 *
 * `template.variables` are positional: index 0 fills {{1}}, and so on. The
 * order is fixed by whatever was approved in WhatsApp Manager, and is asserted
 * in `tests/whatsapp-meta.test.mjs`.
 */
export function buildMetaMessageBody(to, template) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      components: [
        {
          type: "body",
          parameters: template.variables.map((v) => ({ type: "text", text: sanitizeVariable(v) })),
        },
      ],
    },
  };
}

/**
 * Meta's error shape, flattened to one line for the admin and the order row.
 *
 * The code and subcode are kept because they are what makes an error
 * actionable — 132001 is "template does not exist", 131047 is "re-engagement
 * required", and an admin reading only the prose cannot tell those apart.
 */
export function describeMetaError(parsed, fallbackText) {
  const e = parsed && typeof parsed === "object" ? parsed.error : null;
  if (!e) return String(fallbackText ?? "").slice(0, 300);
  const sub = e.error_subcode ? `/${e.error_subcode}` : "";
  return `${e.message ?? "unknown"} (code ${e.code ?? "?"}${sub})`.slice(0, 300);
}
