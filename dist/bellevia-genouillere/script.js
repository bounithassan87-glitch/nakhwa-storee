/* ==========================================================================
   دعامة الركبة الاحترافية · behaviour

   Vanilla, no build step, no dependency. Each block finds its own hooks and
   does nothing at all if they are absent, so deleting a section from the HTML
   cannot throw.

   The form posts to `/api/orders` — the store's one order endpoint, the same
   one every other BelleVia storefront uses. It sends the chosen offer and three
   fields — name, phone, city; the address is taken on the confirmation call —
   the server prices the order from the catalogue, and the page only ever
   reports an order the API confirmed.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ══ 00 · Config ═══════════════════════════════════════════════════════ */
  var RAW = window.GENOUILLERE_CONFIG || {};
  var CFG = {
    orderApiEndpoint: String(RAW.orderApiEndpoint || '').trim(),
    productSlug: String(RAW.productSlug || 'bellevia-genouillere').trim(),
    source: String(RAW.source || 'bellevia-genouillere').trim(),
    currencyShort: String(RAW.currencyShort || 'DH').trim(),
    currency: String(RAW.currency || 'درهم').trim(),
    currencyCode: String(RAW.currencyCode || 'MAD').trim().toUpperCase(),
    delivery: String(RAW.delivery || '').trim(),
    deliveryArea: String(RAW.deliveryArea || '').trim(),
    cashOnDelivery: RAW.cashOnDelivery !== false,
    cities: Array.isArray(RAW.cities) ? RAW.cities : [],
  };

  /* The offer ladder, cleaned and sorted by quantity. A row survives only if
     both its quantity and its total are real positive numbers, so a half-typed
     offer is dropped rather than rendered as `NaN درهم`.

     ⚠️ This must mirror PACK_PRICING["bellevia-genouillere"] in
     shared/catalog.js. The page never sends a price — the server reads that
     table — so a quantity offered here and missing there is an order the API
     answers `invalid_quantity`. */
  var OFFERS = (Array.isArray(RAW.offers) ? RAW.offers : [])
    .map(function (o) {
      return {
        qty: parseInt(o && o.qty, 10),
        price: typeof (o && o.price) === 'number' ? o.price : parseFloat(o && o.price),
        label: String((o && o.label) || '').trim(),
      };
    })
    .filter(function (o) { return o.qty > 0 && isFinite(o.price) && o.price > 0; })
    .sort(function (a, b) { return a.qty - b.qty; });

  /** The single-unit total — the yardstick every saving is measured against. */
  var UNIT = OFFERS.length ? OFFERS[0].price / OFFERS[0].qty : null;

  /**
   * What a row saves against buying that many units one at a time.
   * Computed, never configured: «وفر 60 درهم» on the pair is (2 × 180) − 300,
   * a number the customer can check. A hand-written saving becomes a lie the
   * first time someone edits a price and forgets it.
   */
  function saving(o) {
    if (UNIT === null) return 0;
    return Math.max(0, Math.round(o.qty * UNIT - o.price));
  }

  /** «180 درهم» — an Arabic phrase, so it inherits the page's RTL and the
      digits stay to the right of the currency word where they belong. */
  function money(n) { return n + ' ' + CFG.currency; }

  /* ══ 01 · Delivery and cash on delivery ════════════════════════════════
     One switch each. A page that promises free delivery or cash on delivery
     after one of them was turned off is a refused parcel at the door, so each
     is printed from config or not printed at all. */
  if (!CFG.cashOnDelivery) $$('[data-cod]').forEach(function (el) { el.remove(); });
  if (CFG.delivery) {
    $$('[data-delivery]').forEach(function (el) { el.textContent = CFG.delivery; });
    $$('[data-delivery-row]').forEach(function (el) { el.hidden = false; });
  } else {
    $$('[data-delivery-row]').forEach(function (el) { el.remove(); });
  }
  if (CFG.deliveryArea) {
    $$('[data-delivery-area]').forEach(function (el) { el.textContent = CFG.deliveryArea; el.hidden = false; });
    $$('[data-area-row]').forEach(function (el) { el.hidden = false; });
  } else {
    // The row too, not just its text: an icon beside nothing is still a promise.
    $$('[data-delivery-area], [data-area-row]').forEach(function (el) { el.remove(); });
  }

  /* ══ 02 · Prices ═══════════════════════════════════════════════════════
     Every price on the page is written from this one number, so there is no
     second place for a stale one to hide — and there is exactly ONE number.
     No struck-through "was" price: none was ever confirmed for this product,
     and an invented one is a fake discount. With none configured the price
     elements are REMOVED rather than left showing a placeholder — an emptied
     <p> still holds whitespace text nodes, so `:empty` would not catch it and
     the page would keep a bordered, blank price line. */
  (function prices() {
    if (!OFFERS.length) {
      $$('[data-price-wrap]').forEach(function (el) { el.remove(); });
      return;
    }
    $$('[data-price]').forEach(function (el) { el.textContent = money(OFFERS[0].price); el.hidden = false; });

    /* «2 بـ 300 درهم» — the hero and the offer card each name an offer by its
       quantity (data-offer-line="2") and get its price from here. A quantity
       that is not on sale removes its line, so neither can quote a price the
       form will not charge. Three spans so the number can be the big one; the
       order inside the flex row is the reading order, right to left. */
    $$('[data-offer-line]').forEach(function (el) {
      var qty = parseInt(el.getAttribute('data-offer-line'), 10);
      var o = OFFERS.filter(function (x) { return x.qty === qty; })[0];
      if (!o) { el.remove(); return; }
      el.textContent = '';
      [['oline__q', o.qty + ' بـ'], ['oline__n', String(o.price)], ['oline__c', CFG.currency]].forEach(function (p) {
        var s = document.createElement('span');
        s.className = p[0];
        s.textContent = p[1];
        el.appendChild(s);
      });
      el.hidden = false;
    });

    /* The chooser. Built from config rather than typed into the HTML, so a
       price can never disagree with the label beside it. Real radios in a real
       fieldset: arrow keys work, the group is one tab stop, and a screen reader
       announces "1 of 2" without a line of ARIA. */
    var box = $('[data-offers]');
    if (!box) return;
    box.textContent = '';

    OFFERS.forEach(function (o, i) {
      var sv = saving(o);

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'offer';
      input.value = String(o.qty);
      input.className = 'pick__radio';
      if (i === 0) input.checked = true;

      var name = document.createElement('span');
      name.className = 'pick__name';
      name.textContent = o.label || (o.qty + ' × ' + CFG.productName);

      var price = document.createElement('b');
      price.className = 'pick__price';
      price.textContent = money(o.price);

      var head = document.createElement('span');
      head.className = 'pick__head';
      head.appendChild(name);
      head.appendChild(price);

      var body = document.createElement('span');
      body.className = 'pick__box';
      body.appendChild(head);
      if (sv) {
        var tag = document.createElement('span');
        tag.className = 'pick__save';
        tag.textContent = 'وفر ' + money(sv);
        body.appendChild(tag);
      }

      var label = document.createElement('label');
      label.className = 'pick';
      label.appendChild(input);
      label.appendChild(body);
      box.appendChild(label);
    });
  })();

  /* ══ 02b · Reviews ═════════════════════════════════════════════════════
     Real customers only, from config.js `reviews`. A card is drawn only when
     it has a name and words; stars only when a rating was actually given. With
     none, the whole section is removed — an empty card with five stars is a
     rating nobody gave. */
  (function reviews() {
    var sec = $('[data-reviews]');
    var list = $('[data-reviews-list]');
    if (!sec || !list) return;
    var rows = (Array.isArray(RAW.reviews) ? RAW.reviews : []).filter(function (r) {
      return r && String(r.name || '').trim() && String(r.text || '').trim();
    });
    if (!rows.length) { sec.remove(); return; }
    rows.forEach(function (r) {
      var card = document.createElement('article');
      card.className = 'rcard';
      var head = document.createElement('div');
      head.className = 'rcard__head';
      if (r.photo) {
        var img = document.createElement('img');
        img.className = 'rcard__photo';
        img.src = String(r.photo);
        img.alt = '';
        img.loading = 'lazy';
        img.width = 48; img.height = 48;
        head.appendChild(img);
      }
      var who = document.createElement('div');
      var name = document.createElement('p');
      name.className = 'rcard__name';
      name.textContent = String(r.name).trim();
      who.appendChild(name);
      if (r.city) {
        var city = document.createElement('p');
        city.className = 'rcard__city';
        city.textContent = String(r.city).trim();
        who.appendChild(city);
      }
      head.appendChild(who);
      var stars = parseInt(r.rating, 10);
      if (stars >= 1 && stars <= 5) {
        var st = document.createElement('p');
        st.className = 'rcard__stars';
        st.textContent = '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars);
        st.setAttribute('aria-label', stars + ' من 5');
        head.appendChild(st);
      }
      card.appendChild(head);
      var text = document.createElement('p');
      text.className = 'rcard__text';
      text.textContent = String(r.text).trim();
      card.appendChild(text);
      list.appendChild(card);
    });
    sec.hidden = false;
  })();

  /* ══ 03 · City suggestions ═════════════════════════════════════════════
     A <datalist>, filled from config. The input stays a plain text field on
     purpose: a <select> of Moroccan cities cannot hold every douar and small
     town, and a customer who cannot find their own town simply does not order.
     Suggestions help the majority; typing serves everyone else. */
  (function cities() {
    var list = $('#cities');
    if (!list || !CFG.cities.length) return;
    var frag = document.createDocumentFragment();
    CFG.cities.forEach(function (name) {
      var o = document.createElement('option');
      o.value = name;
      frag.appendChild(o);
    });
    list.appendChild(frag);
  })();

  /* ══ 04 · Tracking bridge ══════════════════════════════════════════════
     nk-track.js is the store's one tracking implementation — it fires PageView
     itself and sends every event twice (pixel + Conversions API) under a shared
     event id. Nothing here re-implements it, and nothing here may throw. */
  function trackBoth(name, params) {
    try { if (window.nkTrack) return window.nkTrack.trackOnce(name, params); } catch (e) { /* never block */ }
    return undefined;
  }
  function trackPixel(name, params, id) {
    try { if (window.nkTrack) window.nkTrack.pixel(name, params, id); } catch (e) { /* never block */ }
  }
  function newEventId() {
    try { if (window.nkTrack) return window.nkTrack.id(); } catch (e) { /* fall through */ }
    return 'nk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  var CONTENT = {
    content_name: 'دعامة الركبة الاحترافية',
    content_type: 'product',
    content_ids: [CFG.productSlug],
  };

  /* ViewContent on load: a single-product landing page IS the product view, and
     a scroll trigger would miss every bounce — exactly the impressions Meta
     needs to learn from. */
  trackBoth('ViewContent', {
    content_name: CONTENT.content_name,
    content_type: CONTENT.content_type,
    content_ids: CONTENT.content_ids,
    value: OFFERS.length ? OFFERS[0].price : undefined,
    currency: CFG.currencyCode,
  });

  /* ══ 05 · Smooth scroll to the form ════════════════════════════════════
     Every «اطلب» on the page, and the sticky bar, land here. Same tab, and the
     form's first control — the chosen offer — is focused once the scroll has
     settled; focusing mid-flight cancels the smooth scroll in Safari.

     The offer, not the name field. The offer sits above the fields, and
     focusing a text input pops the phone keyboard, which makes the browser
     scroll the input up into the space left — carrying the offer off the
     top of the screen, the one thing the card now leads with. A radio takes
     focus without a keyboard. With no prices set there is no offer, and the
     name field is first again.

     Product photographs are deliberately NOT wired to this: a picture that
     jumps the page when you tap to look closer is a page fighting its reader. */
  $$('[data-goto]').forEach(function (a) {
    on(a, 'click', function (e) {
      // The section, not the form card: the offer card above the form is the
      // first thing a buyer should see on arrival.
      var card = $('#commander') || $('.order__card');
      if (!card) return;
      e.preventDefault();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // A link that sells one offer (the creative sells the pair) opens the
      // form on it. The change event runs the chooser's own handler, so the
      // total and the button label follow.
      var wanted = a.getAttribute('data-goto-offer');
      var pick = wanted && $('input[name="offer"][value="' + wanted + '"]');
      if (pick && !pick.checked) {
        pick.checked = true;
        pick.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var first = $('input[name="offer"]:checked') || $('input[name="offer"]') || $('#fullname');
      var doneEl = $('#order-done');
      if (!first || (doneEl && !doneEl.hidden)) return;
      setTimeout(function () { first.focus({ preventScroll: true }); }, 520);
    });
  });

  /* ══ 06 · Order form ═══════════════════════════════════════════════════ */
  (function orderForm() {
    var form = $('#order-form');
    if (!form) return;

    var submitBtn = $('#submit');
    var formError = $('#form-error');
    var done = $('#order-done');
    var doneNum = $('#order-number');
    var doneAgain = $('#order-again');
    var notice = $('#order-notice');
    /* Captured before the first submit can overwrite it — the button's label
       carries an inline SVG, so it is restored as HTML, not as text. */
    var LABEL = submitBtn ? submitBtn.innerHTML : '';

    /* ── The chosen offer ────────────────────────────────────────────────
       A pack ladder, not a multiplier: the catalogue prices 1 at 180 and 2 at
       300 and sells no other quantity, so the total is the row's own price —
       never unit × quantity, which would quote 360 for the pair. */
    var picked = OFFERS.length ? OFFERS[0] : null;

    function renderTotal() {
      var text = picked ? money(picked.price) : '—';
      $$('[data-sum-total]').forEach(function (el) { el.textContent = text; });
      $$('[data-sum-short]').forEach(function (el) { el.textContent = text; });
    }
    $$('input[name="offer"]', form).forEach(function (input) {
      on(input, 'change', function () {
        if (!input.checked) return;
        picked = OFFERS.filter(function (o) { return String(o.qty) === input.value; })[0] || picked;
        renderTotal();
      });
    });
    renderTotal();

    /* ── Validation ──────────────────────────────────────────────────────
       These three rules mirror `catalogSchema` in functions/api/orders.ts
       exactly — name 2–100, Moroccan mobile, city 2–80. Being stricter here
       than the server would reject orders the API would accept; being looser
       would send the customer a round trip to be told no. */

    /** Moroccan mobile, in whatever shape someone types it. */
    function normalizePhone(raw) {
      var d = String(raw).replace(/[\s\-().]/g, '');
      // Arabic-Indic digits, in case the keyboard is set to Arabic.
      d = d.replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); });
      d = d.replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); });
      if (d.indexOf('+212') === 0) d = '0' + d.slice(4);
      else if (d.indexOf('00212') === 0) d = '0' + d.slice(5);
      else if (d.indexOf('212') === 0 && d.length === 12) d = '0' + d.slice(3);
      return d;
    }

    var RULES = {
      fullname: function (v) {
        if (!v) return 'عمّر الاسم ديالك.';
        if (v.length < 2) return 'الاسم قصير بزاف.';
        if (v.length > 100) return 'الاسم طويل بزاف.';
        if (!/[؀-ۿa-zA-Z]/.test(v)) return 'كتب الاسم بالحروف.';
        return '';
      },
      phone: function (v) {
        if (!v) return 'عمّر رقم التيليفون.';
        if (!/^0[5-7]\d{8}$/.test(normalizePhone(v))) {
          return 'الرقم ماشي صحيح. خاصو يبدا بـ 06 ولا 07 ولا 05 ويكون فيه 10 أرقام.';
        }
        return '';
      },
      city: function (v) {
        if (!v) return 'عمّر المدينة.';
        if (v.length < 2) return 'كتب اسم المدينة كامل.';
        if (v.length > 80) return 'اسم المدينة طويل بزاف.';
        return '';
      },
    };

    function setError(input, msg) {
      var out = $('[data-err-for="' + input.id + '"]');
      if (out) { out.textContent = msg; out.hidden = !msg; }
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function validate(input) {
      var rule = RULES[input.name];
      if (!rule) return true;
      var msg = rule(input.value.trim());
      setError(input, msg);
      return !msg;
    }

    var inputs = $$('input', form).filter(function (i) { return RULES[i.name]; });
    inputs.forEach(function (input) {
      // Complain on blur, forgive on input: nobody wants to be told their phone
      // is wrong while they are still typing the third digit.
      on(input, 'blur', function () { validate(input); });
      on(input, 'input', function () {
        if (input.getAttribute('aria-invalid') === 'true') validate(input);
      });
    });

    function showFormError(msg) {
      if (!formError) return;
      formError.textContent = msg;
      formError.hidden = false;
      formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    var busy = false;
    function setBusy(b) {
      busy = b;
      if (!submitBtn) return;
      submitBtn.disabled = b;
      if (b) submitBtn.textContent = 'كنسجلو الطلب…';
      else { submitBtn.innerHTML = LABEL; renderTotal(); }
    }

    var SERVER_MESSAGES = {
      product_unavailable: 'المنتوج ماشي متوفر دابا. عيط لينا وغادي نعاونوك.',
      invalid_payload: 'كاينة شي معلومة ناقصة ولا ماشي صحيحة. عاود شوف الفورم عافاك.',
      validation_error: 'كاينة شي معلومة ناقصة ولا ماشي صحيحة. عاود شوف الفورم عافاك.',
      invalid_quantity: 'هاد الكمية ماشي متوفرة. بدلها وعاود.',
      rate_limited: 'بزاف ديال المحاولات فوقت قصير. تسنى شوية وعاود.',
      insufficient_stock: 'ما بقاش بزاف فالمخزون. نقّص الكمية ولا عيط لينا.',
    };

    // Minted once per page view, before anything is sent, so the browser copy
    // and the server copy of each event carry the same id. Purchase gets its
    // own — Meta deduplicates per event name AND id.
    var leadEventId = newEventId();
    var purchaseEventId = newEventId();

    function payload() {
      return {
        productSlug: CFG.productSlug,
        // Joins this order to the funnel events from the same visit, so the
        // server can record order_success against the session that started the
        // form. Opaque and anonymous; absent if storage is unavailable.
        sessionId: (window.nkTrack && window.nkTrack.sessionId && window.nkTrack.sessionId()) || undefined,
        customerName: $('#fullname').value.trim(),
        phone: normalizePhone($('#phone').value),
        city: $('#city').value.trim(),
        // No `address` key at all — not an empty one. The street is taken on
        // the confirmation call, and catalogSchema treats an OMITTED address as
        // "leave the stored one alone", while an empty string fails min(3).
        // `Customer` is keyed by phone across every storefront, so a stand-in
        // sentence here would overwrite a real customer's real street.
        quantity: picked ? picked.qty : 1,
        source: CFG.source,
        // Attribution ids. If Meta is unreachable these are simply ignored and
        // the order is unaffected. No price is sent — the server prices the
        // order from the catalogue and would discard one if it were.
        eventId: leadEventId,
        purchaseEventId: purchaseEventId,
      };
    }

    function showDone(result) {
      form.hidden = true;
      if (notice) notice.hidden = true;
      if (done) {
        if (doneNum) doneNum.textContent = (result && result.orderNumber) || '—';
        var numLine = $('.done__num');
        if (numLine) numLine.hidden = !(result && result.orderNumber);
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      /* Lead + Purchase, browser copy only: the server fired its own from the
         order path with these same ids, at the moment the row was committed.
         The value is what the API confirmed — never a constant, or Meta
         optimises against revenue that does not match the sale. */
      var value = result && result.total != null
        ? result.total / 100
        : (picked ? picked.price : undefined);
      var currency = (result && result.currency) || CFG.currencyCode;

      trackPixel('Lead', {
        value: value, currency: currency,
        content_name: CONTENT.content_name,
        order_id: result && result.orderNumber,
      }, leadEventId);

      // fbevents logs "Parameter 'currency' is invalid for event 'Purchase'"
      // because its validator's list of 49 codes omits MAD. It is advisory —
      // the event is still sent, and the Conversions API accepts MAD.
      // Do not "fix" it by changing the currency. See META-TRACKING.md.
      trackPixel('Purchase', {
        value: value, currency: currency,
        content_name: CONTENT.content_name,
        content_type: CONTENT.content_type,
        content_ids: CONTENT.content_ids,
        contents: [{ id: CFG.productSlug, quantity: picked ? picked.qty : 1, item_price: value == null || !picked ? undefined : value / picked.qty }],
        num_items: picked ? picked.qty : 1,
        order_id: result && result.orderNumber,
      }, purchaseEventId);
    }

    on(doneAgain, 'click', function () {
      form.reset();
      inputs.forEach(function (i) { setError(i, ''); });
      if (formError) formError.hidden = true;
      if (done) done.hidden = true;
      if (notice) notice.hidden = !DEMO;
      form.hidden = false;
      var first = $('input[name="offer"]');
      if (first) { first.checked = true; picked = OFFERS[0] || picked; }
      renderTotal();
      // A second order in the same page view is a different conversion.
      leadEventId = newEventId();
      purchaseEventId = newEventId();
      (first || $('#fullname')).focus(); // the offer leads, as in section 05
    });

    /* ── Demo mode ───────────────────────────────────────────────────────
       No endpoint means there is nowhere for an order to go. The form stays
       usable so the page can be shown to the client, but it says so and
       refuses to claim an order was placed — a fake success is worth a real
       order lost. */
    var DEMO = !CFG.orderApiEndpoint;
    if (DEMO && notice) {
      notice.textContent = 'وضع التجربة: رابط الطلبات ما تعمّرش فالإعدادات، فالطلبات ما كيتسجلوش.';
      notice.hidden = false;
    }

    /* ── Submit ──────────────────────────────────────────────────────────── */
    on(form, 'submit', function (e) {
      e.preventDefault();
      if (busy) return; // duplicate-click protection
      if (formError) formError.hidden = true;

      /* The chosen row is read back from the DOM rather than trusted from the
         `change` handler alone: browser autofill and a restored bfcache page
         can both leave a radio checked that never fired an event. */
      var chosen = $('input[name="offer"]:checked');
      if (chosen) {
        picked = OFFERS.filter(function (o) { return String(o.qty) === chosen.value; })[0] || picked;
        renderTotal();
      }

      var bad = null;
      inputs.forEach(function (input) { if (!validate(input) && !bad) bad = input; });
      if (bad) {
        bad.focus();
        bad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      /* InitiateCheckout on a valid attempt. Gated to once per page view: a
         customer who mistypes a phone number, corrects it and resubmits is one
         checkout, not two. */
      trackBoth('InitiateCheckout', {
        value: picked ? picked.price : undefined,
        currency: CFG.currencyCode,
        content_type: CONTENT.content_type,
        contents: [{ id: CFG.productSlug, quantity: picked ? picked.qty : 1 }],
      });

      if (DEMO) {
        showFormError('وضع التجربة: الطلب ما تسجّلش. خاص تتعمّر الإعدادات.');
        return;
      }

      setBusy(true);

      var ac = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ac) ac.abort(); }, 15000);

      fetch(CFG.orderApiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
        signal: ac ? ac.signal : undefined,
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; })
            .then(function (body) { return { ok: res.ok, body: body }; });
        })
        .then(function (r) {
          // Success is whatever the server says it is. The page never reports
          // an order as placed on its own initiative, and on failure every
          // field the customer typed is left exactly as it was so they can
          // retry.
          if (r.ok && r.body && r.body.ok) { showDone(r.body); return; }
          var code = r.body && r.body.error;
          showFormError(SERVER_MESSAGES[code] || 'ما قدرناش نسجلو الطلب دابا. عاود حاول ولا عيط لينا.');
        })
        .catch(function () {
          showFormError('كاين مشكل فالكونيكسيون. تأكد من الأنترنيت وعاود حاول.');
        })
        .then(function () {
          clearTimeout(timer);
          setBusy(false);
        });
    });
  })();

  /* ══ 07 · Sticky mobile CTA ════════════════════════════════════════════
     Up only once BOTH the hero button and the order card are off screen, so the
     opening screen is never two identical CTAs and the bar never covers the
     form it points at. `body` carries matching bottom padding while it is up,
     so it cannot hide the last line of the page either. */
  (function sticky() {
    var bar = $('#sticky');
    var card = $('.order__card');
    var heroCta = $('.hero__copy .btn');
    var done = $('#order-done');
    if (!bar || !card || !('IntersectionObserver' in window)) return;

    var phone = window.matchMedia('(max-width: 899px)');
    var visible = new Map();

    function apply() {
      var anyOn = false;
      visible.forEach(function (v) { if (v) anyOn = true; });
      var show = phone.matches && !anyOn && (!done || done.hidden);
      bar.hidden = !show;
      document.body.style.paddingBottom = show ? bar.offsetHeight + 'px' : '';
    }

    // rootMargin stays 0: a negative inset shrinks the root, and on a 360×800
    // phone the hero button sits in the last pixels of the first screen.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible.set(en.target, en.isIntersecting); });
      apply();
    }, { rootMargin: '0px' });

    io.observe(card);
    if (heroCta) io.observe(heroCta);

    if (phone.addEventListener) phone.addEventListener('change', apply);
    else if (phone.addListener) phone.addListener(apply);
    /* Unconditionally, not only while the bar is already up: gating on
       `!bar.hidden` means a resize can hide the bar but never reveal it. */
    on(window, 'resize', apply);
  })();
})();
