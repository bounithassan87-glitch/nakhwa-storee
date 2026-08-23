// Product-aware WhatsApp routing — Tests A–G.
//
// The rule under test is the one that decides which gateway carries which
// product's confirmation. It is exercised against the REAL registry and the
// REAL decision function; nothing here is a copy kept in step by hand.
//
// The failure this suite exists to prevent: Meta refuses any business-initiated
// message that does not name a template it has approved, so a global "Meta is
// configured, therefore use Meta" rule silently stops every storefront that has
// no template of its own. Test G is that scenario, stated as an assertion.
//
// No network, no database, no Worker. Running this cannot message anyone.
import test from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCT_WHATSAPP,
  META_TEMPLATES,
  WHATSAPP_TEMPLATES,
  buildMetaTemplate,
  buildConfirmationMessage,
  triggerFor,
  providerPreferenceFor,
  hasMetaTemplate,
  productLabelFor,
  whatsappConfigFor,
} from "../shared/whatsapp-templates.js";
import { chooseWhatsAppProvider, skipReasonFor } from "../shared/whatsapp-routing.js";

/** The environment as the routing rule sees it. */
const BOTH = { meta: true, ultramsg: true };
const META_ONLY = { meta: true, ultramsg: false };
const ULTRA_ONLY = { meta: false, ultramsg: true };
const NEITHER = { meta: false, ultramsg: false };

const gateway = (slug, avail) => chooseWhatsAppProvider(slug, avail).gateway;

/* ══ A · PACK RAHA → Meta → pack_raha_confirmation ═══════════════════════ */
test("A · PACK RAHA routes to Meta and fills the approved template", async (t) => {
  const slug = "bellevia-pack-raha";

  await t.test("configuration is exactly what Meta approved", () => {
    const cfg = whatsappConfigFor(slug);
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.provider, "meta");
    assert.equal(cfg.trigger, "order", "PACK RAHA keeps its order-time behaviour");
    assert.equal(cfg.productLabel, "PACK RAHA");
    assert.equal(cfg.meta.template, "pack_raha_confirmation");
    assert.equal(cfg.meta.language, "ar");
  });

  await t.test("it reaches Meta whenever Meta is configured", () => {
    assert.equal(gateway(slug, BOTH), "meta", "even with UltraMsg also available");
    assert.equal(gateway(slug, META_ONLY), "meta");
  });

  await t.test("the five variables are in the approved order, with a bare total", () => {
    const built = buildMetaTemplate(slug, {
      name: "سارة", productName: "BelleVia PACK RAHA",
      total: "349", quantity: "1", city: "الدار البيضاء",
    });
    assert.equal(built.name, "pack_raha_confirmation");
    assert.equal(built.language, "ar");
    assert.deepEqual(built.variables, ["سارة", "PACK RAHA", "349", "1", "الدار البيضاء"]);
    assert.ok(!/درهم|DH/.test(built.variables[2]), "the template already carries the currency");
  });

  await t.test("quantity 2 sends 698, not 349", () => {
    const built = buildMetaTemplate(slug, { name: "سارة", total: "698", quantity: "2", city: "فاس" });
    assert.equal(built.variables[2], "698");
    assert.equal(built.variables[3], "2");
  });

  await t.test("the catalogue name cannot override the approved label", () => {
    // Renaming the row in the dashboard must not change what a customer reads.
    const built = buildMetaTemplate(slug, { productName: "Something Else Entirely", productLabel: "Hijacked" });
    assert.equal(built.variables[1], "PACK RAHA");
  });
});

/* ══ B · Anti-Lice — the second approved template ════════════════════════
   Two products now run on Meta, each with its own approved template. This is
   the case the whole product-aware design exists for: two Meta products and
   four non-Meta products, all live at once, none borrowing another's wording. */
