// Per-product WhatsApp confirmation messages.
//
// One message per product, keyed by the same slug that joins a landing page, a
// catalog row and `/api/orders`. The order API and the admin confirm flow read
// this file; neither of them knows the name of any individual product, so
// adding a storefront is a new entry here and nothing else.
//
// Nothing in a template may promise something the shop has not committed to —
// no delivery date, no guarantee, no medical claim. A confirmation message says
// the order arrived and that a human will call. That is all it is for.

/**
 * The variables a template may use. Anything else in braces is left alone, so a
 * typo shows up in the message as `{whatever}` instead of silently vanishing.
 */
export const TEMPLATE_VARIABLES = [
  "name",
  "phone",
  "city",
  "address",
  "quantity",
  "total",
  "orderNumber",
  "productName",
];

/**
 * The message used for a product with no entry below.
 *
 * This is the text the shop was already sending before per-product messages
 * existed, kept verbatim so products that were live keep their exact wording.
 */
export const DEFAULT_TEMPLATE = {
  enabled: true,
  messageTemplate: [
    "السلام عليكم،",
    "",
    "شكراً لاختياركم Nakhwa Store 🌿",
    "",
    "تم التوصل بطلبكم بنجاح ✅",
    "",
    "سيتواصل معكم فريقنا قريباً لتأكيد الطلب والعنوان قبل الشحن.",
    "",
    "شكراً على ثقتكم 💚",
  ].join("\n"),
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRODUCT_WHATSAPP — the single source of truth for how one product confirms.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Everything the send path needs to know about a product lives in one entry:
 * whether it confirms at all, which gateway, what the customer is told the
 * product is called, when the message fires, and — for Meta — which approved
 * template and in what variable order.
 *
 * There used to be two registries describing the same products (free text here,
 * Meta templates elsewhere). Adding a storefront meant editing both, and they
 * could disagree without anything complaining. `WHATSAPP_TEMPLATES` and
 * `META_TEMPLATES` are now DERIVED from this object, so the old names still
 * work for every existing caller and test while there is only one place to edit.
 *
 * Fields:
 *   enabled       false sends nothing for this product, whatever else is set.
 *   provider      "meta" | "ultramsg" | "auto". See `resolveProvider`. "auto"
 *                 picks Meta only when this product HAS a Meta template, which
 *                 is what stops one product's Meta setup from muting the rest.
 *   productLabel  what the customer is told they bought. Optional; falls back to
 *                 the catalogue row's name.
 *   trigger       "order"   — fires the moment the order commits
 *                 "confirm" — fires when an admin presses CONFIRM (the default)
 *                 Resend works for both, and the atomic claim is shared, so a
 *                 product on "order" cannot also send on the later CONFIRM.
 *   text          the free-form message a text gateway sends, verbatim.
 *   meta          present ONLY when a template is genuinely approved in
 *                 WhatsApp Manager. Never invent one: naming an unapproved
 *                 template fails with error 132001, which reads as "template
 *                 does not exist" and sends whoever debugs it the wrong way.
 */
export const PRODUCT_WHATSAPP = {
  "bellevia-anti-lice": {
    enabled: true,
    provider: "meta",
    // What the customer is told they bought — {{2}} in the approved body. Pinned
    // here so renaming the catalogue row cannot change the wording Meta approved.
    productLabel: "PACK القمل",
    // Unchanged: this product confirms when an admin presses CONFIRM, never at
    // order time. Its approved body says «تم استلام طلبكم بنجاح», which the shop
    // sends once a human has looked at the order.
    trigger: "confirm",
    meta: {
      // Approved body (ar):
      //   السلام عليكم {{1}} 👋
      //   تم استلام طلبكم بنجاح لمنتج {{2}}.
      //   💰 المبلغ الإجمالي: {{3}} درهم   ← «درهم» is IN the template, so {{3}}
      //   📦 الكمية: {{4}}                   is the bare number
      //   📍 المدينة: {{5}}
      template: "anti_lice_confirmation",
      language: "ar",
      variables: (v) => [
        String(v.name ?? ""),                    // {{1}} customer name
        String(v.productLabel ?? "PACK القمل"),  // {{2}} product, as the customer reads it
        String(v.total ?? ""),                   // {{3}} total, digits only
        String(v.quantity ?? ""),                // {{4}} quantity
        String(v.city ?? ""),                    // {{5}} city
      ],
    },
    // Kept as the text a plain gateway would send. Unused while `provider` is
    // "meta", and unchanged, so nothing about this product's wording moves.
    text: [
      "سلام {name} 👋",
      "",
      "توصلنا بطلبك ديال Pack BelleVia Anti-Lice بنجاح ✅",
      "",
      "📦 الطلب: Pack BelleVia Anti-Lice",
      "💰 الثمن: {total} درهم",
      "🔢 الكمية: {quantity}",
      "📍 المدينة: {city}",
      "",
      "غادي يتواصل معاك واحد من الفريق ديالنا قريباً باش يأكد معاك المعلومات وموعد التوصيل.",
      "",
      "خلي التليفون قريب منك باش ما يفوتكش الاتصال 📞",
      "",
      "شكراً على ثقتك في BelleVia 💚",
    ].join("\n"),
  },

  "bellevia-pack-raha": {
    enabled: true,
    // The one product with an approved Meta template today.
    provider: "meta",
    productLabel: "PACK RAHA",
    // Its approved body reads «تم استلام طلبك» — an acknowledgement of receipt,
    // true at the moment the order arrives, not later. Kept as it already
    // behaves; the claim means the subsequent CONFIRM sends nothing.
    trigger: "order",
    meta: {
      // Approved body (ar, Utility):
      //   السلام عليكم {{1}} تم استلام طلبك بنجاح.
      //   المنتج: {{2}}
      //   المبلغ الإجمالي: {{3}} درهم   ← «درهم» is IN the template, so {{3}}
      //   الكمية: {{4}}                   is the bare number
      //   المدينة: {{5}}
      //   سنتواصل معك لتأكيد تفاصيل الطلب قبل الشحن.
      template: "pack_raha_confirmation",
      language: "ar",
      variables: (v) => [
        String(v.name ?? ""),                  // {{1}} customer name
        String(v.productLabel ?? "PACK RAHA"), // {{2}} product, as the customer reads it
        String(v.total ?? ""),                 // {{3}} total, digits only
        String(v.quantity ?? ""),              // {{4}} quantity
        String(v.city ?? ""),                  // {{5}} city
      ],
    },
    text: [
      "سلام {name} 👋",
      "",
      "توصلنا بطلبك ديال PACK RAHA من BelleVia بنجاح ✅",
      "",
      "📦 الطلب: {productName}",
      "💰 الثمن: {total} درهم",
      "🔢 الكمية: {quantity}",
      "📍 المدينة: {city}",
      "",
      "غادي يتواصل معاك واحد من الفريق ديالنا قريباً باش يأكد معاك المعلومات وموعد التوصيل.",
      "",
      "خلي التليفون قريب منك باش ما يفوتكش الاتصال 📞",
      "",
      "شكراً على ثقتك في BelleVia 💚",
    ].join("\n"),
  },

  "bellevia-anti-joint-pain": {
    enabled: true,
    provider: "auto",
    trigger: "confirm",
    text: [
      "سلام {name} 👋",
      "",
      "توصلنا بطلبك ديال BelleVia Anti Joint Pain بنجاح ✅",
      "",
      "📦 الطلب: {productName}",
      "💰 الثمن: {total} درهم",
      "🔢 الكمية: {quantity}",
      "📍 المدينة: {city}",
      "",
      "غادي يتواصل معاك واحد من الفريق ديالنا قريباً باش يأكد معاك المعلومات وموعد التوصيل.",
      "",
      "خلي التليفون قريب منك باش ما يفوتكش الاتصال 📞",
      "",
      "شكراً على ثقتك في BelleVia 💚",
    ].join("\n"),
  },

  "bellevia-weight-gain": {
    enabled: true,
    provider: "auto",
    trigger: "confirm",
    text: [
      "سلام {name} 👋",
      "",
      "توصلنا بطلبك ديال Bellevia Weight Gain بنجاح ✅",
      "",
      "📦 الطلب: {productName}",
      "💰 الثمن: {total} درهم",
      "🔢 الكمية: {quantity}",
      "📍 المدينة: {city}",
      "",
      "غادي يتواصل معاك واحد من الفريق ديالنا قريباً باش يأكد معاك المعلومات وموعد التوصيل.",
      "",
      "خلي التليفون قريب منك باش ما يفوتكش الاتصال 📞",
      "",
      "شكراً على ثقتك في BelleVia 💚",
    ].join("\n"),
  },
};

/* ───────────────────────────────────────────────────────────────────────────
   Derived views.

   `WHATSAPP_TEMPLATES` and `META_TEMPLATES` were the two hand-maintained
   registries that PRODUCT_WHATSAPP replaced. They are still exported — every
   existing caller and test keeps working — but they are now computed from it,
   so the two can no longer disagree about a product.

   They are snapshots taken at module load, and frozen: writing to one would
   not change what gets sent, and a silent no-op is worse than a throw. Nothing
   in the send path reads them — every question goes through an accessor below,
   which reads PRODUCT_WHATSAPP itself.
   ─────────────────────────────────────────────────────────────────────────── */

const SLUGS = Object.keys(PRODUCT_WHATSAPP);

/** Free-text messages, per slug: what a text gateway such as UltraMsg sends. */
export const WHATSAPP_TEMPLATES = Object.freeze(
  Object.fromEntries(
    SLUGS.map((slug) => {
      const p = PRODUCT_WHATSAPP[slug];
      return [slug, Object.freeze({ enabled: p.enabled !== false, messageTemplate: p.text })];
    }),
  ),
);

/**
 * One product's Meta template in the legacy shape, or `null` if it has none.
 *
 * Reads PRODUCT_WHATSAPP directly rather than the snapshot below, so the
 * registry stays the only thing that decides. Everything that ASKS about a
 * template goes through here; `META_TEMPLATES` is only for reading the list.
 */
function metaEntryFor(slug) {
  const p = PRODUCT_WHATSAPP[slug];
  if (!p || !p.meta) return null;
  return {
    name: p.meta.template,
    language: p.meta.language,
    // The literal product name the customer should read, NOT the catalogue
    // row's `name`. The catalogue calls it "BelleVia PACK RAHA"; the approved
    // message reads «المنتج: PACK RAHA». Pinned so a rename in the dashboard
    // cannot change what a customer is told they bought.
    productLabel: p.productLabel ?? null,
    variables: p.meta.variables,
  };
}

/**
 * Meta-approved templates, per slug — only for products that actually have one.
 *
 * A text gateway sends the free text above. Meta's Cloud API cannot: a
 * business-initiated message must name a template Meta has approved and pass
 * its variables positionally, and a COD order opens no 24-hour window.
 *
 * `variables` maps an order onto {{1}}…{{n}} IN TEMPLATE ORDER. Get the order
 * wrong and the customer reads their city where the price should be — Meta
 * validates the count, never the meaning. Each approved body is reproduced in
 * a comment beside its entry above so the order can be checked in place.
 *
 * The template text itself lives in WhatsApp Manager and is NEVER built here.
 * Editing this file cannot change what Meta sends; only the values that fill it.
 */
export const META_TEMPLATES = Object.freeze(
  Object.fromEntries(
    SLUGS.filter((slug) => PRODUCT_WHATSAPP[slug].meta)
      .map((slug) => [slug, Object.freeze(metaEntryFor(slug))]),
  ),
);

/**
 * The approved template for `slug`, filled from one order — or `null` if this
 * product has no Meta template, in which case a Meta send is skipped rather
 * than attempted and rejected.
 */
export function buildMetaTemplate(slug, vars = {}) {
  const t = metaEntryFor(slug);
  if (!t) return null;
  // `productLabel` from the registry wins over anything the caller passes, so
  // the customer-facing product name is decided here and nowhere else.
  const merged = { ...vars, productLabel: t.productLabel ?? vars.productName };
  return { name: t.name, language: t.language, variables: t.variables(merged) };
}

/* ───────────────────────────────────────────────────────────────────────────
   Accessors.

   The send path asks these questions instead of reading the registry directly,
   so an unknown slug has one defined answer rather than one per call site.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * The whole configuration for `slug`, with every field resolved.
 *
 * Always returns an object. An unknown product falls back to the default
 * message, the text gateway and the CONFIRM trigger — the behaviour the shop
 * had before any of this was per-product.
 */
export function whatsappConfigFor(slug) {
  const found = PRODUCT_WHATSAPP[slug];
  if (!found) {
    return {
      slug: slug ?? null,
      source: "default",
      enabled: DEFAULT_TEMPLATE.enabled !== false,
      provider: "auto",
      trigger: "confirm",
      productLabel: null,
      text: DEFAULT_TEMPLATE.messageTemplate,
      meta: null,
    };
  }
  return {
    slug,
    source: "product",
    enabled: found.enabled !== false,
    provider: found.provider ?? "auto",
    trigger: found.trigger === "order" ? "order" : "confirm",
    productLabel: found.productLabel ?? null,
    text: found.text,
    meta: found.meta ?? null,
  };
}

/**
 * When this product's confirmation fires.
 *
 * `"order"` sends the moment the order commits; `"confirm"` waits for an admin
 * to press CONFIRM. Unknown products get `"confirm"`, so a slug typo delays a
 * message rather than firing one at a customer nobody has reviewed.
 */
export function triggerFor(slug) {
  return whatsappConfigFor(slug).trigger;
}

/** Which gateway this product asked for. Not which one it will get — see `resolveProvider`. */
export function providerPreferenceFor(slug) {
  return whatsappConfigFor(slug).provider;
}

/** True only when a template is genuinely registered for this product. */
export function hasMetaTemplate(slug) {
  return metaEntryFor(slug) !== null;
}

/**
 * What the customer should be told they bought, or `null` to use the catalogue
 * row's name.
 *
 * @param {string|null|undefined} slug
 * @returns {string|null}
 */
export function productLabelFor(slug) {
  return whatsappConfigFor(slug).productLabel;
}

/**
 * The text configuration for `slug`, or the default when the product has none.
 *
 * Always returns an object, so a caller never has to branch on "configured or
 * not" before asking whether sending is enabled.
 */
export function templateFor(slug) {
  const cfg = whatsappConfigFor(slug);
  return {
    enabled: cfg.enabled,
    messageTemplate: cfg.text,
    source: cfg.source,
    slug: cfg.slug,
  };
}

/**
 * Substitute `{name}`-style placeholders.
 *
 * Values are inserted literally. A value that itself contains braces is not
 * re-scanned, so a customer called "{total}" cannot make the message quote a
 * price twice — each placeholder is replaced exactly once, left to right.
 */
export function renderTemplate(messageTemplate, vars = {}) {
  return String(messageTemplate).replace(/\{(\w+)\}/g, (whole, key) => {
    if (!TEMPLATE_VARIABLES.includes(key)) return whole;
    const v = vars[key];
    return v === undefined || v === null || v === "" ? whole : String(v);
  });
}

/**
 * The message to send for one order, or a reason not to send one.
 *
 * `{ enabled: false }` is a deliberate decision by configuration and is recorded
 * as `disabled`, which is different from a send that was attempted and failed.
 */
export function buildConfirmationMessage(slug, vars) {
  const cfg = templateFor(slug);
  if (!cfg.enabled) return { enabled: false, message: null, source: cfg.source };
  return { enabled: true, message: renderTemplate(cfg.messageTemplate, vars), source: cfg.source };
}
