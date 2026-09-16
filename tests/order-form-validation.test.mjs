// The shared order-form validation, exercised as the browser runs it.
//
// `assets/js/order-form.js` is a classic script: it has no exports, and a
// landing page loads it with a plain <script src>. Rather than keep a second
// copy of the rules here that could drift from the one that ships, the file is
// read and evaluated in a `vm` context with a stand-in `window`, and the object
// it installs is what every assertion below runs against.
//
// No network, no database, no browser. Running this submits nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets", "js", "order-form.js");

const source = await readFile(SRC, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "order-form.js" });

const api = sandbox.window.nkOrderForm;
const { rules, normalizePhone, resolveCity, cities } = api ?? {};

const okPhone = (v) => rules.phone(v) === "";
const okName = (v) => rules.fullname(v) === "";
const okCity = (v) => rules.city(v) === "";

test("the file installs the shape every landing page expects", () => {
  assert.ok(api, "window.nkOrderForm must exist after the script runs");
  assert.equal(typeof rules.fullname, "function");
  assert.equal(typeof rules.phone, "function");
  assert.equal(typeof rules.city, "function");
  // Every rule returns a string: '' for valid, a message otherwise. A page
  // treats any truthy return as the error to render.
  for (const rule of [rules.fullname, rules.phone, rules.city]) {
    assert.equal(typeof rule(""), "string");
    assert.equal(typeof rule(undefined), "string", "must not throw on undefined");
    assert.equal(typeof rule(null), "string", "must not throw on null");
  }
});

/* ══ PHONE ════════════════════════════════════════════════════════════════ */

test("PHONE · every accepted Moroccan format normalises and passes", () => {
  const accepted = [
    "0658552431", "0758552431",
    "+212658552431", "+212758552431",
    "00212658552431", "00212758552431",
    "212658552431", "212758552431",
    "06 58 55 24 31", "06-58-55-24-31", "(06) 58.55.24.31",
  ];
  for (const raw of accepted) {
    assert.equal(rules.phone(raw), "", `${raw} must be accepted`);
  }
  // …and all the 06 spellings mean one number.
  for (const raw of ["0658552431", "+212658552431", "00212658552431", "212658552431", "06 58 55 24 31"]) {
    assert.equal(normalizePhone(raw), "0658552431", `from ${raw}`);
  }
});

test("PHONE · a landline is refused, and told why", () => {
  const msg = rules.phone("0522334455");
  assert.notEqual(msg, "");
  assert.match(msg, /ثابت/, "05 deserves its own message, not the generic one");
  assert.equal(okPhone("0537771122"), false);
});

test("PHONE · wrong length, letters and empty are refused", () => {
  for (const bad of ["065855243", "06585524311", "06", "", "   ", "06abcd1234", "abcdefghij", "+2126585524", "0058552431"]) {
    assert.equal(okPhone(bad), false, `${bad} must be refused`);
  }
});

test("PHONE · every fake number from the order log is refused", () => {
  const fakes = [
    "0606060606", "0600000000", "0700000000",
    "0611111111", "0622222222", "0633333333", "0644444444", "0655555555",
    "0666666666", "0677777777", "0688888888", "0699999999",
    "0711111111", "0722222222", "0733333333", "0744444444", "0755555555",
    "0766666666", "0777777777", "0788888888", "0799999999",
    "0612345678", "0712345678", "0601234567",
  ];
  for (const bad of fakes) {
    assert.equal(okPhone(bad), false, `${bad} must be refused`);
  }
});

