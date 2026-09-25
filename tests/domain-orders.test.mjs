/**
 * Domains: the price rule (never under 27.90, always ending .90, repriced up
 * at renewal) and a domain sold on its own (src/lib/domainOrders.ts), with
 * Vercel and Stripe both faked so nothing real is bought or charged. Also the
 * purchase-confirmation email fixes that shipped with it (src/lib/email.ts).
 *
 *   node --import ./tests/register.mjs --test tests/domain-orders.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const S = await import("../src/lib/domainSales.ts");
const O = await import("../src/lib/domainOrders.ts");
const E = await import("../src/lib/email.ts");
const SO = await import("../src/lib/sameOrigin.ts");

const needed = (r) => (r + S.DOMAIN_TARGET_PROFIT_USD + S.STRIPE_FIXED_USD) / (1 - S.STRIPE_RATE);
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

/* ── 1. The price ─────────────────────────────────────────────────────── */

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
  // exactly on a .90: not pushed to the next one
  const r = 31.9 * 0.95 - 13.3;
  assert.equal(S.retailYearlyUsd(r), 31.9);
});

test("a renewal never costs less than last year, and follows Vercel up", () => {
  assert.equal(S.renewalRetailUsd(27.9, 11.25), 27.9, "Vercel unchanged: same price");
  assert.equal(S.renewalRetailUsd(27.9, 9), 27.9, "Vercel cheaper: still last year's price");
  assert.equal(S.renewalRetailUsd(27.9, 20), 35.9, "Vercel up: the price rises to keep the profit");
  assert.equal(S.renewalRetailUsd(27.9, null), 27.9, "Vercel unreachable: no guessing upward");
  assert.equal(S.renewalRetailUsd(0, 11.25), 27.9, "a record with no price falls back to the floor");
});

/* ── 2. The record ────────────────────────────────────────────────────── */

test("the record survives Stripe metadata, and an empty field clears a stale one", () => {
  const rec = { domain: "ithardigital.com", status: "bought", retailUsd: 27.9, lang: "en", name: "Ithar", project: "ithar-digital", attached: "ithar-digital", orderId: "ord_1", session: "cs_live_1", boughtAt: "2026-09-24", renewsOn: "2027-09-24", noticedFor: "2027-09-24", noticedUsd: 35.9 };
  const meta = O.orderRecordMetadata(rec);
  assert.equal(meta.servolia_domain_note, "", "absent = '' so Stripe deletes the old key");
  assert.equal(meta.servolia_domain_noticed_usd, "35.9");
  assert.deepEqual(O.readOrderRecord(meta), rec);
  assert.ok(Object.keys(meta).length <= 50, "Stripe allows 50 metadata keys");
  assert.equal(O.readOrderRecord({}), null);
  assert.equal(O.readOrderRecord({ servolia_domain: "not a domain" }), null);
  assert.equal(O.readOrderRecord({ servolia_domain: "a.com", servolia_domain_status: "weird" }).status, "failed", "unknown status is never charged");
  for (const s of ["claimed", "purchasing", "bought", "failed", "stopped"]) {
    assert.equal(O.readOrderRecord({ servolia_domain: "a.com", servolia_domain_status: s }).status, s);
  }
});

/* ── 3. Renewal dates and the notice promise ──────────────────────────── */

test("renewal dates: a rise is announced 30 days out, once; the charge is 7 days out", () => {
  const rec = { domain: "a.com", status: "bought", retailUsd: 27.9, lang: "en", renewsOn: "2027-09-24" };
  assert.equal(O.daysBefore("2027-09-24", 30), "2027-08-25");
  assert.deepEqual(O.renewalStep(rec, "2027-08-25", 11.25), { kind: "wait" }, "no rise, no notice");
  assert.deepEqual(O.renewalStep(rec, "2027-08-25", 20), { kind: "notice", price: 35.9 });
  assert.deepEqual(O.renewalStep(rec, "2027-08-24", 20), { kind: "wait" }, "31 days out is too early");
  assert.deepEqual(O.renewalStep({ ...rec, noticedFor: "2027-09-24", noticedUsd: 35.9 }, "2027-08-30", 20), { kind: "wait" }, "noticed once");
  assert.deepEqual(O.renewalStep(rec, "2027-09-17", 11.25), { kind: "charge", price: 27.9, wanted: 27.9 });
  assert.deepEqual(O.renewalStep({ ...rec, status: "stopped" }, "2027-09-20", 11.25), { kind: "wait" }, "stopped at the client's request");
  for (const status of ["failed", "claimed", "purchasing"]) {
    assert.deepEqual(O.renewalStep({ ...rec, status }, "2027-09-20", 11.25), { kind: "wait" }, status);
  }
  assert.equal(O.nextYear("2026-09-24"), "2027-09-24");
  assert.equal(O.nextYear("2028-02-29"), "2029-03-01", "a leap day renews on the 1st of March");
  assert.equal(O.chargeDateFor("2027-09-24"), "2027-09-17");
});

