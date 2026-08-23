# BelleVia — PACK RAHA

Landing page for the three-product hair-care routine: **زيت 60ml + شامبو 150ml +
رشاش 100ml**, at **349 درهم** (was 400), free delivery, cash on delivery.
Moroccan Darija, RTL, mobile-first, built for cold Facebook/Instagram/TikTok
traffic.

**Written for men and women.** The bottles say «للجنسين», so every line of copy
on the page and in `script.js` — headings, instructions, validation errors,
server errors — uses the neutral form of Darija rather than the feminine
imperatives the sibling pages use (`دلّك` not `دلّكي`, `عمّر` not `عمّري`). The
brand's own «للرجال والنساء» pictogram is cropped out of the offer creative and
carried in the hero, the offer box and the closing block. If you edit copy here,
keep it neutral: a feminine-only page discards half the traffic the ads buy.

Static: `index.html` + `style.css` + `script.js` + `config.js`. No build, no
framework. The only third-party request is the store's own `/nk-track.js`.

```
bellevia-pack-raha/
├── index.html          the page — 15 sections + footer
├── style.css           one stylesheet, tokens at the top
├── script.js           price × quantity, validation, order POST, tracking, sticky CTA
├── config.js           ← the only file to edit before launch
├── assets/images/      built from the client's creatives, see tools/
├── assets/fonts|logo|favicon/   copied from the sibling BelleVia pages
└── tools/build-assets.mjs       regenerates assets/images/
```

This page is a **sibling** of `bellevia-anti-lice/`, not a fork of it. It shares
the store's one backend, one admin and one tracking script, and it shares the
design system by *copy* — nothing here imports from that folder, so this page
cannot break it.

---

## 1 · ⚠️ Two things the client must confirm before launch

### a) The spray is 100ml, not 60ml

The brief said 60ml. **Every creative that shows the spray's label says
`100ml`** — the hero, both ingredient sheets and the routine sheet. The
packaging wins, so the page says 100ml throughout. If the bottle actually
shipping is 60ml, change it in five places: `index.html` (hero pill, product
card, FAQ, footer, meta description) and the product description in
`scripts/upsert-product.mjs`.

Two related art errors in the source creatives, already handled:

- the routine sheet captions the **oil** `150ml`; it is 60ml everywhere else, so
  that frame's bottles are never shown;
- the shampoo usage sheet shows a **300 ml** bottle with the older
  «Bellevia NATURAL WELLNESS» wordmark — a different SKU. Only its photograph of
  the woman is used; the bottle is cropped out.

### b) The ingredient list follows the official «المكونات» creative

Two early «المكونات» creatives **contradicted each other on nearly every line**,
so for the first build the page published only their intersection and pointed at
the label for the rest.

| | creative A | creative B |
| --- | --- | --- |
| شامبو | زيت الكبار · جل الصبار · بروفيتامين B5 · جوجوبا المخمل · ختمسيك · بدون سلفات | زيت ازير · جل الصبار · برو فيتامين B5 · بودرة البصل · جنسينغ · بدون سلفات |
| زيت | الأركان · الخروع · الجوجوبا · الحبة السوداء · الجينسنج · B5 · السمسم المخمّر | الازير · الجرجير · الجوجوبا · الفلفل الحار · قرنفل · الحرمل · ساليسيليك · B5 · جنسينغ |
| رشاش | **ميتوكسينيل** · سالسليك · فيتامين A · مستخلص حشيشي · B5 | **مينوكسيديل** · ساليسيليك · فيتامين A · مستخلص عشبي · B5 |

**On 2026-08-16 the client supplied the official sheet and confirmed it in
writing as the source of truth.** It is creative B. The page now reproduces it
verbatim, per column:

- زيت (60ml) — زيت الازير · زيت الجرجير · زيت الجوجوبا · زيت الفلفل الحار · قرنفل · الحرمل · اسيد ساليسيليك · برو فيتامين B5 · جنسينغ
- شامبو (150ml) — زيت ازير · جل الصبار · برو فيتامين B5 · بودرة البصل · جنسينغ · بدون سلفات
- بخاخ (100ml) — مينوكسيديل · ساليسيليك · فيتامين A · مستخلص عشبي · بروفيتامين B5

