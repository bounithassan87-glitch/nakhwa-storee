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
  function externalId() {
    try {
      var existing = localStorage.getItem(EXTERNAL_ID_KEY);
      if (existing) return existing;
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

  function userData() {
    return {
      fbp: cookie('_fbp'),
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
      // keepalive so the request still leaves if the page is navigating away.
      fetch(API_BASE + '/api/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        mode: 'cors',
      }).catch(function () { /* offline, blocked, CORS — not the page's problem */ });
    } catch (_) { /* ignore */ }
  }

  var fired = {};

  window.nkTrack = {
    id: uuid,
    userData: userData,
    pixel: pixel,

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
})();