test("the charge never exceeds what the client was told: the noticed price, or last year's", () => {
  const rec = { domain: "a.com", status: "bought", retailUsd: 27.9, lang: "en", renewsOn: "2027-09-24" };
  // Noticed at 35.90, Vercel rose again since: still 35.90.
  assert.deepEqual(O.renewalStep({ ...rec, noticedFor: "2027-09-24", noticedUsd: 35.9 }, "2027-09-17", 25), { kind: "charge", price: 35.9, wanted: 40.9 });
  // Noticed at 35.90, Vercel came back down: the lower figure.
  assert.deepEqual(O.renewalStep({ ...rec, noticedFor: "2027-09-24", noticedUsd: 35.9 }, "2027-09-17", 11.25), { kind: "charge", price: 27.9, wanted: 27.9 });
  // No notice went out (rise appeared inside the window): last year's price.
  assert.deepEqual(O.renewalStep(rec, "2027-09-17", 20), { kind: "charge", price: 27.9, wanted: 35.9 });
  // A notice for LAST year's date does not authorise this year's rise.
  assert.deepEqual(O.renewalStep({ ...rec, noticedFor: "2026-09-24", noticedUsd: 35.9 }, "2027-09-17", 20), { kind: "charge", price: 27.9, wanted: 35.9 });
});

/* ── Vercel and Stripe, faked ─────────────────────────────────────────── */

const CONTACT = { firstName: "A", lastName: "B", email: "ops@servolia.com", phone: "+212600000000", address1: "1 St", city: "Tangier", state: "TA", zip: "90000", country: "MA" };
/** One timeline shared by both fakes, so ORDER can be asserted. */
let timeline = [];
function fakeVercel({ available = true, purchase = 11.25, renewal = 11.25, buy = { ok: true }, order = ["completed"], attachFails = false } = {}) {
  process.env.VERCEL_TOKEN = "t"; process.env.VERCEL_TEAM_ID = "team_x";
  process.env.DOMAIN_CONTACT_JSON = JSON.stringify(CONTACT);
  const calls = [];
  const states = [...order];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method ?? "GET" });
    timeline.push(`vercel ${init.method ?? "GET"} ${u.replace("https://api.vercel.com", "").split("?")[0]}`);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/price")) return json(200, { years: 1, purchasePrice: purchase, renewalPrice: renewal, transferPrice: renewal });
    if (u.includes("/availability")) return json(200, { available });
    if (u.includes("/buy")) return buy.ok ? json(200, { orderId: "ord_42", _links: {} }) : json(400, { error: { code: "nope", message: "refused" } });
    if (u.includes("/registrar/orders/")) {
      const st = states.length > 1 ? states.shift() : states[0];
      const line = st === "completed" ? "completed" : st === "failed" ? "failed" : "pending";
      return json(200, { orderId: "ord_42", status: st, domains: [{ purchaseType: "purchase", autoRenew: true, years: 1, domainName: "ithardigital.com", status: line, price: purchase, ...(st === "failed" ? { error: { code: "registry-error" } } : {}) }] });
    }
    if (u.includes("/domains")) return attachFails ? json(403, { error: { code: "forbidden", message: "You don't have access to the domain you are adding" } }) : json(200, {});
    return json(404, {});
  };
  return calls;
}