test("PHONE · the fake-pattern rules stay narrow enough for real numbers", (t) => {
  // The cost of a false positive is a lost sale, so numbers that merely LOOK
  // patterned must still pass. Each of these defeats one rule by a single digit.
  const real = [
    "0661234567", // ascending-ish, but not a run of the digit string
    "0645454546", // two-digit block that breaks on the last pair
    "0612341235", // four-digit block that breaks on the last digit
    "0600000001", // eight identical digits, except the last
    "0658552431", "0771002030", "0699887766", "0707070717",
  ];
  for (const good of real) {
    assert.equal(okPhone(good), "" === rules.phone(good), `${good} must be accepted`);
    assert.equal(rules.phone(good), "", `${good} must be accepted`);
  }
  t.diagnostic(`${real.length} near-miss numbers accepted`);
});

test("PHONE · the shape rules are what reject, not a list of numbers", () => {
  const { _isFakePhoneBody: isFake } = api;
  assert.equal(isFake("00000000"), true, "one digit eight times");
  assert.equal(isFake("06060606"), true, "a two-digit block four times");
  assert.equal(isFake("12341234"), true, "a four-digit block twice");
  assert.equal(isFake("12345678"), true, "a straight run up");
  assert.equal(isFake("98765432"), true, "a straight run down");
  assert.equal(isFake("58552431"), false, "an ordinary number");
});

/* ══ NAME ═════════════════════════════════════════════════════════════════ */

test("NAME · real names pass, in every script a customer uses", () => {
  const good = [
    "سعاد بنعلي", "محمد", "فاطمة الزهراء", "عبد الرحمان الإدريسي",
    "Hassan Bounit", "Youssef", "Marie-Claire", "Anne Marie",
    "Salma El Amrani", "Omar", "Rachid Ben Ali", "O'Brien",
    "Testour",  // a real Moroccan surname — must survive the `test` rule
  ];
  for (const name of good) {
    assert.equal(rules.fullname(name), "", `${name} must be accepted`);
  }
});

test("NAME · garbage and placeholders are refused", () => {
  const bad = [
    "", "   ", "ا", "اب", "ab",            // empty or too short
    "12345", "0606060606",                  // digits only
    "aaaa", "xxxx", "qqqq", "محمددددد",     // repeated characters
    "test", "testing", "Test", "  TEST  ",  // placeholders, any case
    "name", "azerty", "qwerty", "asdf", "lorem ipsum", "test test",
    "Cvslm",                                // the real one from the order log
    "qsdfgh", "zxcvbn",                     // Latin with no vowel
  ];
  for (const name of bad) {
    assert.equal(okName(name), false, `${name} must be refused`);
  }
});

test("NAME · length bounds", () => {
  assert.equal(okName("ابc"), true, "three characters is the floor");
  assert.equal(okName("م".repeat(61)), false, "over 60 is refused");
});

/* ══ CITY ═════════════════════════════════════════════════════════════════ */

test("CITY · the dataset is real, non-empty and free of duplicates", () => {
  assert.ok(cities.length >= 100, `expected a comprehensive list, got ${cities.length}`);
  assert.equal(new Set(cities).size, cities.length, "no duplicate display names");
  for (const c of cities) {
    assert.match(c, /[ء-ي]/, `${c} must be an Arabic display name`);
  }
});

test("CITY · the named major cities all resolve", () => {
  const required = [
    "Casablanca", "Rabat", "Salé", "Témara", "Marrakech", "Agadir", "Tanger",
    "Fès", "Meknès", "Oujda", "Kenitra", "El Jadida", "Mohammedia", "Beni Mellal",
    "Nador", "Tétouan", "Safi", "Khouribga", "Settat", "Berrechid", "Larache",
    "Khemisset", "Ifrane", "Errachidia", "Ouarzazate", "Essaouira", "Taroudant",
    "Tiznit", "Guelmim", "Laâyoune", "Dakhla",
  ];
  for (const name of required) {
    assert.ok(resolveCity(name), `${name} must resolve`);
    assert.equal(rules.city(name), "", `${name} must validate`);
  }
});

