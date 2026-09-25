/**
 * Domains: the price rule (never under 27.90, always ending .90, repriced at
 * renewal only when the registry moved) and a domain sold on its own
 * (src/lib/domainOrders.ts), with Vercel and Stripe both faked so nothing
 * real is bought or charged. Also the purchase-confirmation email fixes that
 * shipped with it (src/lib/email.ts).
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
const X = await import("../src/lib/extraDomains.ts");

const needed = (r) => (r + S.DOMAIN_TARGET_PROFIT_USD + S.STRIPE_FIXED_USD) / (1 - S.STRIPE_RATE);
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

/* ── Vercel and Stripe, faked ─────────────────────────────────────────── */

const CONTACT = { firstName: "A", lastName: "B", email: "ops@servolia.com", phone: "+212600000000", address1: "1 St", city: "Tangier", state: "TA", zip: "90000", country: "MA" };
/** One timeline shared by both fakes, so ORDER can be asserted. */
let timeline = [];
function fakeVercel({
  available = true, purchase = 11.25, renewal = 11.25, buy = { status: 200 }, order = ["completed"], attachFails = false,
  inTeam = false, teamBoughtAt = Date.parse("2026-09-24T10:00:00Z"), project = true, quoteFails = false, autoRenewFails = false,
} = {}) {
  process.env.VERCEL_TOKEN = "t"; process.env.VERCEL_TEAM_ID = "team_x";
  process.env.DOMAIN_CONTACT_JSON = JSON.stringify(CONTACT);
  const calls = [];
  const states = [...order];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const method = init.method ?? "GET";
    calls.push({ url: u, method, body: init.body ? JSON.parse(String(init.body)) : null });
    timeline.push(`vercel ${method} ${u.replace("https://api.vercel.com", "").split("?")[0]}`);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auto-renew")) return autoRenewFails ? json(500, { error: { code: "internal_server_error" } }) : new Response(null, { status: 204 });
    if (u.includes("/price")) return quoteFails ? json(500, { error: { code: "internal_server_error" } }) : json(200, { years: 1, purchasePrice: purchase, renewalPrice: renewal, transferPrice: renewal });
    if (u.includes("/availability")) return quoteFails ? json(500, {}) : json(200, { available });
    if (u.includes("/buy")) return buy.status === 200 ? json(200, { orderId: "ord_42", _links: {} }) : json(buy.status, { error: { code: buy.status >= 500 ? "internal_server_error" : "nope", message: "refused" } });
    if (u.includes("/registrar/orders/")) {
      const st = states.length > 1 ? states.shift() : states[0];
      const line = st === "completed" ? "completed" : st === "failed" ? "failed" : "pending";
      return json(200, { orderId: "ord_42", status: st, domains: [{ purchaseType: "purchase", autoRenew: true, years: 1, domainName: "ithardigital.com", status: line, price: purchase, ...(st === "failed" ? { error: { code: "registry-error" } } : {}) }] });
    }
    if (u.includes("/v5/domains/")) return inTeam ? json(200, { domain: { name: "ithardigital.com", boughtAt: teamBoughtAt } }) : json(404, { error: { code: "not_found" } });
    if (u.includes("/v9/projects/")) return project ? json(200, { id: "prj_1", name: "ithar-digital" }) : json(404, { error: { code: "not_found" } });
    if (u.includes("/v10/projects/")) return attachFails ? json(403, { error: { code: "forbidden", message: "You don't have access to the domain you are adding" } }) : json(200, {});
    return json(404, {});
  };
  return calls;
}

function fakeStripe({ metadata = {}, invoices = [], payFails = false, email = "ithar@example.com", customers = null, emptyItems = false } = {}) {
  const log = { sessions: [], customerUpdates: [], invoicesCreated: [], items: [], paid: [], finalized: [], deleted: [], voided: [], invoiceUpdates: [] };
  // Stripe never stores a "" value: setting one deletes the key.
  const clean = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== ""));
  const customer = { id: "cus_1", email, metadata: clean(metadata) };
  const all = customers ? customers.map((c) => ({ ...c, metadata: clean(c.metadata) })) : [customer];
  const invById = new Map(invoices.map((i) => [i.id, { ...i, metadata: { ...i.metadata } }]));
  const seenKeys = new Map();
  const snap = (c) => ({ ...c, metadata: { ...c.metadata } });
  const find = (id) => all.find((x) => x.id === id) ?? customer;
  return {
    log, customer, all, invById,
    checkout: { sessions: { create: async (p) => { log.sessions.push(p); return { url: "https://checkout.stripe.com/c/pay/cs_live_x" }; } } },
    customers: {
      retrieve: async (id) => snap(find(id)),
      update: async (id, p, opts = {}) => {
        if (opts.idempotencyKey && seenKeys.has(opts.idempotencyKey)) {
          return { ...seenKeys.get(opts.idempotencyKey), lastResponse: { headers: { "idempotent-replayed": "true" } } };
        }
        const c = find(id);
        log.customerUpdates.push({ id, ...p, key: opts.idempotencyKey });
        timeline.push(`stripe customer ${p.metadata?.servolia_domain_status ?? "?"}`);
        for (const [k, v] of Object.entries(p.metadata ?? {})) { if (v === "") delete c.metadata[k]; else c.metadata[k] = v; }
        const res = { ...snap(c), lastResponse: { headers: {} } };
        if (opts.idempotencyKey) seenKeys.set(opts.idempotencyKey, res);
        return res;
      },
      search: async ({ query }) => {
        const [, k, v] = /metadata\['([^']+)'\]:'([^']+)'/.exec(query);
        return { data: all.filter((c) => c.metadata[k] === v).map(snap), has_more: false };
      },
    },
    paymentIntents: { retrieve: async () => ({ payment_method: "pm_card" }) },
    invoices: {
      list: async () => ({ data: [...invById.values()].map((i) => ({ ...i, metadata: { ...i.metadata } })) }),
      retrieve: async (id) => ({ ...invById.get(id) }),
      create: async (p) => { const inv = { id: `in_${log.invoicesCreated.length + 1}`, status: "draft", total: 0, metadata: { ...p.metadata } }; log.invoicesCreated.push(p); invById.set(inv.id, inv); return { ...inv }; },
      finalizeInvoice: async (id, p) => { log.finalized.push({ id, ...p }); const inv = invById.get(id); inv.status = "open"; return { ...inv }; },
      pay: async (id) => {
        if (payFails) throw new Error("card_declined");
        const inv = invById.get(id);
        inv.status = "paid"; inv.amount_paid = inv.total;
        log.paid.push(id);
        return { ...inv };
      },
      update: async (id, p) => { log.invoiceUpdates.push({ id, ...p }); const inv = invById.get(id); Object.assign(inv.metadata, p.metadata ?? {}); return { ...inv }; },
      del: async (id) => { log.deleted.push(id); invById.delete(id); return { id, deleted: true }; },
      voidInvoice: async (id) => { log.voided.push(id); invById.get(id).status = "void"; return { ...invById.get(id) }; },
    },
    invoiceItems: { create: async (p) => { log.items.push(p); const inv = invById.get(p.invoice); if (inv && !emptyItems) inv.total = (inv.total ?? 0) + p.amount; return {}; } },
  };
}

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
  }
  assert.equal(S.retailYearlyUsd(20), 35.9, "35.05 needed -> 35.90");
  assert.equal(S.retailYearlyUsd(31.9 * 0.95 - 13.3), 31.9, "exactly on a .90: not pushed to the next one");
});