function fakeStripe({ metadata = {}, invoices = [], payFails = false, email = "ithar@example.com", customers = null } = {}) {
  const log = { sessions: [], customerUpdates: [], invoicesCreated: [], items: [], paid: [], finalized: [] };
  const customer = { id: "cus_1", email, metadata: { ...metadata } };
  const all = customers ?? [customer];
  const invById = new Map(invoices.map((i) => [i.id, { ...i }]));
  return {
    log, customer,
    checkout: { sessions: { create: async (p) => { log.sessions.push(p); return { url: "https://checkout.stripe.com/c/pay/cs_live_x" }; } } },
    customers: {
      retrieve: async () => customer,
      update: async (id, p) => {
        const c = all.find((x) => x.id === id) ?? customer;
        log.customerUpdates.push({ id, ...p });
        timeline.push(`stripe customer ${p.metadata?.servolia_domain_status ?? "?"}`);
        for (const [k, v] of Object.entries(p.metadata ?? {})) { if (v === "") delete c.metadata[k]; else c.metadata[k] = v; }
        return c;
      },
      search: async ({ query }) => {
        const want = /'([a-z]+)'$/.exec(query)[1];
        return { data: all.filter((c) => c.metadata.servolia_domain_status === want), has_more: false };
      },
    },
    paymentIntents: { retrieve: async () => ({ payment_method: "pm_card" }) },
    invoices: {
      list: async () => ({ data: [...invById.values()] }),
      create: async (p) => { const inv = { id: `in_${log.invoicesCreated.length + 1}`, status: "draft", total: 0, metadata: p.metadata }; log.invoicesCreated.push(p); invById.set(inv.id, inv); return inv; },
      finalizeInvoice: async (id) => { log.finalized.push(id); const inv = invById.get(id); inv.status = "open"; return { ...inv }; },
      pay: async (id) => {
        if (payFails) throw new Error("card_declined");
        const inv = invById.get(id);
        inv.status = "paid"; inv.amount_paid = inv.total;
        log.paid.push(id);
        return { ...inv };
      },
    },
    invoiceItems: { create: async (p) => { log.items.push(p); const inv = invById.get(p.invoice); if (inv) inv.total = (inv.total ?? 0) + p.amount; return {}; } },
  };
}

test("the $80 ceiling: a name whose price would go over it is not offered", async () => {
  fakeVercel({ purchase: 70, renewal: 70 });
  const q = await S.domainQuote("costly.com");
  assert.equal(q.sellable, false);
  assert.equal(q.reason, "too-expensive");
  assert.ok(q.yearlyUsd > S.DOMAIN_MAX_RETAIL_USD);
  fakeVercel({ purchase: 62, renewal: 62 });
  assert.equal(S.retailYearlyUsd(62), 79.9);
  assert.equal((await S.domainQuote("fine.com")).sellable, true, "79.90 is still offered");
});

/* ── 4. The link ──────────────────────────────────────────────────────── */

test("the link: priced by the server at 27.90, card saved for next year, one customer per order", async () => {
  fakeVercel();
  const stripe = fakeStripe();
  const res = await O.createDomainOrderLink(stripe, { domain: "https://www.ItharDigital.com/", email: " Ithar@Example.com ", name: "Ithar", project: "ithar-digital", lang: "en", origin: "https://servolia.com" });
  assert.equal(res.ok, true);
  assert.equal(res.yearlyUsd, 27.9);
  const p = stripe.log.sessions[0];
  assert.equal(p.line_items[0].price_data.unit_amount, 2790, "whole cents: 27.9 * 100 is 2789.999... in floating point");
  assert.equal(p.line_items[0].price_data.currency, "usd");
  assert.equal(p.customer_email, "ithar@example.com");
  assert.equal(p.customer_creation, "always");
  assert.equal(p.payment_intent_data.setup_future_usage, "off_session", "without it next year's renewal has no card");
  assert.equal(p.metadata.kind, O.DOMAIN_ORDER_KIND);
  assert.equal(p.metadata.domain, "ithardigital.com");
  assert.equal(p.metadata.domain_retail_usd, "27.9");
  assert.equal(p.metadata.project, "ithar-digital");
  assert.equal(p.cancel_url, "https://servolia.com/");
  assert.ok(p.expires_at * 1000 - Date.now() < 24 * 3600 * 1000, "Stripe refuses more than 24 hours");

  const fr = fakeStripe();
  await O.createDomainOrderLink(fr, { domain: "ithardigital.com", email: "a@b.co", lang: "fr", origin: "https://servolia.com" });
  assert.equal(fr.log.sessions[0].locale, "fr");
  assert.equal(fr.log.sessions[0].cancel_url, "https://servolia.com/fr");
  assert.match(fr.log.sessions[0].line_items[0].price_data.product_data.name, /^Domaine /);
});