The sheet spells B5 two ways — «برو فيتامين» in the oil and shampoo,
«بروفيتامين» in the spray. Each column is reproduced as written rather than
normalised, because the instruction was to match the sheet exactly.

`مينوكسيديل` and `ساليسيليك` were removed from the gate's `FORBIDDEN` list to
allow this; `ميتوكسينيل` stays, so the garbled spelling from creative A cannot
ship beside the correct one.

**The legal position has not changed by being written down here.** Minoxidil is
a regulated pharmaceutical active in Morocco, not a cosmetic ingredient, and a
COD page that names it is advertising a medicinal product. The client was told
this plainly and instructed that it be published anyway; that is their call to
make, and it is recorded here rather than argued again. It still warrants legal
review before the page runs — naming it on the page does not make it compliant.

---

## 2 · Before launch — price and contact

### The catalogue price must equal the page price

The page states **349 درهم**, struck through from **400**, set once in
`config.js`:

```js
price: '349',
oldPrice: '400',
```

That figure is what the customer *reads*. What they are *charged* comes from the
catalogue: `/api/orders` prices every order `offerPrice ?? basePrice` from the
product row and ignores any price in the request. So the product with slug
`bellevia-pack-raha` must exist, be **ACTIVE**, and carry:

```
basePrice   40000 centimes   (400 DH)
offerPrice  34900 centimes   (349 DH)  ← what is charged
```

There is a preset for exactly this:

```bash
node scripts/upsert-product.mjs --slug bellevia-pack-raha --production
```

Quantity is a plain multiplier on both sides — the page shows `349 × n`, the
server bills `unit × n` — and there is deliberately **no `PACK_PRICING` row**
for this slug, so the two agree at every quantity. Do not add one without also
changing the page.

The **«وفّر 51 درهم» badge is subtracted, not typed**: `script.js` computes it
from `oldPrice − price`, so it cannot advertise a discount the two configured
figures do not actually produce, and it moves on its own if either changes. The
struck-through price and the badge both disappear if `oldPrice` is not higher
than `price`.

The page writes the currency as **درهم**, not `DH`, matching the sibling
BelleVia pages — `currency` in `config.js` is the one place to change that. The
number is the same either way; `DH` inside RTL Arabic is a bidi hazard, which is
why the word is used in copy while the creative keeps its own `DH`.

### Contact, in `config.js`

`phone` and `whatsapp` are empty. Whatever stays empty simply does not render,
rather than leaving a dead link.

---

## 3 · What the page claims, and where it comes from

| Section | Source |
| --- | --- |
| Each product's benefit lines | that bottle's own label, **quoted verbatim** — the label photograph sits beside them as proof |
| Volumes 60ml / 150ml / 100ml | the labels |
| Routine order and timings — زيت (60 min) → شامبو → رشاش (2×/day) | the «روتينك المثالي» creative, step for step. Note this is **not** the order the brief guessed |
| Shampoo usage — wet hair, lather, rinse | the «طريقة استعمال الشامبو» creative |
| Precautions | the same creative's «تنبيه» panel, verbatim |
| The six problem cards | the «المشكلة» creative's own six captions |
| «للجنسين» / للرجال والنساء | printed on the bottles, and the pictogram in the offer creative's badge band |
| 349 درهم, COD, free delivery | the client's brief and the existing configuration |

Not on the page, because nothing supplied supports it: reviews, ratings, sales
counts, certifications, doctors, before/after photos, guarantees, countdowns,
delivery-time promises. The benefits section is framed as care and appearance
only — nothing claims to stop hair loss, regrow hair, or work in a given number
of days. The FAQ answers the delivery question by saying the detail is given on
the confirmation call, rather than inventing a number.

Every usage instruction is followed by a line telling the reader to follow the
label on the product.

---

## 4 · Images

`node bellevia-pack-raha/tools/build-assets.mjs` rebuilds `assets/images/`. It
finds the client's creative folder itself; if it cannot, it prints where it
looked and you point it with `BELLEVIA_RAHA_SOURCE_DIR`. The header of that file
records what every supplied creative is used for and why.

### The approved creative

`pack-raha-background-reference.png.png` (1024×1536 — yes, the double extension
is the real filename) is the **source of truth** for the three bottles and for
the page's whole botanical look:

