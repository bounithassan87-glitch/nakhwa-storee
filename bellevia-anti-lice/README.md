# BelleVia — Pack ضد القمل

Landing page for the two-product anti-lice pack: **سيروم ضد القمل 30ml + شامبو
ضد القمل 150ml**, at **299 درهم**, cash on delivery. Moroccan Darija, RTL,
mobile-first, built for cold Facebook/Instagram traffic.

Static: `index.html` + `style.css` + `script.js` + `config.js`. No build, no
framework. The only third-party request is the store's own `/nk-track.js`.

```
bellevia-anti-lice/
├── index.html          the page — 11 sections + footer
├── style.css           one stylesheet, tokens at the top
├── script.js           price × quantity, validation, order POST, tracking, sticky CTA
├── config.js           ← the only file to edit before launch
├── assets/images/      built from the client's creatives, see tools/
├── assets/fonts|logo|favicon/   shared with the sibling BelleVia pages
└── tools/build-assets.mjs       regenerates assets/images/
```

---

## 1 · Before launch — two things

### a) The catalogue price must equal the page price

The page states **299 درهم**, set once in `config.js`:

```js
price: '299',
```

That figure is what the customer *reads*. What they are *charged* comes from the
catalogue: `/api/orders` prices every order `offerPrice ?? basePrice` from the
product row and ignores any price in the request. So the product with slug
`bellevia-anti-lice` must exist, be **ACTIVE**, and be priced at **29900
centimes**.

Quantity is a plain multiplier on both sides — the page shows `299 × n`, the
server bills `unit × n` — and there is deliberately **no `PACK_PRICING` row**
for this slug, so the two agree at every quantity. Do not add one without also
changing the page.

### b) Contact, in `config.js`

`phone` and `whatsapp` are empty. Whatever stays empty simply does not render,
rather than leaving a dead link.

---

## 2 · What the page claims, and where it comes from

| Section | Source |
| --- | --- |
| The three benefit lines | the «الفوائد» creative, **quoted verbatim** — rewording them would change the claim |
| Ingredients | the «المكونات» creative — serum: زيت شجرة الشاي، زيت النيم، الخزامى · shampoo: البيرميثرين، زيت شجرة الشاي |
| How to use, and the timings | the «كيفية الاستخدام» creative, step for step (10–15 min serum, 5–10 min shampoo) |
| Precautions | the same creative's احتياطات / موانع الاستعمال panels |
| 299 درهم, COD, free delivery | the client's brief and the existing configuration |

Not on the page, because nothing supplied supports it: reviews, ratings, sales
counts, certifications, doctors, before/after photos, guarantees, countdowns,
delivery-time promises. The FAQ answers "فوقاش كيوصل الطلب؟" by saying the
delivery detail is given on the confirmation call, rather than inventing a
number.

Every usage instruction is followed by a line telling the reader to follow the
label on the product.

---

## 3 · Images

`node bellevia-anti-lice/tools/build-assets.mjs` rebuilds `assets/images/`. It
finds the client's creative folder itself (it has already been renamed once); if
it cannot, it prints where it looked and you point it with
`BELLEVIA_LICE_SOURCE_DIR="…"`. The header of that file records what every
supplied creative is used for and why. The short version:

- **The hero is a crop.** The supplied «باك متكامل» creative shows **four**
  products (شامبو، سيروم، زيت علاج، بلسم). This pack is two. A four-bottle photo
  beside a two-product price is how a COD parcel gets refused at the door, so
  only the shampoo + serum pair is cropped out of it, and the whole frame is
  never emitted.
- **Nothing is generated.** No AI product shots, no stock photography. The
  human pictures — the child in the problem section, the family in "من هو هاد
  الباك ليه" — are cropped from the brand's own creatives.
- Two photographs are capped in CSS rather than upscaled: the family tile is
  320px wide in the creative and the child is 600px, and stretching a picture
  past its own resolution looks worse than a smaller sharp one.
