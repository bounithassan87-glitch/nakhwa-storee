// The provider contract every WhatsApp gateway in this project implements.
//
// It was previously inlined in `ultramsg.ts`; it lives here now because there
// are two providers and neither should own the shape the other must satisfy.
// `ultramsg.ts` re-exports these, so nothing that imported them there breaks.
//
// One input carries BOTH representations of the same confirmation:
//
//   `message`  — the fully rendered Darija text. What a plain text gateway
//                (UltraMsg) sends verbatim.
//   `template` — the same content as an approved template name plus ordered
//                variables. What Meta's Cloud API requires, because a business
//                may not send free-form text outside a 24-hour customer-
//                initiated window, and a COD order does not open one.
//
// Building both costs nothing and means switching provider is configuration,
// not a rewrite of the calling code.

/** What happened, as the caller sees it. Never throws. */
export interface WhatsAppResult {
  ok: boolean;
  /** Set when nothing was attempted — missing config, unusable phone. */
  skipped?: string;
  /** Provider HTTP status, when there was one. */
  status?: number;
  /** The provider's own message, truncated. Carries no credential. */
  detail?: string;
  /** Provider-side id for the accepted message. Meta returns `wamid.…`. */
  messageId?: string;
}

/** An approved template and the variables that fill it, in order. */
export interface WhatsAppTemplate {
  /** Template name as approved in WhatsApp Manager. */
  name: string;
  /** Language code as approved, e.g. `ar`. */
  language: string;
  /** Body variables for {{1}}…{{n}}, already in template order. */
  variables: string[];
}

export interface SendWhatsAppInput {
  /** As stored on the order — local Moroccan form. Providers normalise. */
  phone: string;
  /** Rendered text, for gateways that send free-form messages. */
  message: string;
  /** Structured form, for gateways that require an approved template. */
  template?: WhatsAppTemplate;
}

export type WhatsAppSender = (input: SendWhatsAppInput) => Promise<WhatsAppResult>;