test("the link is refused for a taken name, a bad email, a bad project, or no registrant — never a link to something we cannot sell", async () => {
  fakeVercel({ available: false });
  assert.equal((await O.createDomainOrderLink(fakeStripe(), { domain: "taken.com", email: "a@b.co", lang: "en", origin: "x" })).ok, false);
  fakeVercel();
  assert.equal((await O.createDomainOrderLink(fakeStripe(), { domain: "x.com", email: "nope", lang: "en", origin: "x" })).ok, false);
  assert.equal((await O.createDomainOrderLink(fakeStripe(), { domain: "x.com", email: "a@b.co", project: "../other", lang: "en", origin: "x" })).ok, false);
  delete process.env.DOMAIN_CONTACT_JSON;
  assert.equal((await O.createDomainOrderLink(fakeStripe(), { domain: "x.com", email: "a@b.co", lang: "en", origin: "x" })).ok, false, "no registrant contact = no purchase possible = no link");
});

/* ── 5. Paid: the webhook's purchase ──────────────────────────────────── */

const SESSION = {
  id: "cs_live_1", customer: "cus_1", payment_intent: "pi_1", customer_details: { email: "ithar@example.com" },
  currency: "usd", amount_total: 2790,
  metadata: { kind: "domain_order", domain: "ithardigital.com", domain_retail_usd: "27.9", lang: "en", name: "Ithar", project: "ithar-digital" },
};
const NOPOLL = { pollMs: [0, 0, 0] };
const buys = (calls) => calls.filter((c) => c.url.includes("/buy")).length;

test("paid: claimed BEFORE the registrar is called, bought, attached, card made the default, dated a year out", async () => {
  timeline = [];
  const calls = fakeVercel();
  const stripe = fakeStripe();
  const r = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(r.outcome, "done");
  assert.equal(r.record.status, "bought");
  assert.equal(r.record.orderId, "ord_42");
  assert.equal(r.record.session, "cs_live_1");
  assert.equal(r.record.attached, "ithar-digital");
  assert.equal(r.attach, "done");
  assert.equal(r.cardSaved, true);
  assert.equal(r.record.renewsOn, O.nextYear(new Date().toISOString().slice(0, 10)));
  const claim = timeline.indexOf("stripe customer claimed");
  const buy = timeline.findIndex((t) => t.includes("/buy"));
  assert.ok(claim >= 0 && buy > claim, `claim must precede the buy: ${timeline.join(" | ")}`);
  assert.ok(calls.some((c) => c.url.includes("/v10/projects/ithar-digital/domains") && c.method === "POST"));
  assert.equal(stripe.log.customerUpdates.at(-1).invoice_settings.default_payment_method, "pm_card");
  assert.deepEqual(O.describeDomainOrder(r).email, "registered");
  assert.match(O.describeDomainOrder(r).telegram, /REGISTERED.*\nAttached to Vercel project ithar-digital/);
});

test("a replayed checkout.session.completed never buys twice and says nothing twice", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe();
  await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  const before = buys(calls);
  const again = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(again.outcome, "duplicate");
  assert.equal(buys(calls), before);
  assert.deepEqual(O.describeDomainOrder(again), { telegram: null, email: null }, "no second email, no second alert");
});

test("a replay that finds only the CLAIM (the first run died mid-purchase) buys nothing and tells the owner, not the client", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata({ domain: "ithardigital.com", status: "claimed", retailUsd: 27.9, lang: "en", session: "cs_live_1" }) });
  const r = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(r.outcome, "interrupted");
  assert.equal(buys(calls), 0);
  assert.equal(stripe.log.customerUpdates.length, 0, "the claim is left for the owner to resolve");
  const say = O.describeDomainOrder(r);
  assert.equal(say.email, null);
  assert.match(say.telegram, /NOTHING was bought/);
});

test("a customer already holding another domain is never overwritten", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata({ domain: "other.com", status: "bought", retailUsd: 27.9, lang: "en" }) });
  const r = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(r.outcome, "conflict");
  assert.equal(buys(calls), 0);
  assert.equal(stripe.customer.metadata.servolia_domain, "other.com");
});

