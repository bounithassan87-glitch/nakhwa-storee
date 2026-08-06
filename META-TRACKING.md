# Meta tracking — frozen

Status: **production-ready. Do not modify the Pixel or Conversions API
implementation without a specific reason and a fresh end-to-end verification.**

Production currency is **MAD** and stays MAD.

## What runs

Five events, each sent twice — once from the browser pixel, once from the
Conversions API — sharing one `event_id` so Meta keeps whichever arrives first
and drops the duplicate.

| Event | Fired from | Server copy sent by |
|---|---|---|
| `PageView` | `nk-track.js`, on load | `POST /api/track` |
| `ViewContent` | `script.js`, on load | `POST /api/track` |
| `InitiateCheckout` | `script.js`, on submit | `POST /api/track` |
| `Lead` | `script.js`, after the API confirms | `functions/api/orders.ts` |
| `Purchase` | `script.js`, after the API confirms | `functions/api/orders.ts` |

`Lead` and `Purchase` are sent server-side from the order path rather than
through `/api/track`, because only that path knows the order was actually
committed. Their `event_id`s travel in the order payload (`eventId`,
`purchaseEventId`) so both copies match.

`/api/track` deliberately refuses `Lead` and `Purchase`: it is a public,
unauthenticated endpoint, and a conversion must not be assertable by anyone who
can post to it.

## The `_fbp` seed

`fbevents.js` is injected async while `PageView` fires in the same synchronous
tick, so on a first visit the pixel has not yet written `_fbp`. Meta reported
19.8% match on that field as a result.

`nk-track.js` now seeds `_fbp` in Meta's own format when it is absent, before
any event reports one. `fbevents` reads an existing first-party `_fbp` and keeps
it, so both copies carry the same value and every later event inherits it. It is
written **only when missing** — the pixel's own value is never overwritten.

## Known warning — upstream, do not "fix"

The browser console logs this on every Purchase:

```
[Meta Pixel] - Parameter 'currency' is invalid for event 'Purchase'.
```

**This is a limitation in Meta's own client-side validator, not a defect here.**

`fbevents.js` validates `currency` against a hardcoded list of 49 codes.
**MAD is not in it** — nor are EGP, PKR, NGN or KES; most of Africa and South
Asia are missing. `Purchase` is the only standard event carrying a validation
schema, which is why `Lead` sends the same MAD and warns about nothing.

The warning is **advisory**. In the track path the validator's result is
discarded and the event is sent anyway:

```js
d.validateEventAndLog(e, r);   // return value dropped
He.call(this, o, r, n);        // sent unconditionally
```

Verified: the Purchase reaches Meta with MAD intact, and the Conversions API
accepts MAD, answering `200` with `"currency":"MAD"` on every order.

### Why it is not worked around

Every way to silence it costs more than it saves:

- **Send a currency the list accepts.** Reporting 299 MAD as 299 USD overstates
  revenue roughly tenfold. Meta bids on reported value, so it would chase
  revenue that does not exist and the ROAS figures become fiction. **Never do
  this.**
- **Drop `currency`.** It is `isRequired`, so this trades the warning for
  `REQUIRED_PARAM_MISSING` and loses the amount.
- **Patch `console.warn`.** Hides the symptom and swallows genuine warnings
  later.

No workaround may falsify purchase values. If the warning ever needs to go, the
route is Meta's: Events Manager → Help → Report a problem, citing that `MAD` is
absent from `VALID_CURRENCY_CODES` in `fbevents.js` while the Conversions API
accepts it.

## Verified state

Last full production verification — order `NK-MSGRKB8M-RDQP`:

- All five events fire, once each, no duplicates
- Pixel `eventID` equals CAPI `event_id` on every event
- `Purchase` carries `value`, `currency`, `content_ids`, `contents`
  (with `item_price`), `content_type`, `num_items`, `order_id` — and the pixel
  and CAPI payloads describe the same product by slug
- `capi_purchase_result` / `capi_last_result` record what Meta answered, so this
  is checkable from the database without a deploy
- Zero JavaScript errors

## Verifying a change, if one is ever needed

`META_TEST_EVENT_CODE` is not set. Setting it routes events to Events Manager →
Test Events, which shows every parameter Meta actually received:

```bash
npx wrangler pages secret put META_TEST_EVENT_CODE --project-name nakhwa-store
```

Remove it afterwards — while it is set, events are marked as test traffic.