test("CITY · Arabic, Latin, accents, case and spacing all reach one city", () => {
  const casa = "الدار البيضاء";
  for (const spelling of ["الدار البيضاء", "Casablanca", "casablanca", "CASABLANCA", "  Casa  ", "casa", "كازابلانكا"]) {
    assert.equal(resolveCity(spelling), casa, `${spelling} → ${casa}`);
  }
  assert.equal(resolveCity("Laayoune"), resolveCity("Laâyoune"), "accents fold");
  assert.equal(resolveCity("Fes"), resolveCity("Fès"));
  assert.equal(resolveCity("Sale"), resolveCity("Salé"));
  assert.equal(resolveCity("M'diq"), resolveCity("Mdiq"), "apostrophes fold");
  assert.equal(resolveCity("أكادير"), resolveCity("Agadir"), "Arabic and Latin agree");
});

test("CITY · the customer's display name is preserved as the canonical Arabic", () => {
  assert.equal(resolveCity("Agadir"), "أكادير");
  assert.equal(resolveCity("tanger"), "طنجة");
  assert.ok(cities.includes(resolveCity("Dakhla")));
});

test("CITY · anything not a Moroccan locality is refused", () => {
  const bad = ["", "   ", "aaaa", "test", "Paris", "London", "Madrid", "12345", "asdkjh", "مدينة", "xyz", "Casablanca2"];
  for (const city of bad) {
    assert.equal(okCity(city), false, `${city} must be refused`);
    assert.equal(resolveCity(city), null, `${city} must not resolve`);
  }
  assert.match(rules.city("Paris"), /اختار مدينة صحيحة/);
});

test("CITY · a prefix is not a match, so no parcel is routed by a guess", () => {
  // "Ben" could be Ben Ahmed or Ben Guerir. Resolving it would pick whichever
  // came first in the list and ship to the wrong province.
  assert.equal(resolveCity("Ben"), null);
  assert.equal(resolveCity("Sidi"), null);
  assert.equal(resolveCity("ال"), null);
  // The full names still work.
  assert.ok(resolveCity("Ben Ahmed"));
  assert.ok(resolveCity("Ben Guerir"));
});

/* ══ THE WHOLE FORM ═══════════════════════════════════════════════════════ */

/** What a page's `validate()` does across its three fields. */
const formPasses = (name, phone, city) =>
  rules.fullname(name) === "" && rules.phone(phone) === "" && rules.city(city) === "";

test("FORM · a complete, valid order is allowed through", () => {
  assert.equal(formPasses("سعاد بنعلي", "0658552431", "الدار البيضاء"), true);
  assert.equal(formPasses("Hassan Bounit", "+212758552431", "Agadir"), true);
});

test("FORM · one bad field is enough to block the whole submission", () => {
  assert.equal(formPasses("سعاد بنعلي", "0606060606", "الدار البيضاء"), false, "bad phone");
  assert.equal(formPasses("سعاد بنعلي", "0658552431", "Paris"), false, "bad city");
  assert.equal(formPasses("Cvslm", "0658552431", "الدار البيضاء"), false, "bad name");
  assert.equal(formPasses("", "", ""), false, "empty");
});

/* ══ A PAGE THAT OWNS ITS CITY FIELD ══════════════════════════════════════
   Genouillère ships `list="cities"` and its own datalist, on purpose: a closed
   list cannot hold every douar, and a customer who cannot find their town does
   not order. The shared file has to recognise that and keep its hands off the
   field — while still lending the page its name and phone rules. */

/** A city input, with whatever attributes a page might have put on it. */
const cityInput = (attrs = {}) => ({
  getAttribute: (k) => attrs[k] ?? null,
  hasAttribute: (k) => Object.prototype.hasOwnProperty.call(attrs, k),
  setAttribute: (k, v) => { attrs[k] = v; },
  addEventListener() {},
});