test("Vercel still 'purchasing': recorded as purchasing, not attached yet, client told it is being completed", async () => {
  const calls = fakeVercel({ order: ["purchasing"] });
  const stripe = fakeStripe();
  const r = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(r.record.status, "purchasing");
  assert.equal(r.record.orderId, "ord_42");
  assert.ok(r.record.renewsOn, "the order is placed: the year is dated");
  assert.equal(r.attach, "none");
  assert.equal(calls.some((c) => c.url.includes("/v10/projects/")), false, "no attach before the registry finishes");
  assert.equal(calls.filter((c) => c.url.includes("/registrar/orders/")).length, 3, "polled the three times it was given");
  assert.equal(O.describeDomainOrder(r).email, "processing");

  // A quarter of an hour later: the registry finished.
  fakeVercel({ order: ["completed"] });
  const [s] = await O.settlePurchasingOrders(stripe);
  assert.equal(s.step, "registered");
  assert.equal(s.attach, "done");
  assert.equal(stripe.customer.metadata.servolia_domain_status, "bought");
  assert.equal(stripe.customer.metadata.servolia_domain_attached, "ithar-digital");
  assert.deepEqual(await O.settlePurchasingOrders(stripe), [], "settled once");
});

test("Vercel's order FAILED: recorded failed, never renewed, the client told a refund or a hand finish", async () => {
  const calls = fakeVercel({ order: ["failed"] });
  const r = await O.fulfilDomainOrder(fakeStripe(), SESSION, false, NOPOLL);
  assert.equal(r.record.status, "failed");
  assert.match(r.record.note, /registry-error/);
  assert.equal(r.record.renewsOn, undefined);
  assert.equal(calls.some((c) => c.url.includes("/v10/projects/")), false);
  assert.equal(O.describeDomainOrder(r).email, "failed");

  // And the same, discovered by the cron.
  fakeVercel({ order: ["failed"] });
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata({ domain: "ithardigital.com", status: "purchasing", retailUsd: 27.9, lang: "en", orderId: "ord_42", renewsOn: "2027-09-24" }) });
  const [s] = await O.settlePurchasingOrders(stripe);
  assert.equal(s.step, "failed");
  assert.equal(stripe.customer.metadata.servolia_domain_status, "failed");
  assert.equal(stripe.customer.metadata.servolia_domain_renews, undefined, "a failed name is never renewed");
});

test("an order stuck in 'purchasing' is reported once, hours later, not every quarter hour", async () => {
  fakeVercel({ order: ["purchasing"] });
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata({ domain: "ithardigital.com", status: "purchasing", retailUsd: 27.9, lang: "en", orderId: "ord_42", boughtAt: "2026-09-24", renewsOn: "2027-09-24" }) });
  assert.deepEqual(await O.settlePurchasingOrders(stripe, new Date("2026-09-24T03:00:00Z")), [], "3 hours: still waiting");
  const [s] = await O.settlePurchasingOrders(stripe, new Date("2026-09-24T12:00:00Z"));
  assert.equal(s.step, "stuck");
  assert.deepEqual(await O.settlePurchasingOrders(stripe, new Date("2026-09-24T12:15:00Z")), [], "reported once");
  assert.equal(stripe.customer.metadata.servolia_domain_status, "purchasing", "still settled when it completes");
});

test("a founder TEST purchase never reaches the registrar; a refusal is recorded, not lost", async () => {
  const calls = fakeVercel();
  const t = await O.fulfilDomainOrder(fakeStripe(), SESSION, true, NOPOLL);
  assert.equal(t.record.status, "failed");
  assert.match(t.record.note, /TEST/);
  assert.equal(buys(calls), 0);
  assert.equal(calls.some((c) => c.url.includes("/v10/projects/")), false, "nothing attached either");

  fakeVercel({ buy: { ok: false } });
  const f = await O.fulfilDomainOrder(fakeStripe(), SESSION, false, NOPOLL);
  assert.equal(f.record.status, "failed");
  assert.equal(f.attach, "none", "nothing to attach when nothing was bought");
  assert.equal(O.describeDomainOrder(f).email, "failed");
});

test("money that does not cover the price buys nothing; Adaptive Pricing is read in USD", async () => {
  const calls = fakeVercel();
  const r = await O.fulfilDomainOrder(fakeStripe(), { ...SESSION, amount_total: 1000 }, false, NOPOLL);
  assert.equal(r.record.status, "failed");
  assert.match(r.record.note, /paid 10\.00 USD/);
  assert.equal(buys(calls), 0);

  assert.equal(O.paidUsdCents({ currency: "usd", amount_total: 2790 }), 2790);
  assert.equal(O.paidUsdCents({ currency: "eur", amount_total: 2600, currency_conversion: { source_currency: "usd", amount_total: 2790 } }), 2790);
  assert.equal(O.paidUsdCents({ currency: "eur", amount_total: 2600 }), null);
  const eur = await O.fulfilDomainOrder(fakeStripe(), { ...SESSION, currency: "eur", amount_total: 2600, currency_conversion: { source_currency: "usd", amount_total: 2790 } }, false, NOPOLL);
  assert.equal(eur.record.status, "bought", "a client paying in euros for a USD price is still bought");
});

