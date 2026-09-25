/**
 * Domains: the price rule (never under 27.90, always ending .90, repriced up
 * at renewal) and a domain sold on its own (src/lib/domainOrders.ts), with
 * Vercel and Stripe both faked so nothing real is bought or charged.
 *
 *   node --import ./tests/register.mjs --test tests/domain-orders.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const S = await import("../src/lib/domainSales.ts");
const O = await import("../src/lib/domainOrders.ts");
const E = await import("../src/lib/email.ts");

const needed = (r) => (r + S.DOMAIN_TARGET_PROFIT_USD + S.STRIPE_FIXED_USD) / (1 - S.STRIPE_RATE);

test("a .com at Vercel's price sells at the 27.90 floor, not 26", () => {
  assert.equal(S.retailYearlyUsd(11.25), 27.9);
  assert.equal(S.retailYearlyUsd(0), 27.9);
});

test("every price ends in .90, covers the profit rule, and never jumps a whole dollar past it", () => {
  for (let r = 5; r <= 60; r += 0.37) {
    const p = S.retailYearlyUsd(r);
    assert.equal(Math.round(p * 100) % 100, 90, `${r} -> ${p}`);
    assert.ok(p + 1e-9 >= needed(r), `${r} -> ${p} is under the ${needed(r)} the rule needs`);
    assert.ok(p === 27.9 || p - needed(r) < 1 + 1e-9, `${r} -> ${p} overshoots`);
    assert.ok(S.netProfitUsd(p, r) >= S.DOMAIN_TARGET_PROFIT_USD - 0.01, `${r} -> keeps ${S.netProfitUsd(p, r)}`);
    assert.equal(Number.isInteger(Math.round(p * 100)), true);
  }
  assert.equal(S.retailYearlyUsd(20), 35.9, "35.05 needed -> 35.90");
});

test("a renewal never costs less than last year, and follows Vercel up", () => {
  assert.equal(S.renewalRetailUsd(27.9, 11.25), 27.9, "Vercel unchanged: same price");
  assert.equal(S.renewalRetailUsd(27.9, 9), 27.9, "Vercel cheaper: still last year's price");
  assert.equal(S.renewalRetailUsd(27.9, 20), 35.9, "Vercel up: the price rises to keep the profit");
  assert.equal(S.renewalRetailUsd(27.9, null), 27.9, "Vercel unreachable: no guessing upward");
  assert.equal(S.renewalRetailUsd(0, 11.25), 27.9, "a record with no price falls back to the floor");
});

test("the record survives Stripe metadata, and an empty field clears a stale one", () => {
  const rec = { domain: "ithardigital.com", status: "bought", retailUsd: 27.9, lang: "en", name: "Ithar", project: "ithar-digital", orderId: "ord_1", boughtAt: "2026-09-24", renewsOn: "2027-09-24" };
  const meta = O.orderRecordMetadata(rec);
  assert.equal(meta.servolia_domain_note, "", "absent = '' so Stripe deletes the old key");
  assert.deepEqual(O.readOrderRecord(meta), rec);
  assert.equal(O.readOrderRecord({}), null);
  assert.equal(O.readOrderRecord({ servolia_domain: "not a domain" }), null);
});

test("renewal dates: a rise is announced 30 days out, once; the charge is 7 days out", () => {
  const rec = { domain: "a.com", status: "bought", retailUsd: 27.9, lang: "en", renewsOn: "2027-09-24" };
  assert.equal(O.daysBefore("2027-09-24", 30), "2027-08-25");
  assert.deepEqual(O.renewalStep(rec, "2027-08-25", 11.25), { kind: "wait" }, "no rise, no notice");
  assert.deepEqual(O.renewalStep(rec, "2027-08-25", 20), { kind: "notice", price: 35.9 });
  assert.deepEqual(O.renewalStep(rec, "2027-08-24", 20), { kind: "wait" }, "31 days out is too early");
  assert.deepEqual(O.renewalStep({ ...rec, noticedFor: "2027-09-24" }, "2027-08-30", 20), { kind: "wait" }, "noticed once");
  assert.deepEqual(O.renewalStep(rec, "2027-09-17", 11.25), { kind: "charge", price: 27.9 });
  assert.deepEqual(O.renewalStep({ ...rec, status: "stopped" }, "2027-09-20", 11.25), { kind: "wait" }, "stopped at the client's request");
  assert.deepEqual(O.renewalStep({ ...rec, status: "failed" }, "2027-09-20", 11.25), { kind: "wait" });
  assert.equal(O.nextYear("2026-09-24"), "2027-09-24");
  assert.equal(O.daysBefore("2027-09-24", 7), "2027-09-17");
});

/* ── Vercel and Stripe, faked ─────────────────────────────────────────── */

