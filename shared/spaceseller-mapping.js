// Local order → Space Seller order body.
//
// Pure: no network, no database, no secrets. It takes an already-loaded order
// and returns either a body to POST or a reason not to. Keeping the decision
// here means the whole mapping — including every refusal — is testable without
// reaching Space Seller.
//
// Nothing in this file guesses. A value that cannot be derived from the order is
// omitted or the mapping fails; none is ever invented.

/** Why a mapping refused. Stored on the order and shown to the admin. */
export const MAPPING_ERRORS = {
  MISSING_SKU: "missing_sku",
  MISSING_COMPONENT_SKU: "missing_component_sku",
  MISSING_PHONE: "missing_phone",
  MISSING_NAME: "missing_name",
  MISSING_PRODUCT: "missing_product",
  INVALID_TOTAL: "invalid_total",
  INVALID_QUANTITY: "invalid_quantity",
};

/** Admin-facing Arabic text for each refusal. */
export const MAPPING_ERROR_LABELS = {
  [MAPPING_ERRORS.MISSING_SKU]: "المنتج ما عندوش SKU ديال Space Seller",
  [MAPPING_ERRORS.MISSING_COMPONENT_SKU]: "شي مكوّن ديال الباك ما عندوش SKU ديال Space Seller",
  [MAPPING_ERRORS.MISSING_PHONE]: "رقم الهاتف ناقص",
  [MAPPING_ERRORS.MISSING_NAME]: "اسم الزبون ناقص",
  [MAPPING_ERRORS.MISSING_PRODUCT]: "الطلب ما فيهش منتج",
  [MAPPING_ERRORS.INVALID_TOTAL]: "مبلغ الطلب غير صالح",
  [MAPPING_ERRORS.INVALID_QUANTITY]: "الكمية غير صالحة",
};

/* ── Packs ─────────────────────────────────────────────────────────────────
   Some things this store sells as one product are several products to Space
   Seller, who stocks and picks the components individually.

   Anti-Lice is one such: the customer buys a single 299 MAD pack, and the
   warehouse has to pick a serum and a shampoo. Sending it as one line against
   one SKU would be describing a parcel that does not exist.

   `perPack` is how many of that component go into ONE pack, so the line
   quantity is `packs ordered × perPack`.

   The components are named here from the pack's own description in the
   database ("باك من منتجين للعناية بالشعر: سيروم ضد القمل 30ml وشامبو ضد القمل
   150ml"), corroborated by the landing page. Neither exists as a local product,
   so their SKUs cannot be read from the catalog — they were supplied directly
   and are reproduced verbatim.

   A `sku` of null is load-bearing rather than a placeholder: the mapper refuses
   the whole order rather than send half a pack. */
export const PACK_COMPOSITION = {
  "bellevia-anti-lice": [
    { component: "سيروم ضد القمل 30ml", sku: "anti-poux", perPack: 1 },
    { component: "شامبو ضد القمل 150ml", sku: "shampoux", perPack: 1 },
  ],
  // PACK RAHA carries a local SKU of its own, BVP-RAHA-001, and that SKU is
  // deliberately NOT used: Space Seller stocks the three bottles separately, so
  // the pack is not a thing they can pick. Being listed here is what stops the
  // local SKU from being sent — the pack branch never reads product.sku.
  "bellevia-pack-raha": [
    { component: "زيت ضد تساقط الشعر 60ml", sku: "huil-anti-chute", perPack: 1 },
    { component: "شامبو ضد تساقط الشعر 150ml", sku: "sham-anti-chute", perPack: 1 },
    { component: "رشاش ضد تساقط الشعر 100ml", sku: "spray-anti-chute", perPack: 1 },
  ],
};

/** The components of a pack, or null if this product ships as itself. */
export function packComponents(slug) {
  if (typeof slug !== "string") return null;
  return PACK_COMPOSITION[slug.trim()] ?? null;
}

/** Centimes → the decimal MAD Space Seller expects. Never the other way. */
export function centimesToMad(centimes) {
  return Math.round(centimes) / 100;
}

/**
 * Build the POST /orders body for one local order.
 *
 * Returns `{ ok: true, body }` or `{ ok: false, error, detail }`. It never
 * throws, and it never substitutes a value it could not derive.
 *
 * A local product may become more than one Space Seller line: see
 * PACK_COMPOSITION. The returned `products` are therefore Space Seller's view
 * of the parcel, not a copy of the order's items.
 *
 * @param order shape:
 *   { orderNumber, quantity, totalPrice, note,
 *     customer: { fullName, phone, city, address },
 *     items: [{ quantity, product: { sku, name, slug } }] }
 */
