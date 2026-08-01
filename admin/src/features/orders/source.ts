/**
 * Human labels for the storefront an order came from.
 *
 * `Order.source` is free text on purpose: a new landing page starts sending its
 * own value the day it launches, with no deploy here. Known values get a proper
 * name; anything else is shown as-is so a page nobody has registered yet is
 * still identifiable rather than appearing as "unknown".
 *
 * Lives outside the component files so the table and the mobile cards share one
 * mapping (same reasoning as `./status.ts`).
 */
type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "gold";

const KNOWN: Record<string, { label: string; tone: Tone }> = {
  // The original Nakhwa page predates multi-product and sends no slug, so its
  // orders carry the schema default.
  landing: { label: "Nakhwa Store", tone: "brand" },
  "cache-terazo": { label: "Nakhwa Store", tone: "brand" },
  "lilya-talon": { label: "LILYA TALON", tone: "gold" },
  admin: { label: "لوحة التحكم", tone: "neutral" },
};

export function sourceLabel(source: string): { label: string; tone: Tone } {
  return KNOWN[source] ?? { label: source, tone: "neutral" };
}