const CONTACT = { firstName: "A", lastName: "B", email: "ops@servolia.com", phone: "+212600000000", address1: "1 St", city: "Tangier", state: "TA", zip: "90000", country: "MA" };
function fakeVercel({ available = true, purchase = 11.25, renewal = 11.25, buy = { ok: true } } = {}) {
  process.env.VERCEL_TOKEN = "t"; process.env.VERCEL_TEAM_ID = "team_x";
  process.env.DOMAIN_CONTACT_JSON = JSON.stringify(CONTACT);
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method ?? "GET" });
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/price")) return json(200, { years: 1, purchasePrice: purchase, renewalPrice: renewal });
    if (u.includes("/availability")) return json(200, { available });
    if (u.includes("/buy")) return buy.ok ? json(200, { orderId: "ord_42" }) : json(400, { error: { code: "nope", message: "refused" } });
    if (u.includes("/domains")) return json(200, {});
    return json(404, {});
  };
  return calls;
}

function fakeStripe({ metadata = {}, invoices = [], payFails = false } = {}) {
  const log = { sessions: [], customerUpdates: [], invoicesCreated: [], items: [], paid: [] };
  const customer = { id: "cus_1", email: "ithar@example.com", metadata: { ...metadata } };
  return {
    log, customer,
    checkout: { sessions: { create: async (p) => { log.sessions.push(p); return { url: "https://checkout.stripe.com/c/pay/cs_live_x" }; } } },
    customers: {
      retrieve: async () => customer,
      update: async (id, p) => { log.customerUpdates.push(p); for (const [k, v] of Object.entries(p.metadata ?? {})) { if (v === "") delete customer.metadata[k]; else customer.metadata[k] = v; } return customer; },
      search: async () => ({ data: [customer], has_more: false }),
    },
    paymentIntents: { retrieve: async () => ({ payment_method: "pm_card" }) },
    invoices: {
      list: async () => ({ data: invoices }),
      create: async (p) => { const inv = { id: `in_${log.invoicesCreated.length + 1}`, status: "draft", metadata: p.metadata }; log.invoicesCreated.push(p); return inv; },
      finalizeInvoice: async (id) => ({ id, status: "open" }),
      pay: async (id) => { if (payFails) throw new Error("card_declined"); log.paid.push(id); return { id, status: "paid", amount_paid: 3590 }; },
    },
    invoiceItems: { create: async (p) => { log.items.push(p); return {}; } },
  };
}

test("the link: priced by the server at 27.90, card saved for next year, one customer per order", async () => {
  fakeVercel();
  const stripe = fakeStripe();
  const res = await O.createDomainOrderLink(stripe, { domain: "https://www.ItharDigital.com/", email: "ithar@example.com", name: "Ithar", project: "ithar-digital", lang: "en", origin: "https://servolia.com" });
  assert.equal(res.ok, true);
  assert.equal(res.yearlyUsd, 27.9);
  const p = stripe.log.sessions[0];
  assert.equal(p.line_items[0].price_data.unit_amount, 2790, "whole cents: 27.9 * 100 is 2789.999... in floating point");
  assert.equal(p.customer_creation, "always");
  assert.equal(p.payment_intent_data.setup_future_usage, "off_session", "without it next year's renewal has no card");
  assert.equal(p.metadata.kind, O.DOMAIN_ORDER_KIND);
  assert.equal(p.metadata.domain, "ithardigital.com");
  assert.equal(p.metadata.project, "ithar-digital");
  assert.ok(p.expires_at * 1000 - Date.now() < 24 * 3600 * 1000, "Stripe refuses more than 24 hours");
});

test("the link is refused for a taken name, a .fr, and a bad email — never a link to something we cannot sell", async () => {
  fakeVercel({ available: false });
  assert.equal((await O.createDomainOrderLink(fakeStripe(), { domain: "taken.com", email: "a@b.co", lang: "en", origin: "x" })).ok, false);
  fakeVercel();
  assert.equal((await O.createDomainOrderLink(fakeStripe(), { domain: "x.com", email: "nope", lang: "en", origin: "x" })).ok, false);
  delete process.env.DOMAIN_CONTACT_JSON;
  assert.equal((await O.createDomainOrderLink(fakeStripe(), { domain: "x.com", email: "a@b.co", lang: "en", origin: "x" })).ok, false, "no registrant contact = no purchase possible = no link");
});

const SESSION = {
  id: "cs_live_1", customer: "cus_1", payment_intent: "pi_1", customer_details: { email: "ithar@example.com" },
  metadata: { kind: "domain_order", domain: "ithardigital.com", domain_retail_usd: "27.9", lang: "en", name: "Ithar", project: "ithar-digital" },
};

