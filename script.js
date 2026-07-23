// ===== Nakhwa Store — Landing Page Interactions =====

const WA_NUMBER = '212624273714';
const PRICE_1 = 299;
const PRICE_2 = 549;

document.addEventListener('DOMContentLoaded', () => {

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
    vid.addEventListener('playing', () => card.classList.add('playing','loaded'));
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

    // Try to autoplay WITH sound; if the browser blocks it, fall back to
    // muted autoplay and surface a clear "play with sound" button + controls.
    function tryAutoplay(){
      vid.muted = false;
      const p = vid.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { soundOn = true; card.classList.remove('needs-tap'); soundBtn.hidden = false; updateSoundBtn(); })
         .catch(() => {
           // Blocked with sound -> play muted so it's visibly running, prompt for tap
           vid.muted = true;
           card.classList.add('needs-tap');
           vid.setAttribute('controls', '');
           vid.play().catch(() => {});
         });
      }
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

  /* ---------- Gallery Lightbox ---------- */
  (function lightbox(){
    const grid = document.getElementById('gallery-grid');
    const images = Array.from(grid.querySelectorAll('img'));
    const box = document.getElementById('lightbox');
    const stage = document.getElementById('lightbox-stage');
    const img = document.getElementById('lightbox-img');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    let current = 0, scale = 1;

    function render(){
      scale = 1; img.style.transform = 'scale(1)';
      img.src = images[current].src; img.alt = images[current].alt;
    }
    function open(i){ current = i; render(); box.hidden = false; document.body.style.overflow = 'hidden'; }
    function close(){ box.hidden = true; document.body.style.overflow = ''; }
    function show(delta){ current = (current + delta + images.length) % images.length; render(); }

    images.forEach((im, i) => im.addEventListener('click', () => open(i)));
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => show(1));
    nextBtn.addEventListener('click', () => show(-1));
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    img.addEventListener('dblclick', () => { scale = scale === 1 ? 2.2 : 1; img.style.transform = `scale(${scale})`; });

    let startX = 0, startY = 0, moved = false;
    stage.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; moved = false; }, { passive: true });
    stage.addEventListener('touchmove', () => { moved = true; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (!moved || scale !== 1) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(dx > 0 ? 1 : -1);
    });
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(1);
      if (e.key === 'ArrowLeft') show(-1);
    });
  })();

  /* ---------- Smart Order System ---------- */
  (function orderForm(){
    const form = document.getElementById('order-form');
    const success = document.getElementById('order-success');
    const waFallback = document.getElementById('wa-fallback');
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
      const q = qty();
      const total = q === 2 ? PRICE_2 : PRICE_1;
      sumQty.textContent = q;
      sumTotal.textContent = total + ' درهم';

      const two = q === 2;
      piece2.hidden = !two;
      piece1Title.textContent = two ? 'القطعة الأولى' : 'تفاصيل البوركيني';
      size2Inputs.forEach(i => i.required = two);
      color2Inputs.forEach(i => i.required = two);
      if (!two) { size2Inputs.forEach(i => i.checked = false); color2Inputs.forEach(i => i.checked = false); }
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

    function buildMessage(){
      const q = qty();
      const total = q === 2 ? PRICE_2 : PRICE_1;
      const name = document.getElementById('fullname').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const city = document.getElementById('city').value.trim();
      const address = document.getElementById('address').value.trim();
      const size1 = (document.querySelector('input[name="size1"]:checked') || {}).value || '';
      const color1 = (document.querySelector('input[name="color1"]:checked') || {}).value || '';

      let msg = '🛍️ *طلب جديد — بوركيني Cache Terazo*\n';
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

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildMessage())}`;
      waFallback.href = url;

      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });

      window.open(url, '_blank');
    });

    refresh();
  })();

});
