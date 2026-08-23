// Which gateway sends a given product's confirmation — the decision itself.
//
// Separated from the Worker code that acts on it for two reasons. It is the
// rule most likely to be got wrong, so it is worth testing directly rather than
// through a Worker; and `functions/` is TypeScript, which the bare `node --test`
// runner cannot load, so a test there would have to be a hand-kept copy of this
// logic — which would then pass while the real rule drifted.
//
// Pure: no environment, no network, no I/O. It is told what is available and
// answers what to use.
import { providerPreferenceFor, hasMetaTemplate } from "./whatsapp-templates.js";

/**
 * @typedef {"meta" | "ultramsg" | "none"} Gateway
 * @typedef {object} Availability
 * @property {boolean} meta      Meta credentials present in the environment.
 * @property {boolean} ultramsg  UltraMsg credentials present in the environment.
 */

/**
 * Pick the gateway for `slug`.
 *
 * The rule this file exists to enforce: **a product's Meta setup must never
 * decide anything for another product.** Meta rejects any business-initiated
 * message that does not name a template it has approved, so "Meta is configured,
 * therefore everything goes through Meta" would have silenced every storefront
 * without its own approved template the moment the first one was set up. Meta is
 * therefore only ever chosen for a product that HAS a template.
 *
 * @param {string|null|undefined} slug
 * @param {Availability} available
 * @returns {{ gateway: Gateway, reason: string }} `reason` names the branch, so
 *   a log line and a failed send can be traced to one clause of this function.
 */
export function chooseWhatsAppProvider(slug, available) {
  const preference = providerPreferenceFor(slug);
  const metaUsable = Boolean(available?.meta) && hasMetaTemplate(slug);
  const ultraUsable = Boolean(available?.ultramsg);

  // Pinned to Meta. Never quietly downgraded to the text gateway: a product is
  // pinned because Meta approved its exact wording, and sending the free-text
  // version instead would put un-approved copy in front of a customer.
  if (preference === "meta") {
    if (metaUsable) return { gateway: "meta", reason: "pinned_meta" };
    // Which of the two is missing decides who has to fix it — an operator with
    // the credentials, or someone getting a template approved.
    return {
      gateway: "none",
      reason: hasMetaTemplate(slug) ? "meta_not_configured" : "no_template",
    };
  }

  // Pinned to the text gateway. Meta is not considered even if it is configured
  // and this product happens to have a template.
  if (preference === "ultramsg") {
    return ultraUsable
      ? { gateway: "ultramsg", reason: "pinned_ultramsg" }
      : { gateway: "none", reason: "ultramsg_not_configured" };
  }

  // "auto" — the default, and the clause that keeps every other storefront
  // alive while one product runs on Meta.
  if (metaUsable) return { gateway: "meta", reason: "auto_meta" };
  if (ultraUsable) return { gateway: "ultramsg", reason: "auto_ultramsg" };
  return { gateway: "none", reason: "not_configured" };
}

/**
 * The `skipped` value to record when no gateway could be chosen.
 *
 * `no_template` and `not_configured` are kept apart deliberately: the first is
 * a product that still needs a template approved, the second is a shop with no
 * working gateway at all. Collapsing them would send whoever reads the
 * dashboard to the wrong place.
 */
export function skipReasonFor(reason) {
  return reason === "no_template" ? "no_template" : "not_configured";
}