export function buildSpaceSellerOrder(order) {
  if (!order || typeof order !== "object") {
    return { ok: false, error: MAPPING_ERRORS.MISSING_PRODUCT, detail: "no order" };
  }

  const customer = order.customer ?? {};
  const fullname = String(customer.fullName ?? "").trim();
  if (!fullname) return { ok: false, error: MAPPING_ERRORS.MISSING_NAME };

  // Sent exactly as stored. Space Seller's own example uses the Moroccan local
  // form (0612345678), so unlike WhatsApp this is NOT normalised to 212 —
  // rewriting it would be inventing a format the API did not ask for.
  const phone = String(customer.phone ?? "").trim();
  if (!phone) return { ok: false, error: MAPPING_ERRORS.MISSING_PHONE };

  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) return { ok: false, error: MAPPING_ERRORS.MISSING_PRODUCT };

  const quantity = Number(order.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: MAPPING_ERRORS.INVALID_QUANTITY, detail: String(order.quantity) };
  }

  const totalCentimes = Number(order.totalPrice);
  if (!Number.isFinite(totalCentimes) || totalCentimes < 0) {
    return { ok: false, error: MAPPING_ERRORS.INVALID_TOTAL, detail: String(order.totalPrice) };
  }

  // Every order in this system is one product in N units: `persist` writes one
  // OrderItem per unit, all carrying the same productId, and quantity lives on
  // the order rather than the item. Verified against all 91 orders in
  // production — none has more than one distinct product, and all 106 item rows
  // carry quantity 1.
  //
  // The row's own quantity is still summed rather than assumed, because the
  // column exists and the cart on feat/storefront-platform writes it. Counting
  // rows would silently undercount a parcel the day that branch lands.
  // Phase 1 — how many units of each distinct LOCAL product were ordered.
  // Packs are still whole here; they are taken apart in phase 2.
  const perProduct = new Map();
  for (const it of items) {
    const product = it?.product ?? {};
    const slug = String(product.slug ?? "").trim();
    const sku = String(product.sku ?? "").trim();
    const name = String(product.name ?? "").trim();
    // Slug identifies the product; SKU is only its Space Seller name, and a pack
    // legitimately has none.
    const key = slug || sku || name;
    if (!key) return { ok: false, error: MAPPING_ERRORS.MISSING_PRODUCT, detail: "unidentifiable item" };

    const units = Number.isInteger(it?.quantity) && it.quantity > 0 ? it.quantity : 1;
    const seen = perProduct.get(key);
    if (seen) seen.units += units;
    else perProduct.set(key, { slug, sku, name, units });
  }

  // For the ordinary single-product order, Order.quantity is authoritative: it
  // is the figure the checkout priced totalPrice against. The per-item sum is
  // the fallback for a genuinely mixed order, which no order has yet.
  if (perProduct.size === 1) [...perProduct.values()][0].units = quantity;

  // Phase 2 — turn local products into Space Seller lines, expanding packs.
  const lines = new Map();
  const add = (sku, qty) => lines.set(sku, (lines.get(sku) ?? 0) + qty);

  for (const p of perProduct.values()) {
    const components = packComponents(p.slug);

    if (components) {
      for (const c of components) {
        const csku = String(c.sku ?? "").trim();
        if (!csku) {
          // Refuse the WHOLE order. Sending the components whose SKU happens to
          // be known would ship a partial pack — worse than shipping nothing,
          // because it looks like a completed order.
          return {
            ok: false,
            error: MAPPING_ERRORS.MISSING_COMPONENT_SKU,
            detail: `${p.name || p.slug} → ${c.component}`,
          };
        }
        add(csku, p.units * (Number.isInteger(c.perPack) && c.perPack > 0 ? c.perPack : 1));
      }
      continue;
    }

    if (!p.sku) {
      // The one thing that must never be improvised. A guessed SKU would create
      // a real order against somebody else's product.
      return { ok: false, error: MAPPING_ERRORS.MISSING_SKU, detail: p.name || p.slug || "unknown product" };
    }
    add(p.sku, p.units);
  }

  const products = [...lines.entries()].map(([sku, qty]) => {
    const line = { sku, quantity: qty };

    // unit_price is optional, and this is the one number that cannot always be
    // stated honestly. Pack pricing means the total is discounted: three
    // weight-gain at a catalog 199 are charged 449, not 597. Sending the catalog
    // price would contradict total_price; sending total/quantity only works when
    // it divides exactly — 449/3 is 149.666… and any rounding makes the line
    // disagree with the total by a centime.
    //
    // A pack produces several lines from one price, and there is no honest way
    // to split 299 MAD between a serum and a shampoo — so the multi-line case
    // sends no unit_price at all. total_price is always authoritative: it is
    // what the courier collects on delivery.
    if (lines.size === 1 && qty > 0 && totalCentimes % qty === 0) {
      line.unit_price = centimesToMad(totalCentimes / qty);
    }
    return line;
  });

  const body = {
    fullname,
    phone,
    total_price: centimesToMad(totalCentimes),
    products,
  };

  // address carries the street and nothing else.
  //
  // It used to have the city appended — "olad brhil، taroudant" — to compensate
  // for the missing id_city. That was a mistake: it corrupted the street field
  // without making the destination appear, so the two are separate again.
  const address = String(customer.address ?? "").trim();
  if (address) body.address = address;

  // The city, as its own field.
  //
  // Worth being honest about what this is: the integration guide's POST contract
  // lists `id_city` (integer, "provided by Mediaplus") and NOT a `city` string.
  // A plain `city` appears only in the GET response, beside `id_city`, where it
  // reads as the name looked up from that id. So this field may well be ignored
  // on create.
  //
  // It is sent anyway because the city has to travel somewhere, and this is the
  // only honest place for it while no id_city mapping exists — the store holds
  // 46 distinct free-text city names and there is no endpoint to resolve them.
  // Guessing an integer would address a real parcel to the wrong province.
  const city = String(customer.city ?? "").trim();
  if (city) body.city = city;

  const note = String(order.note ?? "").trim();
  // The local order number travels in the note so a Space Seller order can be
  // traced back here by a human. It is the closest thing available to a shared
  // reference — the API exposes no idempotency key and no lookup by our id.
  const ref = order.orderNumber ? `Ref: ${order.orderNumber}` : "";
  const fullNote = [note, ref].filter(Boolean).join(" | ");
  if (fullNote) body.note = fullNote;

  return { ok: true, body };
}