test("attach refused: bought, owner told exactly where to add it", async () => {
  fakeVercel({ attachFails: true });
  const r = await O.fulfilDomainOrder(fakeStripe(), SESSION, false, NOPOLL);
  assert.equal(r.record.status, "bought");
  assert.equal(r.attach, "failed");
  assert.equal(r.record.attached, undefined);
  assert.match(O.describeDomainOrder(r).telegram, /NOT attached to ithar-digital \(forbidden: .*Vercel > ithar-digital > Domains/);
});

/* ── 6. A year later ──────────────────────────────────────────────────── */

const DUE = { domain: "ithardigital.com", status: "bought", retailUsd: 27.9, lang: "en", renewsOn: "2027-09-24" };

test("renewal: a rise is noticed at 30 days, then charged once at the noticed price; a second run finds the paid invoice", async () => {
  fakeVercel({ renewal: 20 });
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE) });
  const [n] = await O.runDomainOrderRenewals(stripe, "2027-08-25");
  assert.equal(n.step, "noticed");
  assert.equal(n.priceUsd, 35.9);
  assert.equal(n.chargeOn, "2027-09-17");
  assert.equal(stripe.customer.metadata.servolia_domain_noticed_usd, "35.9");
  assert.deepEqual(await O.runDomainOrderRenewals(stripe, "2027-08-26"), [], "announced once");

  const [r] = await O.runDomainOrderRenewals(stripe, "2027-09-18");
  assert.equal(r.step, "charged");
  assert.equal(stripe.log.items[0].amount, 3590, "Vercel rose to 20 -> 35.90, as announced");
  assert.equal(stripe.log.items[0].currency, "usd");
  assert.equal(stripe.customer.metadata.servolia_domain_renews, "2028-09-24");
  assert.equal(stripe.customer.metadata.servolia_domain_retail, "35.9");
  assert.equal(stripe.customer.metadata.servolia_domain_noticed, undefined, "next year's notice starts clean");

  // A stale record (the date write failed) finds the paid invoice instead of making a second one.
  const stale = fakeStripe({ metadata: O.orderRecordMetadata(DUE), invoices: [{ id: "in_9", status: "paid", total: 3590, amount_paid: 3590, metadata: { kind: "domain_order_renewal", renews_on: "2027-09-24" } }] });
  const [s] = await O.runDomainOrderRenewals(stale, "2027-09-19");
  assert.equal(s.step, "charged");
  assert.equal(s.priceUsd, 35.9);
  assert.equal(stale.log.invoicesCreated.length, 0, "never a second invoice for the same year");
  assert.equal(stale.log.items.length, 0);
});

test("renewal with no notice sent: charged at last year's price, and the owner sees what was held back", async () => {
  fakeVercel({ renewal: 20 });
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE) });
  const [r] = await O.runDomainOrderRenewals(stripe, "2027-09-18");
  assert.equal(r.step, "charged");
  assert.equal(stripe.log.items[0].amount, 2790);
  assert.equal(r.heldBackUsd, 35.9);
});

test("a draft invoice left EMPTY by a run that died gets its line — never finalised and 'paid' for 0", async () => {
  fakeVercel();
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE), invoices: [{ id: "in_7", status: "draft", total: 0, metadata: { kind: "domain_order_renewal", renews_on: "2027-09-24" } }] });
  const [r] = await O.runDomainOrderRenewals(stripe, "2027-09-18");
  assert.equal(r.step, "charged");
  assert.equal(stripe.log.invoicesCreated.length, 0, "the existing draft is reused");
  assert.equal(stripe.log.items.length, 1);
  assert.equal(stripe.log.items[0].invoice, "in_7");
  assert.equal(r.priceUsd, 27.9);

  const zero = fakeStripe({ metadata: O.orderRecordMetadata(DUE), invoices: [{ id: "in_8", status: "paid", total: 0, amount_paid: 0, metadata: { kind: "domain_order_renewal", renews_on: "2027-09-24" } }] });
  const [z] = await O.runDomainOrderRenewals(zero, "2027-09-18");
  assert.equal(z.step, "charge-failed", "a 0 payment is never a renewal");
  assert.equal(zero.customer.metadata.servolia_domain_renews, "2027-09-24");
});