test("paid: bought, attached to the project, card made the default, dated a year out", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe();
  const r = await O.fulfilDomainOrder(stripe, SESSION, false);
  assert.equal(r.record.status, "bought");
  assert.equal(r.record.orderId, "ord_42");
  assert.equal(r.attach, "done");
  assert.equal(r.cardSaved, true);
  assert.equal(r.record.renewsOn, O.nextYear(new Date().toISOString().slice(0, 10)));
  assert.ok(calls.some((c) => c.url.includes("/v10/projects/ithar-digital/domains") && c.method === "POST"));
  assert.equal(stripe.log.customerUpdates[0].invoice_settings.default_payment_method, "pm_card");

  // Stripe delivers again: found, nothing bought twice.
  const before = calls.filter((c) => c.url.includes("/buy")).length;
  const again = await O.fulfilDomainOrder(stripe, SESSION, false);
  assert.equal(again.duplicate, true);
  assert.equal(calls.filter((c) => c.url.includes("/buy")).length, before);
});

test("a test purchase never reaches the registrar; a refusal is recorded, not lost", async () => {
  const calls = fakeVercel();
  const t = await O.fulfilDomainOrder(fakeStripe(), SESSION, true);
  assert.equal(t.record.status, "failed");
  assert.match(t.record.note, /TEST/);
  assert.equal(calls.some((c) => c.url.includes("/buy")), false);

  fakeVercel({ buy: { ok: false } });
  const f = await O.fulfilDomainOrder(fakeStripe(), SESSION, false);
  assert.equal(f.record.status, "failed");
  assert.equal(f.attach, "none", "nothing to attach when nothing was bought");
});

test("renewal: charged once at the repriced figure; a second run finds the paid invoice", async () => {
  fakeVercel({ renewal: 20 });
  const meta = O.orderRecordMetadata({ domain: "ithardigital.com", status: "bought", retailUsd: 27.9, lang: "en", renewsOn: "2027-09-24" });
  const stripe = fakeStripe({ metadata: meta });
  const [r] = await O.runDomainOrderRenewals(stripe, "2027-09-18");
  assert.equal(r.step, "charged");
  assert.equal(stripe.log.items[0].amount, 3590, "Vercel rose to 20 -> 35.90");
  assert.equal(stripe.customer.metadata.servolia_domain_renews, "2028-09-24");
  assert.equal(stripe.customer.metadata.servolia_domain_retail, "35.9");

  // The next day: the record already moved on, and a stale record would find
  // the paid invoice instead of making a second one.
  const stale = fakeStripe({ metadata: meta, invoices: [{ id: "in_9", status: "paid", amount_paid: 3590, metadata: { kind: "domain_order_renewal", renews_on: "2027-09-24" } }] });
  const [s] = await O.runDomainOrderRenewals(stale, "2027-09-19");
  assert.equal(s.step, "charged");
  assert.equal(stale.log.invoicesCreated.length, 0, "never a second invoice for the same year");
});

test("renewal: a declined card is reported and the date does not move", async () => {
  fakeVercel();
  const meta = O.orderRecordMetadata({ domain: "ithardigital.com", status: "bought", retailUsd: 27.9, lang: "en", renewsOn: "2027-09-24" });
  const stripe = fakeStripe({ metadata: meta, payFails: true });
  const [r] = await O.runDomainOrderRenewals(stripe, "2027-09-18");
  assert.equal(r.step, "charge-failed");
  assert.equal(stripe.customer.metadata.servolia_domain_renews, "2027-09-24");
});

test("the emails say the price with its cents, in both languages", () => {
  const en = E.domainOrderEmail({ domain: "ithardigital.com", amountUsd: 27.9, registered: true, renewsOnIso: "2027-09-24", name: "Ithar", lang: "en" });
  assert.match(en.subject, /ithardigital\.com is registered/);
  assert.match(en.html, /\$27\.90/);
  assert.match(en.html, /24 September 2027/);
  const fr = E.domainOrderEmail({ domain: "ithardigital.com", amountUsd: 27.9, registered: false, renewsOnIso: "2027-09-24", lang: "fr" });
  assert.match(fr.html, /27,90&nbsp;\$/);
  assert.match(fr.html, /remboursé/);
  const rise = E.domainRenewalEmail({ domain: "a.com", stage: "notice", priceUsd: 35.9, previousUsd: 27.9, onIso: "2027-09-24", lang: "en" });
  assert.match(rise.html, /\$35\.90/);
  assert.match(rise.html, /up from \$27\.90/);
  const flat = E.domainRenewalEmail({ domain: "a.com", stage: "charged", priceUsd: 27.9, previousUsd: 27.9, onIso: "2027-09-24", nextIso: "2028-09-24", lang: "en" });
  assert.doesNotMatch(flat.html, /up from/);
});