test("the $80 ceiling: a name whose price would go over it is not offered", async () => {
  fakeVercel({ purchase: 70, renewal: 70 });
  const q = await S.domainQuote("costly.com");
  assert.equal(q.sellable, false);
  assert.equal(q.reason, "too-expensive");
  fakeVercel({ purchase: 62, renewal: 62 });
  assert.equal(S.retailYearlyUsd(62), 79.9);
  assert.equal((await S.domainQuote("fine.com")).sellable, true, "79.90 is still offered");
});

test("a renewal moves only when the REGISTRY moved: never to the new floor or rounding, never down", () => {
  assert.equal(S.renewalRetailUsd(27.9, 11.25), 27.9, "Vercel unchanged: same price");
  assert.equal(S.renewalRetailUsd(27.9, 9), 27.9, "Vercel cheaper: still last year's price");
  assert.equal(S.renewalRetailUsd(27.9, 20), 35.9, "Vercel up enough to eat the margin: the lowest .90 that restores it");
  assert.equal(S.renewalRetailUsd(27.9, null), 27.9, "Vercel unreachable: no guessing upward");
  // A plan client who bought at 26 (before the floor) keeps 26 while the margin holds...
  assert.equal(S.renewalRetailUsd(26, 11.25), 26, "never raised to the 27.90 floor");
  assert.equal(S.renewalRetailUsd(26.5, 11.25), 26.5, "never re-rounded to .90");
  // ...and rises only when the registry takes the margin under target.
  assert.equal(S.renewalRetailUsd(26, 13), 27.9, "13 at Vercel leaves 11.40 at 26: rises to the .90 that keeps 13");
  assert.ok(S.netProfitUsd(S.renewalRetailUsd(26, 13), 13) >= S.DOMAIN_TARGET_PROFIT_USD - 0.01);
});

/* ── 2. The record ────────────────────────────────────────────────────── */

test("the record survives Stripe metadata, and an empty field clears a stale one", () => {
  const rec = { domain: "ithardigital.com", status: "bought", retailUsd: 27.9, lang: "en", name: "Ithar", project: "ithar-digital", attached: "ithar-digital", orderId: "ord_1", session: "cs_live_1", claimedAt: "2026-09-24T10:00:00.000Z", placedAt: "2026-09-24T10:00:01.000Z", boughtAt: "2026-09-24", renewsOn: "2027-09-24", noticedFor: "2027-09-24", noticedUsd: 35.9, renewalOff: "2027-01-01" };
  const meta = O.orderRecordMetadata(rec);
  assert.equal(meta.servolia_domain_note, "", "absent = '' so Stripe deletes the old key");
  assert.deepEqual(O.readOrderRecord(meta), rec);
  assert.ok(Object.keys(meta).length <= 50, "Stripe allows 50 metadata keys");
  assert.ok(Object.keys(meta).every((k) => k.length <= 40), "Stripe keys are at most 40 characters");
  assert.equal(O.readOrderRecord({}), null);
  assert.equal(O.readOrderRecord({ servolia_domain: "a.com", servolia_domain_status: "weird" }).status, "failed", "unknown status is never charged");
  for (const s of ["claimed", "purchasing", "bought", "failed", "unknown", "stopped"]) {
    assert.equal(O.readOrderRecord({ servolia_domain: "a.com", servolia_domain_status: s }).status, s);
  }
});