test("renewal: a declined card is reported, the date does not move, and tomorrow retries the SAME invoice", async () => {
  fakeVercel();
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE), payFails: true });
  const [r] = await O.runDomainOrderRenewals(stripe, "2027-09-18");
  assert.equal(r.step, "charge-failed");
  assert.match(r.detail, /card_declined/);
  assert.equal(stripe.customer.metadata.servolia_domain_renews, "2027-09-24");
  const [again] = await O.runDomainOrderRenewals(stripe, "2027-09-19");
  assert.equal(again.step, "charge-failed");
  assert.equal(stripe.log.invoicesCreated.length, 1, "one invoice for the year, retried");
  assert.equal(stripe.log.items.length, 1, "one line on it");
});

/* ── 7. What the client reads ─────────────────────────────────────────── */

const orderMail = (o) => E.domainOrderEmail({ domain: "ithardigital.com", amountUsd: 27.9, renewsOnIso: "2027-09-24", chargeOnIso: "2027-09-17", name: "Ithar", lang: "en", ...o });

test("the order email: price with cents, renewal AND charge date, in both languages, per state", () => {
  const en = orderMail({ state: "registered" });
  assert.match(en.subject, /ithardigital\.com is registered/);
  assert.match(en.html, /\$27\.90/);
  assert.match(en.html, /24 September 2027/);
  assert.match(en.html, /charged on 17 September 2027/);
  assert.match(en.html, /reply to this email before 17 September 2027/);
  const fr = orderMail({ state: "registered", lang: "fr" });
  assert.match(fr.html, /27,90&nbsp;\$/);
  assert.match(fr.html, /prélevé le 17 septembre 2027/);

  const proc = orderMail({ state: "processing" });
  assert.match(proc.subject, /^Payment received/);
  assert.match(proc.html, /registry is completing/);
  assert.doesNotMatch(proc.html, /is registered for you/);

  const failed = orderMail({ state: "failed", lang: "fr" });
  assert.match(failed.html, /remboursé/);
  assert.doesNotMatch(failed.html, /Renouvellement/, "no renewal terms for a name that is not registered");
});

test("the renewal emails: the rise named only when there is one; the notice names the charge date", () => {
  const rise = E.domainRenewalEmail({ domain: "a.com", stage: "notice", priceUsd: 35.9, previousUsd: 27.9, onIso: "2027-09-24", chargeOnIso: "2027-09-17", lang: "en" });
  assert.match(rise.html, /\$35\.90/);
  assert.match(rise.html, /up from \$27\.90/);
  assert.match(rise.html, /charged to your card on 17 September 2027/);
  assert.match(rise.html, /before 17 September 2027/);
  const flat = E.domainRenewalEmail({ domain: "a.com", stage: "charged", priceUsd: 27.9, previousUsd: 27.9, onIso: "2027-09-24", nextIso: "2028-09-24", lang: "en" });
  assert.doesNotMatch(flat.html, /up from/);
  assert.match(flat.html, /24 September 2028/);
  const inv = E.domainRenewalEmail({ domain: "a.com", stage: "invoice", priceUsd: 27.9, previousUsd: 27.9, onIso: "2027-09-24", lang: "fr" });
  assert.match(inv.html, /prochaine facture/);
});

test("dates are the calendar date whatever the server's timezone", () => {
  const before = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.match(orderMail({ state: "registered" }).html, /24 September 2027/);
  } finally {
    if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  }
});