test("OPEN CITY · opting out is declared, never inferred", async (t) => {
  const { isOpenCityField } = api;

  await t.test("`data-city-open` opts the field out", () => {
    assert.equal(isOpenCityField(cityInput({ "data-city-open": "", list: "cities" })), true);
    assert.equal(isOpenCityField(cityInput({ "data-city-open": "" })), true);
  });

  await t.test("a plain field is ours to enhance", () => {
    assert.equal(isOpenCityField(cityInput()), false);
  });

  await t.test("a page's own `list` is NOT on its own an opt-out", () => {
    // This is the regression that made the rule explicit: weight-gain and
    // anti-joint-pain both ship a sixteen-entry `list="cities"` that the shared
    // 142-city list is MEANT to replace. Reading that as a decision silently
    // dropped both pages from the closed list and from canonicalisation.
    assert.equal(isOpenCityField(cityInput({ list: "cities" })), false);
    assert.equal(isOpenCityField(cityInput({ list: "nk-city-list" })), false);
  });

  await t.test("it never throws, whatever it is handed", () => {
    for (const bad of [null, undefined, {}, { hasAttribute: () => { throw new Error("x"); } }]) {
      assert.equal(isOpenCityField(bad), false);
    }
  });
});

/* ══ GENOUILLÈRE ══════════════════════════════════════════════════════════
   Name and phone are shared; the city rule is the page's own. Asserted here
   against the shared rules the page actually calls. */

test("GENOUILLERE · phone now matches the other five pages", () => {
  assert.equal(rules.phone("0658552431"), "", "06 accepted");
  assert.equal(rules.phone("0758552431"), "", "07 accepted");
  assert.equal(rules.phone("+212658552431"), "", "+212 normalised");
  assert.equal(rules.phone("00212758552431"), "", "00212 normalised");
  assert.equal(rules.phone("212658552431"), "", "212 normalised");
  assert.notEqual(rules.phone("0522334455"), "", "05 rejected");
  assert.notEqual(rules.phone("0606060606"), "", "fake rejected");
  assert.notEqual(rules.phone("0600000000"), "", "fake rejected");
  assert.notEqual(rules.phone("0612345678"), "", "sequence rejected");
});

test("GENOUILLERE · names use the shared rule", () => {
  assert.equal(rules.fullname("سعاد بنعلي"), "", "Arabic accepted");
  assert.equal(rules.fullname("Hassan Bounit"), "", "Latin accepted");
  assert.equal(rules.fullname("Marie-Claire"), "", "French accepted");
  assert.notEqual(rules.fullname("Cvslm"), "", "garbage rejected");
  assert.notEqual(rules.fullname("aaaa"), "", "repetition rejected");
});

test("GENOUILLERE · its cities are NOT forced through the 142-list", () => {
  // The page's own rule: non-empty, at least two characters. Nothing else.
  const pageCityRule = (v) => {
    if (!v) return "المرجو كتابة المدينة.";
    if (v.length < 2) return "المرجو كتابة اسم المدينة كاملاً.";
    return "";
  };

  for (const city of ["الدار البيضاء", "دوار أولاد بوعبيد", "تيفنوت", "Ait Ourir Centre"]) {
    assert.equal(pageCityRule(city), "", `${city} must be accepted by the page rule`);
  }

  // Three of those four are refused by the shared closed list — which is
  // exactly why this page does not use it.
  assert.equal(rules.city("الدار البيضاء"), "", "the shared list happens to know this one");
  for (const city of ["دوار أولاد بوعبيد", "تيفنوت", "Ait Ourir Centre"]) {
    assert.notEqual(rules.city(city), "", `${city} is refused by the shared list, hence the opt-out`);
  }
});

test("FORM · the exact rows from the order log would all have been stopped", () => {
  // Every one of these reached the order system before this layer existed.
  assert.equal(formPasses("Cvslm", "0606060606", ""), false);
  assert.equal(formPasses("سعاد", "0606060606", "الدار البيضاء"), false);
  assert.equal(formPasses("سعاد بنعلي", "0658552431", ""), false, "the empty city — 11 of 14 orders");
});
