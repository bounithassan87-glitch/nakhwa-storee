/* ==========================================================================
   BelleVia — دعامة الركبة الاحترافية · behaviour

   Vanilla, no build step, no dependency, ~7KB unminified. Each block finds its
   own hooks and does nothing at all if they are absent, so deleting a section
   from the HTML cannot throw.

   This page does NOT post an order anywhere. It validates three fields and
   hands the customer to WhatsApp with the message already written. There is no
   database call, no `/api/orders`, and no third-party WhatsApp API — the link
   is `https://wa.me/<number>?text=<encoded>`, which the native app answers on
   iPhone and Android and which falls back to WhatsApp Web on a desktop that has
   no app installed.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ══ 00 · Config ═══════════════════════════════════════════════════════ */
  var RAW = window.GENOUILLERE_CONFIG || {};
  var CFG = {
    /* Digits only. A number pasted in as «+212 624…» or «00212624…» would build
       a wa.me URL that silently resolves to nothing, so it is cleaned here
       rather than trusted. */
    whatsappNumber: String(RAW.whatsappNumber || '').replace(/[^\d]/g, ''),
    whatsappDisplay: String(RAW.whatsappDisplay || '').trim(),
    productName: String(RAW.productName || 'دعامة الركبة الاحترافية').trim(),
    currency: String(RAW.currency || 'درهم').trim(),
    currencyShort: String(RAW.currencyShort || 'DH').trim(),
    currencyCode: String(RAW.currencyCode || 'MAD').trim().toUpperCase(),
    delivery: String(RAW.delivery || '').trim(),
    cashOnDelivery: RAW.cashOnDelivery !== false,
    cities: Array.isArray(RAW.cities) ? RAW.cities : [],
  };

  /* The offer ladder, cleaned and sorted by quantity. A row is only kept if
     both its quantity and its total are real positive numbers — a half-typed
     offer is dropped rather than rendered as `NaN درهم`. */
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
   * Computed, never configured: «وفر 60 درهم» on the 2-pack is (2 × 180) − 300,
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
    // The text goes on the span; the row around it carries the emoji and the
    // card border, so the two hooks are separate — writing textContent onto the
    // row would delete the 🚚 with it.
    $$('[data-delivery]').forEach(function (el) { el.textContent = CFG.delivery; });
    $$('[data-delivery-row]').forEach(function (el) { el.hidden = false; });
  } else {
    $$('[data-delivery-row]').forEach(function (el) { el.remove(); });
  }

  /* ══ 02 · The offer ════════════════════════════════════════════════════
     Every price on the page — the announcement strip, the hero, the chooser in
     the form, the WhatsApp message, the structured data — is written from
     `OFFERS`, so there is no second place for a stale number to hide.

     With no offers configured, every price element is REMOVED rather than left
     showing a placeholder: this page hands the customer to WhatsApp, where the
     price could be agreed in the conversation, so a page with no price is a
     valid page rather than a broken one. Nothing is ever invented. */

  /** The row the customer has chosen. Defaults to the first, never to null. */
  var picked = OFFERS.length ? OFFERS[0] : null;

  (function offers() {
    if (!OFFERS.length) {
      // The wrapper goes too, not just the number: an emptied <p> still holds
      // whitespace text nodes, so `:empty` would not catch it and the page
      // would keep a bordered, blank price line.
      $$('[data-price-wrap], [data-offers]').forEach(function (el) { el.remove(); });
      return;
    }

    /* The headline price: what one unit costs. */
    $$('[data-offer-from]').forEach(function (el) { el.textContent = money(OFFERS[0].price); el.hidden = false; });

    /* The one-line echo of the multi-buy, for the strip and the hero. Built
       from digits and Arabic only — the Latin labels stay in the chooser, where
       each sits on its own line as a standalone run. */
    var best = OFFERS[OFFERS.length - 1];
    if (best !== OFFERS[0]) {
      var sv = saving(best);
      var line = 'أو ' + best.qty + ' بـ ' + money(best.price) + (sv ? ' — وفر ' + money(sv) : '');
      $$('[data-offer-alt]').forEach(function (el) { el.textContent = line; el.hidden = false; });
    } else {
      $$('[data-offer-alt]').forEach(function (el) { el.remove(); });
    }

    /* ── The chooser ────────────────────────────────────────────────────
       Built from config rather than typed into the HTML, so a price can never
       disagree with the label beside it. Real radios in a real fieldset: the
       arrow keys work, the group has one tab stop, and a screen reader
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
      input.className = 'offer__radio';
      if (i === 0) input.checked = true;

      var head = document.createElement('span');
      head.className = 'offer__head';
      var name = document.createElement('span');
      name.className = 'offer__name';
      name.textContent = o.label || (o.qty + ' × ' + CFG.productName);
      var price = document.createElement('b');
      price.className = 'offer__price';
      price.textContent = money(o.price);
      head.appendChild(name);
      head.appendChild(price);

      var body = document.createElement('span');
      body.className = 'offer__box';
      body.appendChild(head);
      if (sv) {
        var tag = document.createElement('span');
        tag.className = 'offer__save';
        tag.textContent = 'وفر ' + money(sv);
        body.appendChild(tag);
      }

      var label = document.createElement('label');
      label.className = 'offer';
      label.appendChild(input);
      label.appendChild(body);
      box.appendChild(label);

      on(input, 'change', function () { if (input.checked) picked = o; });
    });
  })();

  /* ══ 02b · Structured data ═════════════════════════════════════════════
     The offers are stated in the markup too, so a crawler that runs no JS sees
     them; this rewrites them from config so the two can never drift apart.

     Only what is confirmed goes in: a total, a currency, the quantity that
     total buys, and the page you order from. No `availability` (nobody has
     given us stock figures), no `sku`, no rating and no reviews — a rich result
     built on numbers nobody can vouch for is what earns a manual action. */
  (function structuredData() {
    var node = $('#ld-product');
    if (!node) return;
    try {
      var data = JSON.parse(node.textContent);
      if (!OFFERS.length) { delete data.offers; }
      else {
        data.offers = OFFERS.map(function (o) {
          return {
            '@type': 'Offer',
            price: String(o.price),
            priceCurrency: CFG.currencyCode,
            eligibleQuantity: { '@type': 'QuantitativeValue', value: o.qty, unitCode: 'C62' },
            url: location.origin + location.pathname,
          };
        });
      }
      node.textContent = JSON.stringify(data);
    } catch (err) { /* a malformed block is not worth breaking the page over */ }
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

  /* ══ 04 · Contact line in the footer ═══════════════════════════════════ */
  (function contact() {
    var out = $('[data-contact]');
    if (!out || !CFG.whatsappNumber) return;
    var label = CFG.whatsappDisplay || CFG.whatsappNumber;
    out.innerHTML = 'واتساب: <a href="https://wa.me/' + CFG.whatsappNumber +
      '" rel="noopener"><span class="ltr">' + label + '</span></a>';
    out.hidden = false;
  })();

  /* ══ 05 · Tracking bridge ══════════════════════════════════════════════
     nk-track.js is the store's one tracking implementation — it fires PageView
     itself and sends every event twice (pixel + Conversions API) under a shared
     event id. Nothing here re-implements it, and nothing here may throw.

     This page fires ViewContent and Lead only. It never fires Purchase: no
     order is committed here, and reporting a purchase at the moment someone
     opens WhatsApp would teach Meta to optimise for taps instead of sales. */
  function track(name, params) {
    try { if (window.nkTrack) return window.nkTrack.trackOnce(name, params); } catch (e) { /* never block */ }
    return undefined;
  }

  var CONTENT = {
    content_name: CFG.productName + ' — BelleVia',
    content_type: 'product',
    content_ids: ['bellevia-genouillere'],
  };

  /* ViewContent on load: a single-product landing page IS the product view, and
     a scroll trigger would miss every bounce — exactly the impressions Meta
     needs to learn from. */
  track('ViewContent', {
    content_name: CONTENT.content_name,
    content_type: CONTENT.content_type,
    content_ids: CONTENT.content_ids,
    value: OFFERS.length ? OFFERS[0].price : undefined,
    currency: CFG.currencyCode,
  });

  /* ══ 06 · Smooth scroll to the form ════════════════════════════════════
     Every «اطلب الآن» on the page, and the sticky bar, land here. Same tab, no
     new window, and the first field is focused once the scroll has settled —
     focusing mid-flight cancels the smooth scroll in Safari.

     Product photographs are deliberately NOT wired to this: a picture that
     jumps the page when you tap to look closer is a page fighting its reader. */
  $$('[data-goto]').forEach(function (a) {
    on(a, 'click', function (e) {
      var card = $('.order__card');
      if (!card) return;
      e.preventDefault();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = $('#fullname');
      if (!first) return;
      setTimeout(function () { first.focus({ preventScroll: true }); }, 520);
    });
  });

  /* ══ 07 · Order form → WhatsApp ════════════════════════════════════════ */
  (function orderForm() {
    var form = $('#order-form');
    if (!form) return;

    var submitBtn = $('#submit');
    var formError = $('#form-error');
    /* Captured before the first submit can overwrite it — the button's label
       carries an inline SVG, so it is restored as HTML, not as text. */
    var LABEL = submitBtn ? submitBtn.innerHTML : '';

    /* ── Validation ──────────────────────────────────────────────────────
       Three rules for three fields. There is no address rule, no email rule and
       no quantity rule because there are no such fields: every extra box on a
       Moroccan COD form is orders lost, and the rest is settled on the call. */

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

    /* Name and phone come from /assets/js/order-form.js, shared with every
       other storefront, so the Moroccan mobile shapes and the fake-number
       patterns are defined once. The CITY rule below is this page's own and
       stays that way — the shared file keeps a closed list of 142 localities,
       which is the opposite of what this field is for.

       The shared helper recognises this input as the page's own (it carries
       `list="cities"`, and that datalist exists here), so it does not touch it:
       no list swap, no canonicalisation.

       `fallback` is not a second copy of the shared rules — it is what runs if
       that file fails to load, and it only refuses what is plainly wrong. A
       checkout does not get to break because a helper 404s. */
    var SHARED = (window.nkOrderForm && window.nkOrderForm.rules) || {};
    var fallback = {
      fullname: function (v) {
        return v && v.trim().length >= 3 ? '' : 'المرجو كتابة الاسم الكامل.';
      },
      phone: function (v) {
        return /^0[67]\d{8}$/.test(normalizePhone(v))
          ? '' : 'الرقم غير صحيح. يجب أن يبدأ بـ 06 أو 07 ويتكون من 10 أرقام.';
      },
    };

    var RULES = {
      fullname: SHARED.fullname || fallback.fullname,
      phone: SHARED.phone || fallback.phone,
      // Suggestions only, and deliberately NOT the shared city rule. Anything
      // the customer types is a place they live: the datalist holds the 67
      // towns most orders come from, and a douar that is not in it must still
      // be able to place an order.
      city: function (v) {
        if (!v) return 'المرجو كتابة المدينة.';
        if (v.length < 2) return 'المرجو كتابة اسم المدينة كاملاً.';
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

    /* ── The message ─────────────────────────────────────────────────────
       Built with encodeURIComponent rather than string concatenation into the
       query: a name with «&» in it, or the newlines this message needs, would
       otherwise truncate the text at the first special character and land the
       customer in WhatsApp with half a message. */
    function whatsappUrl(data) {
      var text =
        'السلام عليكم، بغيت نطلب Genouillère.\n\n' +
        'الاسم: ' + data.name + '\n' +
        'الهاتف: ' + data.phone + '\n' +
        'المدينة: ' + data.city + '\n\n' +
        'الكمية: ' + data.quantity + '\n' +
        'الثمن الإجمالي: ' + data.total + ' ' + CFG.currencyShort + '\n\n' +
        'بغيت تأكيد الطلب.';
      return 'https://wa.me/' + CFG.whatsappNumber + '?text=' + encodeURIComponent(text);
    }

    /* ── Submit ──────────────────────────────────────────────────────────
       The form is a real <form> with a real submit button, so Enter works and
       the browser's own autofill fires. Navigation is assigned to the current
       tab rather than opened with window.open: a popup blocker eats window.open
       when the call is even one tick away from the gesture, and on iOS the
       blocked popup is silent — the customer taps, nothing happens, and the
       order is gone. Same tab always reaches WhatsApp, and the page is still in
       history behind it. */
    on(form, 'submit', function (e) {
      e.preventDefault();
      if (formError) formError.hidden = true;

      var bad = null;
      inputs.forEach(function (input) { if (!validate(input) && !bad) bad = input; });
      if (bad) {
        bad.focus();
        bad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!CFG.whatsappNumber) {
        showFormError('رقم واتساب غير مضبوط في الإعدادات. المرجو الاتصال بنا مباشرة.');
        return;
      }

      /* The chosen row is read back from the DOM rather than trusted from the
         `change` handler alone: browser autofill and a restored bfcache page
         can both leave a radio checked that never fired an event. */
      var chosen = $('input[name="offer"]:checked');
      if (chosen) {
        picked = OFFERS.filter(function (o) { return String(o.qty) === chosen.value; })[0] || picked;
      }

      var data = {
        name: $('#fullname').value.trim(),
        phone: normalizePhone($('#phone').value),
        city: $('#city').value.trim(),
        quantity: picked ? (picked.label || String(picked.qty)) : '',
        total: picked ? picked.price : '',
      };

      /* A Lead is exactly what this is: a contact handed over, not a sale. It is
         fired before navigating, and it is allowed to fail silently — tracking
         never stands between a customer and WhatsApp. */
      track('Lead', {
        content_name: CONTENT.content_name,
        content_type: CONTENT.content_type,
        content_ids: CONTENT.content_ids,
        value: picked ? picked.price : undefined,
        currency: CFG.currencyCode,
      });

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري فتح واتساب…';
      }

      window.location.href = whatsappUrl(data);

      /* If WhatsApp is not installed and the handover does nothing visible, the
         button must not stay dead — someone who came back to the tab needs to
         be able to try again. */
      setTimeout(function () {
        if (!submitBtn) return;
        submitBtn.disabled = false;
        submitBtn.innerHTML = LABEL;
      }, 2500);
    });
  })();

  /* ══ 08 · Sticky mobile CTA ════════════════════════════════════════════
     Up only once BOTH the hero button and the order card are off screen, so the
     opening screen is never two identical CTAs and the bar never covers the
     form it points at. `body` carries matching bottom padding while it is up,
     so it cannot hide the last line of the page either. */
  (function sticky() {
    var bar = $('#sticky');
    var card = $('.order__card');
    var heroCta = $('.hero__buy .btn');
    if (!bar || !card || !('IntersectionObserver' in window)) return;

    var phone = window.matchMedia('(max-width: 719px)');
    var visible = new Map();

    function apply() {
      var anyOn = false;
      visible.forEach(function (v) { if (v) anyOn = true; });
      var show = phone.matches && !anyOn;
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
    /* Unconditionally, not only while the bar is already up. Gating on
       `!bar.hidden` means a resize can hide the bar but never reveal it, so a
       phone rotated from landscape (≥720, bar suppressed) back to portrait
       depends entirely on the media-query change event arriving — and when it
       does not, the CTA is gone for the rest of the visit. `apply` reads a
       Map and one offsetHeight; running it on resize costs nothing. */
    on(window, 'resize', apply);
  })();
})();