test("hosting/assistant confirmation: 'Nothing else to do' only when nothing else is to be done", () => {
  const base = { productName: "Website hosting", productNoun: "hosting", siteLabel: "example.com", amountUsd: 20, period: "monthly" };
  for (const lang of ["en", "fr"]) {
    const nothing = lang === "fr" ? /Rien d'autre à faire/ : /Nothing else to do/;
    assert.match(E.clientServicePaidEmail({ ...base, lang }).html, nothing, `${lang}: no step, the line stays`);
    const setup = E.clientServicePaidEmail({ ...base, lang, setupUrl: "https://servolia.com/hosting/setup?t=x" }).html;
    assert.doesNotMatch(setup, nothing, `${lang}: a Next step follows`);
    assert.match(setup, lang === "fr" ? /est actif\./ : /is active\./);
    assert.match(setup, lang === "fr" ? /Prochaine étape/ : /Next step/);
    const asst = { ...base, lang, productName: "AI assistant", productNoun: "AI assistant" };
    const notInstalled = E.clientServicePaidEmail({ ...asst, assistant: { installed: false, snippet: "<script></script>", briefUrl: "https://servolia.com/b" } }).html;
    assert.doesNotMatch(notInstalled, nothing, `${lang}: a Last step follows`);
    assert.match(notInstalled, lang === "fr" ? /Dernière étape/ : /Last step/);
    assert.match(E.clientServicePaidEmail({ ...asst, assistant: { installed: true, snippet: null, briefUrl: null } }).html, nothing, `${lang}: installed, nothing left`);
  }
});

test("the plain-text part never shows a raw &rarr;", () => {
  const html = E.clientServicePaidEmail({ productName: "Website hosting", productNoun: "hosting", siteLabel: "example.com", amountUsd: 20, period: "monthly", portalUrl: "https://servolia.com/hosting/account?t=x", upgradeUrl: "https://servolia.com/u", lang: "en" }).html;
  assert.match(html, /Open my page &rarr;/, "the HTML keeps its arrow");
  const text = E.stripHtml(html);
  assert.doesNotMatch(text, /&rarr;|&[a-z]+;/);
  assert.match(text, /Open my page: https:\/\/servolia\.com\/hosting\/account\?t=x/);
  assert.match(text, /See the exact amount: https:\/\/servolia\.com\/u/);
  assert.equal(E.stripHtml("<p>Next &rarr; step</p>"), "Next → step");
});

/* ── 8. The admin endpoint ────────────────────────────────────────────── */

const H = (h) => ({ get: (n) => h[n.toLowerCase()] ?? null });

test("the admin link endpoint refuses a cross-origin request before anything else", () => {
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", origin: "https://servolia.com", "sec-fetch-site": "same-origin" })), true);
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com" })), true, "curl with the admin cookie: as every admin route");
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", origin: "https://evil.example" })), false);
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", origin: "https://clinic.servolia.com", "sec-fetch-site": "same-site" })), false, "same SITE is not same ORIGIN");
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", "sec-fetch-site": "cross-site" })), false);
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", origin: "null" })), false);
  assert.equal(SO.sameOriginRequest(H({ host: "internal:3000", "x-forwarded-host": "servolia.com", origin: "https://servolia.com" })), true);

  const route = src("src/app/api/admin/domain-order/route.ts");
  const order = ["sameOriginRequest(req.headers)", "isAdminAuthed()", "stripeFor(true)", "createDomainOrderLink("].map((s) => route.indexOf(s));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `origin, then auth, then the LIVE key, then the link: ${order}`);
  assert.doesNotMatch(route, /checkoutStripe|isTestRequest|testMode"/, "an admin link ignores the test cookie");
});

test("the webhook's domain branch reports its own failures and never answers 'done' twice", () => {
  const w = src("src/app/api/webhooks/stripe/route.ts");
  const i = w.indexOf("session.metadata?.kind === DOMAIN_ORDER_KIND");
  assert.ok(i > 0);
  const branch = w.slice(i, w.indexOf("/* ── ARREARS branch", i));
  assert.match(branch, /try \{[\s\S]*fulfilDomainOrder\(stripe, session, test\)[\s\S]*\} catch \(err\) \{[\s\S]*sendTelegramMessage/, "a throw reaches the owner: the outer catch answers 200 and Stripe never retries");
  assert.match(branch, /describeDomainOrder\(res\)/);
  assert.match(branch, /Client email NOT sent/);
});

test("the settle cron is scheduled and guarded", () => {
  const v = JSON.parse(src("vercel.json"));
  assert.ok(v.crons.some((c) => c.path === "/api/cron/domain-orders"));
  const c = src("src/app/api/cron/domain-orders/route.ts");
  assert.match(c, /if \(!secret \|\| req\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`\)/);
  assert.match(c, /stripeFor\(true\)/);
  assert.match(src("src/app/api/cron/domain-billing/route.ts"), /if \(!process\.env\.CRON_SECRET \|\|/);
});
