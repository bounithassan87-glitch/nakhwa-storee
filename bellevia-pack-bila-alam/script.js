/* ==========================================================================
   BelleVia — باك بلا ألم · behaviour
   Vanilla, no build, no dependency. Each block finds its own hooks and does
   nothing at all if they are absent, so deleting a section cannot throw.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ══ 00 · Config ═══════════════════════════════════════════════════════ */
  var RAW = window.BELLEVIA_CONFIG || {};
  var CFG = {
    orderApiEndpoint: String(RAW.orderApiEndpoint || '').trim(),
    productSlug: String(RAW.productSlug || 'bellevia-pack-bila-alam').trim(),
    source: String(RAW.source || 'bellevia-pack-bila-alam').trim(),
    price: String(RAW.price || '').trim(),
    oldPrice: String(RAW.oldPrice || '').trim(),
    currency: String(RAW.currency || 'درهم').trim(),
    currencyCode: String(RAW.currencyCode || 'MAD').trim().toUpperCase(),
    maxQuantity: Math.max(1, Math.min(10, parseInt(RAW.maxQuantity, 10) || 5)),
    delivery: String(RAW.delivery || '').trim(),
    deliveryTime: String(RAW.deliveryTime || '').trim(),
    cashOnDelivery: RAW.cashOnDelivery !== false,
    whatsapp: String(RAW.whatsapp || '').replace(/[^\d]/g, ''),
    phone: String(RAW.phone || '').trim(),
  };

  /** Digits only counts as a number; anything else is text the client wrote. */
  function numeric(v) { return /^\d+(?:[.,]\d+)?$/.test(v) ? parseFloat(v.replace(',', '.')) : null; }
  var UNIT = numeric(CFG.price);

  /** "329 درهم" — an Arabic phrase, so it inherits the page's RTL. */
  function money(n) {
    if (n === null || n === undefined) return '[PRICE]';
    return n + ' ' + CFG.currency;
  }

  /* ══ 01 · Delivery, delay, cash on delivery ════════════════════════════
     One switch each. A page that promises free delivery, or 72 hours, or cash
     on delivery after one of them was turned off is a refused parcel at the
     door — so every one of them is printed from config or not printed at all. */
  if (!CFG.cashOnDelivery) $$('[data-cod]').forEach(function (el) { el.remove(); });
  if (CFG.delivery) {
    $$('[data-delivery]').forEach(function (el) { el.textContent = CFG.delivery; el.hidden = false; });
  }
  if (CFG.deliveryTime) {
    $$('[data-delivery-time]').forEach(function (el) { el.textContent = CFG.deliveryTime; el.hidden = false; });
  }
  /* The FAQ answer is a sentence, not a chip, so it is composed rather than
     replaced — and it keeps its written fallback when no delay is configured. */
  $$('[data-delivery-sentence]').forEach(function (el) {
    if (!CFG.deliveryTime) return;
    el.textContent = 'كنتاصلو بيك فالأول باش نأكدو الطلب، ومن بعد كيوصلك الباك ' +
      CFG.deliveryTime + (CFG.delivery ? ' — ' + CFG.delivery + '.' : '.');
  });

  /* ══ 02 · Prices ═══════════════════════════════════════════════════════
     Every `[data-price-main]` on the page — announcement bar, hero, offer,
     FAQ, final CTA — is written from the same one number, so there is no
     second place for a stale price to hide. */
  (function prices() {
    var main = UNIT === null ? '[PRICE]' : money(UNIT);
    $$('[data-price-main]').forEach(function (el) {
      el.textContent = main;
      el.classList.toggle('is-placeholder', UNIT === null);
    });
    $$('[data-price-short]').forEach(function (el) { el.textContent = main; });

    var old = numeric(CFG.oldPrice);
    if (old !== null && UNIT !== null && old > UNIT) {
      $$('[data-old-price]').forEach(function (el) { el.textContent = money(old); el.hidden = false; });
    }

    // JSON-LD gets an offer only when there is a real price to state.
    var ld = $('#ld-product');
    if (ld && UNIT !== null) {
      try {
        var data = JSON.parse(ld.textContent);
        data.offers = {
          '@type': 'Offer',
          price: String(UNIT),
          priceCurrency: CFG.currencyCode,
          availability: 'https://schema.org/InStock',
        };
        ld.textContent = JSON.stringify(data);
      } catch (err) { /* a malformed block is not worth breaking the page over */ }
    }
  })();

  /* ══ 03 · Contact ══════════════════════════════════════════════════════ */
  (function contact() {
    var out = $('[data-contact]');
    if (!out) return;
    var bits = [];
    if (CFG.phone) bits.push('<a href="tel:' + CFG.phone.replace(/\s/g, '') + '">' + CFG.phone + '</a>');
    if (CFG.whatsapp) bits.push('<a href="https://wa.me/' + CFG.whatsapp + '" rel="noopener">WhatsApp</a>');
    if (!bits.length) return;
    out.innerHTML = bits.join(' · ');
    out.hidden = false;
  })();

  /* ══ 04 · Tracking bridge ══════════════════════════════════════════════
     nk-track.js is the store's one tracking implementation — it fires PageView
     itself and sends every event twice (pixel + Conversions API) under a shared
     event_id. Nothing here re-implements it, and nothing here may throw. */
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
    content_name: 'باك بلا ألم — BelleVia',
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
    value: UNIT === null ? undefined : UNIT,
    currency: CFG.currencyCode,
  });

  /* ══ 05 · Smooth scroll to the form ════════════════════════════════════ */
  $$('[data-goto]').forEach(function (a) {
    on(a, 'click', function (e) {
      var card = $('.order__card');
      if (!card) return;
      e.preventDefault();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = $('#fullname');
      var doneEl = $('#order-done');
      if (!first || (doneEl && !doneEl.hidden)) return;
      // Focusing mid-flight cancels the smooth scroll in Safari.
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

    /* ── Quantity ────────────────────────────────────────────────────────
       A plain multiplier, not a pack ladder: the catalogue prices this product
       at a unit price and the server bills unit × quantity, so anything else on
       screen would be a number the customer is not actually charged. */
    var qty = 1;
    var qtyOut = $('[data-qty-value]');
    var qtyHint = $('[data-qty-hint]');

    function renderTotal() {
      var total = UNIT === null ? null : UNIT * qty;
      var text = total === null ? '[PRICE]' : money(total);
      if (qtyOut) qtyOut.textContent = String(qty);
      $$('[data-sum-total]').forEach(function (el) { el.textContent = text; });
      $$('[data-sum-short]').forEach(function (el) { el.textContent = text; });
      if (qtyHint) {
        qtyHint.textContent = UNIT === null || qty < 2 ? '' : qty + ' × ' + money(UNIT);
      }
      var down = $('[data-qty-down]'); var up = $('[data-qty-up]');
      if (down) down.disabled = qty <= 1;
      if (up) up.disabled = qty >= CFG.maxQuantity;
    }

    function setQty(n) {
      qty = Math.max(1, Math.min(CFG.maxQuantity, n));
      renderTotal();
    }
    on($('[data-qty-down]'), 'click', function () { setQty(qty - 1); });
    on($('[data-qty-up]'), 'click', function () { setQty(qty + 1); });
    renderTotal();

    /* ── Validation ────────────────────────────────────────────────────── */
    function normalizePhone(raw) {
      var d = String(raw).replace(/[\s\-().]/g, '');
      if (d.indexOf('+212') === 0) d = '0' + d.slice(4);
      else if (d.indexOf('00212') === 0) d = '0' + d.slice(5);
      else if (d.indexOf('212') === 0 && d.length === 12) d = '0' + d.slice(3);
      return d;
    }

    /* Three rules for three fields. There is no address rule because there is
       no address field: `/api/orders` accepts a catalog order without one, and
       the street is taken on the confirmation call. */
    var RULES = {
      fullname: function (v) {
        if (!v) return 'عمّر الاسم ديالك.';
        if (v.length < 3) return 'الاسم قصير بزاف.';
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
    var label = submitBtn ? submitBtn.innerHTML : '';
    function setBusy(b) {
      busy = b;
      if (!submitBtn) return;
      submitBtn.disabled = b;
      if (b) submitBtn.textContent = 'كنسجلو الطلب…';
      else submitBtn.innerHTML = label;
      if (!b) renderTotal();
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
        // No `address` key, on purpose. This form asks for three fields, and
        // sending a stand-in sentence would overwrite the real street the same
        // customer may already have on file from another BelleVia page —
        // `Customer` is keyed by phone across all of them. Omitting the field
        // makes the server leave that stored address alone.
        quantity: qty,
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
        : (UNIT === null ? undefined : UNIT * qty);
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
        contents: [{ id: CFG.productSlug, quantity: qty, item_price: value == null ? undefined : value / qty }],
        num_items: qty,
        order_id: result && result.orderNumber,
      }, purchaseEventId);

      if (typeof window.belleviaOnOrder === 'function') {
        try { window.belleviaOnOrder(result || {}); } catch (err) { /* never block on tracking */ }
      }
    }

    on(doneAgain, 'click', function () {
      form.reset();
      inputs.forEach(function (i) { setError(i, ''); });
      if (formError) formError.hidden = true;
      if (done) done.hidden = true;
      if (notice) notice.hidden = !DEMO;
      form.hidden = false;
      setQty(1);
      // A second order in the same page view is a different conversion.
      leadEventId = newEventId();
      purchaseEventId = newEventId();
      $('#fullname').focus();
    });

    /* ── Demo mode ─────────────────────────────────────────────────────
       No endpoint means there is nowhere for an order to go. The form stays
       usable so the page can be shown to the client, but it says so and
       refuses to claim an order was placed — a fake success is worth a real
       order lost. */
    var DEMO = !CFG.orderApiEndpoint;
    if (DEMO && notice) {
      notice.textContent = 'وضع التجربة: رابط الطلبات ما تعمّرش فالإعدادات، فالطلبات ما كيتسجلوش.';
      notice.hidden = false;
    }

    /* ── Submit ────────────────────────────────────────────────────────── */
    on(form, 'submit', function (e) {
      e.preventDefault();
      if (busy) return; // duplicate-click protection
      if (formError) formError.hidden = true;

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
        value: UNIT === null ? undefined : UNIT * qty,
        currency: CFG.currencyCode,
        content_type: CONTENT.content_type,
        contents: [{ id: CFG.productSlug, quantity: qty }],
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

    /* ══ 07 · Sticky mobile CTA ══════════════════════════════════════════
       Up only once BOTH the hero button and the order card are off screen, so
       the opening screen is never two identical CTAs. `body` carries matching
       bottom padding while it is up, so it cannot cover the last line. */
    (function sticky() {
      var bar = $('#sticky');
      var card = $('.order__card');
      var heroCta = $('.hero__offer .btn');
      if (!bar || !card || !('IntersectionObserver' in window)) return;

      var phone = window.matchMedia('(max-width: 719px)');
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
      on(window, 'resize', function () { if (!bar.hidden) apply(); });
    })();
  })();
})();
