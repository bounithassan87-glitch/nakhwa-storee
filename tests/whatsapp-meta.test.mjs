// Meta WhatsApp Cloud API — the wire format, the phone form and the variable
// order, exercised against the SAME code the Worker runs.
//
// `shared/whatsapp-meta-payload.js` and `shared/whatsapp-templates.js` are the
// real modules the provider imports; nothing here is a mirror kept in step by
// hand. What is NOT covered here is the fetch plumbing in `meta.ts` (TypeScript,
// not loadable by the bare node test runner) — that is exercised end-to-end
// against a mock Graph endpoint in the integration run instead.
//
// No network and no database. Nothing here can reach Meta or message anyone.
import test from "node:test";
import assert from "node:assert/strict";

import { META_TEMPLATES, buildMetaTemplate } from "../shared/whatsapp-templates.js";
import {
  toMetaPhone,
  isSendablePhone,
  sanitizeVariable,
  buildMetaMessageBody,
  describeMetaError,
} from "../shared/whatsapp-meta-payload.js";

/* ── Variable order ───────────────────────────────────────────────────────
   Meta validates the COUNT of body parameters and never their meaning. Swap
   two and the customer reads their city where the price belongs, with no error
   raised anywhere. So the approved order is pinned here. */
test("PACK RAHA variables fill {{1}}…{{5}} in the approved order", () => {
  const built = buildMetaTemplate("bellevia-pack-raha", {
    name: "Hassan Test",
    productName: "PACK RAHA",
    total: "349",
    quantity: "1",
    city: "Casablanca",
  });
  assert.equal(built.name, "pack_raha_confirmation");
  assert.equal(built.language, "ar");
  assert.deepEqual(built.variables, ["Hassan Test", "PACK RAHA", "349", "1", "Casablanca"]);
});

test("the total is the bare number — «درهم» belongs to the approved template", () => {
  const built = buildMetaTemplate("bellevia-pack-raha", { total: "349" });
  assert.equal(built.variables[2], "349");
  assert.ok(!/درهم|DH/.test(built.variables[2]), "currency must not be duplicated into the variable");
});

test("a product with no approved template yields null rather than a guess", () => {
  for (const slug of ["bellevia-weight-gain", "bellevia-anti-joint-pain", "cache-terazo", null]) {
    assert.equal(buildMetaTemplate(slug, { name: "x" }), null, `${slug} must have no template`);
  }
});

test("only products with an APPROVED template have one registered", () => {
  // Two are approved today. This list is the guard against a third appearing
  // without someone having got it approved in WhatsApp Manager first.
  assert.deepEqual(Object.keys(META_TEMPLATES).sort(), ["bellevia-anti-lice", "bellevia-pack-raha"]);
});

test("the two approved templates are distinct and never cross", () => {
  const raha = buildMetaTemplate("bellevia-pack-raha", { name: "س", total: "349", quantity: "1", city: "ف" });
  const lice = buildMetaTemplate("bellevia-anti-lice", { name: "س", total: "299", quantity: "1", city: "ف" });
  assert.equal(raha.name, "pack_raha_confirmation");
  assert.equal(lice.name, "anti_lice_confirmation");
  assert.notEqual(raha.name, lice.name);
  assert.equal(raha.variables[1], "PACK RAHA");
  assert.equal(lice.variables[1], "PACK القمل");
});

test("the Anti-Lice total is bare — «درهم» belongs to its approved body", () => {
  // Approved body: «💰 المبلغ الإجمالي: {{3}} درهم» — the word is in the
  // template, so putting it in the variable would print it twice.
  const built = buildMetaTemplate("bellevia-anti-lice", { total: "299" });
  assert.equal(built.language, "ar");
  assert.equal(built.variables[2], "299");
  assert.ok(!/درهم|DH/.test(built.variables[2]));
});

/* ── Phone form ───────────────────────────────────────────────────────── */
test("Moroccan numbers reach Meta as 212XXXXXXXXX with no plus", () => {
  assert.equal(toMetaPhone("0612345678"), "212612345678");
  assert.equal(toMetaPhone("0712345678"), "212712345678");
  assert.equal(toMetaPhone("06 12 34 56 78"), "212612345678");
  assert.equal(toMetaPhone("06-12-34-56-78"), "212612345678");
  assert.equal(toMetaPhone("612345678"), "212612345678");
});