test("plan and panel records carry the notice marker, and a record without one keeps its old shape", () => {
  const rec = { domain: "a.com", status: "bought", retailUsd: 26, nextChargeAt: "2027-09-24" };
  const plain = S.writeDomainRecord(null, rec);
  assert.doesNotMatch(plain, /noticed/);
  const withNotice = S.writeDomainRecord(null, { ...rec, noticed: S.writeNoticed("2027-09-24", 27.9) });
  assert.equal(S.readDomainRecord(withNotice).noticed, "2027-09-24=27.9");
  assert.deepEqual(S.readNoticed("2027-09-24=27.9"), { noticedFor: "2027-09-24", noticedUsd: 27.9 });
  assert.deepEqual(S.readNoticed(undefined), {});
  const ex = X.writeExtraDomain(null, { domain: "b.com", retailUsd: 30, nextChargeAt: "2027-01-01", noticed: "2027-01-01=31.9" });
  assert.equal(X.readExtraDomains(ex)[0].noticed, "2027-01-01=31.9");
});

/* ── 3. The renewal calendar ──────────────────────────────────────────── */

const DEC = (today, o = {}) => S.renewalDecision({ paidUsd: 27.9, vercelRenewalUsd: 20, renewsOn: "2027-09-24", todayIso: today, ...o });

test("a rise is announced between 37 and 30 days out and NEVER later; the charge is 7 days out", () => {
  assert.equal(S.daysBefore("2027-09-24", 30), "2027-08-25");
  assert.deepEqual(DEC("2027-08-17"), { kind: "wait" }, "day -38: too early");
  assert.deepEqual(DEC("2027-08-18"), { kind: "notice", price: 35.9 }, "day -37: window opens");
  assert.deepEqual(DEC("2027-08-25"), { kind: "notice", price: 35.9 }, "day -30: last day");
  assert.deepEqual(DEC("2027-09-04"), { kind: "wait" }, "day -20: too late to announce; the rise waits");
  assert.deepEqual(DEC("2027-09-16"), { kind: "wait" }, "day -8: too late to announce");
  assert.deepEqual(DEC("2027-09-17"), { kind: "charge", price: 27.9, wanted: 35.9 }, "day -7: charged at last year's price");
  assert.deepEqual(DEC("2027-08-25", { vercelRenewalUsd: 11.25 }), { kind: "wait" }, "no rise, no notice");
  assert.deepEqual(DEC("2027-08-20", { noticedFor: "2027-09-24", noticedUsd: 35.9 }), { kind: "wait" }, "announced once");
  assert.equal(O.nextYear("2028-02-29"), "2029-03-01", "a leap day renews on the 1st of March");
  assert.equal(O.chargeDateFor("2027-09-24"), "2027-09-17");
});

test("the charge never exceeds what the client was told: the noticed price, or last year's", () => {
  assert.deepEqual(DEC("2027-09-17", { vercelRenewalUsd: 25, noticedFor: "2027-09-24", noticedUsd: 35.9 }), { kind: "charge", price: 35.9, wanted: 40.9 }, "rose again after the notice");
  assert.deepEqual(DEC("2027-09-17", { vercelRenewalUsd: 11.25, noticedFor: "2027-09-24", noticedUsd: 35.9 }), { kind: "charge", price: 27.9, wanted: 27.9 }, "came back down");
  assert.deepEqual(DEC("2027-09-17", { noticedFor: "2026-09-24", noticedUsd: 35.9 }), { kind: "charge", price: 27.9, wanted: 35.9 }, "last year's notice authorises nothing");
  const rec = { domain: "a.com", status: "bought", retailUsd: 27.9, lang: "en", renewsOn: "2027-09-24" };
  for (const status of ["failed", "claimed", "purchasing", "unknown", "stopped"]) {
    assert.deepEqual(O.renewalStep({ ...rec, status }, "2027-09-20", 11.25), { kind: "wait" }, status);
  }
});

/* ── 4. The link ──────────────────────────────────────────────────────── */

test("the link: priced by the server at 27.90, card saved for next year, one customer per order", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe();
  const res = await O.createDomainOrderLink(stripe, { domain: "https://www.ItharDigital.com/", email: " Ithar@Example.com ", name: "Ithar", project: "ithar-digital", lang: "en", origin: "https://servolia.com" });
  assert.equal(res.ok, true);
  assert.equal(res.yearlyUsd, 27.9);
  assert.ok(calls.some((c) => c.url.includes("/v9/projects/ithar-digital")), "the project was checked");
  const p = stripe.log.sessions[0];
  assert.equal(p.line_items[0].price_data.unit_amount, 2790, "whole cents: 27.9 * 100 is 2789.999... in floating point");
  assert.equal(p.line_items[0].price_data.currency, "usd");
  assert.equal(p.customer_email, "ithar@example.com");
  assert.equal(p.customer_creation, "always");
  assert.equal(p.payment_intent_data.setup_future_usage, "off_session", "without it next year's renewal has no card");
  assert.equal(p.metadata.kind, O.DOMAIN_ORDER_KIND);
  assert.equal(p.metadata.domain_retail_usd, "27.9");
  assert.equal(p.cancel_url, "https://servolia.com/");
  assert.ok(p.expires_at * 1000 - Date.now() < 24 * 3600 * 1000, "Stripe refuses more than 24 hours");
  const fr = fakeStripe();
  await O.createDomainOrderLink(fr, { domain: "ithardigital.com", email: "a@b.co", lang: "fr", origin: "https://servolia.com" });
  assert.equal(fr.log.sessions[0].cancel_url, "https://servolia.com/fr");
  assert.match(fr.log.sessions[0].line_items[0].price_data.product_data.name, /^Domaine /);
});