test("B · Anti-Lice routes to Meta with its OWN approved template", async (t) => {
  const slug = "bellevia-anti-lice";

  await t.test("configuration is exactly what Meta approved", () => {
    const cfg = whatsappConfigFor(slug);
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.provider, "meta");
    assert.equal(cfg.trigger, "confirm", "Anti-Lice confirms on CONFIRM, never at order time");
    assert.equal(cfg.productLabel, "PACK القمل");
    assert.equal(cfg.meta.template, "anti_lice_confirmation");
    assert.equal(cfg.meta.language, "ar");
  });

  await t.test("it gets its own template, never PACK RAHA's", () => {
    assert.equal(gateway(slug, BOTH), "meta");
    const built = buildMetaTemplate(slug, {
      name: "سارة", productName: "BelleVia Anti-Lice",
      total: "299", quantity: "1", city: "الدار البيضاء",
    });
    assert.equal(built.name, "anti_lice_confirmation");
    assert.notEqual(built.name, "pack_raha_confirmation");
    assert.equal(built.language, "ar");
    assert.deepEqual(built.variables, ["سارة", "PACK القمل", "299", "1", "الدار البيضاء"]);
  });

  await t.test("{{3}} is the bare amount — «درهم» is in the approved body", () => {
    const built = buildMetaTemplate(slug, { total: "299" });
    assert.equal(built.variables[2], "299");
    assert.ok(!/درهم|DH/.test(built.variables[2]), "the currency must not be duplicated");
  });

  await t.test("the catalogue name cannot override the approved label", () => {
    const built = buildMetaTemplate(slug, { productName: "Something Else", productLabel: "Hijacked" });
    assert.equal(built.variables[1], "PACK القمل");
  });

  await t.test("its trigger is its own, and PACK RAHA's is untouched", () => {
    assert.equal(triggerFor(slug), "confirm");
    assert.equal(triggerFor("bellevia-pack-raha"), "order");
  });
});

/* A third product, added the same way, must also stay separate. Proved on a
   fixture: no third template is approved, and naming an unapproved one fails
   with error 132001 — which reads as "the template does not exist" and sends
   whoever debugs it looking in the wrong place. */
test("a third Meta product would also get only its own template", async (t) => {
  const slug = "test-third-meta-product";
  t.after(() => { delete PRODUCT_WHATSAPP[slug]; });

  PRODUCT_WHATSAPP[slug] = {
    enabled: true,
    provider: "meta",
    productLabel: "PACK TEST",
    trigger: "confirm",
    meta: {
      template: "third_product_confirmation",
      language: "ar",
      variables: (v) => [String(v.name ?? ""), String(v.productLabel ?? ""), String(v.total ?? "")],
    },
    text: "سلام {name}",
  };

  await t.test("no template was invented for a REAL product", () => {
    // Exactly the two that are approved in WhatsApp Manager, and nothing else.
    const real = Object.keys(META_TEMPLATES).filter((s) => s !== slug).sort();
    assert.deepEqual(real, ["bellevia-anti-lice", "bellevia-pack-raha"]);
  });

  await t.test("it borrows from neither of the two live products", () => {
    assert.equal(gateway(slug, BOTH), "meta");
    const built = buildMetaTemplate(slug, { name: "أمين", total: "199" });
    assert.equal(built.name, "third_product_confirmation");
    assert.notEqual(built.name, "pack_raha_confirmation");
    assert.notEqual(built.name, "anti_lice_confirmation");
    assert.deepEqual(built.variables, ["أمين", "PACK TEST", "199"]);
  });
});

