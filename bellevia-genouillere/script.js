/* ==========================================================================
   دعامة الركبة الاحترافية · behaviour

   Vanilla, no build step, no dependency. Each block finds its own hooks and
   does nothing at all if they are absent, so deleting a section from the HTML
   cannot throw.

   The form posts to `/api/orders` — the store's one order endpoint, the same
   one every other BelleVia storefront uses. It sends five fields, the server
   prices the order from the catalogue, and the page only ever reports an order
   the API confirmed.
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
    price: String(RAW.price || '').trim(),
    currency: String(RAW.currency || 'درهم').trim(),
    currencyCode: String(RAW.currencyCode || 'MAD').trim().toUpperCase(),
    maxQuantity: Math.max(1, Math.min(10, parseInt(RAW.maxQuantity, 10) || 5)),
    delivery: String(RAW.delivery || '').trim(),
    deliveryArea: String(RAW.deliveryArea || '').trim(),
    cashOnDelivery: RAW.cashOnDelivery !== false,
    cities: Array.isArray(RAW.cities) ? RAW.cities : [],
  };

  /** Digits only counts as a number; anything else is text someone typed. */
  function numeric(v) { return /^\d+(?:[.,]\d+)?$/.test(v) ? parseFloat(v.replace(',', '.')) : null; }
  var UNIT = numeric(CFG.price);

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
  } else {
    $$('[data-delivery-area]').forEach(function (el) { el.remove(); });
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
    if (UNIT === null) {
      $$('[data-price-wrap]').forEach(function (el) { el.remove(); });
      return;
    }
    $$('[data-price]').forEach(function (el) { el.textContent = money(UNIT); el.hidden = false; });
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
    value: UNIT === null ? undefined : UNIT,
    currency: CFG.currencyCode,
  });

  /* ══ 05 · Smooth scroll to the form ════════════════════════════════════
     Every «اطلب» on the page, and the sticky bar, land here. Same tab, and the
     first field is focused once the scroll has settled — focusing mid-flight
     cancels the smooth scroll in Safari.

     Product photographs are deliberately NOT wired to this: a picture that
     jumps the page when you tap to look closer is a page fighting its reader. */
  $$('[data-goto]').forEach(function (a) {
    on(a, 'click', function (e) {
      var card = $('.order__card');
      if (!card) return;
      e.preventDefault();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = $('#fullname');
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

    /* ── Quantity ────────────────────────────────────────────────────────
       A plain multiplier, not a pack ladder: the catalogue prices this product
       at a unit price and the server bills unit × quantity, so anything else on
       screen would be a number the customer is not actually charged. */
    var qty = 1;
    var qtyOut = $('[data-qty-value]');
    var qtyHint = $('[data-qty-hint]');

    function renderTotal() {
      var total = UNIT === null ? null : UNIT * qty;
      var text = total === null ? '—' : money(total);
      if (qtyOut) qtyOut.textContent = String(qty);
      $$('[data-sum-total]').forEach(function (el) { el.textContent = text; });
      $$('[data-sum-short]').forEach(function (el) { el.textContent = text; });
      if (qtyHint) qtyHint.textContent = UNIT === null || qty < 2 ? '' : qty + ' × ' + money(UNIT);
      var down = $('[data-qty-down]'); var up = $('[data-qty-up]');
      if (down) down.disabled = qty <= 1;
      if (up) up.disabled = qty >= CFG.maxQuantity;
    }
    function setQty(n) { qty = Math.max(1, Math.min(CFG.maxQuantity, n)); renderTotal(); }
    on($('[data-qty-down]'), 'click', function () { setQty(qty - 1); });
    on($('[data-qty-up]'), 'click', function () { setQty(qty + 1); });
    renderTotal();

    /* ── Validation ──────────────────────────────────────────────────────
       These four rules mirror `catalogSchema` in functions/api/orders.ts
       exactly — name 2–100, Moroccan mobile, city 2–80, address 3–200. Being
       stricter here than the server would reject orders the API would accept;
       being looser would send the customer a round trip to be told no. */

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
      address: function (v) {
        if (!v) return 'عمّر العنوان باش يوصلك الطلب.';
        if (v.length < 3) return 'العنوان قصير بزاف.';
        if (v.length > 200) return 'العنوان طويل بزاف — قصّرو شوية.';
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
        // A real street, unlike the three-field BelleVia pages that omit the
        // key entirely. `Customer` is keyed by phone across every storefront,
        // so what goes here is written to that customer's record — which is
        // exactly right when it is a genuine address, and exactly why a
        // stand-in sentence must never be sent.
        address: $('#address').value.trim(),
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
  })();

  /* ══ 07 · Sticky mobile CTA ════════════════════════════════════════════
     Up only once BOTH the hero button and the order card are off screen, so the
     opening screen is never two identical CTAs and the bar never covers the
     form it points at. `body` carries matching bottom padding while it is up,
     so it cannot hide the last line of the page either. */
  (function sticky() {
    var bar = $('#sticky');
    var card = $('.order__card');
    var heroCta = $('.hero__buy .btn');
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