test("no link for a taken name, an ending we do not sell, a bad email, a missing project, or no registrant", async () => {
  const no = async (o) => (await O.createDomainOrderLink(fakeStripe(), { email: "a@b.co", lang: "en", origin: "x", ...o })).ok;
  fakeVercel({ available: false });
  assert.equal(await no({ domain: "taken.com" }), false);
  fakeVercel();
  assert.equal(await no({ domain: "shop.store" }), false, ".store is not on the list");
  assert.equal(await no({ domain: "x.de" }), false);
  for (const tld of ["com", "org", "net", "co", "io", "ma", "uk", "fr"]) assert.equal(S.tldAllowed(`x.${tld}`), true, tld);
  assert.equal(await no({ domain: "x.com", email: "nope" }), false);
  assert.equal(await no({ domain: "x.com", project: "../other" }), false);
  fakeVercel({ project: false });
  const missing = await O.createDomainOrderLink(fakeStripe(), { domain: "x.com", email: "a@b.co", project: "no-such-project", lang: "en", origin: "x" });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /No Vercel project named "no-such-project"/);
  fakeVercel();
  delete process.env.DOMAIN_CONTACT_JSON;
  assert.equal(await no({ domain: "x.com" }), false, "no registrant contact = no purchase possible = no link");
});

/* ── 5. Paid: the webhook's purchase ──────────────────────────────────── */

const SESSION = {
  id: "cs_live_1", customer: "cus_1", payment_intent: "pi_1", customer_details: { email: "ithar@example.com" },
  currency: "usd", amount_total: 2790,
  metadata: { kind: "domain_order", domain: "ithardigital.com", domain_retail_usd: "27.9", lang: "en", name: "Ithar", project: "ithar-digital" },
};
const NOPOLL = { pollMs: [0, 0, 0] };
const buys = (calls) => calls.filter((c) => c.url.includes("/buy")).length;

test("paid: claimed atomically BEFORE the registrar is called, bought, attached, card made the default", async () => {
  timeline = [];
  const calls = fakeVercel();
  const stripe = fakeStripe();
  const r = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(r.outcome, "done");
  assert.equal(r.record.status, "bought");
  assert.equal(r.record.attached, "ithar-digital");
  assert.ok(r.record.placedAt, "the real time Vercel accepted it");
  assert.equal(r.record.renewsOn, O.nextYear(new Date().toISOString().slice(0, 10)));
  assert.equal(stripe.log.customerUpdates[0].key, "domain-claim-cs_live_1", "the claim carries the session's idempotency key");
  const claim = timeline.indexOf("stripe customer claimed");
  const buy = timeline.findIndex((t) => t.includes("/buy"));
  assert.ok(claim >= 0 && buy > claim, `claim must precede the buy: ${timeline.join(" | ")}`);
  assert.equal(stripe.log.customerUpdates.at(-1).invoice_settings.default_payment_method, "pm_card");
  const say = O.describeDomainOrder(r);
  assert.equal(say.email, "registered");
  assert.equal(say.owner.subject, "💶 Paid: Domain ithardigital.com — $27.90 — Ithar");
  assert.ok(say.owner.lines.some((l) => /^Next: /.test(l ?? "")));
});

test("TWO DELIVERIES AT ONCE make one registrar call: the second meets the claim's idempotency key", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe();
  const [a, b] = await Promise.all([O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL), O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL)]);
  assert.equal(buys(calls), 1);
  assert.deepEqual([a.outcome, b.outcome].sort(), ["concurrent", "done"]);
  const quiet = [a, b].find((x) => x.outcome === "concurrent");
  assert.deepEqual(O.describeDomainOrder(quiet), { owner: null, email: null }, "the second says nothing");
  // A 409 (the first still in flight) counts the same.
  const clash = fakeStripe();
  clash.customers.update = async () => { throw Object.assign(new Error("another request in progress"), { statusCode: 409, type: "StripeIdempotencyError" }); };
  const c = await O.fulfilDomainOrder(clash, SESSION, false, NOPOLL);
  assert.equal(c.outcome, "concurrent");
});

test("a replayed checkout.session.completed never buys twice and says nothing twice", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe();
  await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  const before = buys(calls);
  const again = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(again.outcome, "duplicate");
  assert.equal(buys(calls), before);
  assert.deepEqual(O.describeDomainOrder(again), { owner: null, email: null });
});

test("a replay that finds only the CLAIM buys nothing and tells the owner exactly how to close it", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata({ domain: "ithardigital.com", status: "claimed", retailUsd: 27.9, lang: "en", session: "cs_live_1" }) });
  const r = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(r.outcome, "interrupted");
  assert.equal(buys(calls), 0);
  const say = O.describeDomainOrder(r);
  assert.equal(say.email, null);
  assert.match(say.owner.subject, /^⚠️ Domain order interrupted: ithardigital\.com — Ithar/);
  const text = say.owner.lines.join("\n");
  assert.match(text, /NOTHING was bought/);
  assert.match(text, /Mark bought/);
  assert.match(text, /servolia_domain_status=bought, servolia_domain_bought=YYYY-MM-DD .*servolia_domain_renews=/);
  assert.match(text, /cus_1/);
});

test("a customer already holding another domain is never overwritten", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata({ domain: "other.com", status: "bought", retailUsd: 27.9, lang: "en" }) });
  const r = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(r.outcome, "conflict");
  assert.equal(buys(calls), 0);
  assert.match(O.describeDomainOrder(r).owner.subject, /^⚠️ Domain order conflict/);
});