- Text-heavy creatives are **not** shipped as pictures of Arabic sentences.
  Their medallions and step photographs are cut out and the words are set as
  live text — readable at 360px, selectable, indexable.

---

## 4 · Tracking

The page includes the store's shared `/nk-track.js` — the same file, the same
Pixel and the same Conversions API as the main storefront. **No second tracking
system, no second pixel id.** It fires `PageView` itself; `script.js` adds:

| Event | Browser | Server |
| --- | --- | --- |
| `PageView` | nk-track.js | `/api/track` |
| `ViewContent` | on load | `/api/track` |
| `InitiateCheckout` | on a valid submit, once per page view | `/api/track` |
| `Lead` | after the API confirms | `functions/api/orders.ts` |
| `Purchase` | after the API confirms | `functions/api/orders.ts` |

`eventId` and `purchaseEventId` are minted before the order is sent and travel
in the payload, so the server's copy and the browser's copy of `Lead` and
`Purchase` share one id and Meta deduplicates them. The `Purchase` value is
`result.total / 100` — what the server actually charged, never a constant.

fbevents logs *"Parameter 'currency' is invalid for event 'Purchase'"* because
its validator's list of 49 codes omits MAD. It is advisory; the event is still
sent and the Conversions API accepts MAD. Do not "fix" it. See
`META-TRACKING.md`.

---

## 5 · Deployment

The folder name **is** the slug, and it is the only thing joining the pieces:

```
bellevia-anti-lice/  →  /bellevia-anti-lice/     (page)
                     →  productSlug in the POST  (order)
                     →  Product.slug             (catalogue, price, stock)
```

Registered in `shared/landing-pages.js`, which `scripts/copy-landing-pages.mjs`
reads to copy it into `dist/` and the admin reads to show the page as connected.

```
SITE_URL="https://your-domain.com" npm run build
npm run deploy
```

Local preview with the real API: `npm run db:local`, then `npm run dev`, then
open `http://localhost:8788/bellevia-anti-lice/`. `.dev.vars` points at the
local embedded Postgres, so nothing there touches production.

---

## 6 · Behaviour worth knowing

- **Success is only ever what the server returned.** On any failure the page
  shows a Darija error, keeps every field and the chosen quantity, and re-enables
  the button so the customer can retry.
- **Duplicate clicks send one order.** The submit handler returns early while a
  request is in flight.
- **Sticky CTA** carries the live total, appears on phones only, and only once
  *both* the hero button and the order card are off screen — so the first screen
  is never two identical CTAs. `body` gets matching bottom padding while it is up.
- **Cash on delivery** is one switch (`cashOnDelivery: false`) and every mention
  of it disappears from the page, FAQ included.
- **FAQ is native `<details>`** — no JavaScript, no layout shift, still opens if
  a script fails to load.

---

## 7 · Verified

**Rendering**, at 360×640, 375×667, 390×844, 414×896, 430×932, 834×1112 and
1440×900: no horizontal scroll, nothing overflowing, no broken image, no 4xx
asset, no console error, every tap target ≥44px, and brand + headline + product
+ **299 درهم** + COD + CTA all above the fold at every one of them — including
360×640, where the button ends at 469px.

**Order flow, end to end**, against `wrangler pages dev` + the local embedded
Postgres, clicking through the real page:

```
form → POST /api/orders → 201 → Order row → GET /api/admin/orders → detail
```

Name, phone, city, address, quantity, slug, source and total checked at every
hop; the amount shown to the customer equals the amount stored (598 for qty 2).
Also asserted: three rapid clicks produce exactly one POST; a 500 response shows
a Darija error, keeps all four fields and the quantity, and never shows a
confirmation; a forged `price`/`total`/`currency` is ignored and the order is
repriced from the catalogue; quantities `0`, `-1`, `11`, `2.5` and `"2"` are
refused; an unknown slug returns `product_unavailable`; `/api/admin/orders`
refuses an anonymous request. All five Meta events fire with matching pixel and
Conversions-API event ids.
