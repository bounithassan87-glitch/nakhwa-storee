// ===== Nakhwa Store — Landing Page Interactions =====

const WA_NUMBER = '212624273714';
const PRICE_1 = 299;
const PRICE_2 = 549;

/**
 * Meta tracking lives in nk-track.js, shared by every storefront.
 *
 * These wrappers exist only so this file never has to care whether that script
 * loaded. It is blocked outright by some content blockers, and a bare call to a
 * missing global would throw a ReferenceError inside the checkout handler,
 * abort the submit, and cost a real order. Analytics observes the sale; it
 * never participates in it.
 */
function trackPixelOnce(event, params) {
  try {
    if (!window.nkTrack) return undefined;
    return window.nkTrack.trackOnce(event, params);
  } catch (_) {
    return undefined;
  }
}

/** Browser pixel only, with a caller-supplied id. Used where the server fires
 *  its own copy of the event and the two must carry the same id. */
function trackPixelOnly(event, params, eventId) {
  try {
    if (window.nkTrack) window.nkTrack.pixel(event, params, eventId);
  } catch (_) {
    /* never let a tracking failure surface to the customer */
  }
}

/** Attribution to hand to the server, so its Lead matches the browser's. */
function trackUserData() {
  try {
    return window.nkTrack ? window.nkTrack.userData() : {};
  } catch (_) {
    return {};
  }
}

