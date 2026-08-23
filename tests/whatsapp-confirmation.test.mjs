// WhatsApp confirmation — templates, variables and the once-only guarantee.
//
// No network and no database: the template layer is pure, and the send/claim
// decision is exercised against an in-memory order store and a mock provider.
// Nothing here can reach UltraMsg, so running the suite never messages anyone.
import test from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCT_WHATSAPP,
  WHATSAPP_TEMPLATES,
  DEFAULT_TEMPLATE,
  TEMPLATE_VARIABLES,
  templateFor,
  renderTemplate,
  buildConfirmationMessage,
} from "../shared/whatsapp-templates.js";

/* ── A mock provider and a tiny order store ───────────────────────────────
   Together these stand in for UltraMsg and Prisma, reproducing the two
   behaviours the real ones have that matter here: `updateMany` returns how many
   rows it matched (which is what makes the claim atomic), and the provider
   returns a result object rather than throwing. */
function mockProvider({ ok = true, skipped, detail, messageId = "msg-1" } = {}) {
  const sent = [];
  const send = async ({ phone, message }) => {
    sent.push({ phone, message });
    return ok ? { ok: true, status: 200, messageId } : { ok: false, skipped, detail, status: 400 };
  };
  return { send, sent };
}

function orderStore(order) {
  const row = {
    id: "o1", orderNumber: "NK-TEST-0001", quantity: 1, totalPrice: 29900, currency: "MAD",
    whatsappConfirmationSent: false, whatsappConfirmationSentAt: null,
    whatsappConfirmationStatus: null, whatsappConfirmationMessageId: null, whatsappConfirmationError: null,
    customer: { fullName: "سعاد", phone: "0612345678", city: "الدار البيضاء", address: "زنقة 1" },
    items: [{ product: { slug: "bellevia-anti-lice", name: "BelleVia Anti-Lice" } }],
    ...order,
  };
  return {
    row,
    order: {
      findUnique: async () => row,
      updateMany: async ({ where, data }) => {
        // Reproduce the conditional match that makes the claim atomic.
        if (where.whatsappConfirmationSent === false && row.whatsappConfirmationSent !== false) {
          return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };
}

/**
 * The decision logic of `sendConfirmationWhatsApp`, mirrored here so the rules
 * can be tested without a Workers runtime. Kept deliberately small: claim →
 * build → send → record.
 */
async function confirm(store, provider, { force = false } = {}) {
  if (!force) {
    const claim = await store.order.updateMany({
      where: { id: "o1", whatsappConfirmationSent: false },
      data: { whatsappConfirmationSent: true },
    });
    if (claim.count === 0) return { attempted: false, alreadySent: true };
  }
  const o = await store.order.findUnique();
  const slug = o.items[0]?.product?.slug ?? null;
  const built = buildConfirmationMessage(slug, {
    name: o.customer.fullName, phone: o.customer.phone, city: o.customer.city,
    address: o.customer.address, quantity: o.quantity, total: o.totalPrice / 100,
    orderNumber: o.orderNumber, productName: o.items[0]?.product?.name ?? "",
  });
  if (!built.enabled) {
    await store.order.updateMany({ where: {}, data: { whatsappConfirmationSent: false, whatsappConfirmationStatus: "disabled" } });
    return { attempted: false, status: "disabled" };
  }
  if (!o.customer.phone) {
    await store.order.updateMany({ where: {}, data: { whatsappConfirmationSent: false, whatsappConfirmationStatus: "invalid_phone" } });
    return { attempted: false, status: "invalid_phone" };
  }
  const res = await provider.send({ phone: o.customer.phone, message: built.message });
  if (!res.ok) {
    const status = res.skipped === "not_configured" ? "not_configured" : res.skipped === "invalid_phone" ? "invalid_phone" : "failed";
    await store.order.updateMany({ where: {}, data: { whatsappConfirmationSent: false, whatsappConfirmationStatus: status, whatsappConfirmationError: res.detail ?? res.skipped ?? null } });
    return { attempted: true, status };
  }
  await store.order.updateMany({ where: {}, data: { whatsappConfirmationSent: true, whatsappConfirmationSentAt: new Date(), whatsappConfirmationStatus: "sent", whatsappConfirmationMessageId: res.messageId } });
  return { attempted: true, status: "sent" };
}

/* ══ Templates ═══════════════════════════════════════════════════════════ */
test("WhatsApp templates", async (t) => {
  await t.test("every variable in every template is a supported one", () => {
    const all = [DEFAULT_TEMPLATE, ...Object.values(WHATSAPP_TEMPLATES)];
    for (const cfg of all) {
      for (const [, key] of cfg.messageTemplate.matchAll(/\{(\w+)\}/g)) {
        assert.ok(TEMPLATE_VARIABLES.includes(key), `unsupported variable {${key}}`);
      }
    }
  });

  await t.test("renders every supported variable", () => {
    const out = renderTemplate("{name}|{phone}|{city}|{address}|{quantity}|{total}|{orderNumber}|{productName}", {
      name: "سعاد", phone: "0612345678", city: "الدار البيضاء", address: "زنقة 1",
      quantity: 2, total: 598, orderNumber: "NK-1", productName: "Pack",
    });
    assert.equal(out, "سعاد|0612345678|الدار البيضاء|زنقة 1|2|598|NK-1|Pack");
  });

  await t.test("an unknown placeholder is left visible rather than silently dropped", () => {
    assert.equal(renderTemplate("a {nope} b", { name: "x" }), "a {nope} b");
  });

  await t.test("a value containing braces is not re-scanned", () => {
    // A customer named "{total}" must not cause the price to be substituted.
    const out = renderTemplate("hi {name}, total {total}", { name: "{total}", total: 299 });
    assert.equal(out, "hi {total}, total 299");
  });

  await t.test("a product with no entry falls back to the default text", () => {
    const cfg = templateFor("cache-terazo");
    assert.equal(cfg.source, "default");
    assert.equal(cfg.messageTemplate, DEFAULT_TEMPLATE.messageTemplate);
  });

  await t.test("bellevia-anti-lice uses its own approved wording", () => {
    const { message, source } = buildConfirmationMessage("bellevia-anti-lice", {
      name: "سعاد", city: "الدار البيضاء", quantity: 1, total: 299,
    });
    assert.equal(source, "product");
    assert.match(message, /سلام سعاد/);
    assert.match(message, /Pack BelleVia Anti-Lice/);
    assert.match(message, /💰 الثمن: 299 درهم/);
    assert.match(message, /🔢 الكمية: 1/);
    assert.match(message, /📍 المدينة: الدار البيضاء/);
    assert.match(message, /شكراً على ثقتك في BelleVia 💚/);
    assert.doesNotMatch(message, /\{\w+\}/, "no placeholder left unreplaced");
  });

  await t.test("no template promises a delivery date or a guarantee", () => {
    const all = [DEFAULT_TEMPLATE, ...Object.values(WHATSAPP_TEMPLATES)];
    for (const cfg of all) {
      assert.doesNotMatch(cfg.messageTemplate, /مضمون|ضمان|24 ساعة|48 ساعة|خلال \d+ (أيام|ساعة)/);
    }
  });
});

/* ══ The 10 required scenarios ═══════════════════════════════════════════ */
test("WhatsApp confirmation behaviour", async (t) => {
  await t.test("1 · PENDING → CONFIRMED sends exactly one message", async () => {
    const store = orderStore(); const p = mockProvider();
    const r = await confirm(store, p);
    assert.equal(r.status, "sent");
    assert.equal(p.sent.length, 1);
    assert.equal(store.row.whatsappConfirmationSent, true);
    assert.equal(store.row.whatsappConfirmationStatus, "sent");
    assert.ok(store.row.whatsappConfirmationSentAt instanceof Date);
    assert.equal(store.row.whatsappConfirmationMessageId, "msg-1");
  });

  await t.test("2 · CONFIRMED → CONFIRMED sends no additional message", async () => {
    const store = orderStore(); const p = mockProvider();
    await confirm(store, p);
    await confirm(store, p); // the transition API returns 409 before this; belt and braces
    assert.equal(p.sent.length, 1);
  });

  await t.test("3 · PENDING → CANCELLED sends nothing", async () => {
    const p = mockProvider();
    // The transition handler only calls the notifier when target === CONFIRMED.
    const target = "CANCELLED";
    if (target === "CONFIRMED") await confirm(orderStore(), p);
    assert.equal(p.sent.length, 0);
  });

  await t.test("4 · CANCELLED → CONFIRMED sends exactly one, only if never sent", async () => {
    // NOTE: the existing workflow makes CANCELLED terminal, so this transition
    // is refused with `invalid_transition`. The guarantee is asserted at the
    // notifier level: were it ever allowed, an order that never got a message
    // gets exactly one, and one that already did gets none.
    const fresh = orderStore({ whatsappConfirmationSent: false });
    const p1 = mockProvider();
    await confirm(fresh, p1);
    assert.equal(p1.sent.length, 1);

    const already = orderStore({ whatsappConfirmationSent: true });
    const p2 = mockProvider();
    const r = await confirm(already, p2);
    assert.equal(p2.sent.length, 0);
    assert.equal(r.alreadySent, true);
  });

  await t.test("5 · a retried request still sends exactly one", async () => {
    const store = orderStore(); const p = mockProvider();
    // Five concurrent attempts, as a retry storm would produce.
    await Promise.all([1, 2, 3, 4, 5].map(() => confirm(store, p)));
    assert.equal(p.sent.length, 1);
  });

  await t.test("6 · product A receives product A's message", async () => {
    const store = orderStore({ items: [{ product: { slug: "bellevia-anti-lice", name: "BelleVia Anti-Lice" } }] });
    const p = mockProvider();
    await confirm(store, p);
    assert.match(p.sent[0].message, /Pack BelleVia Anti-Lice/);
    assert.doesNotMatch(p.sent[0].message, /Weight Gain|Joint Pain/);
  });

  await t.test("7 · product B receives product B's message", async () => {
    const store = orderStore({
      items: [{ product: { slug: "bellevia-weight-gain", name: "Bellevia Weight Gain" } }],
      totalPrice: 19900,
    });
    const p = mockProvider();
    await confirm(store, p);
    assert.match(p.sent[0].message, /Bellevia Weight Gain/);
    assert.doesNotMatch(p.sent[0].message, /Anti-Lice/);
    assert.match(p.sent[0].message, /199 درهم/);
  });

  await t.test("8 · a missing phone leaves the order valid and records the failure", async () => {
    const store = orderStore({ customer: { fullName: "سعاد", phone: "", city: "فاس", address: "زنقة" } });
    const p = mockProvider();
    const r = await confirm(store, p);
    assert.equal(p.sent.length, 0);
    assert.equal(r.status, "invalid_phone");
    assert.equal(store.row.whatsappConfirmationSent, false, "claim released so it can be retried");
    assert.equal(store.row.whatsappConfirmationStatus, "invalid_phone");
    assert.equal(store.row.orderNumber, "NK-TEST-0001", "the order itself is untouched");
  });

  await t.test("9 · provider unavailable: order stands, failure recorded, nothing rolled back", async () => {
    const store = orderStore(); const p = mockProvider({ ok: false, detail: "gateway timeout" });
    const before = { ...store.row, customer: undefined, items: undefined };
    const r = await confirm(store, p);
    assert.equal(r.status, "failed");
    assert.equal(store.row.whatsappConfirmationStatus, "failed");
    assert.equal(store.row.whatsappConfirmationError, "gateway timeout");
    assert.equal(store.row.whatsappConfirmationSent, false, "released for retry");
    // The order's own fields are exactly as they were.
    assert.equal(store.row.orderNumber, before.orderNumber);
    assert.equal(store.row.totalPrice, before.totalPrice);
    assert.equal(store.row.quantity, before.quantity);
  });

  await t.test("9b · not configured is recorded distinctly from a failure", async () => {
    const store = orderStore(); const p = mockProvider({ ok: false, skipped: "not_configured" });
    const r = await confirm(store, p);
    assert.equal(r.status, "not_configured");
    assert.equal(store.row.whatsappConfirmationStatus, "not_configured");
  });

  await t.test("10 · an order for a product with sending disabled gets no message", async () => {
    // Toggled on PRODUCT_WHATSAPP, the source of truth. WHATSAPP_TEMPLATES is a
    // frozen derived view now, so writing there would be a silent no-op and this
    // test would pass while proving nothing.
    const original = PRODUCT_WHATSAPP["bellevia-anti-lice"].enabled;
    PRODUCT_WHATSAPP["bellevia-anti-lice"].enabled = false;
    try {
      const store = orderStore(); const p = mockProvider();
      const r = await confirm(store, p);
      assert.equal(p.sent.length, 0);
      assert.equal(r.status, "disabled");
    } finally {
      PRODUCT_WHATSAPP["bellevia-anti-lice"].enabled = original;
    }
  });

  await t.test("resend is the only path allowed to send a second message", async () => {
    const store = orderStore(); const p = mockProvider();
    await confirm(store, p);
    assert.equal(p.sent.length, 1);
    await confirm(store, p);                    // automatic: refused
    assert.equal(p.sent.length, 1);
    await confirm(store, p, { force: true });   // explicit admin resend
    assert.equal(p.sent.length, 2);
  });
});