test("Vercel still 'purchasing': recorded purchasing, not attached yet; the settle cron finishes it once", async () => {
  const calls = fakeVercel({ order: ["purchasing"] });
  const stripe = fakeStripe();
  const r = await O.fulfilDomainOrder(stripe, SESSION, false, NOPOLL);
  assert.equal(r.record.status, "purchasing");
  assert.equal(calls.some((c) => c.url.includes("/v10/projects/")), false, "no attach before the registry finishes");
  assert.equal(O.describeDomainOrder(r).email, "processing");
  assert.match(O.describeDomainOrder(r).owner.subject, /^💶 Paid: /);
  fakeVercel({ order: ["completed"] });
  const [s] = await O.settlePurchasingOrders(stripe);
  assert.equal(s.step, "registered");
  assert.equal(stripe.customer.metadata.servolia_domain_status, "bought");
  assert.equal(stripe.customer.metadata.servolia_domain_attached, "ithar-digital");
  assert.deepEqual(await O.settlePurchasingOrders(stripe), [], "settled once: no second 'registered' email");
});

test("Vercel's order FAILED: recorded failed, never renewed", async () => {
  fakeVercel({ order: ["failed"] });
  const r = await O.fulfilDomainOrder(fakeStripe(), SESSION, false, NOPOLL);
  assert.equal(r.record.status, "failed");
  assert.match(r.record.note, /registry-error/);
  assert.equal(r.record.renewsOn, undefined);
  const say = O.describeDomainOrder(r);
  assert.equal(say.email, "failed");
  assert.match(say.owner.subject, /^⚠️ Domain NOT registered/);
  assert.match(say.owner.lines.join("\n"), /servolia_domain_status=bought/);
});

test("a stuck order is timed from when Vercel accepted it, and reported once", async () => {
  fakeVercel({ order: ["purchasing"] });
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata({ domain: "ithardigital.com", status: "purchasing", retailUsd: 27.9, lang: "en", orderId: "ord_42", placedAt: "2026-09-24T20:00:00.000Z", boughtAt: "2026-09-24", renewsOn: "2027-09-24" }) });
  assert.deepEqual(await O.settlePurchasingOrders(stripe, new Date("2026-09-25T01:00:00Z")), [], "5 hours after acceptance (21 after midnight): still waiting");
  const [s] = await O.settlePurchasingOrders(stripe, new Date("2026-09-25T03:00:00Z"));
  assert.equal(s.step, "stuck");
  assert.deepEqual(await O.settlePurchasingOrders(stripe, new Date("2026-09-25T03:15:00Z")), [], "reported once");
});

test("a founder TEST purchase never reaches the registrar", async () => {
  const calls = fakeVercel();
  const t = await O.fulfilDomainOrder(fakeStripe(), SESSION, true, NOPOLL);
  assert.equal(t.record.status, "failed");
  assert.match(t.record.note, /TEST/);
  assert.equal(buys(calls), 0);
  assert.equal(calls.some((c) => c.url.includes("/v10/projects/")), false);
});

test("money: nothing bought when it does not cover the price, or when the amount cannot be read; Adaptive Pricing read in USD", async () => {
  let calls = fakeVercel();
  const short = await O.fulfilDomainOrder(fakeStripe(), { ...SESSION, amount_total: 1000 }, false, NOPOLL);
  assert.equal(short.record.status, "failed");
  assert.match(short.record.note, /paid 10\.00 USD/);
  const unreadable = await O.fulfilDomainOrder(fakeStripe(), { ...SESSION, currency: "eur", amount_total: 2600 }, false, NOPOLL);
  assert.equal(unreadable.record.status, "failed");
  assert.match(unreadable.record.note, /unreadable/);
  assert.equal(buys(calls), 0);
  calls = fakeVercel();
  const eur = await O.fulfilDomainOrder(fakeStripe(), { ...SESSION, currency: "eur", amount_total: 2600, currency_conversion: { source_currency: "usd", amount_total: 2790 } }, false, NOPOLL);
  assert.equal(eur.record.status, "bought");
});

test("a buy call that dies (network, 5xx) is UNKNOWN — never 'failed, refund'; a quote error is 'couldn't check', never 'taken'", async () => {
  fakeVercel({ buy: { status: 502 } });
  const u = await O.fulfilDomainOrder(fakeStripe(), SESSION, false, NOPOLL);
  assert.equal(u.record.status, "unknown");
  const say = O.describeDomainOrder(u);
  assert.match(say.owner.subject, /^⚠️ Domain purchase unknown/);
  assert.match(say.owner.lines.join("\n"), /MAY have gone through\. Do not buy again or refund before checking/);
  fakeVercel({ buy: { status: 400 } });
  assert.equal((await O.fulfilDomainOrder(fakeStripe(), SESSION, false, NOPOLL)).record.status, "failed", "a 4xx is a real refusal");
  fakeVercel({ quoteFails: true });
  const q = await S.purchaseDomainForClient("ithardigital.com", 27.9);
  assert.equal(q.reason, "error");
  assert.match(q.detail, /could not check/);
});

test("attach refused: bought, owner told exactly where to add it", async () => {
  fakeVercel({ attachFails: true });
  const r = await O.fulfilDomainOrder(fakeStripe(), SESSION, false, NOPOLL);
  assert.equal(r.record.status, "bought");
  assert.equal(r.attach, "failed");
  assert.match(O.describeDomainOrder(r).owner.lines.join("\n"), /NOT attached to ithar-digital \(forbidden: [\s\S]*Vercel > ithar-digital > Domains/);
});

/* ── 6. The owner's hand ──────────────────────────────────────────────── */

const FAILED_REC = { domain: "ithardigital.com", status: "failed", retailUsd: 27.9, lang: "en", project: "ithar-digital", note: "unknown (502)" };

test("mark bought: refused unless the name is in our Vercel team; then dated from Vercel's purchase, attached, a year to run", async () => {
  fakeVercel({ inTeam: false });
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(FAILED_REC) });
  const no = await O.markDomainOrderBought(stripe, "ithardigital.com");
  assert.equal(no.ok, false);
  assert.match(no.error, /NOT in our Vercel team/);
  assert.equal(stripe.customer.metadata.servolia_domain_status, "failed", "nothing written");
  const calls = fakeVercel({ inTeam: true, teamBoughtAt: Date.parse("2026-09-24T22:00:00Z") });
  const ok = await O.markDomainOrderBought(stripe, "ithardigital.com");
  assert.equal(ok.ok, true);
  assert.equal(stripe.customer.metadata.servolia_domain_status, "bought");
  assert.equal(stripe.customer.metadata.servolia_domain_bought, "2026-09-24");
  assert.equal(stripe.customer.metadata.servolia_domain_renews, "2027-09-24");
  assert.equal(ok.attach, "done");
  assert.ok(calls.some((c) => c.url.includes("/v10/projects/ithar-digital/domains")));
  assert.equal((await O.markDomainOrderBought(stripe, "ithardigital.com")).ok, false, "already bought");
});

