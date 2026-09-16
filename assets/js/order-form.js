// Shared order-form validation for every BelleVia storefront.
//
// One file, loaded before each page's own script:
//
//     <script src="/assets/js/order-form.js" defer></script>
//
// It exposes `window.nkOrderForm.rules` — three functions keyed by field name,
// each returning an error string in Darija, or '' when the value is fine. That
// is deliberately the exact shape every landing page's `RULES` object already
// had, so wiring a page up is one line and nothing else about its form moves.
//
// Why it exists: the same three rules were copied into six `script.js` files,
// and they had drifted into being too permissive. Orders arrived with the phone
// `0606060606`, the name `Cvslm`, and cities nobody could deliver to. Tightening
// six copies means tightening five and forgetting one.
//
// Scope, stated plainly: this is a UX filter. It runs in the customer's browser
// and anyone can skip it. It does not make `/api/orders` safe and is not a
// substitute for the server's own validation, which is unchanged.
//
// Nothing here may throw into a caller. A landing page's checkout does not get
// to break because a validation helper met an input it did not expect.
(function () {
  'use strict';

  /* ── Text normalisation ───────────────────────────────────────────────────
     Matching happens on a folded form; what the customer sees is never
     rewritten. Arabic reaches these fields with several spellings of the same
     letter — أ إ آ for ا, ة for ه, ى for ي — and a customer typing "Casa" or
     "Laayoune" means the same city as one typing "الدار البيضاء" or "Laâyoune". */

  /** Arabic diacritics and tatweel: invisible, and never part of a match. */
  var TASHKEEL = /[ؐ-ًؚ-ٰٟـ]/g;

  /** Bidi and zero-width marks. A pasted phone number often carries these. */
  var INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

  function fold(raw) {
    var s = String(raw == null ? '' : raw);
    try {
      // Strip Latin accents: "Laâyoune" and "Laayoune" are one city.
      s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    } catch (e) { /* older engine: fall through with the raw string */ }
    return s
      .replace(INVISIBLE, '')
      .replace(TASHKEEL, '')
      .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ → ا
      .replace(/ة/g, 'ه')                     // ة → ه
      .replace(/ى/g, 'ي')                     // ى → ي
      .replace(/[‘’'`´]/g, '')                // apostrophes in M'diq
      .replace(/[-_.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /* ── Phone ────────────────────────────────────────────────────────────────
     Morocco's mobile numbers are 06 or 07 plus eight digits. 05 is a landline:
     it is a real number, but a COD order needs a phone the delivery driver can
     reach, so it is refused with its own message rather than a generic one. */

  function normalizePhone(raw) {
    var d = String(raw == null ? '' : raw)
      .replace(INVISIBLE, '')
      .replace(/[\s\-().]/g, '');
    if (d.indexOf('+212') === 0) d = '0' + d.slice(4);
    else if (d.indexOf('00212') === 0) d = '0' + d.slice(5);
    else if (d.indexOf('212') === 0 && d.length === 12) d = '0' + d.slice(3);
    return d;
  }

  var ASC = '0123456789';
  var DESC = '9876543210';

  /**
   * A number nobody could be reached on, recognised by shape rather than by a
   * list. Every rule here is checked against the EIGHT digits after the 06/07
   * prefix, so a real number is never judged by a prefix it had to have.
   *
   * Deliberately narrow. A blacklist that rejects a real customer costs a sale;
   * these four shapes are ones no operator issues in sequence:
   *
   *   00000000  one digit, eight times
   *   06060606  a two-digit block, four times
   *   12341234  a four-digit block, twice
   *   12345678  a straight run up or down
   *
   * `0661234567` and `0645454546` are NOT caught, and should not be: only the
   * exact shapes above are, which is what keeps this from guessing.
   */
  function isFakePhoneBody(body) {
    if (/^(\d)\1{7}$/.test(body)) return true;
    if (/^(\d{2})\1{3}$/.test(body)) return true;
    if (/^(\d{4})\1$/.test(body)) return true;
    if (ASC.indexOf(body) !== -1 || DESC.indexOf(body) !== -1) return true;
    return false;
  }

  function phoneError(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (!v) return 'عمّر رقم التيليفون.';

    var p = normalizePhone(v);

    if (/[^\d]/.test(p)) return 'الرقم خاصو يكون غير أرقام.';
    if (/^05\d{8}$/.test(p)) return 'هادا رقم ثابت. عمّر رقم محمول كيبدا بـ 06 ولا 07.';
    if (!/^0[67]\d{8}$/.test(p)) {
      return 'الرقم ماشي صحيح. خاصو يبدا بـ 06 ولا 07 ويكون فيه 10 أرقام.';
    }
    if (isFakePhoneBody(p.slice(2))) return 'عمّر رقم صحيح باش نقدرو نتواصلو معاك.';
    return '';
  }

  /* ── Name ─────────────────────────────────────────────────────────────────
     The bar is "a human could have written this", not "this is a known name".
     Arabic, Latin, hyphens and two-word names all pass untouched; what fails is
     keyboard mashing and the word `test`. */

  /**
   * Whole-string placeholders only — never a substring.
   *
   * `test` must fail while `Testour`, a real Moroccan surname, must not, so
   * matching is on the complete folded name (or on every word of it, which is
   * what catches "test test").
   */
  var PLACEHOLDERS = [
    'test', 'testing', 'tests', 'essai', 'name', 'nom', 'fullname', 'user',
    'admin', 'aaa', 'bbb', 'ccc', 'qqq', 'xxx', 'zzz', 'abc', 'xyz',
    'asd', 'asdf', 'azerty', 'qwerty', 'wxc', 'aze', 'lorem', 'ipsum',
    'nnn', 'sss', 'ddd', 'anonyme', 'inconnu', 'تجربة', 'تجريب', 'اختبار', 'فلان',
  ];

  function nameError(raw) {
    var v = String(raw == null ? '' : raw).replace(INVISIBLE, '').trim().replace(/\s+/g, ' ');
    if (!v) return 'عمّر الاسم ديالك.';
    if (v.length < 3) return 'الاسم قصير بزاف.';
    if (v.length > 60) return 'الاسم طويل بزاف.';

    // At least one letter, in either script.
    if (!/[ء-يa-zA-Z]/.test(v)) return 'كتب الاسم بالحروف.';
    if (/^\d+$/.test(v)) return 'عمّر اسم صحيح.';

    // Four of the same character in a row: `aaaa`, `محمددددد`.
    if (/(.)\1{3,}/.test(v)) return 'عمّر اسم صحيح.';

    var folded = fold(v);
    var words = folded.split(' ').filter(Boolean);
    var allPlaceholder = words.length > 0 && words.every(function (w) {
      return PLACEHOLDERS.indexOf(w) !== -1;
    });
    if (PLACEHOLDERS.indexOf(folded) !== -1 || allPlaceholder) return 'عمّر اسم صحيح.';

    // Latin with no vowel at all is keyboard mashing — `Cvslm`, `qsdfgh`.
    // Applied ONLY to Latin-only input, so no Arabic name is ever judged by it.
    var latinOnly = /^[a-zA-Z\s'-]+$/.test(v);
    if (latinOnly && !/[aeiouyAEIOUY]/.test(v)) return 'عمّر اسم صحيح.';

    return '';
  }

  /* ── Cities ───────────────────────────────────────────────────────────────
     A closed list of real Moroccan cities and delivery localities. Free text is
     what produced undeliverable orders, and a city the driver cannot find is a
     lead that was never a sale.

     `ar` is what the customer sees and what is sent. `alt` exists only for
     matching what they typed — the Latin name, the common short form, a
     frequent alternative spelling. Nothing here is invented: every entry is a
     real Moroccan city, town or delivery locality. */

  var CITY_DATA = [
    ['الدار البيضاء', ['casablanca', 'casa', 'dar el beida', 'dar elbeida', 'كازا', 'كازابلانكا']],
    ['الرباط', ['rabat', 'rbat']],
    ['سلا', ['sale', 'salé', 'sla']],
    ['تمارة', ['temara', 'témara']],
    ['الصخيرات', ['skhirat', 'skhirate']],
    ['هرهورة', ['harhoura']],
    ['تامسنا', ['tamesna']],
    ['المحمدية', ['mohammedia', 'mohamedia', 'fdala']],
    ['بوسكورة', ['bouskoura']],
    ['دار بوعزة', ['dar bouazza', 'dar bouaza']],
    ['النواصر', ['nouaceur', 'nouasseur']],
    ['مديونة', ['mediouna']],
    ['الدروة', ['deroua', 'derroua']],
    ['عين حرودة', ['ain harrouda', 'ain harouda']],
    ['بنسليمان', ['benslimane', 'ben slimane']],
    ['بوزنيقة', ['bouznika']],
    ['حد السوالم', ['had soualem', 'had sualem']],
    ['برشيد', ['berrechid', 'berchid']],
    ['سطات', ['settat']],
    ['ابن أحمد', ['ben ahmed', 'benahmed']],
    ['البروج', ['el borouj', 'elborouj']],
    ['الجديدة', ['el jadida', 'eljadida', 'jadida', 'mazagan']],
    ['أزمور', ['azemmour', 'azemour']],
    ['سيدي بنور', ['sidi bennour', 'sidi benour']],
    ['بئر جديد', ['bir jdid', 'birjdid']],
    ['آسفي', ['safi', 'asfi']],
    ['اليوسفية', ['youssoufia', 'yousoufia']],
    ['الصويرة', ['essaouira', 'essaouria', 'mogador']],
    ['مراكش', ['marrakech', 'marrakesh', 'merrakech']],
    ['آيت أورير', ['ait ourir', 'ait ourire']],
    ['أمزميز', ['amizmiz']],
    ['تحناوت', ['tahanaout', 'tahannaout']],
    ['قلعة السراغنة', ['el kelaa des sraghna', 'kelaa sraghna', 'kalaa sraghna']],
    ['بن جرير', ['ben guerir', 'benguerir']],
    ['شيشاوة', ['chichaoua']],
    ['إمنتانوت', ['imintanout', 'imi n tanoute']],
    ['أكادير', ['agadir', 'agadire']],
    ['إنزكان', ['inezgane', 'inzegane']],
    ['آيت ملول', ['ait melloul', 'aitmelloul']],
    ['الدشيرة', ['dcheira', 'dchira']],
    ['تمسية', ['temsia']],
    ['الدراركة', ['drarga']],
    ['بيوكرى', ['biougra']],
    ['آيت باها', ['ait baha']],
    ['سيدي بيبي', ['sidi bibi']],
    ['تارودانت', ['taroudant', 'taroudannt']],
    ['أولاد تايمة', ['oulad teima', 'ouled teima', 'oulad taima']],
    ['أولاد برحيل', ['ouled berhil', 'oulad berhil']],
    ['تالوين', ['taliouine']],
    ['تافراوت', ['tafraout', 'tafraoute']],
    ['تيزنيت', ['tiznit']],
    ['ميرلفت', ['mirleft']],
    ['سيدي إفني', ['sidi ifni']],
    ['كلميم', ['guelmim', 'goulimine']],
    ['طانطان', ['tan tan', 'tantan']],
    ['طاطا', ['tata']],
    ['فم زكيد', ['foum zguid']],
    ['أسا', ['assa']],
    ['زاك', ['zag']],
    ['العيون', ['laayoune', 'laâyoune', 'layoune', 'el aaiun']],
    ['بوجدور', ['boujdour', 'bojdour']],
    ['السمارة', ['smara', 'es smara']],
    ['طرفاية', ['tarfaya']],
    ['الداخلة', ['dakhla', 'dakhlla']],
    ['أوسرد', ['aousserd', 'aoussred']],
    ['ورزازات', ['ouarzazate', 'warzazat']],
    ['زاكورة', ['zagora']],
    ['أكدز', ['agdz', 'agadz']],
    ['تنغير', ['tinghir', 'tineghir']],
    ['بومالن دادس', ['boumalne dades', 'boumalne']],
    ['قلعة مكونة', ['kelaat mgouna', 'kalaat mgouna']],
    ['الرشيدية', ['errachidia', 'rachidia', 'ksar souk']],
    ['أرفود', ['erfoud']],
    ['الريصاني', ['rissani']],
    ['كلميمة', ['goulmima']],
    ['ميدلت', ['midelt']],
    ['خنيفرة', ['khenifra']],
    ['مريرت', ['mrirt', 'mrirte']],
    ['أزرو', ['azrou']],
    ['إفران', ['ifrane', 'ifran']],
    ['صفرو', ['sefrou']],
    ['فاس', ['fes', 'fès', 'fez']],
    ['مكناس', ['meknes', 'meknès', 'meknas']],
    ['الحاجب', ['el hajeb', 'elhajeb']],
    ['عين تاوجطات', ['ain taoujdate', 'ain taoujtate']],
    ['مولاي إدريس زرهون', ['moulay idriss', 'moulay driss zerhoun']],
    ['تازة', ['taza']],
    ['جرسيف', ['guercif', 'gercif']],
    ['تاونات', ['taounate']],
    ['تاهلة', ['tahla']],
    ['بولمان', ['boulemane']],
    ['ميسور', ['missour']],
    ['وجدة', ['oujda', 'oujdah']],
    ['بركان', ['berkane']],
    ['السعيدية', ['saidia', 'saïdia']],
    ['أحفير', ['ahfir']],
    ['تاوريرت', ['taourirt']],
    ['جرادة', ['jerada']],
    ['العيون الشرقية', ['el aioun sidi mellouk', 'el aioun']],
    ['فكيك', ['figuig']],
    ['بوعرفة', ['bouarfa']],
    ['الناظور', ['nador', 'nadour']],
    ['زايو', ['zaio', 'zaïo']],
    ['العروي', ['al aroui', 'laroui']],
    ['سلوان', ['selouane', 'slouane']],
    ['الدريوش', ['driouch']],
    ['ميضار', ['midar']],
    ['الحسيمة', ['al hoceima', 'alhoceima', 'hoceima']],
    ['إمزورن', ['imzouren']],
    ['بني بوعياش', ['beni bouayach']],
    ['تارجيست', ['targuist']],
    ['شفشاون', ['chefchaouen', 'chaouen', 'chefchaouene']],
    ['وزان', ['ouezzane', 'ouazzane']],
    ['طنجة', ['tanger', 'tangier', 'tanja']],
    ['تطوان', ['tetouan', 'tétouan', 'titouan']],
    ['مرتيل', ['martil']],
    ['المضيق', ['mdiq', 'm diq']],
    ['الفنيدق', ['fnideq', 'fnidek']],
    ['أصيلة', ['asilah', 'arzila']],
    ['العرائش', ['larache', 'laarache']],
    ['القصر الكبير', ['ksar el kebir', 'ksar elkebir', 'ksar kbir']],
    ['القنيطرة', ['kenitra', 'knitra']],
    ['المهدية', ['mehdia', 'mehdya']],
    ['سيدي قاسم', ['sidi kacem']],
    ['سيدي سليمان', ['sidi slimane']],
    ['سوق الأربعاء الغرب', ['souk el arbaa', 'souk larbaa']],
    ['مولاي بوسلهام', ['moulay bousselham']],
    ['سيدي يحيى الغرب', ['sidi yahya el gharb', 'sidi yahya']],
    ['الخميسات', ['khemisset', 'khemissat']],
    ['تيفلت', ['tiflet']],
    ['الرماني', ['rommani']],
    ['بني ملال', ['beni mellal', 'benimellal']],
    ['الفقيه بن صالح', ['fquih ben salah', 'fkih ben salah']],
    ['قصبة تادلة', ['kasba tadla', 'kasbat tadla']],
    ['أزيلال', ['azilal']],
    ['دمنات', ['demnate', 'demnat']],
    ['أفورار', ['afourer', 'afourar']],
    ['سوق السبت', ['souk sebt', 'souk sebt oulad nemma']],
    ['بزو', ['bzou']],
    ['خريبكة', ['khouribga', 'khouribgua']],
    ['وادي زم', ['oued zem', 'wad zem']],
    ['بجعد', ['bejaad', 'bjaad']],
  ];

  /** Canonical display names, in dataset order — what a <datalist> renders. */
  var CITIES = CITY_DATA.map(function (row) { return row[0]; });

  /** folded string → canonical Arabic name. Built once. */
  var CITY_INDEX = (function () {
    var index = {};
    CITY_DATA.forEach(function (row) {
      var canonical = row[0];
      index[fold(canonical)] = canonical;
      row[1].forEach(function (alias) { index[fold(alias)] = canonical; });
    });
    return index;
  })();

  /**
   * The city this text names, or null.
   *
   * Exact match on the folded form only. A prefix match would resolve "Ben" to
   * whichever of "Ben Ahmed" or "Ben Guerir" happened to be first in the list,
   * and silently ship a parcel to the wrong province — the datalist is what
   * offers completions, and the customer picks one.
   */
  function resolveCity(raw) {
    var key = fold(raw);
    if (!key) return null;
    return Object.prototype.hasOwnProperty.call(CITY_INDEX, key) ? CITY_INDEX[key] : null;
  }

  function cityError(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (!v) return 'عمّر المدينة.';
    if (!resolveCity(v)) return 'اختار مدينة صحيحة من اللائحة.';
    return '';
  }

  /* ── City autocomplete ────────────────────────────────────────────────────
     A native <datalist> rather than a custom dropdown. It searches as the
     customer types on both iOS and Android, needs no CSS, and leaves the field
     a plain text input — so the form keeps the exact look it already has, and a
     browser that ignores datalist still gets a working field with the same
     validation behind it.

     Built here instead of in six HTML files: 140 <option> elements repeated per
     page is 140 chances for one page's list to drift from the rest. */

  var LIST_ID = 'nk-city-list';

  /**
   * True when the page has declared that its city field is deliberately open.
   *
   * Opting out is an explicit `data-city-open` attribute on the input, and not
   * something inferred. Inferring it from "this input already has a `list`"
   * was tried and was wrong: `bellevia-weight-gain` and
   * `bellevia-anti-joint-pain` both ship a sixteen-entry `list="cities"` that
   * the shared list is MEANT to replace, and reading that as a decision
   * silently dropped them from the closed list and from canonicalisation.
   *
   * The one page that needs it says so. Genouillère's own comment gives the
   * reason: a closed list of Moroccan cities cannot hold every douar, and a
   * customer who cannot find their town does not order. Such a field is left
   * entirely alone — no list swap, no canonicalisation — and the page keeps
   * its own city rule.
   */
  function isOpenCityField(input) {
    try {
      return Boolean(input && input.hasAttribute && input.hasAttribute('data-city-open'));
    } catch (e) {
      return false;
    }
  }

  function enhanceCityInputs(doc) {
    try {
      var all = doc.querySelectorAll('input[name="city"]');
      if (!all.length) return;

      // Partition first, so a page that owns every one of its city fields never
      // gets 142 <option> elements injected into it for nothing.
      var inputs = [];
      for (var k = 0; k < all.length; k++) {
        if (!isOpenCityField(all[k])) inputs.push(all[k]);
      }
      if (!inputs.length) return;

      var list = doc.getElementById(LIST_ID);
      if (!list) {
        list = doc.createElement('datalist');
        list.id = LIST_ID;
        // One fragment, one reflow.
        var frag = doc.createDocumentFragment();
        for (var i = 0; i < CITIES.length; i++) {
          var opt = doc.createElement('option');
          opt.value = CITIES[i];
          frag.appendChild(opt);
        }
        list.appendChild(frag);
        doc.body.appendChild(list);
      }

      for (var j = 0; j < inputs.length; j++) {
        inputs[j].setAttribute('list', LIST_ID);
        // The browser's own saved-values dropdown covers the datalist on some
        // Android builds, and it offers whatever was typed before — including
        // the free text this list exists to stop.
        inputs[j].setAttribute('autocomplete', 'off');

        // Settle on the canonical spelling once the customer leaves the field.
        //
        // "Casa", "casablanca" and "الدار البيضاء" are one destination, and the
        // value here is what reaches the order, the dashboard and the courier.
        // Without this the store accumulates the same city in two alphabets and
        // four spellings, which is the problem the closed list exists to end.
        // Only ever rewrites a value that RESOLVES — unrecognised text is left
        // exactly as typed, so the error message can quote it back.
        inputs[j].addEventListener('blur', function (ev) {
          try {
            var canonical = resolveCity(ev.target.value);
            if (canonical && ev.target.value !== canonical) ev.target.value = canonical;
          } catch (e) { /* never block the field */ }
        });
      }
    } catch (e) { /* an un-enhanced field still validates; never break checkout */ }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { enhanceCityInputs(document); });
    } else {
      enhanceCityInputs(document);
    }
  }

  /* ── The shape every page already expects ─────────────────────────────── */

  window.nkOrderForm = {
    /** Keyed by the input's `name`, returning '' or a Darija error. */
    rules: {
      fullname: nameError,
      phone: phoneError,
      city: cityError,
    },
    normalizePhone: normalizePhone,
    resolveCity: resolveCity,
    cities: CITIES,
    /**
     * Whether this city input is the page's own open field.
     *
     * Exported so a page can ask rather than guess — and so the rule is
     * testable against the same function the enhancement uses.
     */
    isOpenCityField: isOpenCityField,
    /** Exposed for the suite; not used by any page. */
    _fold: fold,
    _isFakePhoneBody: isFakePhoneBody,
  };
})();
