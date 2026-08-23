// Binding the gateway chosen for a product to its credentials.
//
// The choice is per PRODUCT, not per deployment, and it lives in
// `shared/whatsapp-routing.js` where it can be tested directly. This file only
// turns that answer into a sender: it reads the environment for what is
// available, and hands the winner its secrets.
//
// Neither provider knows the other exists, and removing the two Meta variables
// still reverts every product to UltraMsg with no deploy of different code.
import { whatsAppSender as ultraMsgSender } from "../ultramsg";
import { isMetaConfigured, metaWhatsAppSender, type MetaWhatsAppEnv } from "./meta";
import type { WhatsAppResult, WhatsAppSender } from "./types";
import { chooseWhatsAppProvider, skipReasonFor } from "../../../../shared/whatsapp-routing.js";

export type { WhatsAppSender, WhatsAppResult, WhatsAppTemplate, SendWhatsAppInput } from "./types";
export { isMetaConfigured } from "./meta";

export interface WhatsAppEnv extends MetaWhatsAppEnv {
  ULTRAMSG_INSTANCE_ID?: string;
  ULTRAMSG_TOKEN?: string;
  /** Test seam only: points the text gateway at a local mock. Never in production. */
  ULTRAMSG_API_BASE?: string;
}

/** What the environment offers. The routing rule is told this and nothing else. */
function availability(env: WhatsAppEnv) {
  return {
    meta: isMetaConfigured(env),
    ultramsg: Boolean(env.ULTRAMSG_INSTANCE_ID && env.ULTRAMSG_TOKEN),
  };
}

/**
 * The gateway that will actually be used for `slug`, or `"none"`.
 *
 * Reads the same rule `resolveProvider` does, so a log line and the send it
 * describes can never disagree.
 */
export function providerName(env: WhatsAppEnv, slug?: string | null): "meta" | "ultramsg" | "none" {
  return chooseWhatsAppProvider(slug, availability(env)).gateway;
}

/** A sender that attempts nothing and says exactly why. Never fabricates success. */
function refuse(skipped: string): WhatsAppSender {
  const result: WhatsAppResult = { ok: false, skipped };
  return () => Promise.resolve(result);
}

/**
 * Bind the gateway chosen for `slug` to its credentials.
 *
 * Returns a sender that takes only the message; every secret stays captured in
 * the closure and never travels with the call or reaches a log line.
 *
 * A product with no usable gateway gets a sender that refuses cleanly. That
 * outcome is recorded on the order and releases the once-only claim, so the
 * message can still be sent later from the dashboard once whatever is missing
 * — credentials, or an approved template — has been supplied.
 */
export function resolveProvider(
  env: WhatsAppEnv,
  slug?: string | null,
  reqId?: string,
): WhatsAppSender {
  const { gateway, reason } = chooseWhatsAppProvider(slug, availability(env));
  switch (gateway) {
    case "meta":
      return metaWhatsAppSender(env, reqId);
    case "ultramsg":
      return ultraMsgSender(env, reqId);
    default:
      return refuse(skipReasonFor(reason));
  }
}
