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

  test("only Bellevia is pack-priced", () => {
    // A guard on the blast radius: adding a slug here changes what it charges,
    // so a new entry should be a deliberate edit to this test too.
    assert.deepEqual(Object.keys(PACK_PRICING), [SLUG]);
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
