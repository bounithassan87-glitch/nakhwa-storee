// Landing-page funnel: event validation, funnel arithmetic, and store-local days.
//
// The endpoint and the browser script both import these exact functions, so
// what is asserted here is what runs. The numbers matter: a funnel is read to
// decide where to spend money, and a rate that is quietly wrong is worse than
// no rate at all.
import test from "node:test";
import assert from "node:assert/strict";

import {
  validateAnalyticsEvent,
  buildFunnel,
  rate,
  isValidSessionId,
  isValidSlug,
  EVENT_TYPES,
  CLIENT_EVENT_TYPES,
} from "../shared/analytics-events.js";

import {
  STORE_TIMEZONE,
  startOfStoreDay,
  endOfStoreDay,
  storeDayKey,
  addStoreDays,
  resolveStoreRange,
  zoneOffsetMs,
} from "../shared/store-time.js";

const SID = "nks_abcdef0123456789abcd";

/* ── 1. Event validation ───────────────────────────────────────────────── */

test("a well-formed page_view is accepted and normalised", () => {
  const r = validateAnalyticsEvent({
    event: "page_view",
    sessionId: SID,
    landingPage: "Bellevia-Anti-Lice",
    productSlug: "Bellevia-Anti-Lice",
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.type, "page_view");
  assert.equal(r.value.landingPage, "bellevia-anti-lice", "lower-cased so grouping is stable");
  assert.equal(r.value.outcome, null);
});

test("order_success can never be reported by the browser", () => {
  // The browser could otherwise claim a sale that was refused.
  assert.ok(!CLIENT_EVENT_TYPES.includes("order_success"));
  assert.ok(EVENT_TYPES.includes("order_success"), "but the server still writes it");
  const r = validateAnalyticsEvent({ event: "order_success", sessionId: SID, landingPage: "x" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "unknown_event");
});

test("an unknown event is rejected", () => {
  for (const event of ["purchase", "click", "", "form_startx", "../../etc", null, 42]) {
    const r = validateAnalyticsEvent({ event, sessionId: SID, landingPage: "x" });
    assert.equal(r.ok, false, String(event));
    assert.equal(r.error, "unknown_event");
  }
});

test("a missing or malformed sessionId is rejected, never invented", () => {
  for (const sessionId of [undefined, null, "", "abc", "nks_short", "'; DROP TABLE \"Order\";--", SID + "x".repeat(60)]) {
    const r = validateAnalyticsEvent({ event: "page_view", sessionId, landingPage: "x" });
    assert.equal(r.ok, false, String(sessionId));
    assert.equal(r.error, "invalid_session");
  }
  assert.equal(isValidSessionId(SID), true);
});

test("a malformed landing page is rejected — it is grouped on, not free text", () => {
  for (const landingPage of [undefined, "", "../admin", "a b", "UPPER CASE!", "x".repeat(90), "-leading"]) {
    const r = validateAnalyticsEvent({ event: "page_view", sessionId: SID, landingPage });
    assert.equal(r.ok, false, String(landingPage));
  }
  assert.equal(isValidSlug("bellevia-anti-lice"), true);
  assert.equal(isValidSlug("home"), true);
});

test("an outcome is allowed only on form_submit", () => {
  const ok = validateAnalyticsEvent({ event: "form_submit", sessionId: SID, landingPage: "x", outcome: "failure" });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.outcome, "failure");

  const bad = validateAnalyticsEvent({ event: "form_start", sessionId: SID, landingPage: "x", outcome: "success" });
  assert.equal(bad.ok, false, "an outcome elsewhere would skew the failure counts");
  assert.equal(bad.error, "outcome_not_allowed");
});

test("form_submit defaults to an attempt, and refuses a bogus outcome", () => {
  const d = validateAnalyticsEvent({ event: "form_submit", sessionId: SID, landingPage: "x" });
  assert.equal(d.value.outcome, "attempt");
  const b = validateAnalyticsEvent({ event: "form_submit", sessionId: SID, landingPage: "x", outcome: "maybe" });
  assert.equal(b.ok, false);
});

test("a bad productSlug is dropped rather than failing the event", () => {
  // The page identity is what matters; a malformed product name should not
  // cost us the visit.
  const r = validateAnalyticsEvent({ event: "page_view", sessionId: SID, landingPage: "home", productSlug: "!!bad!!" });
  assert.equal(r.ok, true);
  assert.equal(r.value.productSlug, null);
});

test("detail is bounded, so a huge body cannot fill the column", () => {
  const r = validateAnalyticsEvent({
    event: "form_submit", sessionId: SID, landingPage: "x", detail: "e".repeat(5000),
  });
  assert.equal(r.value.detail.length, 120);
});

test("validation never throws, whatever it is handed", () => {
  for (const bad of [null, undefined, 0, "", [], { event: {} }, { event: "page_view" }]) {
    const r = validateAnalyticsEvent(bad);
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, "string");
  }
});