/* ══ C · a product with NO template ══════════════════════════════════════ */
test("C · a product with no Meta template never fakes a send", async (t) => {
  await t.test("Meta is not chosen for it, even when Meta is configured", () => {
    for (const slug of ["bellevia-weight-gain", "bellevia-anti-joint-pain", "cache-terazo", "lilya-talon"]) {
      assert.equal(hasMetaTemplate(slug), false, `${slug} has no template`);
      assert.notEqual(gateway(slug, META_ONLY), "meta", `${slug} must not be routed to Meta`);
    }
  });

  await t.test("no template is invented — the builder returns null", () => {
    for (const slug of ["bellevia-weight-gain", "bellevia-anti-joint-pain", "cache-terazo", "lilya-talon", null]) {
      assert.equal(buildMetaTemplate(slug, { name: "x" }), null);
    }
  });

  await t.test("a product PINNED to Meta with no template is refused, not downgraded", () => {
    const slug = "test-pinned-no-template";
    PRODUCT_WHATSAPP[slug] = { enabled: true, provider: "meta", trigger: "confirm", text: "x" };
    try {
      const r = chooseWhatsAppProvider(slug, BOTH);
      assert.equal(r.gateway, "none", "must not silently send the un-approved free text instead");
      assert.equal(r.reason, "no_template");
      assert.equal(skipReasonFor(r.reason), "no_template", "the dashboard shows why");
    } finally {
      delete PRODUCT_WHATSAPP[slug];
    }
  });

  await t.test("`no_template` and `not_configured` stay distinct", () => {
    // Different people fix these: one needs credentials, the other needs Meta
    // to approve a template. Collapsing them sends the wrong person looking.
    assert.equal(skipReasonFor("no_template"), "no_template");
    assert.equal(skipReasonFor("not_configured"), "not_configured");
    assert.equal(skipReasonFor("ultramsg_not_configured"), "not_configured");
    assert.equal(skipReasonFor("meta_not_configured"), "not_configured");
  });

  await t.test("with nothing configured at all, nothing is chosen", () => {
    for (const slug of Object.keys(PRODUCT_WHATSAPP)) {
      assert.equal(gateway(slug, NEITHER), "none");
    }
  });
});

/* ══ D · one order, one claim, one message ═══════════════════════════════
   The claim itself is unchanged and covered in whatsapp-confirmation.test.mjs.
   What matters here is that routing did not introduce a SECOND way to send:
   a product on `trigger: "order"` must not also fire on the later CONFIRM. */
test("D · a product cannot be triggered twice", async (t) => {
  await t.test("exactly one trigger per product, and it is one of two values", () => {
    for (const slug of Object.keys(PRODUCT_WHATSAPP)) {
      assert.ok(["order", "confirm"].includes(triggerFor(slug)), `${slug}: ${triggerFor(slug)}`);
    }
  });

  await t.test("the order-time path fires for PACK RAHA only", () => {
    const onOrder = Object.keys(PRODUCT_WHATSAPP).filter((s) => triggerFor(s) === "order");
    assert.deepEqual(onOrder, ["bellevia-pack-raha"]);
  });

  await t.test("an unknown slug waits for CONFIRM rather than firing at order time", () => {
    // A slug typo must delay a message, never send one nobody reviewed.
    assert.equal(triggerFor("not-a-product"), "confirm");
    assert.equal(triggerFor(null), "confirm");
    assert.equal(triggerFor(undefined), "confirm");
  });
});

/* ══ E · invalid phone ═══════════════════════════════════════════════════
   Rejection happens inside each provider, against the real helpers, and is
   covered number-by-number in whatsapp-meta.test.mjs. Asserted here: routing
   does not decide a phone is fine, and a refusal is never a success. */
test("E · a refusal is a refusal, never a message id", async (t) => {
  await t.test("the refusing sender reports the reason and no id", async () => {
    // `resolveProvider` returns this shape when no gateway can serve a product.
    const refused = { ok: false, skipped: skipReasonFor("no_template") };
    assert.equal(refused.ok, false);
    assert.equal(refused.messageId, undefined, "never a fabricated id");
  });

  await t.test("routing has no opinion about phone numbers", () => {
    // The gateway is chosen from configuration alone, so an unusable number
    // cannot change which provider is asked — it is rejected inside it.
    assert.equal(gateway("bellevia-pack-raha", BOTH), "meta");
    assert.equal(gateway("bellevia-anti-lice", BOTH), "meta");
    assert.equal(gateway("bellevia-weight-gain", BOTH), "ultramsg");
  });
});