test("stop renewing: draft deleted, open invoice voided, Vercel auto-renew OFF; the daily sweep catches a stop set by hand", async () => {
  const calls = fakeVercel();
  const stripe = fakeStripe({
    metadata: O.orderRecordMetadata({ ...FAILED_REC, status: "bought", renewsOn: "2027-09-24" }),
    invoices: [
      { id: "in_d", status: "draft", total: 2790, metadata: { kind: "domain_order_renewal", renews_on: "2027-09-24" } },
      { id: "in_o", status: "open", total: 2790, metadata: { kind: "domain_order_renewal", renews_on: "2026-09-24" } },
      { id: "in_x", status: "open", total: 5000, metadata: { kind: "something_else" } },
    ],
  });
  const r = await O.stopDomainOrder(stripe, "ithardigital.com");
  assert.equal(r.ok, true);
  assert.deepEqual(stripe.log.deleted, ["in_d"]);
  assert.deepEqual(stripe.log.voided, ["in_o"], "only renewal invoices are touched");
  const renew = calls.find((c) => c.url.includes("/auto-renew"));
  assert.equal(renew.method, "PATCH");
  assert.deepEqual(renew.body, { autoRenew: false });
  assert.equal(stripe.customer.metadata.servolia_domain_status, "stopped");
  assert.ok(stripe.customer.metadata.servolia_domain_renewal_off);
  assert.deepEqual(await O.sweepStoppedOrders(stripe), [], "done once");

  fakeVercel();
  const byHand = fakeStripe({ metadata: O.orderRecordMetadata({ ...FAILED_REC, status: "stopped" }) });
  const [s] = await O.sweepStoppedOrders(byHand);
  assert.deepEqual(s.problems, []);
  assert.ok(byHand.customer.metadata.servolia_domain_renewal_off);
  fakeVercel({ autoRenewFails: true });
  const stuck = fakeStripe({ metadata: O.orderRecordMetadata({ ...FAILED_REC, status: "stopped" }) });
  const [t] = await O.sweepStoppedOrders(stuck);
  assert.match(t.problems.join(), /auto-renew still ON/);
  assert.equal(stuck.customer.metadata.servolia_domain_renewal_off, undefined, "retried tomorrow");
});

test("the daily audit: bought with no renewal date, failed-but-registered, a claim that never finished", async () => {
  fakeVercel({ inTeam: true });
  const cs = [
    { id: "cus_a", email: null, metadata: O.orderRecordMetadata({ domain: "a.com", status: "bought", retailUsd: 27.9, lang: "en" }) },
    { id: "cus_b", email: null, metadata: O.orderRecordMetadata({ domain: "b.com", status: "failed", retailUsd: 27.9, lang: "en" }) },
    { id: "cus_c", email: null, metadata: O.orderRecordMetadata({ domain: "c.com", status: "claimed", retailUsd: 27.9, lang: "en", claimedAt: "2026-09-24T10:00:00.000Z" }) },
    { id: "cus_d", email: null, metadata: O.orderRecordMetadata({ domain: "d.com", status: "claimed", retailUsd: 27.9, lang: "en", claimedAt: "2026-09-24T11:50:00.000Z" }) },
  ];
  const lines = await O.auditDomainOrders(fakeStripe({ customers: cs }), new Date("2026-09-24T12:00:00Z"));
  assert.equal(lines.length, 3, lines.join("\n"));
  assert.match(lines.join("\n"), /a\.com .*NO renewal date/);
  assert.match(lines.join("\n"), /b\.com .*recorded failed but IS registered/);
  assert.match(lines.join("\n"), /c\.com .*claimed .*never finished/);
});

/* ── 7. A year later ──────────────────────────────────────────────────── */

const DUE = { domain: "ithardigital.com", status: "bought", retailUsd: 27.9, lang: "en", renewsOn: "2027-09-24" };
const sent = (ok = true) => { const log = []; return { log, sendNotice: async (r) => { log.push(r); return ok; } }; };