/* ── 2. Funnel arithmetic ──────────────────────────────────────────────── */

test("a rate with no denominator is null, never NaN or Infinity", () => {
  assert.equal(rate(5, 0), null);
  assert.equal(rate(0, 0), null);
  assert.equal(rate(1, -1), null);
  assert.equal(rate(NaN, 10), null);
  assert.equal(rate(3, 10), 30);
});

test("an empty funnel shows no rates rather than zeroes", () => {
  const f = buildFunnel({});
  assert.equal(f.visitors, 0);
  for (const [k, v] of Object.entries(f.rates)) {
    assert.equal(v, null, `${k} must be null before there is anything to divide`);
  }
});

test("a realistic funnel computes every rate correctly", () => {
  const f = buildFunnel({
    visitors: 1000, formViews: 600, formStarts: 200,
    submitAttempts: 120, failedSubmissions: 20, orders: 100, abandoned: 100,
  });
  assert.equal(f.rates.visitorsToFormViews, 60);
  assert.equal(f.rates.formViewsToStarts, 33.3);
  assert.equal(f.rates.startsToSubmits, 60);
  assert.equal(f.rates.submitsToOrders, 83.3);
  assert.equal(f.rates.conversion, 10, "orders out of everyone who arrived");
  assert.equal(f.rates.formCompletion, 50, "orders out of everyone who started");
  assert.equal(f.rates.abandonment, 50);
});

test("completion and abandonment are independent counts, not forced to 100%", () => {
  // They only sum to 100 when every starter either ordered or abandoned within
  // the window. A session that started yesterday and ordered today breaks that,
  // and the numbers must be allowed to say so rather than being normalised.
  const f = buildFunnel({ formStarts: 10, orders: 8, abandoned: 5 });
  assert.equal(f.rates.formCompletion, 80);
  assert.equal(f.rates.abandonment, 50);
});

test("submit attempts are not orders — a failed submit never counts as a sale", () => {
  const f = buildFunnel({ visitors: 100, formStarts: 50, submitAttempts: 40, failedSubmissions: 15, orders: 25 });
  assert.equal(f.orders, 25);
  assert.equal(f.submitAttempts, 40);
  assert.notEqual(f.orders, f.submitAttempts);
  assert.equal(f.rates.submitsToOrders, 62.5);
});

/* ── 3. Store-local day boundaries ─────────────────────────────────────── */

test("the store timezone is Morocco, resolved through the IANA database", () => {
  assert.equal(STORE_TIMEZONE, "Africa/Casablanca");
  // Not hardcoded to +1: Morocco moves to UTC+0 for Ramadan, so the offset must
  // come from the zone data rather than a constant.
  const off = zoneOffsetMs(new Date("2026-08-30T12:00:00Z"));
  assert.ok(off === 3_600_000 || off === 0, `unexpected offset ${off}`);
});

test("23:30 UTC belongs to the NEXT store day — the exact bug being fixed", () => {
  // 23:30 UTC is 00:30 in Casablanca, i.e. already tomorrow. Under the old UTC
  // boundaries this order was reported against the previous day.
  const instant = new Date("2026-08-30T23:30:00Z");
  assert.equal(storeDayKey(instant), "2026-08-31", "store-local day");
  assert.equal(instant.toISOString().slice(0, 10), "2026-08-30", "UTC day — the old, wrong answer");
});