```
بخاخ ضد تساقط الشعر    100ml   white spray
زيت ضد تساقط الشعر      60ml   white airless pump
شامبو مضاد لتساقط الشعر 150ml   black cap
```

An **earlier** pack — amber dropper oil, white-cap shampoo, «رشاش» — was on this
page until 2026-08-15 and is gone. Nothing from it survives in `assets/`: the
builder tracks every file it writes and deletes anything else in the folder, so
a superseded bottle cannot linger behind a stale filename. That prune is the
guarantee, not anybody's memory — the widths changed with the pack
(`hero-pack-760` → `-698`, `product-oil-185` → `-199`), so a plain rebuild would
otherwise have left both generations side by side.

Excluded from every crop, by rectangle: the headline, the «عناية طبيعية» pill,
the natural-ingredients badge and the green claims band at the foot. The page
states its own headline and price as live HTML and makes no "100% natural"
claim. Measured bounds are in the builder's header.

### The background system

The page's botanical atmosphere comes from that same photograph rather than from
anything generated — one environment at eight intensities, not eight
backgrounds:

- **`bg-wash`** — a block of the creative's own foliage, upscaled and blurred
  until it is light and colour rather than imagery. Carries the hero (under a
  bright veil) and the closing block (under a deep green one).
- **`bg-leaves`** — the same block left sharp, small, at the outer corners only.
  Dropped on phones below 720px, where there is no room beside the product.
- **`.sec--field` / `.sec--field-2`** — CSS gradients sampled from that palette.
  No photograph sits behind body copy anywhere.

**The hero is light.** The creative is cream-lit with foliage at the edges; the
previous deep-green hero fought it. Type is dark ink there now and the brand
green moved to the header bar, the buttons, the order card, the offer box and
the closing block. The old full-width green section band is gone entirely — the
brief asked explicitly not to overuse green.

The short version of the rest:

- **Nothing is generated.** No AI product shots, no stock photography, no
  redrawn bottles, no recolouring, no retouched labels.
- **No crop cuts a bottle.** Every rectangle runs from above the cap to below
  the base; the hero cluster keeps its plinth and foliage.
- **The hero is a crop** of the client's offer creative with the burned-in price
  column left behind, because the page states the price as live text and a
  1086px picture of a price is unreadable at 360px.
- **The whole offer creative is shown once**, uncropped, in the offer section.
  Its 400→349 DH is the price the catalogue charges, so showing it entire cannot
  mislead.
- Text-heavy creatives are **not** shipped as pictures of Arabic sentences.
  Their medallions and photographs are cut out and the words are set as live
  text — readable at 360px, selectable, indexable.
- Two creatives are not built at all (one names the spray «بخاخ» where every
  other reference says «رشاش»; one is the contradicted ingredient sheet). Both
  are one entry each to restore.

---

## 5 · Tracking

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

### Known: the confirmation WhatsApp and why it may say «فشل الإرسال»

The send path is: admin presses CONFIRM → `functions/api/admin/orders/[id].ts`
→ `sendConfirmationWhatsApp` → `POST https://api.ultramsg.com/{instance}/messages/chat`
(token in the body, never the query string). The outcome is written to the
order as `whatsapp_confirmation_status` and the provider's own message to
`whatsapp_confirmation_error`, and the admin drawer renders both — `✓ تم الإرسال`
or `⚠ فشل الإرسال` with the real reason underneath, plus an إعادة الإرسال button.

**A failed send never rolls back the order.** The status change has already
committed by the time the provider is called; an unreachable or unpaid gateway
is a message to retry, not a reason to un-confirm a sale.

Seen in production on 2026-08-15 (order `NK-MSUWQ3BF-W8HU`):

```
status = failed
error  = {"error":"Your instance has been Stopped due to non-payment. …"}
```

That is a **billing state, not a bug** — the credentials authenticate fine. When
the UltraMsg subscription lapses, every confirmation records `failed` until it
is renewed, and pressing إعادة الإرسال afterwards sends the message.

### Known latent bug: `00212…` phone normalisation

`normalizePhone` in `functions/api/_lib/capi.ts` (shared by the Conversions API
and the WhatsApp sender) turns `00212612345678` into `2120212612345678` — the
`00` prefix falls through the `startsWith("0")` branch and gets `212` prepended
on top of the country code. The result is 16 digits, which is longer than the
11-digit floor, so it is **accepted** and handed to the provider, which will
reject it.

