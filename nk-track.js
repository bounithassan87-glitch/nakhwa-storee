// Shared Meta tracking for every Nakhwa storefront.
//
// One file, included by any landing page on any domain:
//
//     <script src="https://nakhwa-store.pages.dev/nk-track.js"></script>
//
// It fires PageView by itself and exposes two calls for the rest. Every event
// goes out twice — once from the browser pixel, once from the Conversions API —
// carrying the same event_id, which is what stops Meta counting the conversion
// twice. The browser copy is lost to content blockers and closed tabs; the
// server copy is not. Whichever arrives first wins.
//
// The API origin is taken from this script's own src, so a page hosted on a
// different domain needs no configuration, and the file is served from the
// Nakhwa origin where the Functions live.
//
// Nothing here may ever throw into a caller: a landing page's checkout does not
// get to break because an ad platform is unreachable.
(function () {
  'use strict';

  // Meta Pixel bootstrap. It lives here rather than inline in the page so the
  // document carries no executable inline script at all — which is what allows
  // 'unsafe-inline' to be removed from script-src. Same code, same order: init
  // first, then the PageView fired at the bottom of this file.
  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  try { window.fbq('init', '2808695152828717'); } catch (_) { /* blocked */ }

  var API_BASE = (function () {
    try {
      var src = (document.currentScript && document.currentScript.src) || '';
      return src ? new URL(src).origin : '';
    } catch (_) {
      return '';
    }
  })();

  var EXTERNAL_ID_KEY = 'nk_ext_id';

  function uuid() {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (_) { /* fall through */ }
    return 'nk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function cookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : undefined;
    } catch (_) {
      return undefined;
    }
  }

  /**
   * A stable id for this visitor, so events from the same person link together
   * across a session. Random and first-party — it identifies nobody by itself.
   */
  // Anything that reaches the server is validated there too, but a value read
  // back out of storage is attacker-controlled on a compromised device and is
  // not trusted on the way out: only the shape this file writes is accepted,
  // and anything else is replaced rather than forwarded.
  var ID_SHAPE = /^(?:[0-9a-f-]{36}|nk-[0-9a-z]{1,12}-[0-9a-z]{1,12})$/i;

  function externalId() {
    try {
      var existing = localStorage.getItem(EXTERNAL_ID_KEY);
      if (existing && ID_SHAPE.test(existing)) return existing;
      var fresh = uuid();
      localStorage.setItem(EXTERNAL_ID_KEY, fresh);
      return fresh;
    } catch (_) {
      return undefined; // private mode, storage disabled — not worth failing over
    }
  }

  /**
   * Meta's click id. The pixel writes `_fbc` when it sees `fbclid`, but only
   * after it has loaded, so it is rebuilt from the URL when the cookie is not
   * there yet — otherwise the first pageview of every ad click, the one that
   * matters most for attribution, goes out unattributed.
   */
  function fbc() {
    var fromCookie = cookie('_fbc');
    if (fromCookie) return fromCookie;
    try {
      var id = new URL(window.location.href).searchParams.get('fbclid');
      return id ? 'fb.1.' + Date.now() + '.' + id : undefined;
    } catch (_) {
      return undefined;
    }
  }

  /**
   * Make sure a _fbp exists before any event reports one.
   *
   * The pixel writes _fbp, but fbevents.js is injected async and PageView fires
   * in the same synchronous tick — so on a first visit the cookie does not exist
   * yet and the server copy of the highest-volume event went out with no fbp at
   * all. That is what held the match rate near 20%: not a propagation bug, a
   * race.
   *
   * Rather than delay the event waiting for Meta's script, the cookie is seeded
   * here in Meta's own format when it is absent. fbevents.js reads an existing
   * first-party _fbp and keeps it, so the browser copy and the server copy carry
   * the same value and every later event in the session inherits it.
   *
   * It is only ever written when missing — the pixel's own value is never
   * overwritten.
   */
  function ensureFbp() {
    var existing = cookie('_fbp');
    if (existing) return existing;
    try {
      // fb.<subdomainIndex>.<creationTime>.<random>, the format Meta documents.
      // The index counts the labels the cookie is scoped to, which is what
      // fbevents itself uses — 2 for a host like shop.example.com.
      var index = Math.max(1, window.location.hostname.split('.').length - 1);
      var value = 'fb.' + index + '.' + Date.now() + '.' +
        String(Math.floor(Math.random() * 1e18));
      // 90 days, matching the pixel's own lifetime.
      document.cookie = '_fbp=' + value + ';path=/;max-age=7776000;SameSite=Lax';
      // Only report it if the browser actually stored it.
      return cookie('_fbp');
    } catch (_) {
      return undefined;
    }
  }

  function userData() {
    return {
      fbp: ensureFbp(),
      fbc: fbc(),
      externalId: externalId(),
      eventSourceUrl: window.location.href,
    };
  }

  /** Fire the browser pixel only. Safe when fbq is missing or blocked. */
  function pixel(name, params, eventId) {
    try {
      if (typeof window.fbq !== 'function') return;
      window.fbq('track', name, params || {}, eventId ? { eventID: eventId } : undefined);
    } catch (_) { /* analytics never interrupts the page */ }
  }

  /** Fire the server copy. Fire-and-forget; failures are the server's to log. */
  function server(name, params, eventId) {
    try {
      var u = userData();
      var body = {
        eventName: name,
        eventId: eventId,
        eventSourceUrl: u.eventSourceUrl,
        fbp: u.fbp,
        fbc: u.fbc,
        externalId: u.externalId,
      };
      if (params && typeof params.value === 'number') {
        body.value = params.value;
        body.currency = params.currency || 'MAD';
      }
      // Product identity, so the server copy describes the same item the pixel
      // copy did. Sent under the names the endpoint validates; it rebuilds the
      // Meta-shaped custom_data itself.
      if (params) {
        if (params.content_name) body.contentName = params.content_name;
        if (params.content_type) body.contentType = params.content_type;
        if (Array.isArray(params.content_ids) && params.content_ids.length) {
          body.contentIds = params.content_ids.slice(0, 10);
        }
      }
      // keepalive so the request still leaves if the page is navigating away.
      fetch(API_BASE + '/api/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'strict-origin',
        cache: 'no-store',
      }).catch(function () { /* offline, blocked, CORS — not the page's problem */ });
    } catch (_) { /* ignore */ }
  }

  /* ── First-party funnel ───────────────────────────────────────────────────
     Meta tells us how a campaign performed. It cannot tell us how many people
     opened the form and gave up, because that is not a Meta event and never
     reaches our own data. These few functions do, and they store nothing about
     the person: a random per-visit id, which page, and what happened. */

  var SESSION_KEY = 'nk_sid';

  /**
   * An opaque id for this visit.
   *
   * sessionStorage, not localStorage: it should die with the tab. It exists
   * only to join "started the form" to "placed the order", and identifies
   * nobody — no name, no phone, no fingerprint, no IP.
   */
  function sessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing && /^nks_[A-Za-z0-9_-]{16,48}$/.test(existing)) return existing;
      var raw = uuid().replace(/-/g, '').slice(0, 24);
      var fresh = 'nks_' + raw;
      sessionStorage.setItem(SESSION_KEY, fresh);
      return fresh;
    } catch (_) {
      return undefined; // private mode — the visit simply goes uncounted
    }
  }

  /**
   * Which storefront this is, taken from the first path segment.
   *
   * Deliberately derived from the URL rather than from a per-page config
   * global, so a new landing page is counted the day it ships without touching
   * this file. `/bellevia-anti-lice/` becomes "bellevia-anti-lice"; the root
   * becomes "home".
   */
  function landingPage() {
    try {
      var seg = window.location.pathname.split('/').filter(Boolean)[0] || 'home';
      seg = String(seg).toLowerCase().replace(/\.html?$/, '');
      return /^[a-z0-9][a-z0-9-]{0,79}$/.test(seg) ? seg : 'home';
    } catch (_) {
      return 'home';
    }
  }

  /**
   * The product the page sells.
   *
   * The page's own config is authoritative and is preferred whenever it is
   * there. It is not always there yet: on a storefront whose config.js is
   * itself deferred, this file runs first and page_view — the very first event
   * — went out with no product at all, while every later event carried one.
   *
   * So the URL slug is the fallback. On every storefront here the path segment
   * and the product slug are the same string, and reporting the page a visit
   * landed on is closer to the truth than reporting nothing. Neither branch
   * hard-codes a product name.
   */
  function productSlug() {
    try {
      var keys = Object.keys(window);
      for (var i = 0; i < keys.length; i++) {
        if (!/_CONFIG$/.test(keys[i])) continue;
        var cfg = window[keys[i]];
        if (cfg && typeof cfg.productSlug === 'string' && cfg.productSlug) return cfg.productSlug;
      }
    } catch (_) { /* ignore */ }
    // Fallback: the landing page slug. 'home' means the root storefront, which
    // sells nothing in particular, so that reports no product rather than a
    // made-up one.
    var fromUrl = landingPage();
    return fromUrl && fromUrl !== 'home' ? fromUrl : undefined;
  }

  /** Send one funnel event. Fire-and-forget, like every other call here. */
  function funnel(type, opts) {
    try {
      var sid = sessionId();
      if (!sid) return;
      var body = {
        analytics: {
          event: type,
          sessionId: sid,
          landingPage: landingPage(),
          productSlug: productSlug(),
        },
      };
      if (opts && opts.outcome) body.analytics.outcome = opts.outcome;
      if (opts && opts.detail) body.analytics.detail = String(opts.detail).slice(0, 120);
      fetch(API_BASE + '/api/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'strict-origin',
        cache: 'no-store',
      }).catch(function () { /* not the page's problem */ });
    } catch (_) { /* ignore */ }
  }

  /**
   * Send at most once per session per page.
   *
   * Guarded in sessionStorage rather than a variable, so a reload or a
   * re-render cannot inflate the count — which would quietly make the funnel
   * look wider at the top than it really was.
   */
  function funnelOnce(type, opts) {
    try {
      var key = 'nk_f_' + type + '_' + landingPage();
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (_) { /* storage unavailable — fall through and still send once */ }
    funnel(type, opts);
  }

  /** The order form, found generically across storefronts. */
  function orderForm() {
    try {
      var byId = document.querySelector('form#order-form, form#orderForm, form[data-nk-form]');
      if (byId) return byId;
      // Fallback: the first form carrying a telephone field is the order form
      // on every storefront here, and on any plausible future one.
      var forms = document.querySelectorAll('form');
      for (var i = 0; i < forms.length; i++) {
        if (forms[i].querySelector('input[type="tel"], input[name="phone"]')) return forms[i];
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  /**
   * Watch the form: seen, and then actually used.
   *
   * form_view fires when the form reaches the viewport — not on page load,
   * because a form nobody scrolled to was never offered. form_start fires on
   * the first real interaction with a field, which is the only honest signal
   * that someone began filling it in, and the number abandonment is measured
   * against.
   */
  function watchForm() {
    var form = orderForm();
    if (!form) return;

    try {
      if (typeof IntersectionObserver === 'function') {
        var io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) {
              funnelOnce('form_view');
              io.disconnect();
              return;
            }
          }
        }, { threshold: 0.25 });
        io.observe(form);
      } else {
        // No observer: count it as seen rather than never.
        funnelOnce('form_view');
      }
    } catch (_) { /* ignore */ }

    try {
      var started = false;
      var onStart = function () {
        if (started) return;
        started = true;
        funnelOnce('form_start');
        // One signal is all we need; stop listening rather than re-checking on
        // every keystroke.
        form.removeEventListener('focusin', onStart, true);
        form.removeEventListener('input', onStart, true);
        form.removeEventListener('change', onStart, true);
      };
      // focusin rather than focus: it bubbles, so one listener covers every
      // field including any added later.
      form.addEventListener('focusin', onStart, true);
      form.addEventListener('input', onStart, true);
      form.addEventListener('change', onStart, true);
    } catch (_) { /* ignore */ }

    try {
      // Every real submit, including one the page's own validation will reject
      // — a customer who tried and was turned away did attempt to order, and
      // counting only the clean attempts would hide exactly the friction worth
      // finding. Capture phase, so it is recorded before the page's handler
      // can preventDefault.
      //
      // NOT deduplicated: a second attempt after fixing a typo is a second
      // attempt. The outcome of each is decided server-side.
      form.addEventListener('submit', function () {
        funnel('form_submit', { outcome: 'attempt' });
      }, true);
    } catch (_) { /* ignore */ }
  }

  var fired = {};

  window.nkTrack = {
    id: uuid,
    userData: userData,
    pixel: pixel,

    /** First-party funnel. Separate from Meta on purpose. */
    sessionId: sessionId,
    landingPage: landingPage,
    funnel: funnel,
    funnelOnce: funnelOnce,

    /** Both copies, sharing one event_id so Meta deduplicates them. */
    track: function (name, params, eventId) {
      var id = eventId || uuid();
      pixel(name, params, id);
      server(name, params, id);
      return id;
    },

    /** Both copies, at most once per page view. Returns the id used. */
    trackOnce: function (name, params) {
      if (fired[name]) return fired[name];
      var id = uuid();
      fired[name] = id;
      pixel(name, params, id);
      server(name, params, id);
      return id;
    },
  };

  // PageView, as soon as this file runs. Once per page load by construction.
  window.nkTrack.trackOnce('PageView');

  // The same arrival, recorded first-party. Sent separately from the Meta call
  // above so neither can affect the other: this is the visitor count the
  // dashboard reads, and Meta cannot be queried for it.
  funnel('page_view');

  // Wire the form once the document has one to wire.
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watchForm);
    } else {
      watchForm();
    }
  } catch (_) { /* ignore */ }
})();