test("00:30 store time falls inside that same store day's window", () => {
  const instant = new Date("2026-08-30T23:30:00Z"); // = 00:30 local on the 31st
  const start = startOfStoreDay(instant);
  const end = endOfStoreDay(instant);
  assert.ok(start <= instant && instant <= end, "the instant must sit inside its own day");
  assert.equal(storeDayKey(start), "2026-08-31");
  assert.equal(storeDayKey(end), "2026-08-31");
});

test("a store day starts at local midnight and is one millisecond short of 24h", () => {
  const start = startOfStoreDay(new Date("2026-08-30T12:00:00Z"));
  const end = endOfStoreDay(new Date("2026-08-30T12:00:00Z"));
  assert.equal(end.getTime() - start.getTime(), 86_400_000 - 1);
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(start);
  assert.equal(hhmm, "00:00", "the day begins at local midnight, not 01:00");
});

test("an instant just before local midnight stays on the earlier day", () => {
  // 22:30 UTC = 23:30 local, still the 30th.
  assert.equal(storeDayKey(new Date("2026-08-30T22:30:00Z")), "2026-08-30");
  assert.equal(storeDayKey(new Date("2026-08-30T23:30:00Z")), "2026-08-31");
});

test("adding store days steps whole local days", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  assert.equal(storeDayKey(addStoreDays(now, -1)), "2026-08-29");
  assert.equal(storeDayKey(addStoreDays(now, -6)), "2026-08-24");
  assert.equal(storeDayKey(addStoreDays(now, 1)), "2026-08-31");
});

/* ── 4. Dashboard ranges ───────────────────────────────────────────────── */

test("every documented range key resolves to a sane window", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  for (const key of ["today", "yesterday", "last7", "last30", "thisMonth", "custom"]) {
    const r = resolveStoreRange(key, null, null, now);
    assert.ok(r.from instanceof Date && r.to instanceof Date, key);
    assert.ok(r.from <= r.to, `${key}: from must not exceed to`);
  }
});

test("today and yesterday are adjacent and do not overlap", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  const today = resolveStoreRange("today", null, null, now);
  const yest = resolveStoreRange("yesterday", null, null, now);
  assert.equal(storeDayKey(today.from), "2026-08-30");
  assert.equal(storeDayKey(yest.from), "2026-08-29");
  assert.equal(today.from.getTime() - yest.to.getTime(), 1, "no gap, no overlap");
});

test("an unknown range key falls back to last7, as it always did", () => {
  const r = resolveStoreRange("nonsense", null, null, new Date("2026-08-30T12:00:00Z"));
  assert.equal(r.key, "last7");
});

test("last7 covers seven store days including today", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  const r = resolveStoreRange("last7", null, null, now);
  assert.equal(storeDayKey(r.from), "2026-08-24");
  assert.equal(storeDayKey(r.to), "2026-08-30");
});

test("thisMonth starts on the first of the local month", () => {
  const r = resolveStoreRange("thisMonth", null, null, new Date("2026-08-30T12:00:00Z"));
  assert.equal(storeDayKey(r.from), "2026-08-01");
});

test("a custom range honours both ends in local time", () => {
  const r = resolveStoreRange("custom", "2026-08-01", "2026-08-15", new Date("2026-08-30T12:00:00Z"));
  assert.equal(storeDayKey(r.from), "2026-08-01");
  assert.equal(storeDayKey(r.to), "2026-08-15");
  assert.equal(r.key, "custom");
});

test("a custom range with junk dates falls back rather than throwing", () => {
  const r = resolveStoreRange("custom", "not-a-date", "also-bad", new Date("2026-08-30T12:00:00Z"));
  assert.ok(r.from <= r.to);
});

test("a late-evening order lands in today's range, not yesterday's", () => {
  // The operational point of the whole timezone change.
  const orderAt = new Date("2026-08-30T23:30:00Z"); // 00:30 local on the 31st
  const now = new Date("2026-08-31T09:00:00Z");
  const today = resolveStoreRange("today", null, null, now);
  assert.ok(orderAt >= today.from && orderAt <= today.to, "must count toward the 31st");
  const yest = resolveStoreRange("yesterday", null, null, now);
  assert.ok(!(orderAt >= yest.from && orderAt <= yest.to), "and not toward the 30th");
});
