/* ==========================================================================
   BelleVia Anti-Joint Pain — behaviour
   Vanilla, no build. Each block below is a self-contained component: it looks
   for its own hooks in the DOM and does nothing at all if they are absent.
   ========================================================================== */
(function () {
  'use strict';

  /* ══ 00 · Config ═══════════════════════════════════════════════════════
     config.js is the only file the client edits. Everything it leaves empty
     is treated as "not known yet" — the page hides that bit, or shows a
     visible placeholder. Nothing is ever invented to fill a gap. */
  var RAW = window.BELLEVIA_CONFIG || {};
  var CFG = {
    orderApiEndpoint: String(RAW.orderApiEndpoint || '').trim(),
    productSlug: String(RAW.productSlug || 'bellevia-anti-joint-pain').trim(),
    source: String(RAW.source || 'bellevia-anti-joint-pain').trim(),
    price: String(RAW.price || '').trim(),
    oldPrice: String(RAW.oldPrice || '').trim(),
    offer: String(RAW.offer || '').trim(),
    currency: String(RAW.currency || 'درهم').trim(),
    currencyCode: String(RAW.currencyCode || 'MAD').trim().toUpperCase(),
    delivery: String(RAW.delivery || '').trim(),
    cashOnDelivery: RAW.cashOnDelivery !== false,
    whatsapp: String(RAW.whatsapp || '').replace(/[^\d]/g, ''),
    phone: String(RAW.phone || '').trim(),
    social: RAW.social || {},
    testimonials: Array.isArray(RAW.testimonials) ? RAW.testimonials : [],
    packs: Array.isArray(RAW.packs) ? RAW.packs : [],
  };

  /* ── Packs ────────────────────────────────────────────────────────────
     Normalised once, here, so every consumer reads the same numbers.
     `price` is the total for the whole pack. A pack without one falls back to
     qty × the first pack's unit price, which is how "1 علبة" gets its price
     from `price` without repeating it in two places. The saving is always
     derived — never typed — so it cannot drift out of step with the prices. */
  var PACKS = (function () {
    var unit = parseFloat(String(CFG.price).replace(',', '.')) || 0;
    return CFG.packs
      .map(function (p) {
        var qty = parseInt(p.qty, 10);
        if (!qty || qty < 1) return null;
        var total = p.price != null && String(p.price).trim() !== ''
          ? parseFloat(String(p.price).replace(',', '.'))
          : unit * qty;
        if (!(total > 0)) return null;
        return {
          qty: qty,
          total: total,
          label: String(p.label || (qty + ' علبة')),
          badge: String(p.badge || ''),
          saving: Math.max(0, unit * qty - total),
        };
      })
      .filter(Boolean)
      .sort(function (a, b) { return a.qty - b.qty; });
  })();

  /* ══ 01 · Utils ════════════════════════════════════════════════════════ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
  function svgIcon(id, cls) {
    return '<svg class="' + cls + '" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  // Marks the document as scripted. Placed first, and deliberately: the reveal
  // animation's hidden state is scoped to .js, so without this line nothing is
  // ever hidden and a failed script can't blank the page.
  document.documentElement.classList.add('js');

  /* ══ 02 · Header state ═════════════════════════════════════════════════ */
  (function header() {
    var head = $('#head');
    if (!head) return;
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (entries) {
      head.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }).observe(sentinel);
  })();

  /* ══ 03 · Reveal on scroll ═════════════════════════════════════════════ */
  (function reveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var seen = 0;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        seen++;
        e.target.classList.add('is-in');
        io.unobserve(e.target); // one-way: nothing re-hides on the way back up
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

    items.forEach(function (el) { io.observe(el); });

    // Failsafe. The effect starts every one of these elements at opacity 0, so
    // an observer that never reports would leave most of the page blank — and
    // that does happen: a tab that loads while backgrounded or prerendered
    // composites nothing, so nothing ever intersects. If not a single element
    // has come in after three seconds, drop the effect and show everything.
    // Revealing off-screen elements early is invisible; a blank page is not.
    setTimeout(function () {
      if (seen) return;
      io.disconnect();
      items.forEach(function (el) { el.classList.add('is-in'); });
    }, 3000);
  })();

  /* ══ 04 · Offer — price, old price, deal, delivery ═════════════════════
     An unfilled price stays on screen reading "[PRICE]" in a hatched chip
     rather than quietly disappearing: a missing price is a launch blocker and
     should look like one. The compact copies in the hero, the closing panel
     and the sticky bar are the exception — those only appear once a real
     price exists, so an unconfigured page still reads as a finished design. */
  (function offer() {
    function fill(attr, value) {
      $$('[' + attr + ']').forEach(function (el) {
        if (value) {
          el.textContent = value;
          el.classList.remove('is-placeholder');
          el.hidden = false;
        } else {
          el.classList.add('is-placeholder');
        }
      });
    }

    // A bare number gets the currency appended; anything already carrying a
    // unit ("199 DH", "199 درهم") is printed exactly as it was typed.
    function withCurrency(v) {
      if (!v) return '';
      return /^[\d\s.,]+$/.test(v) ? v.trim() + ' ' + CFG.currency : v;
    }
    var price = withCurrency(CFG.price);
    var oldPrice = withCurrency(CFG.oldPrice);

    fill('data-price', price);
    fill('data-price-old', oldPrice);
    fill('data-offer', CFG.offer);
    fill('data-delivery-text', CFG.delivery);

    // Old price and deal badge are genuinely optional — no old price simply
    // means there is no crossed-out figure, not that one is missing.
    if (!CFG.oldPrice) $$('[data-price-old]').forEach(function (el) { el.remove(); });
    if (!CFG.offer) $$('[data-offer]').forEach(function (el) { el.remove(); });
    if (!CFG.delivery) $$('[data-delivery]').forEach(function (el) { el.remove(); });
    if (!CFG.cashOnDelivery) {
      $$('[data-cod]').forEach(function (el) { el.remove(); });
      $$('[data-cod-answer]').forEach(function (el) {
        var card = el.closest('.qa');
        if (card) card.remove();
      });
      var codFact = $('[data-cod-short]');
      if (codFact && codFact.parentElement) codFact.parentElement.remove();
    }

    // "ابتداءً من" only makes sense when there is a ladder to start from.
    if (PACKS.length < 2) $$('[data-from-label]').forEach(function (el) { el.remove(); });

    // The hero offer block ships visible so the price is in the first paint and
    // the button does not move once script.js runs. It is hidden only when no
    // price is configured — a setup state, never a live one.
    if (!price) $$('[data-offer-mini]').forEach(function (el) { el.hidden = true; });

    // Schema.org offer, added only when there is a real price to quote — and
    // only when it can be expressed the way search engines require: a bare
    // number plus an ISO 4217 code. `currency` is the word shown to shoppers
    // ("درهم"), which is not a valid priceCurrency; that comes from
    // `currencyCode`. A malformed offer is worse than no offer, so anything
    // that fails these checks is simply left out.
    var numeric = CFG.price.replace(/[^\d.,]/g, '').replace(',', '.');
    var validCode = /^[A-Z]{3}$/.test(CFG.currencyCode);
    if (numeric && validCode) {
      var node = $('#ld-product');
      if (node) {
        try {
          var data = JSON.parse(node.textContent);
          if (PACKS.length > 1) {
            // Several packs at different totals is an AggregateOffer, not one
            // Offer — quoting a single price would misstate the range.
            var totals = PACKS.map(function (p) { return p.total; });
            data.offers = {
              '@type': 'AggregateOffer',
              lowPrice: String(Math.min.apply(null, totals)),
              highPrice: String(Math.max.apply(null, totals)),
              offerCount: PACKS.length,
              priceCurrency: CFG.currencyCode,
              availability: 'https://schema.org/InStock',
            };
          } else {
            data.offers = {
              '@type': 'Offer',
              price: numeric,
              priceCurrency: CFG.currencyCode,
              availability: 'https://schema.org/InStock',
            };
          }
          node.textContent = JSON.stringify(data, null, 2);
        } catch (err) { /* leave the static block alone if it won't parse */ }
      }
    }
  })();

  /* ══ 04b · Pack selector ═══════════════════════════════════════════════
     The selector is the primary way to choose an offer; the quantity stepper
     stays (the payload needs it, and some people reach for it first) but the
     two are bound together and the stepper is clamped to the packs on offer,
     so there is never a quantity on screen that has no price behind it. */
  var selectedPack = PACKS[0] || null;
  var packListeners = [];
  function onPackChange(fn) { packListeners.push(fn); }
  function money(n) {
    // Whole dirhams read better than 199.00; keep decimals only if they exist.
    var s = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
    return s + ' ' + CFG.currency;
  }

  (function packs() {
    var wrap = $('#packs');
    var list = $('#packsList');
    var qtyInput = $('#quantity');
    if (!wrap || !list || !PACKS.length) return;

    list.innerHTML = PACKS.map(function (p, i) {
      return '<label class="pack' + (p.badge ? ' pack--flag' : '') + '">' +
        '<input type="radio" name="pack" value="' + p.qty + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span class="pack__box">' +
          (p.badge ? '<span class="pack__badge">' + escapeHtml(p.badge) + '</span>' : '') +
          '<span class="pack__label">' + escapeHtml(p.label) + '</span>' +
          '<span class="pack__price">' + money(p.total) + '</span>' +
          (p.saving > 0
            ? '<span class="pack__save">وفري ' + money(p.saving) + '</span>'
            : '<span class="pack__save pack__save--none"></span>') +
        '</span>' +
      '</label>';
    }).join('');

    wrap.hidden = false;

    // The stepper can only reach quantities the packs actually price.
    if (qtyInput) {
      qtyInput.min = String(PACKS[0].qty);
      qtyInput.max = String(PACKS[PACKS.length - 1].qty);
    }

    function packFor(qty) {
      for (var i = 0; i < PACKS.length; i++) if (PACKS[i].qty === qty) return PACKS[i];
      return null;
    }

    function select(pack, syncRadio) {
      if (!pack) return;
      selectedPack = pack;
      if (qtyInput && parseInt(qtyInput.value, 10) !== pack.qty) qtyInput.value = String(pack.qty);
      if (syncRadio) {
        var radio = $('input[name="pack"][value="' + pack.qty + '"]', list);
        if (radio) radio.checked = true;
      }
      packListeners.forEach(function (fn) { fn(pack); });
    }

    on(list, 'change', function (e) {
      if (e.target && e.target.name === 'pack') select(packFor(parseInt(e.target.value, 10)), false);
    });

    // Stepper → selector. Anything the packs do not cover snaps to the
    // nearest one that they do, so the two can never disagree.
    if (qtyInput) {
      on(qtyInput, 'input', function () {
        var q = parseInt(qtyInput.value, 10);
        var match = packFor(q);
        if (match) { select(match, true); return; }
        if (!q) return;
        var nearest = PACKS.reduce(function (best, p) {
          return Math.abs(p.qty - q) < Math.abs(best.qty - q) ? p : best;
        }, PACKS[0]);
        select(nearest, true);
      });
    }

    select(PACKS[0], true);
  })();

  /* ── Live total ────────────────────────────────────────────────────────
     Shown above the submit button and repeated inside it, because the button
     is the last thing read before the order is placed and "أكّد الطلب" alone
     leaves the shopper to do the multiplication.

     Two sources, one display. With a pack ladder the total is the selected
     pack's price. Without one it is unit price × quantity — which is exactly
     what `functions/api/orders.ts` charges for a product with no PACK_PRICING
     row, so the figure on the button is the figure on the delivery slip. If
     a ladder is ever added to `shared/catalog.js`, the first branch takes over
     and the two stay in step. */
  (function orderTotal() {
    var box = $('#orderTotal');
    var val = $('#orderTotalVal');
    var btnTotal = $('#submitTotal');
    var qtyInput = $('#quantity');
    var unit = parseFloat(String(CFG.price).replace(',', '.')) || 0;

    function paint(total) {
      var text = money(total);
      if (val) val.textContent = text;
      if (box) box.hidden = false;
      if (btnTotal) {
        btnTotal.textContent = text;
        btnTotal.classList.remove('is-placeholder');
      }
    }

    if (PACKS.length) {
      onPackChange(function (p) { paint(p.total); });
      if (selectedPack) paint(selectedPack.total);
      return;
    }

    // No price configured means there is no honest total to show; the button
    // keeps its plain label rather than quoting a number nobody set.
    if (!unit) return;

    function fromQty() {
      var q = parseInt(qtyInput && qtyInput.value, 10) || 1;
      paint(unit * Math.max(1, q));
    }
    if (qtyInput) on(qtyInput, 'input', fromQty);
    fromQty();
  })();

  /* One compact line of the ladder in the hero, so the offer is legible before
     the first scroll. Informational only — the selector below is the control. */
  (function heroLadder() {
    var el = $('#heroLadder');
    if (!el || PACKS.length < 2) return;
    // Only the rungs above the entry price. The line right above already reads
    // "ابتداءً من 199 درهم", so repeating 1×199 here spends a line to say
    // nothing — what earns the space is that 2 and 3 cost less per box.
    el.innerHTML = PACKS.slice(1).map(function (p) {
      return '<span class="hero__ladder-i">' +
        escapeHtml(p.label) + ' <b>' + money(p.total) + '</b>' +
      '</span>';
    }).join('<span class="hero__ladder-sep" aria-hidden="true">·</span>');
    el.hidden = false;
  })();

  /* The whole ladder in the closing panel, with the chosen pack marked so the
     closing screen agrees with the selector rather than restating a menu she
     has already decided on. */
  (function finalLadder() {
    var el = $('#finalPacks');
    if (!el || !PACKS.length) return;
    el.innerHTML = PACKS.map(function (p) {
      // data-pack-qty, not data-qty: the stepper binds a click handler to
      // every [data-qty] on the page, so reusing that name here would make
      // tapping a closing-panel row silently change the order quantity.
      return '<li class="ladder__i" data-pack-qty="' + p.qty + '">' +
        '<span class="ladder__q">' + escapeHtml(p.label) + '</span>' +
        '<span class="ladder__p">' + money(p.total) + '</span>' +
        (p.saving > 0 ? '<span class="ladder__s">وفري ' + money(p.saving) + '</span>' : '') +
      '</li>';
    }).join('');
    el.hidden = false;

    var items = $$('.ladder__i', el);
    function mark(pack) {
      items.forEach(function (li) {
        var on = Number(li.getAttribute('data-pack-qty')) === pack.qty;
        li.classList.toggle('is-on', on);
        // Announced, not just coloured — the mark carries meaning.
        if (on) li.setAttribute('aria-current', 'true');
        else li.removeAttribute('aria-current');
      });
    }
    onPackChange(mark);
    if (selectedPack) mark(selectedPack);
  })();

  /* ══ 05 · Sticky CTA ═══════════════════════════════════════════════════ */
  (function sticky() {
    var bar = $('#stickyCta');
    var hero = $('.hero');
    var order = $('#commander');
    if (!bar || !hero || !order) return;

    // Track the selected pack, so the bar always quotes what is actually
    // about to be ordered rather than a fixed entry price.
    if (PACKS.length) {
      var stickPrice = $('[data-price]', bar);
      var stickOld = $('[data-price-old]', bar);
      if (stickOld) stickOld.remove();
      if (stickPrice) {
        // Name the pack as well as the price. "449 درهم" on its own reads as a
        // different, higher price than the 199 she saw in the hero; "3 علب —
        // 449 درهم" reads as the choice she just made.
        var label = document.createElement('span');
        label.className = 'sticky__pack';
        stickPrice.parentNode.insertBefore(label, stickPrice);
        stickPrice.classList.remove('is-placeholder');
        var paint = function (p) {
          label.textContent = p.label;
          stickPrice.textContent = money(p.total);
        };
        onPackChange(paint);
        if (selectedPack) paint(selectedPack);
      }
    }

    // Nothing to quote? Drop the price column and let the button take the bar.
    if (!$('[data-price]:not(.is-placeholder)', bar)) {
      var col = $('.sticky__price', bar);
      if (col) col.remove();
      var btn = $('.btn', bar);
      if (btn) btn.style.maxWidth = 'none';
    }
    bar.hidden = false;

    var pastHero = false;
    var atOrder = false;
    function sync() { bar.classList.toggle('is-up', pastHero && !atOrder); }

    new IntersectionObserver(function (e) {
      pastHero = !e[0].isIntersecting; sync();
    }, { threshold: 0 }).observe(hero);

    // The bar retracts over the form: a fixed button pointing at the thing
    // already on screen is just an obstacle between the user and the fields.
    new IntersectionObserver(function (e) {
      atOrder = e[0].isIntersecting; sync();
    }, { threshold: 0 }).observe(order);
  })();

  /* ══ 06 · Composition table ════════════════════════════════════════════
     Fourteen rows is a wall on a phone. The first five are shown and the rest
     unfold on request — on desktop the whole table is visible from the start. */
  (function composition() {
    var table = $('#compoTable');
    var more = $('#compoMore');
    if (!table || !more) return;

    var small = window.matchMedia('(max-width: 719px)');

    function apply() {
      if (small.matches) {
        more.hidden = false;
        if (more.getAttribute('aria-expanded') !== 'true') table.classList.add('is-clipped');
      } else {
        more.hidden = true;
        table.classList.remove('is-clipped');
      }
    }

    on(more, 'click', function () {
      var open = table.classList.toggle('is-clipped') === false;
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'قلّص اللائحة' : 'شوف اللائحة كاملة';
    });

    (small.addEventListener ? small.addEventListener.bind(small, 'change')
      : small.addListener.bind(small))(apply);
    apply();
  })();

  /* ══ 07 · Lightbox ═════════════════════════════════════════════════════ */
  (function lightbox() {
    var box = $('#lightbox');
    var img = $('#lbImg');
    var close = $('#lbClose');
    if (!box || !img) return;

    var opener = null;

    function open(src, alt) {
      img.src = src;
      img.alt = alt || '';
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      if (close) close.focus();
    }

    function shut() {
      box.hidden = true;
      img.removeAttribute('src'); // not src='' — that would resolve to the page URL
      document.body.style.overflow = '';
      if (opener) { opener.focus(); opener = null; }
    }

    $$('.shot__zoom').forEach(function (btn) {
      on(btn, 'click', function () {
        opener = btn;
        open(btn.getAttribute('data-zoom'), btn.getAttribute('data-zoom-alt'));
      });
    });

    on(close, 'click', shut);
    on(box, 'click', function (e) { if (e.target !== img) shut(); });
    on(document, 'keydown', function (e) { if (e.key === 'Escape' && !box.hidden) shut(); });
  })();

  /* ══ 08 · Testimonials ═════════════════════════════════════════════════
     Driven entirely by config.testimonials, and the section stays hidden while
     that array is empty — which is how it ships. The page will not invent a
     customer, and a review written by whoever built the page is an invention
     however it is worded. Each entry also carries a visible label saying what
     it is, so a sample can never be mistaken for a verified review. */
  (function testimonials() {
    var section = $('#avis');
    var list = $('#avisList');
    var sub = $('#avisSub');
    if (!section || !list) return;

    var items = CFG.testimonials.filter(function (t) { return t && t.text; });
    if (!items.length) return; // stays hidden

    var anySample = false;

    list.innerHTML = items.map(function (t) {
      var sample = t.verified !== true;
      if (sample) anySample = true;
      return '<li class="avi">' +
        svgIcon('i-quote', 'avi__q') +
        '<p>' + escapeHtml(t.text) + '</p>' +
        (t.name ? '<p class="avi__who">' + escapeHtml(t.name) + '</p>' : '') +
        '<span class="avi__tag">' + (sample ? 'نموذج توضيحي — ماشي رأي زبون موثّق' : escapeHtml(t.tag || 'رأي زبون')) + '</span>' +
        '</li>';
    }).join('');

    if (sub) {
      sub.textContent = anySample
        ? 'الآراء المعلّمة بـ «نموذج توضيحي» هي أمثلة على الشكل، وماشي آراء زبناء موثّقة.'
        : '';
    }

    section.hidden = false;
  })();

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ══ 09 · Quantity stepper ═════════════════════════════════════════════ */
  (function quantity() {
    var input = $('#quantity');
    if (!input) return;
    $$('[data-qty]').forEach(function (btn) {
      on(btn, 'click', function () {
        var step = parseInt(btn.getAttribute('data-qty'), 10) || 0;
        var min = parseInt(input.min, 10) || 1;
        var max = parseInt(input.max, 10) || 99;
        var next = Math.min(max, Math.max(min, (parseInt(input.value, 10) || min) + step));
        input.value = String(next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  })();

  /* ══ 10 · Order form ═══════════════════════════════════════════════════ */
  (function orderForm() {
    var form = $('#orderForm');
    if (!form) return;

    var submitBtn = $('#submitBtn');
    var formError = $('#formError');
    var done = $('#orderDone');
    var doneRef = $('#doneRef');
    var doneAgain = $('#doneAgain');
    var notice = $('#demoNotice');
    var submitLabel = $('#submitLabel');
    var submitBusy = $('#submitBusy');

    /* ── Validation ──────────────────────────────────────────────────── */

    /** Strips spaces and separators, and folds +212 / 00212 / 212 down to 0. */
    function normalizePhone(raw) {
      var d = String(raw).replace(/[\s\-().]/g, '');
      if (d.indexOf('+212') === 0) d = '0' + d.slice(4);
      else if (d.indexOf('00212') === 0) d = '0' + d.slice(5);
      else if (d.indexOf('212') === 0 && d.length === 12) d = '0' + d.slice(3);
      return d;
    }

    var RULES = {
      fullname: function (v) {
        if (!v) return 'عمّر الاسم ديالك.';
        if (v.length < 3) return 'الاسم قصير بزاف.';
        if (!/[؀-ۿa-zA-Z]/.test(v)) return 'كتب الاسم بالحروف.';
        return '';
      },
      phone: function (v) {
        if (!v) return 'عمّر رقم الهاتف.';
        var d = normalizePhone(v);
        if (!/^0[5-7]\d{8}$/.test(d)) return 'الرقم ماشي صحيح. خاصو يبدا بـ 06 ولا 07 ولا 05 ويكون فيه 10 أرقام.';
        return '';
      },
      city: function (v) {
        if (!v) return 'عمّر المدينة.';
        if (v.length < 2) return 'كتب اسم المدينة كامل.';
        return '';
      },
      address: function (v) {
        if (!v) return 'عمّر العنوان.';
        if (v.length < 6) return 'زيد شوية ديال التفاصيل باش يوصل الطلب.';
        return '';
      },
      quantity: function (v) {
        var n = parseInt(v, 10);
        if (!n || n < 1) return 'الكمية خاصها تكون 1 على الأقل.';
        if (n > 10) return 'أقصى كمية هي 10. إلا بغيتي كثر، عيّط لينا.';
        return '';
      },
    };

    function fieldOf(input) { return input.closest('.field'); }

    function setError(input, msg) {
      var wrap = fieldOf(input);
      var out = $('#err-' + input.id);
      if (wrap) wrap.classList.toggle('is-bad', !!msg);
      if (out) out.textContent = msg;
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }

    function validate(input) {
      var rule = RULES[input.name];
      if (!rule) return true;
      var msg = rule(input.value.trim());
      setError(input, msg);
      return !msg;
    }

    var inputs = $$('input, textarea', form).filter(function (i) { return RULES[i.name]; });

    inputs.forEach(function (input) {
      // Errors appear on blur, then correct themselves live — so nobody is
      // told they are wrong while they are still typing the answer.
      on(input, 'blur', function () { validate(input); });
      on(input, 'input', function () {
        var wrap = fieldOf(input);
        if (wrap && wrap.classList.contains('is-bad')) validate(input);
      });
    });

    /* ── States ──────────────────────────────────────────────────────── */
    /* Swaps two spans instead of rewriting the button. Rewriting it destroyed
       #submitTotal, and the live total then stopped tracking the quantity for
       the rest of the session — a shopper who retried after a dropped
       connection could be quoted one figure and charged another. */
    function setBusy(state) {
      if (!submitBtn) return;
      submitBtn.disabled = state;
      if (submitLabel && submitBusy) {
        submitLabel.hidden = state;
        submitBusy.hidden = !state;
      } else {
        submitBtn.textContent = state ? 'كنصيفطو الطلب…' : 'أكّد الطلب';
      }
    }

    function showFormError(msg) {
      if (!formError) return;
      formError.textContent = msg;
      formError.hidden = false;
      formError.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    /** Server-side failures, said in the user's language. */
    var SERVER_MESSAGES = {
      product_unavailable: 'المنتج ماشي متوفر دابا. عيّط لينا وغادي نعاونوك.',
      invalid_payload: 'كاين شي معلومة ناقصة ولا ماشي صحيحة. عاود عمّر الفورم عافاك.',
      rate_limited: 'بزاف ديال المحاولات فوقت قصير. تسنى شوية وعاود.',
      insufficient_stock: 'ما بقاوش بزاف ديال العلب. نقّص الكمية ولا عيّط لينا.',
    };

    function payload() {
      var body = {
        productSlug: CFG.productSlug,
        customerName: $('#fullname').value.trim(),
        phone: normalizePhone($('#phone').value),
        city: $('#city').value.trim(),
        address: $('#address').value.trim(),
        quantity: parseInt($('#quantity').value, 10) || 1,
        source: CFG.source,
      };

      // Which pack was on screen, for whoever packs the box. The price is not
      // sent and would be ignored if it were: the server prices the order from
      // its own pack table, so a tampered client cannot set what it pays. The
      // note names the offer only — the total on the order row is the server's.
      if (selectedPack && selectedPack.saving > 0) {
        body.note = 'عرض: ' + selectedPack.label;
      }
      return body;
    }

    function succeed(result) {
      form.hidden = true;
      if (notice) notice.hidden = true;
      if (done) {
        if (doneRef) {
          doneRef.textContent = result && result.orderNumber
            ? 'رقم الطلب: ' + result.orderNumber
            : '';
          doneRef.hidden = !doneRef.textContent;
        }
        done.hidden = false;
        done.focus();
        done.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      // Optional tracking hook (Meta Pixel, GA…). Left to the page owner.
      if (typeof window.belleviaOnOrder === 'function') {
        try { window.belleviaOnOrder(result || {}); } catch (err) { /* never block on tracking */ }
      }
    }

    on(doneAgain, 'click', function () {
      form.reset();
      inputs.forEach(function (i) { setError(i, ''); });
      if (formError) formError.hidden = true;
      if (done) done.hidden = true;
      if (notice) notice.hidden = !!CFG.orderApiEndpoint;
      form.hidden = false;
      $('#fullname').focus();
    });

    /* ── Demo mode ───────────────────────────────────────────────────────
       With no endpoint configured there is nowhere for an order to go. The
       form stays usable so the page can be demoed, but it says so up front
       and refuses to claim an order was placed. A false success here would
       cost a real customer a real order. */
    var DEMO = !CFG.orderApiEndpoint;
    if (DEMO && notice) {
      notice.textContent = 'وضع التجربة: رابط الطلبات ما تعمّرش فالإعدادات، فالطلبات ما كيتسجلوش.';
      notice.hidden = false;
    }

    /* ── Submit ──────────────────────────────────────────────────────── */
    on(form, 'submit', function (e) {
      e.preventDefault();
      if (formError) formError.hidden = true;

      var bad = null;
      inputs.forEach(function (input) {
        var ok = validate(input);
        if (!ok && !bad) bad = input;
      });
      if (bad) {
        bad.focus();
        bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }

      if (DEMO) {
        showFormError('وضع التجربة: الطلب ما تسجّلش. خاص يتعمّر رابط الطلبات فالإعدادات.');
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
            .then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
        })
        .then(function (r) {
          // Success is whatever the server says it is. The page never reports
          // an order as placed on its own initiative.
          if (r.ok && r.body && r.body.ok) { succeed(r.body); return; }
          var code = r.body && (r.body.error || r.body.code);
          showFormError(SERVER_MESSAGES[code] || 'ما قدرناش نسجلو الطلب دابا. عاود جرب، ولا عيّط لينا.');
        })
        .catch(function (err) {
          showFormError(err && err.name === 'AbortError'
            ? 'الاتصال طوّل بزاف. شوف الأنترنت ديالك وعاود جرب.'
            : 'ما وصلناش للسيرفر. شوف الأنترنت ديالك وعاود جرب.');
        })
        .then(function () { clearTimeout(timer); setBusy(false); });
    });
  })();

  /* ══ 11 · Contact ══════════════════════════════════════════════════════
     Every channel here is opt-in. An empty value in config.js means the link
     simply does not exist, rather than pointing somewhere invented. */
  (function contact() {
    var wrap = $('#footContact');
    var list = $('#contactList');
    if (!wrap || !list) return;

    function add(href, text, external) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      li.appendChild(a);
      list.appendChild(li);
    }

    if (CFG.whatsapp) add('https://wa.me/' + CFG.whatsapp, 'WhatsApp', true);
    if (CFG.phone) add('tel:' + CFG.phone.replace(/\s/g, ''), CFG.phone, false);
    ['instagram', 'facebook', 'tiktok'].forEach(function (k) {
      var url = String(CFG.social[k] || '').trim();
      if (url) add(url, k.charAt(0).toUpperCase() + k.slice(1), true);
    });

    wrap.hidden = list.children.length === 0;
  })();

  /* ══ 12 · Year ═════════════════════════════════════════════════════════ */
  (function year() {
    var el = $('#year');
    if (el) el.textContent = String(new Date().getFullYear());
  })();

})();
