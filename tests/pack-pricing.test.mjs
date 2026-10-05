// What a pack-priced product costs is decided in shared/catalog.js and nowhere
// else. A wrong number there undercharges or overcharges every order for that
// product, silently — the order row would just hold a plausible total. These
// are pure lookups, so they run with no database and no server.
//
// Run with `npm test`. Plain JS on purpose: it imports only shared/catalog.js,
// so there is no TypeScript loader and no test framework to keep in sync.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { packTotalFor, packQuantitiesFor, PACK_PRICING } from "../shared/catalog.js";

const SLUG = "bellevia-weight-gain";

describe("Bellevia pack pricing", () => {
  test("each pack is charged its own total, not the unit price times quantity", () => {
    assert.equal(packTotalFor(SLUG, 1), 19900); // 199.00 DH
    assert.equal(packTotalFor(SLUG, 2), 34900); // 349.00, not 2 × 199 = 398
    assert.equal(packTotalFor(SLUG, 3), 44900); // 449.00, not 3 × 199 = 597
  });

  test("the packs save what the landing page claims", () => {
    const unit = packTotalFor(SLUG, 1);
    assert.equal(unit * 2 - packTotalFor(SLUG, 2), 4900); // "وفري 49 درهم"
    assert.equal(unit * 3 - packTotalFor(SLUG, 3), 14800); // "وفري 148 درهم"
  });

  test("a quantity outside the ladder has no price, so the order is refused", () => {
    // undefined, not null: the product *is* pack-priced, this size is not sold.
    // Falling back to unit × quantity here would charge 4 × 199 to someone who
    // was only ever shown 1, 2 and 3.
    assert.equal(packTotalFor(SLUG, 4), undefined);
    assert.equal(packTotalFor(SLUG, 0), undefined);
    assert.equal(packTotalFor(SLUG, 10), undefined);
  });

  test("a product with no pack pricing is left alone", () => {
    // null means "not pack-priced" — the caller keeps unit × quantity, which is
    // what protects every other product in the catalog from this table.
    assert.equal(packTotalFor("cache-terazo", 2), null);
    assert.equal(packTotalFor("lilya-talon", 3), null);
    assert.equal(packQuantitiesFor("cache-terazo"), null);
  });

  test("the offered quantities are reported for the error response", () => {
    assert.deepEqual(packQuantitiesFor(SLUG), [1, 2, 3]);
  });

  test("exactly three products are pack-priced", () => {
    // A guard on the blast radius: adding a slug here changes what it charges,
    // so a new entry should be a deliberate edit to this test too.
    assert.deepEqual(Object.keys(PACK_PRICING).sort(), [
      "bellevia-genouillere",
      "bellevia-pack-bila-alam",
      "bellevia-weight-gain",
    ]);
  });

  test("every price is a whole number of centimes", () => {
    // Prices are integers by convention across the codebase; a float here would
    // produce fractional dirhams on the order row.
    for (const [slug, tiers] of Object.entries(PACK_PRICING)) {
      for (const [qty, total] of Object.entries(tiers)) {
        assert.ok(Number.isInteger(total), `${slug} qty ${qty} is not an integer`);
        assert.ok(total > 0, `${slug} qty ${qty} is not positive`);
      }
    }
  });
});

/* The knee brace: 1 for 180, 2 for 300.
 *
 * Its landing page shows those two and nothing else, and it sends only a
 * quantity — the server reads the total here. So this table and
 * `bellevia-genouillere/config.js` are two copies of one fact, and these tests
 * are what stops them drifting: a page quoting 300 against a table charging
 * 360 is a customer shown one number and billed another. */
describe("Genouillere pack pricing", () => {
  const KNEE = "bellevia-genouillere";

  test("the pair is charged 300, not twice 180", () => {
    assert.equal(packTotalFor(KNEE, 1), 18000); // 180.00 DH
    assert.equal(packTotalFor(KNEE, 2), 30000); // 300.00, not 2 × 180 = 360
  });

  test("the pair saves the 60 DH the page claims", () => {
    const unit = packTotalFor(KNEE, 1);
    assert.equal(unit * 2 - packTotalFor(KNEE, 2), 6000); // «وفر 60 درهم»
  });

  test("it is sold in ONE and TWO only", () => {
    assert.deepEqual(packQuantitiesFor(KNEE), [1, 2]);
    // undefined, not null: the product IS pack-priced, these sizes are not
    // sold. The order form offers exactly two options for this reason — a
    // stepper reaching 3 would only ever build a rejected order.
    assert.equal(packTotalFor(KNEE, 3), undefined);
    assert.equal(packTotalFor(KNEE, 0), undefined);
  });

  test("adding the row did not disturb the other pack-priced product", () => {
    assert.equal(packTotalFor("bellevia-weight-gain", 2), 34900);
    assert.equal(packTotalFor("bellevia-pack-raha", 2), null);
  });
});

/* باك بلا ألم: 1 for 329, 2 for 549.
 *
 * Same contract as the brace: the page sends a quantity, the server reads the
 * total here, and `bellevia-pack-bila-alam/config.js` quotes the same two
 * numbers. These tests keep the two copies honest. */
describe("Pack bila alam pricing", () => {
  const SLUG = "bellevia-pack-bila-alam";

  test("two packs are charged 549, not twice 329", () => {
    assert.equal(packTotalFor(SLUG, 1), 32900); // 329.00 DH
    assert.equal(packTotalFor(SLUG, 2), 54900); // 549.00, not 2 × 329 = 658
  });

  test("the pair saves the 109 DH the page claims", () => {
    const unit = packTotalFor(SLUG, 1);
    assert.equal(unit * 2 - packTotalFor(SLUG, 2), 10900); // «وفّر 109 درهم»
  });

  test("it is sold in ONE and TWO only", () => {
    assert.deepEqual(packQuantitiesFor(SLUG), [1, 2]);
    assert.equal(packTotalFor(SLUG, 3), undefined);
    assert.equal(packTotalFor(SLUG, 0), undefined);
  });

  test("the page config quotes exactly what the server charges", async () => {
    // config.js is a browser script that assigns window.BELLEVIA_CONFIG, so it
    // is evaluated against a stand-in window rather than imported.
    const { readFile } = await import("node:fs/promises");
    const { runInNewContext } = await import("node:vm");
    const src = await readFile(new URL("../bellevia-pack-bila-alam/config.js", import.meta.url), "utf8");
    const win = {};
    runInNewContext(src, { window: win });
    const offers = win.BELLEVIA_CONFIG.offers;
    // Array.from: the vm context has its own Array, which deepEqual tells apart.
    assert.deepEqual(Array.from(offers, (o) => o.qty), packQuantitiesFor(SLUG));
    for (const o of offers) assert.equal(Number(o.price) * 100, packTotalFor(SLUG, o.qty));
  });
});