**Deliberately not fixed** (client's call, 2026-08-16). It is unreachable today:
the landing page's own `normalizePhone` in `script.js` rewrites `00212…` to
`0…` before the order is posted, and all 67 production customer phones were
checked — every one normalises to a valid `212XXXXXXXXX`. It becomes reachable
only if a phone is entered through some path that skips the page, e.g. typed
directly into the admin. The fix is one branch: test for `00` before `0`.

### Meta

fbevents logs *"Parameter 'currency' is invalid for event 'Purchase'"* because
its validator's list of 49 codes omits MAD. It is advisory; the event is still
sent and the Conversions API accepts MAD. Do not "fix" it. See
`META-TRACKING.md`.

---

## 6 · Deployment

The folder name **is** the slug, and it is the only thing joining the pieces:

```
bellevia-pack-raha/  →  /bellevia-pack-raha/     (page)
                     →  productSlug in the POST  (order)
                     →  Product.slug             (catalogue, price, stock)
```

Registered in `shared/landing-pages.js`, which `scripts/copy-landing-pages.mjs`
reads to copy it into `dist/` and the admin reads to show the page as connected.
Its WhatsApp confirmation message is in `shared/whatsapp-templates.js`.

```
SITE_URL="https://your-domain.com" npm run build
npm run deploy
```

Local preview with the real API: `npm run db:local`, then `npm run dev`, then
open `http://localhost:8788/bellevia-pack-raha/`. `.dev.vars` points at the
local embedded Postgres, so nothing there touches production.

---

## 7 · Behaviour worth knowing

- **Success is only ever what the server returned.** On any failure the page
  shows a Darija error, keeps every field and the chosen quantity, and re-enables
  the button so the customer can retry.
- **Duplicate clicks send one order.** The submit handler returns early while a
  request is in flight.
- **Sticky CTA** carries the live total, appears on phones only, and only once
  *both* the hero button and the order card are off screen — so the first screen
  is never two identical CTAs. `body` gets matching bottom padding while it is up.
- **Cash on delivery** is one switch (`cashOnDelivery: false`) and every mention
  of it disappears from the page, FAQ included. The delivery line works the same
  way, and takes its FAQ entry with it.
- **FAQ is native `<details>`** — no JavaScript, no layout shift, still opens if
  a script fails to load.
- **The struck-through price only renders when it is genuinely higher** than the
  selling price. A "was" below the "now" is not a discount and is not drawn.

---

## 8 · Verified

**Rendering**, at 360×640, 390×844, 414×896, 430×932, 768×1024, 1024×768,
1280×800 and 1440×900: no horizontal scroll, nothing overflowing, no broken
image, no 4xx asset, no console error, every tap target ≥44px, and headline +
**349 درهم** + CTA all above the fold at 360×640.

**Bidi**, by reading the layout engine's own client rects rather than
eyeballing a screenshot: the Latin runs (`PACK RAHA`, `60ml`, `150ml`, `100ml`,
`B5`, `A`) all sit in the right visual order inside the Arabic — hero pills,
lede, CTA, order total, ingredient lines, offer box and footer.

**Order flow, end to end**, against `wrangler pages dev` + the local embedded
Postgres, clicking through the real page:

```
form → POST /api/orders → 201 → Order row → GET /api/admin/orders → detail
```

Name, phone, city, address, quantity, slug, source, payment method and free
shipping checked at every hop; the amount shown to the customer equals the
amount stored (349 for qty 1, 698 for qty 2). Also asserted: the page sends **no
price at all**; a forged `price`/`total`/`currency` is ignored and the order is
repriced from the catalogue to 34900 MAD; quantities `0`, `-1`, `11`, `2.5` and
`"2"` are refused; three rapid clicks produce exactly one POST;
`/api/admin/orders` refuses an anonymous request and, once authenticated, shows
the order as **BelleVia PACK RAHA · 349 DH · COD · source `bellevia-pack-raha`**
alongside the other storefronts' orders in the same dashboard.

**No regression**: the same sweep and the same order flow were re-run against
`/bellevia-anti-lice/` — still renders clean at all five viewports, still takes
an order, still bills 299. Its source files were not opened for writing; their
modification times all predate this work.
