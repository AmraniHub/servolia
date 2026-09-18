import test from "node:test";
import assert from "node:assert/strict";

import {
  CLIENT_PRODUCTS,
  HOSTING_TIERS,
  hostingAmountCents,
  isAddOn,
  resolveHostingPlan,
} from "../src/lib/hosting.ts";

/**
 * A ONE-OFF MUST NEVER BE CHARGEABLE AS A SUBSCRIPTION.
 *
 * Multilingual search is sold once, for $145. Every other product in this file
 * is recurring, so the recurring shape is the default everywhere — which means
 * the one-off is the case that breaks quietly. It breaks as a real charge on a
 * real card, not as a failing build, so it is worth pinning here.
 */

test("a one-off costs the same whichever period the page was showing", () => {
  const seo = CLIENT_PRODUCTS.seo_multilingual;
  assert.equal(seo.oneOffUsd, 145);
  assert.equal(hostingAmountCents(seo, "monthly"), 14_500);
  assert.equal(hostingAmountCents(seo, "annual"), 14_500);
});

test("a recurring product still prices per period", () => {
  const hosting = CLIENT_PRODUCTS.hosting;
  assert.equal(hostingAmountCents(hosting, "monthly"), Math.round(hosting.monthlyUsd * 100));
  assert.equal(hostingAmountCents(hosting, "annual"), Math.round(hosting.annualUsd * 100));
  assert.notEqual(hostingAmountCents(hosting, "monthly"), hostingAmountCents(hosting, "annual"));
});

test("every one-off product is an add-on, never a hosting tier", () => {
  /* The admin hosting-checkout route is hardcoded to `mode: "subscription"`.
     It refuses add-ons, so this is what keeps a one-off away from that route:
     if a one-off ever became a tier, the guard would stop covering it and the
     client would be billed $145 every month. */
  for (const [key, product] of Object.entries(CLIENT_PRODUCTS)) {
    if (!product.oneOffUsd) continue;
    assert.ok(isAddOn(key), `${key} is a one-off but not an add-on`);
    assert.ok(!HOSTING_TIERS.includes(key), `${key} is a one-off sold as a hosting tier`);
  }
});

test("no hosting tier is a one-off", () => {
  for (const key of HOSTING_TIERS) {
    const plan = resolveHostingPlan(key);
    assert.ok(plan, `${key} does not resolve`);
    assert.equal(plan.oneOffUsd, undefined, `${key} is a tier priced as a one-off`);
  }
});

test("only a hosting tier carries a setup fee", () => {
  /* The checkout route appends a one-time line for any plan with setupUsd, and
     that line reads "Mailbox setup — one time". It belongs to the Business
     tier, which comes with mailboxes. seo_multilingual kept a setupUsd of 345
     from an older quote, which put a $345 mailbox charge on its $145 one-off:
     a $490 Stripe page selling mailboxes to someone buying SEO. The route is
     gated on HOSTING_TIERS now; this stops the data drifting back. */
  for (const [key, product] of Object.entries(CLIENT_PRODUCTS)) {
    if (product.setupUsd === undefined) continue;
    assert.ok(
      HOSTING_TIERS.includes(key),
      `${key} carries setupUsd ${product.setupUsd} but is not a hosting tier`,
    );
  }
});

test("a one-off carries no setup fee at all", () => {
  for (const [key, product] of Object.entries(CLIENT_PRODUCTS)) {
    if (!product.oneOffUsd) continue;
    assert.equal(
      product.setupUsd,
      undefined,
      `${key} is charged once but also carries a separate setup fee`,
    );
  }
});

test("a one-off never promises recurring work", () => {
  /* A bullet reading "checked every month" under a price charged once is a
     commitment with no revenue behind it, and the client is right to hold us
     to it. Caught on seo_multilingual the day its price became one-time: the
     price field changed and the sales copy did not. */
  const recurringWords = [
    /every month/i,
    /each month/i,
    /monthly/i,
    /chaque mois/i,
    /mensuel/i,
    /par mois/i,
  ];
  for (const [key, product] of Object.entries(CLIENT_PRODUCTS)) {
    if (!product.oneOffUsd) continue;
    const sold = [
      ...product.includes,
      product.description,
      ...product.fr.includes,
      product.fr.description,
    ];
    for (const line of sold) {
      for (const word of recurringWords) {
        assert.ok(!word.test(line), `${key} is a one-off but its copy says: ${line}`);
      }
    }
  }
});

test("every explain key is a bullet that actually exists somewhere", () => {
  /* The explanations are keyed on the bullet TEXT, so editing a bullet without
     editing its key silently drops the explanation off the page — no error,
     the paragraph just stops rendering.
     Checked against every product rather than the one product, because the
     hosting tiers deliberately share one HOSTING_EXPLAIN map that is a
     superset: hosting_lite has no "Domain renewal and DNS managed" bullet
     while the two tiers above it do. */
  const bullets = { en: new Set(), fr: new Set() };
  for (const product of Object.values(CLIENT_PRODUCTS)) {
    for (const line of product.includes) bullets.en.add(line);
    for (const line of product.fr.includes) bullets.fr.add(line);
  }
  for (const [key, product] of Object.entries(CLIENT_PRODUCTS)) {
    for (const [lang, block] of [["en", product], ["fr", product.fr]]) {
      for (const bulletKey of Object.keys(block.explain ?? {})) {
        assert.ok(
          bullets[lang].has(bulletKey),
          `${key}.${lang}: explain key matches no bullet anywhere: ${bulletKey}`,
        );
      }
    }
  }
});

test("resolveHostingPlan cannot be walked onto Object's prototype", () => {
  for (const evil of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.equal(resolveHostingPlan(evil), undefined, `${evil} resolved to a product`);
    assert.equal(isAddOn(evil), false, `${evil} read as a sellable add-on`);
  }
});
