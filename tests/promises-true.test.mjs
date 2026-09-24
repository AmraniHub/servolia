/**
 * Every promise a paying client reads is executed by code, or the words say
 * what actually happens.
 *
 * Found by a read-through on 2026-09-24: pages that showed one price while
 * Stripe charged another, add-ons nothing performs still for sale, a mailbox
 * count that differed between the product and the invoice line, a monitor that
 * did not exist. The pure parts run; the wiring is held by source guards so the
 * next edit cannot quietly reopen a hole.
 *
 *   node --import ./tests/register.mjs --test tests/promises-true.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const { CLIENT_PRODUCTS } = await import("../src/lib/hosting.ts");
const { ADDONS, addonForSale } = await import("../src/lib/pricing.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");

/* ── 1. multilingual search is a one-off, everywhere ───────────────────── */

test("the pay page is handed the one-off price, and shows it before any period price", () => {
  const page = src("src/components/ClientProductPage.tsx");
  assert.ok(/oneOffUsd=\{product\.oneOffUsd\}/.test(page), "ClientProductPage must pass oneOffUsd to ProductCheckout");

  const card = src("src/components/ProductCheckout.tsx");
  // Same order as hostingAmountCents: the one-off wins outright.
  assert.ok(/const amount = oneOff \? oneOffUsd : annual \? annualUsd : monthlyUsd;/.test(card),
    "the displayed amount must put the one-off first");
  assert.ok(/oneOff \? t\.payOnce\(amount\)/.test(card), "the pay button must say once for a one-off");
  assert.ok(/\{oneOff \? null : \(/.test(card), "no yearly/monthly toggle for a one-off");
});

test("the one-off wording exists in both languages", async () => {
  const card = src("src/components/ProductCheckout.tsx");
  for (const key of ["once:", "billedOnce:", "payOnce:", "nothingRecurring:"]) {
    assert.equal(card.split(key).length - 1, 2, `${key} must be defined in en AND fr`);
  }
  assert.equal(CLIENT_PRODUCTS.seo_multilingual.oneOffUsd, 145);
});

test("the thanks page tells a one-off buyer: paid once, five working days, no renewal", () => {
  const page = src("src/app/hosting/thanks/page.tsx");
  const entries = page.match(/seo_multilingual: \{[\s\S]*?\n  \},/g) ?? [];
  assert.equal(entries.length, 2, "seo_multilingual copy in COPY and COPY_FR");
  const [fr, en] = entries;
  assert.ok(/five working days/.test(en) && /nothing renews/.test(en), "EN: five working days, nothing renews");
  assert.ok(/cinq jours ouvrés/.test(fr) && /rien ne se renouvelle/.test(fr), "FR: cinq jours ouvrés, rien ne se renouvelle");
  // The footer's renewal line is not shown for a one-off.
  assert.ok(/\{isOneOff\s*\?\s*\(fr/.test(page), "the renewal footer branches on isOneOff");
  assert.ok(/const isSetup = setup === "1" && !isOneOff;/.test(page), "a one-off never shows the handover step");
});

test("a step whose link could not be minted points at the email, never at nothing", () => {
  const page = src("src/app/hosting/thanks/page.tsx");
  assert.ok(/isStep && !stepUrl \? noLinkNote : ""/.test(page));
  assert.ok(/confirmation email/.test(page) && /email de confirmation\./.test(page));
});

test("the checkout sends a one-off buyer to the thanks page without setup=1", () => {
  const route = src("src/app/api/hosting-checkout/route.ts");
  assert.ok(/: oneOff\s*\n\s*\? `\$\{origin\}\/hosting\/thanks\?product=\$\{hostingPlan\.key\}&lang=\$\{lang\}`/.test(route),
    "the one-off success_url must carry no setup/session flags");
});

/* ── 2. a retired add-on cannot be bought ──────────────────────────────── */

test("the add-on checkout sells only what is available", () => {
  for (const [key, a] of Object.entries(ADDONS)) {
    const sale = addonForSale(key);
    if (a.available === false) assert.deepEqual(sale, { error: "retired" }, `${key} is retired and must be refused`);
    else assert.equal(sale.addon, a, `${key} is for sale`);
  }
  assert.deepEqual(addonForSale("sms"), { error: "retired" });
  assert.deepEqual(addonForSale("reviews"), { error: "retired" });
  assert.deepEqual(addonForSale("constructor"), { error: "unknown" }, "not Object's constructor");
  assert.deepEqual(addonForSale(""), { error: "unknown" });
  assert.deepEqual(addonForSale(undefined), { error: "unknown" });
});

test("the add-on route asks addonForSale and answers a retired add-on with a 4xx", () => {
  const route = src("src/app/api/checkout-addon/route.ts");
  assert.ok(route.includes("addonForSale(addon)"), "the route must go through addonForSale");
  assert.ok(!/ADDONS\[/.test(route), "the route must not index ADDONS directly");
  assert.ok(/status: 410/.test(route), "a retired add-on gets a clear 4xx");
});

test("neither the portal assistant nor the city pages offer a retired add-on", () => {
  assert.ok(!/Object\.values\(ADDONS\)/.test(src("src/lib/portalAssistant.ts")), "the portal assistant lists SELLABLE_ADDONS");
  assert.ok(!/avis Google/i.test(src("src/lib/content/frGeo.ts").replace(/hook: "[^"]*"/g, "")),
    "no city-page answer says a plan includes Google reviews");
});