test("renewal: the notice is recorded ONLY after its email went; then charged once, at the noticed price", async () => {
  fakeVercel({ renewal: 20 });
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE) });
  const fail = sent(false);
  const [f] = await O.runDomainOrderRenewals(stripe, "2027-08-25", fail);
  assert.equal(f.step, "notice-failed");
  assert.equal(fail.log.length, 1);
  assert.equal(stripe.customer.metadata.servolia_domain_noticed, undefined, "an unsent notice authorises nothing");
  assert.deepEqual(O.renewalStep(O.readOrderRecord(stripe.customer.metadata), "2027-09-17", 20), { kind: "charge", price: 27.9, wanted: 35.9 });

  const late = fakeStripe({ metadata: O.orderRecordMetadata(DUE) });
  const hook = sent(true);
  const [n] = await O.runDomainOrderRenewals(late, "2027-08-24", hook);
  assert.equal(n.step, "noticed");
  assert.equal(n.chargeOn, "2027-09-17");
  assert.equal(late.customer.metadata.servolia_domain_noticed_usd, "35.9");
  assert.deepEqual(await O.runDomainOrderRenewals(late, "2027-08-25", hook), [], "announced once");
  assert.equal(hook.log.length, 1);

  const [r] = await O.runDomainOrderRenewals(late, "2027-09-18", hook);
  assert.equal(r.step, "charged");
  assert.equal(late.log.items[0].amount, 3590, "as announced");
  assert.equal(late.log.invoicesCreated[0].auto_advance, false, "the cron is the only collector");
  assert.equal(late.log.finalized[0].auto_advance, false);
  assert.equal(late.customer.metadata.servolia_domain_renews, "2028-09-24");
  assert.equal(late.customer.metadata.servolia_domain_noticed, undefined, "next year's notice starts clean");

  const stale = fakeStripe({ metadata: O.orderRecordMetadata(DUE), invoices: [{ id: "in_9", status: "paid", total: 3590, amount_paid: 3590, metadata: { kind: "domain_order_renewal", renews_on: "2027-09-24" } }] });
  const [s] = await O.runDomainOrderRenewals(stale, "2027-09-19", sent());
  assert.equal(s.step, "charged");
  assert.equal(stale.log.invoicesCreated.length, 0, "never a second invoice for the same year");
});

test("a rise found at day -20 or -8 is not announced and not charged: last year's price", async () => {
  for (const day of ["2027-09-04", "2027-09-16"]) {
    fakeVercel({ renewal: 20 });
    const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE) });
    const hook = sent(true);
    assert.deepEqual(await O.runDomainOrderRenewals(stripe, day, hook), [], day);
    assert.equal(hook.log.length, 0, `${day}: no late notice`);
  }
  fakeVercel({ renewal: 20 });
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE) });
  const [r] = await O.runDomainOrderRenewals(stripe, "2027-09-17", sent());
  assert.equal(stripe.log.items[0].amount, 2790);
  assert.equal(r.heldBackUsd, 35.9);
});

test("an empty draft gets its line; one still empty after that is DELETED, never finalised at 0", async () => {
  fakeVercel();
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE), invoices: [{ id: "in_7", status: "draft", total: 0, metadata: { kind: "domain_order_renewal", renews_on: "2027-09-24" } }] });
  const [r] = await O.runDomainOrderRenewals(stripe, "2027-09-18", sent());
  assert.equal(r.step, "charged");
  assert.equal(stripe.log.items[0].invoice, "in_7");

  const empty = fakeStripe({ metadata: O.orderRecordMetadata(DUE), emptyItems: true });
  const [e] = await O.runDomainOrderRenewals(empty, "2027-09-18", sent());
  assert.equal(e.step, "charge-failed");
  assert.equal(empty.log.finalized.length, 0, "never finalised");
  assert.deepEqual(empty.log.deleted, ["in_1"]);
  assert.equal(empty.customer.metadata.servolia_domain_renews, "2027-09-24");

  const zero = fakeStripe({ metadata: O.orderRecordMetadata(DUE), invoices: [{ id: "in_8", status: "paid", total: 0, amount_paid: 0, metadata: { kind: "domain_order_renewal", renews_on: "2027-09-24" } }] });
  assert.equal((await O.runDomainOrderRenewals(zero, "2027-09-18", sent()))[0].step, "charge-failed", "a 0 payment is never a renewal");
});

test("a declined card: one invoice, one attempt a day, stops after MAX_CHARGE_ATTEMPTS and says so once", async () => {
  fakeVercel();
  const stripe = fakeStripe({ metadata: O.orderRecordMetadata(DUE), payFails: true });
  const steps = [];
  for (const day of ["2027-09-17", "2027-09-18", "2027-09-19", "2027-09-20", "2027-09-21", "2027-09-22"]) {
    const [r] = await O.runDomainOrderRenewals(stripe, day, sent());
    steps.push(r ? `${r.step}:${r.attempts}` : "silent");
  }
  assert.deepEqual(steps, ["charge-failed:1", "charge-failed:2", "charge-failed:3", "gave-up:4", "silent", "silent"]);
  assert.equal(stripe.log.invoicesCreated.length, 1, "one invoice for the year");
  assert.equal(stripe.log.items.length, 1, "one line on it");
  assert.equal(stripe.customer.metadata.servolia_domain_renews, "2027-09-24", "the date never moved");
});

/* ── 8. What the client reads ─────────────────────────────────────────── */

const orderMail = (o) => E.domainOrderEmail({ domain: "ithardigital.com", amountUsd: 27.9, renewsOnIso: "2027-09-24", chargeOnIso: "2027-09-17", name: "Ithar", lang: "en", ...o });

test("the order email: price with cents, renewal AND charge date, in both languages, per state", () => {
  const en = orderMail({ state: "registered" });
  assert.match(en.subject, /ithardigital\.com is registered/);
  assert.match(en.html, /\$27\.90/);
  assert.match(en.html, /charged on 17 September 2027/);
  assert.match(en.html, /reply to this email before 17 September 2027/);
  const fr = orderMail({ state: "registered", lang: "fr" });
  assert.match(fr.html, /27,90&nbsp;\$/);
  assert.match(fr.html, /prélevé le 17 septembre 2027/);
  assert.match(orderMail({ state: "processing" }).html, /registry is completing/);
  const failed = orderMail({ state: "failed", lang: "fr" });
  assert.match(failed.html, /remboursé/);
  assert.doesNotMatch(failed.html, /Renouvellement/, "no renewal terms for a name that is not registered");
});