function newEventId() {
  try {
    if (window.nkTrack) return window.nkTrack.id();
  } catch (_) { /* fall through */ }
  return 'nk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- ViewContent ----------
     A single-product landing page: arriving on it is looking at the product,
     so this fires on load rather than on scroll. A scroll trigger would miss
     every visitor who bounces, and those are exactly the impressions Meta
     needs to learn from.

     trackOnce sends the pixel copy and the Conversions API copy under one
     event_id and refuses a second send for the same name, so this is once per
     page view by construction — no extra guard, no new plumbing. */
  trackPixelOnce('ViewContent', {
    content_name: 'Cache Terazo',
    content_type: 'product',
    content_ids: ['cache-terazo'],
    value: PRICE_1,
    currency: 'MAD',
  });


  /* ---------- Hero Color Showcase ---------- */
  (function heroShowcase(){
    const frame = document.querySelector('.showcase-frame');
    const mainImg = document.getElementById('hero-main-img');
    const thumbs = Array.from(document.querySelectorAll('#hero-color-thumbs .thumb'));

    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected','false'); });
        thumb.classList.add('is-active');
        thumb.setAttribute('aria-selected','true');

        const newSrc = thumb.getAttribute('data-img');
        const color = thumb.getAttribute('data-color');
        if (mainImg.getAttribute('src') !== newSrc) {
          frame.classList.add('swap');
          const pre = new Image();
          pre.onload = () => {
            mainImg.src = newSrc;
            mainImg.alt = 'بوركيني Cache Terazo - اللون ' + color;
            requestAnimationFrame(() => frame.classList.remove('swap'));
          };
          pre.src = newSrc;
        }

        // sync first-piece color in the order form
        const formColor = document.querySelector(`input[name="color1"][value="${color}"]`);
        if (formColor) { formColor.checked = true; formColor.dispatchEvent(new Event('change', { bubbles:true })); }
      });
    });
  })();

  /* ---------- Sticky CTA ---------- */
  (function stickyCta(){
    const sticky = document.getElementById('sticky-cta');
    const hero = document.querySelector('.hero');
    const orderSection = document.getElementById('order');

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.target === hero) {
          sticky.classList.toggle('show', !entry.isIntersecting);
        }
        if (entry.target === orderSection && entry.isIntersecting) {
          sticky.classList.remove('show');
        }
      });
    }, { threshold: 0.05 });
    io.observe(hero);
    io.observe(orderSection);
  })();

  /* ---------- Video (autoplay with sound, graceful fallback) ---------- */
  (function video(){
    const card = document.getElementById('video-card');
    const vid = document.getElementById('product-video');
    const btn = document.getElementById('play-btn');
    const soundBtn = document.getElementById('sound-btn');
    let soundOn = false;   // has audio been unlocked by the user?

    vid.addEventListener('loadeddata', () => card.classList.add('loaded'));
    vid.addEventListener('canplay', () => card.classList.add('loaded'));
    vid.addEventListener('playing', () => {
      card.classList.add('playing', 'loaded');
      // The element autoplays muted, and CSS hides the big play button once
      // `.playing` is set — without this the sound toggle would stay hidden and
      // there would be no way left to turn audio on.
      soundBtn.hidden = false;
      updateSoundBtn();
    });
    vid.addEventListener('pause', () => card.classList.remove('playing'));

    function updateSoundBtn(){
      if (vid.muted) { soundBtn.innerHTML = '🔇 صوت'; }
      else { soundBtn.innerHTML = '🔊 صوت'; }
    }

    // Turn sound ON and play (called from a user gesture -> always allowed)
    function playWithSound(){
      vid.muted = false;
      soundOn = true;
      card.classList.remove('needs-tap');
      soundBtn.hidden = false;
      vid.removeAttribute('controls');
      updateSoundBtn();
      vid.play().catch(() => {});
    }

    // Resume muted playback when the card scrolls back into view.
    //
    // The element carries `autoplay muted`, so the first play needs no help.
    // This used to attempt unmuted playback first and fall back on rejection,
    // which no browser permits without a gesture — every load paid for a failed
    // play() and a visible stall before landing on muted anyway. Sound is now
    // unlocked only by the play or sound button, both of which are real taps.
    function tryAutoplay(){
      vid.play().catch(() => {});
    }

    // Big play button = one tap to start WITH music
    btn.addEventListener('click', (e) => { e.stopPropagation(); playWithSound(); });

    // Tapping the video toggles play/pause (and unlocks sound on first tap)
    vid.addEventListener('click', () => {
      if (!soundOn) { playWithSound(); return; }
      if (vid.paused) vid.play().catch(() => {});
      else vid.pause();
    });

    // Sound toggle
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      vid.muted = !vid.muted;
      if (!vid.muted) soundOn = true;
      updateSoundBtn();
      if (vid.paused) vid.play().catch(() => {});
    });

    // Play/pause based on visibility. Keep sound state chosen by the user.
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (soundOn) { vid.muted = false; vid.play().catch(() => {}); }
          else { tryAutoplay(); }
        } else {
          vid.pause();
        }
      });
    }, { threshold: 0.4 });
    io.observe(card);
  })();

  /* ---------- Product Slider (premium carousel) ---------- */
  (function productSlider(){
    const root = document.getElementById('product-slider');
    const viewport = document.getElementById('slider-viewport');
    const track = document.getElementById('slider-track');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    const thumbsWrap = document.getElementById('slider-thumbs');
    if (!root || !viewport || !track) return;

    const realSlides = Array.from(track.children);
    const N = realSlides.length;
    if (!N) return;
    const thumbs = Array.from(thumbsWrap.querySelectorAll('.s-thumb'));

    // Clone edge slides for a seamless infinite loop.
    const firstClone = realSlides[0].cloneNode(true);
    const lastClone = realSlides[N - 1].cloneNode(true);
    [firstClone, lastClone].forEach(c => { c.classList.add('clone'); c.setAttribute('aria-hidden', 'true'); });
    track.insertBefore(lastClone, realSlides[0]);
    track.appendChild(firstClone);

    let index = 1;              // real slide 0 sits at position 1 (after lastClone)
    let width = viewport.clientWidth;
    let startX = 0, dx = 0, dragging = false, animating = false;

    function apply(animate){
      track.style.transition = animate ? 'transform .42s cubic-bezier(.22,.61,.36,1)' : 'none';
      track.style.transform = 'translateX(' + (-(index * width) + dx) + 'px)';
    }
    function realIndex(){ return ((index - 1) % N + N) % N; }
    function updateThumbs(){
      const ri = realIndex();
      thumbs.forEach((t, i) => t.classList.toggle('active', i === ri));
      const a = thumbs[ri];
      // Center the active thumbnail WITHIN the strip only — must never scroll the
      // page (scrollIntoView would, jumping the customer away on an image click).
      if (a && thumbsWrap){
        const wr = thumbsWrap.getBoundingClientRect();
        const ar = a.getBoundingClientRect();
        const delta = (ar.left + ar.width / 2) - (wr.left + wr.width / 2);
        if (Math.abs(delta) > 1) thumbsWrap.scrollBy({ left: delta, behavior: 'smooth' });
      }
    }
    let animTimer = null;
    function go(to, animate){
      const willAnimate = animate !== false;
      index = to; dx = 0;
      if (willAnimate){
        animating = true;
        clearTimeout(animTimer);
        // Fallback release: transitionend won't fire if the transform is unchanged.
        animTimer = setTimeout(() => { animating = false; }, 480);
      }
      apply(willAnimate); updateThumbs();
    }
    function next(){ if (!animating) go(index + 1, true); }   // guard prevents overshooting the loop clones
    function prev(){ if (!animating) go(index - 1, true); }

    track.addEventListener('transitionend', () => {
      animating = false; clearTimeout(animTimer);
      if (index === N + 1) { index = 1; apply(false); }
      else if (index === 0) { index = N; apply(false); }
    });

    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
    thumbs.forEach((t, i) => t.addEventListener('click', () => go(i + 1, true)));

    // Pointer drag (desktop) + swipe (mobile) via Pointer Events.
    viewport.addEventListener('pointerdown', (e) => {
      dragging = true; animating = false; startX = e.clientX; dx = 0; root.dataset.moved = '0';
      track.style.transition = 'none';
      if (viewport.setPointerCapture) { try { viewport.setPointerCapture(e.pointerId); } catch (_) {} }
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      if (Math.abs(dx) > 6) root.dataset.moved = '1';
      apply(false);
    });
    function endDrag(){
      if (!dragging) return;
      dragging = false;
      const threshold = Math.max(40, width * 0.15);
      if (dx <= -threshold) { dx = 0; next(); }
      else if (dx >= threshold) { dx = 0; prev(); }
      else { dx = 0; apply(true); }
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('dragstart', (e) => e.preventDefault());

    // Keyboard support.
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    });

    // Auto-jump to a colour's first image when the colour selection changes.
    document.querySelectorAll('input[name="color1"]').forEach(inp => inp.addEventListener('change', () => {
      const t = realSlides.findIndex(s => s.dataset.color === inp.value);
      if (t >= 0) go(t + 1, true);
    }));

    window.addEventListener('resize', () => { width = viewport.clientWidth; apply(false); });
    apply(false);
    updateThumbs();
  })();

  /* ---------- Fullscreen Lightbox (from slider) ---------- */
  (function lightbox(){
    const box = document.getElementById('lightbox');
    const slider = document.getElementById('product-slider');
    const slides = Array.from(document.querySelectorAll('#slider-track .slide:not(.clone)'));
    const images = slides.map(s => s.querySelector('img'));
    if (!box || !images.length) return;

    const stage = document.getElementById('lightbox-stage');
    const img = document.getElementById('lightbox-img');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    let current = 0, scale = 1;

    function render(){
      scale = 1; img.style.transform = 'scale(1)';
      img.src = images[current].currentSrc || images[current].src;
      img.alt = images[current].alt;
    }
    function open(i){ current = i; render(); box.hidden = false; document.body.style.overflow = 'hidden'; }
    function close(){ box.hidden = true; document.body.style.overflow = ''; }
    function show(delta){ current = (current + delta + images.length) % images.length; render(); }

    images.forEach((im, i) => im.addEventListener('click', () => {
      // Ignore the click that ends a drag/swipe.
      if (slider && slider.dataset.moved === '1') { slider.dataset.moved = '0'; return; }
      open(i);
    }));
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => show(-1));
    nextBtn.addEventListener('click', () => show(1));
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    img.addEventListener('dblclick', () => { scale = scale === 1 ? 2.2 : 1; img.style.transform = `scale(${scale})`; });

    let sx = 0, sy = 0, moved = false;
    stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false; }, { passive: true });
    stage.addEventListener('touchmove', () => { moved = true; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (!moved || scale !== 1) return;
      const ddx = e.changedTouches[0].clientX - sx;
      const ddy = e.changedTouches[0].clientY - sy;
      if (Math.abs(ddx) > 50 && Math.abs(ddx) > Math.abs(ddy)) show(ddx < 0 ? 1 : -1);
    });
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(-1);
      if (e.key === 'ArrowRight') show(1);
    });
  })();

  /* ---------- Smart Order System ---------- */
  (function orderForm(){
    const form = document.getElementById('order-form');
    const success = document.getElementById('order-success');
    // WhatsApp is no longer part of checkout — this is an optional contact link
    // shown only after the order has been written to the database.
    const waContact = document.getElementById('wa-fallback');
    const submitBtn = document.getElementById('order-submit');
    const submitLabel = document.getElementById('order-submit-label');
    const errorBox = document.getElementById('order-error');
    const orderRef = document.getElementById('order-number');
    const orderRefValue = document.getElementById('order-number-value');
    const piece2 = document.getElementById('piece-2');
    const piece1Title = document.getElementById('piece-1-title');
    const sumQty = document.getElementById('sum-qty');
    const sumTotal = document.getElementById('sum-total');
    const size2Inputs = piece2.querySelectorAll('input[name="size2"]');
    const color2Inputs = piece2.querySelectorAll('input[name="color2"]');

    function qty(){ return document.querySelector('input[name="qty"]:checked').value === '2' ? 2 : 1; }

    // JS-driven active state (bulletproof across renderers)
    function syncActive(groupName, labelSelector){
      document.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
        const label = input.closest(labelSelector);
        if (label) label.classList.toggle('is-checked', input.checked);
      });
    }
    function syncAll(){
      syncActive('qty', '.qty-option');
      syncActive('size1', '.size-pill');
      syncActive('color1', '.color-photo');
      syncActive('size2', '.size-pill');
      syncActive('color2', '.color-photo');
    }
    ['qty','size1','color1','size2','color2'].forEach(n => {
      document.querySelectorAll(`input[name="${n}"]`).forEach(input => {
        input.addEventListener('change', syncAll);
      });
    });

    function refresh(){
      const two = qty() === 2;
      sumQty.textContent = two ? 2 : 1;
      sumTotal.textContent = (two ? PRICE_2 : PRICE_1) + ' درهم';

      piece2.hidden = !two;
      piece2.setAttribute('aria-hidden', String(!two));
      piece1Title.textContent = two ? 'القطعة الأولى' : 'تفاصيل البوركيني';

      // Two Pieces → enable + require the second section (its own size & color).
      // One Piece  → DISABLE it so it is fully ignored by validation, form data
      //              and order submission. Selections are preserved (not cleared)
      //              so they return if the customer switches back to Two Pieces.
      [...size2Inputs, ...color2Inputs].forEach(i => { i.disabled = !two; i.required = two; });

      syncAll();
    }

    // qty radios
    document.querySelectorAll('input[name="qty"]').forEach(r => r.addEventListener('change', refresh));
    syncAll();

    // offer cards -> set qty + scroll to form
    document.querySelectorAll('.offer-card').forEach(card => {
      card.addEventListener('click', () => {
        const q = card.getAttribute('data-qty');
        const radio = document.querySelector(`input[name="qty"][value="${q}"]`);
        if (radio) { radio.checked = true; }
        document.querySelectorAll('.offer-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        refresh();
        document.getElementById('order').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    /**
     * Message body for the optional WhatsApp contact link shown after checkout.
     * It is no longer how an order is placed — the order already exists in the
     * database by the time this runs — so it leads with the order number the
     * customer can quote.
     */
    function buildMessage(orderNumber){
      const q = qty();
      const total = q === 2 ? PRICE_2 : PRICE_1;
      const name = document.getElementById('fullname').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const city = document.getElementById('city').value.trim();
      const address = document.getElementById('address').value.trim();
      const size1 = (document.querySelector('input[name="size1"]:checked') || {}).value || '';
      const color1 = (document.querySelector('input[name="color1"]:checked') || {}).value || '';

      let msg = '🛍️ *استفسار حول طلب — بوركيني Cache Terazo*\n';
      if (orderNumber) msg += `🧾 رقم الطلب: ${orderNumber}\n`;
      msg += '━━━━━━━━━━━━━━\n';
      msg += `👤 الاسم: ${name}\n`;
      msg += `📞 الهاتف: ${phone}\n`;
      msg += `🏙️ المدينة: ${city}\n`;
      msg += `📍 العنوان: ${address}\n`;
      msg += '━━━━━━━━━━━━━━\n';
      msg += `📦 المنتج: بوركيني Cache Terazo\n`;
      msg += `🔢 الكمية: ${q}\n`;

      if (q === 2) {
        const size2 = (document.querySelector('input[name="size2"]:checked') || {}).value || '';
        const color2 = (document.querySelector('input[name="color2"]:checked') || {}).value || '';
        msg += `\n• القطعة 1: المقاس ${size1} — اللون ${color1}\n`;
        msg += `• القطعة 2: المقاس ${size2} — اللون ${color2}\n`;
      } else {
        msg += `📏 المقاس: ${size1}\n`;
        msg += `🎨 اللون: ${color1}\n`;
      }

      msg += '━━━━━━━━━━━━━━\n';
      msg += `💰 المجموع: ${total} درهم\n`;
      msg += `🚚 التوصيل: مجاني\n`;
      msg += `💵 الدفع عند الاستلام`;
      return msg;
    }

    /** The request body POST /api/orders expects. */
    // Minted once per page view, before the order is sent, so the browser copy
    // and the server copy of each event can carry the same id. Purchase gets its
    // own: Meta deduplicates per event name AND id, so sharing one id across two
    // event names would be legal but makes the two impossible to tell apart in
    // Events Manager.
    const leadEventId = newEventId();
    const purchaseEventId = newEventId();

    function collectOrder(){
      const q = qty();
      const items = [{
        size: (document.querySelector('input[name="size1"]:checked') || {}).value || '',
        color: (document.querySelector('input[name="color1"]:checked') || {}).value || ''
      }];
      if (q === 2) {
        items.push({
          size: (document.querySelector('input[name="size2"]:checked') || {}).value || '',
          color: (document.querySelector('input[name="color2"]:checked') || {}).value || ''
        });
      }
      const u = trackUserData();
      return {
        fullname: document.getElementById('fullname').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        city: document.getElementById('city').value.trim(),
        address: document.getElementById('address').value.trim(),
        quantity: q,
        items: items,
        // Attribution. All optional server-side: if nk-track.js was blocked
        // these are simply absent and the order is unaffected. `eventId` is
        // generated before the request so the server's Lead and the browser's
        // carry the same id and Meta counts one conversion, not two.
        eventId: leadEventId,
        purchaseEventId: purchaseEventId,
        fbp: u.fbp,
        fbc: u.fbc,
        externalId: u.externalId,
        eventSourceUrl: u.eventSourceUrl
      };
    }

    /** `error` codes the API returns, mapped to what the customer should read. */
    const ERROR_TEXT = {
      validation_error: 'تحقّقي من المعلومات المدخلة وعاودي المحاولة.',
      invalid_json: 'وقع خطأ في إرسال البيانات. عاودي المحاولة.',
      product_unavailable: 'المنتج غير متوفر حالياً. جرّبي بعد قليل.',
      database_not_configured: 'الخدمة غير متاحة مؤقتاً. عاودي المحاولة بعد قليل.',
      server_error: 'وقع خطأ من جهتنا. عاودي المحاولة بعد قليل.'
    };

    function setBusy(busy){
      submitBtn.disabled = busy;
      submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
      submitLabel.textContent = busy ? 'جاري إرسال الطلب…' : 'تأكيد الطلب';
    }

    /**
     * Checkout.
     *
     * The order is written to the database first and the confirmation is shown
     * only after the API says it succeeded. The previous flow fired the request
     * and moved on regardless, so a failed write still showed "order placed" —
     * the customer believed they had ordered and nothing reached the admin.
     * A failure now keeps the form on screen with its values intact so the
     * customer can simply press the button again.
     */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Fired before validation: pressing the order button *is* the intent,
      // whether or not every field happens to be filled in correctly yet.
      //
      // Once per page view. The form is `novalidate`, so this handler runs on
      // every attempt — including a rejected one the customer then corrects,
      // and including Enter rather than a click. Ungated, a customer who
      // mistypes their phone would report two checkouts for one checkout.
      trackPixelOnce('InitiateCheckout', {
        value: qty() === 2 ? PRICE_2 : PRICE_1,
        currency: 'MAD',
        contents: [{ id: 'cache-terazo', quantity: qty() }],
        content_type: 'product',
      });

      if (!form.checkValidity()) { form.reportValidity(); return; }

      errorBox.hidden = true;
      setBusy(true);

      let result = null;
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(collectOrder())
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || body.ok !== true) {
          throw new Error(body && typeof body.error === 'string' ? body.error : '');
        }
        result = body;
      } catch (err) {
        setBusy(false);
        errorBox.textContent =
          ERROR_TEXT[err && err.message] ||
          'تعذّر إرسال الطلب. تحقّقي من اتصالك بالإنترنت وعاودي المحاولة.';
        errorBox.hidden = false;
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      setBusy(false);

      // Only past this point: the API returned ok and the order is in the
      // database. Firing on submit instead would count every failed write and
      // every abandoned attempt as a lead, and the ad optimisation would be
      // trained on orders that do not exist.
      // Browser copy only — the server fired its own Lead from the order path,
      // with this same id, at the moment the row was committed.
      const orderValue = result.total != null ? result.total / 100 : qty() === 2 ? PRICE_2 : PRICE_1;
      const orderCurrency = result.currency || 'MAD';

      trackPixelOnly('Lead', {
        value: orderValue,
        currency: orderCurrency,
        content_name: 'Cache Terazo',
        order_id: result.orderNumber,
      }, leadEventId);

      // Purchase. This is the event campaigns optimise against, and it was the
      // one thing never being sent — which is why Ads Manager had nothing to
      // optimise on despite orders arriving.
      //
      // The value is the amount the API confirmed, not a constant: it is what
      // the server priced the order at, so 299, 549 or whatever the catalog
      // says. Reporting a fixed figure would hand Meta a revenue number that
      // does not match the sale and corrupt the ROAS it optimises toward.
      //
      // Browser copy only — the server fires its own Purchase from the order
      // path with this same id, and Meta keeps whichever arrives first.
      // The console warns "Parameter 'currency' is invalid for event 'Purchase'"
      // on every one of these. It is Meta's validator, not this call: fbevents
      // checks currency against a hardcoded list of 49 codes that omits MAD, and
      // Purchase is the only standard event carrying a validation schema. The
      // warning is advisory — the track path discards the validator's result and
      // sends the event anyway, and the Conversions API accepts MAD.
      //
      // Do not "fix" it by changing the currency. See META-TRACKING.md.
      trackPixelOnly('Purchase', {
        value: orderValue,
        currency: orderCurrency,
        content_name: 'Cache Terazo',
        content_type: 'product',
        content_ids: ['cache-terazo'],
        contents: [{ id: 'cache-terazo', quantity: qty(), item_price: orderValue / qty() }],
        num_items: qty(),
        order_id: result.orderNumber,
      }, purchaseEventId);

      if (result.orderNumber) {
        orderRefValue.textContent = result.orderNumber;
        orderRef.hidden = false;
      }

      // Only sets the link's target. Nothing here navigates: no window.open,
      // no location assignment, no programmatic click. The customer decides
      // whether to contact us, and the order is already recorded either way.
      waContact.href =
        `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildMessage(result.orderNumber))}`;

      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    refresh();
  })();

  /* ---------- "You May Also Like" strip ---------- */
  (function alsoLike(){
    const track = document.getElementById('ymal-track');
    if (!track) return;

    // Each card names a real colourway. Tapping one checks that colour in the
    // order form before the anchor scrolls there, so the strip is a shortcut
    // into checkout rather than four links to the same place. Same mechanism
    // the hero thumbnails already use.
    track.querySelectorAll('.ymal-link[data-color]').forEach(link => {
      link.addEventListener('click', () => {
        const color = link.getAttribute('data-color');
        const radio = document.querySelector(`input[name="color1"][value="${color}"]`);
        if (!radio) return;
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  })();

});

/* ---------- Hero: swipe and arrows ----------
   Steps through the colour swatches that already exist rather than moving the
   image itself: a swipe or an arrow click simply activates the next thumb, so
   the image swap, the active state and the sync into the order form all run
   through exactly the same path a tap does. No new state, and nothing here
   knows anything about orders. */
(function heroNav(){
  const frame = document.querySelector('.showcase-frame');
  const strip = document.getElementById('hero-color-thumbs');
  if (!frame || !strip) return;

  const thumbs = () => Array.from(strip.querySelectorAll('.thumb'));
  function step(dir){
    const all = thumbs();
    if (all.length < 2) return;
    const i = all.findIndex(t => t.classList.contains('is-active'));
    const next = all[((i < 0 ? 0 : i) + dir + all.length) % all.length];
    if (next) next.click();
  }

  // Arrows. Created here so no markup changes; hidden on touch widths by CSS.
  for (const [cls, dir, label, path] of [
    ['hero-nav-prev', -1, 'اللون السابق', 'M15 18l-6-6 6-6'],
    ['hero-nav-next',  1, 'اللون التالي', 'M9 6l6 6-6 6'],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hero-nav ' + cls;
    b.setAttribute('aria-label', label);
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
    b.addEventListener('click', (e) => { e.preventDefault(); step(dir); });
    frame.appendChild(b);
  }

  // Swipe. Horizontal only, so vertical scrolling is never captured.
  let x0 = null, y0 = null;
  frame.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; }, { passive: true });
  frame.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    // RTL: a leftward swipe advances, matching the strip's reading direction.
    step(dx < 0 ? 1 : -1);
  }, { passive: true });
  frame.addEventListener('pointercancel', () => { x0 = null; }, { passive: true });
})();

/* ---------- Second piece: start clean each time ----------
   Choosing "قطعة واحدة" after filling the second piece used to leave those
   values selected behind the collapsed block, so going back to "قطعتان"
   presented a piece the customer had not just chosen — and had no reason to
   re-check. They are cleared instead.

   Nothing about the order changes: the payload only ever includes the second
   piece when the quantity is 2, which was already true. Clearing is done by
   unchecking the radios and firing one `change`, so the existing handler
   repaints the selected states through its own path rather than this module
   reaching into them. */
(function resetSecondPiece(){
  const qty = document.querySelectorAll('input[name="qty"]');
  if (!qty.length) return;

  function clearPieceTwo(){
    const inputs = document.querySelectorAll('input[name="size2"], input[name="color2"]');
    if (!inputs.length) return;
    let changed = false;
    inputs.forEach(i => { if (i.checked) { i.checked = false; changed = true; } });
    // Unchecking in script fires no event, so the shared refresh is nudged once
    // and it clears the `is-checked` styling for both groups itself.
    if (changed) inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
  }

  qty.forEach(r => r.addEventListener('change', () => {
    if (r.checked && r.value === '1') clearPieceTwo();
  }));
})();