test("an already-international number does not get a second 212", () => {
  assert.equal(toMetaPhone("+212612345678"), "212612345678");
  assert.equal(toMetaPhone("212612345678"), "212612345678");
  // The `00` access prefix was the trap in the previous helper: it took the
  // leading-zero branch and produced 2120212… — 16 digits, silently wrong.
  assert.equal(toMetaPhone("00212612345678"), "212612345678");
});

test("unusable input is rejected, not sent", () => {
  assert.equal(toMetaPhone(""), null);
  assert.equal(toMetaPhone(null), null);
  assert.equal(isSendablePhone("212612345678"), true);
  assert.equal(isSendablePhone("21261234567"), false, "too short");
  assert.equal(isSendablePhone("2120212612345678"), false, "the double-prefix bug would be caught here");
  assert.equal(isSendablePhone("212112345678"), false, "not a mobile prefix");
});

/* ── The wire body ────────────────────────────────────────────────────── */
test("the request body is exactly what the Cloud API expects", () => {
  const template = buildMetaTemplate("bellevia-pack-raha", {
    name: "Hassan Test", productName: "PACK RAHA",
    total: "349", quantity: "1", city: "Casablanca",
  });
  const body = buildMetaMessageBody(toMetaPhone("+212600000000"), template);

  assert.equal(body.messaging_product, "whatsapp");
  assert.equal(body.recipient_type, "individual");
  assert.equal(body.type, "template");
  assert.equal(body.to, "212600000000");
  assert.equal(body.template.name, "pack_raha_confirmation");
  assert.deepEqual(body.template.language, { code: "ar" });
  assert.equal(body.template.components.length, 1);
  assert.equal(body.template.components[0].type, "body");
  assert.deepEqual(
    body.template.components[0].parameters,
    [
      { type: "text", text: "Hassan Test" },
      { type: "text", text: "PACK RAHA" },
      { type: "text", text: "349" },
      { type: "text", text: "1" },
      { type: "text", text: "Casablanca" },
    ],
  );
});

test("variables Meta would reject are flattened, not passed through", () => {
  // Newlines, tabs and runs of spaces are all rejected by the Cloud API.
  assert.equal(sanitizeVariable("Hassan\nBounit"), "Hassan Bounit");
  assert.equal(sanitizeVariable("Casa\t\tblanca"), "Casa blanca");
  assert.equal(sanitizeVariable("a    b"), "a b");
  assert.equal(sanitizeVariable("  trimmed  "), "trimmed");
  assert.equal(sanitizeVariable(null), "");
  assert.equal(sanitizeVariable("x".repeat(2000)).length, 900);
});

test("a customer-typed name cannot break the payload", () => {
  const t = buildMetaTemplate("bellevia-pack-raha", {
    name: "  حسن\n\nبونيت  ", productName: "PACK RAHA",
    total: "698", quantity: "2", city: "الدار   البيضاء",
  });
  const body = buildMetaMessageBody("212600000000", t);
  const texts = body.template.components[0].parameters.map((p) => p.text);
  assert.equal(texts[0], "حسن بونيت");
  assert.equal(texts[4], "الدار البيضاء");
  for (const v of texts) assert.ok(!/[\r\n\t]| {2,}/.test(v), `"${v}" must be flat`);
});

/* ── Errors ───────────────────────────────────────────────────────────── */
test("Meta's error keeps its code, which is what makes it actionable", () => {
  const detail = describeMetaError({
    error: {
      message: "Template name does not exist in the translation",
      type: "OAuthException", code: 132001, error_subcode: 2494010, fbtrace_id: "Axx",
    },
  }, "");
  assert.match(detail, /Template name does not exist/);
  assert.match(detail, /132001/);
  assert.match(detail, /2494010/);
});

test("a non-JSON error body still yields something an admin can read", () => {
  assert.equal(describeMetaError(null, "502 Bad Gateway"), "502 Bad Gateway");
  assert.equal(describeMetaError(null, ""), "");
});

test("the error description never carries a credential", () => {
  // Meta echoes no token, but assert the shape anyway: this string is stored on
  // the order and rendered in the dashboard.
  const detail = describeMetaError({ error: { message: "Invalid OAuth access token", code: 190 } }, "");
  assert.ok(!/Bearer|EAA[A-Za-z0-9]/.test(detail), "no token material in a stored error");
});