test("the renewal emails: the rise named only when there is one; notices name the charge day, plan clients their invoice", () => {
  const rise = E.domainRenewalEmail({ domain: "a.com", stage: "notice", priceUsd: 35.9, previousUsd: 27.9, onIso: "2027-09-24", chargeOnIso: "2027-09-17", lang: "en" });
  assert.match(rise.html, /up from \$27\.90 last year: the registry raised its price/);
  assert.match(rise.html, /charged to your card on 17 September 2027/);
  const plan = E.domainRenewalEmail({ domain: "a.com", stage: "notice", priceUsd: 27.9, previousUsd: 26, onIso: "2027-09-24", chargeOnIso: "2027-09-17", lang: "fr", billed: "invoice" });
  assert.match(plan.html, /figure sur votre facture suivante/);
  assert.doesNotMatch(plan.html, /prélevé sur votre carte/);
  const flat = E.domainRenewalEmail({ domain: "a.com", stage: "charged", priceUsd: 27.9, previousUsd: 27.9, onIso: "2027-09-24", nextIso: "2028-09-24", lang: "en" });
  assert.doesNotMatch(flat.html, /up from|registry raised/);
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
    const asst = { ...base, lang, productName: "AI assistant", productNoun: "AI assistant" };
    assert.doesNotMatch(E.clientServicePaidEmail({ ...asst, assistant: { installed: false, snippet: "<script></script>", briefUrl: "https://servolia.com/b" } }).html, nothing, `${lang}: a Last step follows`);
    assert.match(E.clientServicePaidEmail({ ...asst, assistant: { installed: true, snippet: null, briefUrl: null } }).html, nothing, `${lang}: installed, nothing left`);
  }
});

test("the plain-text part never shows a raw &rarr;", () => {
  const html = E.clientServicePaidEmail({ productName: "Website hosting", productNoun: "hosting", siteLabel: "example.com", amountUsd: 20, period: "monthly", portalUrl: "https://servolia.com/hosting/account?t=x", upgradeUrl: "https://servolia.com/u", lang: "en" }).html;
  assert.match(html, /Open my page &rarr;/, "the HTML keeps its arrow");
  const text = E.stripHtml(html);
  assert.doesNotMatch(text, /&rarr;|&[a-z]+;/);
  assert.match(text, /Open my page: https:\/\/servolia\.com\/hosting\/account\?t=x/);
  assert.equal(E.stripHtml("<p>Next &rarr; step</p>"), "Next → step");
});

/* ── 9. The admin endpoints, the webhook branch, the crons ────────────── */

const H = (h) => ({ get: (n) => h[n.toLowerCase()] ?? null });

test("the admin domain endpoints refuse a cross-origin request before anything else", () => {
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", origin: "https://servolia.com", "sec-fetch-site": "same-origin" })), true);
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com" })), true, "curl with the admin cookie: as every admin route");
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", origin: "https://evil.example" })), false);
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", origin: "https://clinic.servolia.com", "sec-fetch-site": "same-site" })), false, "same SITE is not same ORIGIN");
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", "sec-fetch-site": "cross-site" })), false);
  assert.equal(SO.sameOriginRequest(H({ host: "servolia.com", origin: "null" })), false);
  assert.equal(SO.sameOriginRequest(H({ host: "internal:3000", "x-forwarded-host": "servolia.com", origin: "https://servolia.com" })), true);
  for (const [file, call] of [["src/app/api/admin/domain-order/route.ts", "createDomainOrderLink("], ["src/app/api/admin/domain-order/manage/route.ts", "markDomainOrderBought("]]) {
    const route = src(file);
    const order = ["sameOriginRequest(req.headers)", "isAdminAuthed()", "stripeFor(true)", call].map((s) => route.indexOf(s));
    assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `${file}: origin, then auth, then the LIVE key, then the action: ${order}`);
    assert.doesNotMatch(route, /checkoutStripe|isTestRequest|testMode"/, `${file}: ignores the test cookie`);
  }
});

test("the webhook's domain branch: its own try/catch, owner notice via Sends, the client email awaited first", () => {
  const w = src("src/app/api/webhooks/stripe/route.ts");
  const i = w.indexOf("session.metadata?.kind === DOMAIN_ORDER_KIND");
  assert.ok(i > 0);
  const branch = w.slice(i, w.indexOf("/* AN EXTRA DOMAIN", i));
  assert.match(branch, /try \{[\s\S]*fulfilDomainOrder\(domainStripe, session, test\)[\s\S]*\} catch \(err\) \{[\s\S]*sends\.owner\(/, "a throw reaches the owner: the outer catch answers 200 and Stripe never retries");
  assert.match(branch, /await sends\.add\("domain order email"/);
  assert.match(branch, /describeDomainOrder\(res\)/);
  assert.doesNotMatch(branch, /sendTelegramMessage|\.catch\(\(\) => \{\}\)/, "no unbounded send");
});

test("the settle cron is scheduled and guarded; both crons send through Sends", () => {
  const v = JSON.parse(src("vercel.json"));
  assert.ok(v.crons.some((c) => c.path === "/api/cron/domain-orders"));
  const c = src("src/app/api/cron/domain-orders/route.ts");
  assert.match(c, /if \(!secret \|\| req\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`\)/);
  assert.match(c, /stripeFor\(true\)/);
  const b = src("src/app/api/cron/domain-billing/route.ts");
  assert.match(b, /if \(!process\.env\.CRON_SECRET \|\|/);
  for (const f of [b, c]) {
    assert.match(f, /await sends\.settled\(\)/);
    assert.doesNotMatch(f, /sendTelegramMessage/);
  }
});