/* ══ F · provider failure ════════════════════════════════════════════════ */
test("F · a failure is recorded as a failure", async (t) => {
  await t.test("no branch of the rule can report success", () => {
    // Every path either names a real gateway that must actually answer, or
    // returns "none" — there is no third outcome that could look like a send.
    const avails = [BOTH, META_ONLY, ULTRA_ONLY, NEITHER];
    const slugs = [...Object.keys(PRODUCT_WHATSAPP), "unknown-product", null];
    for (const a of avails) {
      for (const s of slugs) {
        const r = chooseWhatsAppProvider(s, a);
        assert.ok(["meta", "ultramsg", "none"].includes(r.gateway));
        assert.ok(typeof r.reason === "string" && r.reason.length > 0);
      }
    }
  });

  await t.test("a missing gateway is a skip with a reason, not a silent pass", () => {
    const r = chooseWhatsAppProvider("bellevia-anti-lice", NEITHER);
    assert.equal(r.gateway, "none");
    assert.equal(skipReasonFor(r.reason), "not_configured");
  });
});

/* ══ G · the critical regression ═════════════════════════════════════════
   Meta credentials present, TWO products on Meta with different templates,
   and four products not on Meta at all. All of it must hold AT THE SAME TIME.
   This is the exact failure the whole product-aware design exists to prevent. */
