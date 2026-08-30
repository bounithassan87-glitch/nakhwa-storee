// Landing-page funnel: event vocabulary, validation, and the funnel arithmetic.
//
// Pure — no network, no database, no DOM. It is shared by the browser script,
// the public /api/track endpoint, and the admin analytics endpoint, so all
// three agree on what an event is called and how a rate is computed. Keeping
// the maths here is what makes it testable: a funnel that divides by zero, or
// counts a submit attempt as an order, is a wrong number on a dashboard someone
// makes decisions from.

/** The only event types the system stores. Anything else is rejected. */
export const EVENT_TYPES = Object.freeze([
  "page_view",
  "form_view",
  "form_start",
  "form_submit",
  "order_success",
]);

/**
 * Outcomes for form_submit.
 *
 * A submit is an attempt until the server says otherwise. `success` here means
 * the API accepted it; the authoritative record of a sale is still the
 * order_success row written server-side after the order actually commits.
 */
export const SUBMIT_OUTCOMES = Object.freeze(["attempt", "success", "failure"]);

/** Events the browser is allowed to report. order_success is server-only. */
export const CLIENT_EVENT_TYPES = Object.freeze(
  EVENT_TYPES.filter((t) => t !== "order_success"),
);

export const LIMITS = Object.freeze({
  sessionId: 64,
  landingPage: 80,
  productSlug: 80,
  detail: 120,
});

/** Session ids this system issues: `nks_` plus 16–48 url-safe characters. */
const SESSION_SHAPE = /^nks_[A-Za-z0-9_-]{16,48}$/;

export function isValidSessionId(v) {
  return typeof v === "string" && SESSION_SHAPE.test(v);
}

/**
 * Landing-page identifier: the slug-shaped label a page reports for itself.
 *
 * Deliberately narrow. It is written to the database from an unauthenticated
 * endpoint and later grouped on, so it may not carry arbitrary text.
 */
const SLUG_SHAPE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function isValidSlug(v) {
  return typeof v === "string" && SLUG_SHAPE.test(v);
}

/**
 * Validate one inbound analytics event.
 *
 * Returns `{ ok: true, value }` with a normalised record, or `{ ok: false,
 * error }`. Never throws: this runs on a public endpoint.
 */
export function validateAnalyticsEvent(input) {
  if (!input || typeof input !== "object") return { ok: false, error: "not_an_object" };

  const type = String(input.event ?? "").trim();
  if (!CLIENT_EVENT_TYPES.includes(type)) return { ok: false, error: "unknown_event" };

  const sessionId = String(input.sessionId ?? "").trim();
  if (!isValidSessionId(sessionId)) return { ok: false, error: "invalid_session" };

  const landingPage = String(input.landingPage ?? "").trim().toLowerCase();
  if (!isValidSlug(landingPage)) return { ok: false, error: "invalid_landing_page" };

  const rawSlug = String(input.productSlug ?? "").trim().toLowerCase();
  const productSlug = rawSlug && isValidSlug(rawSlug) ? rawSlug : null;

  let outcome = null;
  if (type === "form_submit") {
    const o = String(input.outcome ?? "attempt").trim();
    if (!SUBMIT_OUTCOMES.includes(o)) return { ok: false, error: "invalid_outcome" };
    outcome = o;
  } else if (input.outcome != null) {
    // An outcome on anything but a submit is meaningless; refuse rather than
    // silently store a field that would skew the failure counts.
    return { ok: false, error: "outcome_not_allowed" };
  }

  const rawDetail = input.detail == null ? null : String(input.detail).trim();
  const detail = rawDetail ? rawDetail.slice(0, LIMITS.detail) : null;

  return { ok: true, value: { type, sessionId, landingPage, productSlug, outcome, detail } };
}

/* ── Funnel arithmetic ─────────────────────────────────────────────────── */

/**
 * A percentage, or null when there is nothing to divide by.
 *
 * Null rather than 0: "no visitors yet" and "visitors who all bounced" are
 * different facts, and showing 0% for the first is a lie the dashboard would
 * tell every morning before the first visit.
 */
export function rate(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Build the funnel from already-aggregated counts.
 *
 * `abandoned` is passed in rather than derived: it is a count of sessions that
 * started a form and never produced an order, which can only be answered by
 * grouping on session id. Subtracting orders from form starts would be wrong —
 * one person can start twice, return the next day, or order from a session that
 * began before the range.
 */
export function buildFunnel(counts) {
  const visitors = counts.visitors ?? 0;
  const formViews = counts.formViews ?? 0;
  const formStarts = counts.formStarts ?? 0;
  const submitAttempts = counts.submitAttempts ?? 0;
  const failedSubmissions = counts.failedSubmissions ?? 0;
  const orders = counts.orders ?? 0;
  const abandoned = counts.abandoned ?? 0;

  return {
    visitors,
    formViews,
    formStarts,
    submitAttempts,
    failedSubmissions,
    orders,
    abandoned,
    rates: {
      visitorsToFormViews: rate(formViews, visitors),
      formViewsToStarts: rate(formStarts, formViews),
      startsToSubmits: rate(submitAttempts, formStarts),
      submitsToOrders: rate(orders, submitAttempts),
      /** The headline: of everyone who arrived, how many bought. */
      conversion: rate(orders, visitors),
      /** Of everyone who began filling the form, how many finished. */
      formCompletion: rate(orders, formStarts),
      /** Its complement, counted from sessions rather than subtracted. */
      abandonment: rate(abandoned, formStarts),
    },
  };
}