/** How stale a synced order may be before opening it triggers a refresh. */
export const OPPORTUNISTIC_REFRESH_MS = 15 * 60 * 1000;

/**
 * Whether opening this order in the dashboard should refresh it from upstream.
 *
 * This is the substitute for a cron job: Cloudflare Pages Functions have no
 * scheduled handler, so the refresh rides on traffic that was happening anyway.
 * Bounded on purpose — only orders already synced, and only once the stored
 * status is stale — so browsing the list cannot hammer Space Seller.
 */
export function shouldRefresh(order, now = Date.now()) {
  if (!order) return false;
  if (!order.spacesellerOrderId && !order.spacesellerUuid) return false;
  const at = order.spacesellerSyncedAt;
  if (!at) return true;
  const ms = at instanceof Date ? at.getTime() : new Date(at).getTime();
  if (!Number.isFinite(ms)) return true;
  return now - ms > OPPORTUNISTIC_REFRESH_MS;
}

/* ── Response classification ───────────────────────────────────────────────
   Pure, and separated from the fetch plumbing so every branch that decides
   whether an order might exist upstream is unit-testable. This is the most
   safety-critical judgement in the integration: calling an "unknown" a
   "rejected" invites a duplicate parcel. */

/**
 * What an HTTP status means for an order we tried to create.
 *
 *   ok        2xx — accepted
 *   rejected  a definite refusal. Nothing was created; retrying is safe.
 *   unknown   it may or may not have been created. NEVER auto-retry.
 *
 * 408, 429 and 5xx are unknown rather than rejected: the request may well have
 * reached Space Seller and been processed before the failure was reported.
 */
export function classifyStatus(status) {
  if (status === undefined || status === null) return "unknown"; // timeout / network
  if (status >= 200 && status < 300) return "ok";
  if (status === 408 || status === 429) return "unknown";
  if (status >= 500) return "unknown";
  return "rejected"; // 401, 403, 404, 422, …
}

/** Whether another attempt could plausibly succeed. */
export function isRetriable(status) {
  return classifyStatus(status) === "unknown";
}

/**
 * Strip anything credential-shaped out of an upstream message.
 *
 * Defence in depth: the token is never sent anywhere it could be echoed, but an
 * error body is third-party text that gets stored and shown to an admin, so it
 * is scrubbed before it is trusted.
 */
export function scrubUpstream(text) {
  return String(text ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer ***")
    .replace(
      /"?(token|access_token|authorization|api[_-]?key)"?\s*[:=]\s*"?[A-Za-z0-9._~+/=-]{6,}"?/gi,
      "$1: ***",
    )
    .slice(0, 300);
}

/* ── Fulfilment scope ──────────────────────────────────────────────────────
   Which products Space Seller actually fulfils.

   This is a routing decision, not a validation one, and the distinction
   matters: a product outside this list is not "missing something", it is
   simply not Space Seller's to ship. Its orders are recorded as out of scope
   and raise no alarm in the dashboard.

   Nothing is removed from the catalog by being absent here — cache-terazo and
   lilya-talon are sold exactly as before, they are just fulfilled elsewhere. */
export const SPACESELLER_PRODUCTS = Object.freeze([
  "bellevia-weight-gain",
  "bellevia-anti-joint-pain",
  "bellevia-pack-raha",
  "bellevia-anti-lice",
]);

/** Whether this product's orders are sent to Space Seller at all. */
export function isInSpaceSellerScope(slug) {
  return typeof slug === "string" && SPACESELLER_PRODUCTS.includes(slug.trim());
}

/**
 * The scope decision for a whole order.
 *
 * An order is in scope when any of its products is. Returns the slug that put
 * it in scope, so a caller can log which product routed it.
 */
export function orderInSpaceSellerScope(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  for (const it of items) {
    const slug = it?.product?.slug;
    if (isInSpaceSellerScope(slug)) return { inScope: true, slug: String(slug).trim() };
  }
  return { inScope: false, slug: items[0]?.product?.slug ?? null };
}