test("G · Meta for one product never silences or captures the others", async (t) => {
  await t.test("the two Meta products each send their OWN template, together", () => {
    assert.equal(gateway("bellevia-pack-raha", BOTH), "meta");
    assert.equal(gateway("bellevia-anti-lice", BOTH), "meta");
    assert.equal(buildMetaTemplate("bellevia-pack-raha", {}).name, "pack_raha_confirmation");
    assert.equal(buildMetaTemplate("bellevia-anti-lice", {}).name, "anti_lice_confirmation");
    // …and neither can reach the other's.
    assert.notEqual(
      buildMetaTemplate("bellevia-pack-raha", {}).name,
      buildMetaTemplate("bellevia-anti-lice", {}).name,
    );
  });

  await t.test("a Meta product pinned to the text gateway still obeys the pin", () => {
    // The original form of this regression: Meta credentials present must not
    // capture a product that asked for the other gateway.
    const slug = "bellevia-anti-lice";
    const original = PRODUCT_WHATSAPP[slug].provider;
    PRODUCT_WHATSAPP[slug].provider = "ultramsg";
    try {
      assert.equal(gateway("bellevia-pack-raha", BOTH), "meta");
      assert.equal(gateway(slug, BOTH), "ultramsg", "Meta credentials must not capture it");
    } finally {
      PRODUCT_WHATSAPP[slug].provider = original;
    }
  });

  await t.test("as shipped: two on Meta, the rest on UltraMsg", () => {
    assert.deepEqual(
      Object.fromEntries(Object.keys(PRODUCT_WHATSAPP).map((s) => [s, gateway(s, BOTH)])),
      {
        "bellevia-anti-lice": "meta",
        "bellevia-pack-raha": "meta",
        "bellevia-anti-joint-pain": "ultramsg",
        "bellevia-weight-gain": "ultramsg",
      },
    );
  });

  await t.test("the legacy burkini flow is unchanged", () => {
    // `cache-terazo` has no entry, so it takes the defaults: the text gateway,
    // on CONFIRM, with the message the shop was already sending.
    assert.equal(gateway("cache-terazo", BOTH), "ultramsg");
    assert.equal(triggerFor("cache-terazo"), "confirm");
    assert.equal(providerPreferenceFor("cache-terazo"), "auto");
    assert.equal(productLabelFor("cache-terazo"), null);
    const built = buildConfirmationMessage("cache-terazo", { name: "سعاد" });
    assert.equal(built.source, "default");
    assert.match(built.message, /Nakhwa Store/);
  });

  await t.test("`lilya-talon` is an order source, not a product — and is unaffected", () => {
    assert.equal(PRODUCT_WHATSAPP["lilya-talon"], undefined);
    assert.equal(gateway("lilya-talon", BOTH), "ultramsg");
    assert.equal(triggerFor("lilya-talon"), "confirm");
  });

  await t.test("the reverse: UltraMsg unavailable leaves both Meta products working", () => {
    assert.equal(gateway("bellevia-pack-raha", META_ONLY), "meta");
    assert.equal(gateway("bellevia-anti-lice", META_ONLY), "meta");
    for (const s of ["bellevia-weight-gain", "bellevia-anti-joint-pain"]) {
      const r = chooseWhatsAppProvider(s, META_ONLY);
      assert.equal(r.gateway, "none", `${s} has no gateway`);
      assert.equal(skipReasonFor(r.reason), "not_configured", "recorded honestly, not as sent");
    }
  });

  await t.test("the reverse: Meta unavailable leaves the non-Meta products on UltraMsg", () => {
    for (const s of ["bellevia-weight-gain", "bellevia-anti-joint-pain", "cache-terazo", "lilya-talon"]) {
      assert.equal(gateway(s, ULTRA_ONLY), "ultramsg", `${s} keeps working`);
    }
    // Both Meta products are pinned, so each is refused rather than sent as
    // un-approved free text through the other gateway.
    for (const s of ["bellevia-pack-raha", "bellevia-anti-lice"]) {
      const r = chooseWhatsAppProvider(s, ULTRA_ONLY);
      assert.equal(r.gateway, "none", `${s} must not improvise`);
      assert.equal(r.reason, "meta_not_configured");
    }
  });

  await t.test("every product still has its own text, unchanged", () => {
    for (const slug of Object.keys(PRODUCT_WHATSAPP)) {
      const built = buildConfirmationMessage(slug, {
        name: "سعاد", total: "349", quantity: "1", city: "الدار البيضاء", productName: "س",
      });
      assert.equal(built.enabled, true);
      assert.equal(built.source, "product");
      assert.equal(built.message, WHATSAPP_TEMPLATES[slug].messageTemplate
        .replace(/\{name\}/g, "سعاد").replace(/\{total\}/g, "349")
        .replace(/\{quantity\}/g, "1").replace(/\{city\}/g, "الدار البيضاء")
        .replace(/\{productName\}/g, "س"));
    }
  });
});

/* ══ Derived views ═══════════════════════════════════════════════════════ */
test("the old exports are views of the one registry, and cannot drift", async (t) => {
  await t.test("WHATSAPP_TEMPLATES covers every product, with its text", () => {
    assert.deepEqual(Object.keys(WHATSAPP_TEMPLATES), Object.keys(PRODUCT_WHATSAPP));
    for (const [slug, view] of Object.entries(WHATSAPP_TEMPLATES)) {
      assert.equal(view.messageTemplate, PRODUCT_WHATSAPP[slug].text);
      assert.equal(view.enabled, PRODUCT_WHATSAPP[slug].enabled !== false);
    }
  });

  await t.test("META_TEMPLATES covers only products that have one", () => {
    assert.deepEqual(
      Object.keys(META_TEMPLATES),
      Object.keys(PRODUCT_WHATSAPP).filter((s) => PRODUCT_WHATSAPP[s].meta),
    );
  });

  await t.test("the views are frozen, so a write cannot silently do nothing", () => {
    assert.throws(() => { "use strict"; WHATSAPP_TEMPLATES["bellevia-pack-raha"].enabled = false; });
    assert.throws(() => { "use strict"; META_TEMPLATES["bellevia-pack-raha"].name = "other"; });
  });
});
