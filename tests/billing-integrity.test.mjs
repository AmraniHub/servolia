/**
 * BILLING INTEGRITY (2026-10-02) — the fixes from the adversarial money audit.
 *
 *  P1  a standalone invoice never revives a churned / suspended row
 *  P2  the invoice's subscription is read in BOTH payload shapes
 *  P3  one Stripe customer per client, one plan per client, one subscription
 *      per hosting site; the webhook alerts on a second one; the daily check
 *  P4  an exception answers 500 and alerts the owner once per event
 *  P5  add-on subscriptions are recorded, and named on failure / cancel
 *  P6  a paid extra domain is never silently ignored
 *  P7  business checkouts collect a VAT number; reverse-charge mention
 *  P8  monthly → yearly switches only once paid
 *  P9  the admin hosting link puts its metadata on the subscription
 *  P10 a domain is bought only when the payment covers it; atomic claim
 *  and: subscription.updated sync, dispute alert, exact top-up address
 *
 * The harness's fake Supabase answers every read with every seeded row,
 * whatever the filter — which would hide exactly the matching bugs fixed
 * here. This file answers reads THROUGH the query's filters (eq, is, in,
 * ilike, like, not.is), so "matched by customer" and "matched by
 * subscription" really differ.
 *
 *   node --import ./tests/register.mjs --test tests/billing-integrity.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as H from "./webhook-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const { POST, request } = await H.bootHarness();
process.env.RESEND_API_KEY = "re_harness";
process.env.CRON_SECRET = "cron_harness";
process.env.FOUNDER_EMAIL = "founder@example.com";
const VERCEL_ENV = {
  VERCEL_TOKEN: "vt_harness", VERCEL_TEAM_ID: "team_harness",
  DOMAIN_CONTACT_JSON: JSON.stringify({ firstName: "A", lastName: "B", email: "ops@servolia.com", phone: "+212600000000", address1: "1 St", city: "Tangier", state: "TA", zip: "90000", country: "MA" }),
};

/* ── A Supabase that honours filters ─────────────────────────────────── */

const SUPA = "https://harness.supabase.co";
const BS = String.fromCharCode(92);
const reEsc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, (m) => BS + m);
function likeToRegex(p, flags) {
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === BS && i + 1 < p.length) { re += reEsc(p[++i]); continue; }
    re += ch === "%" || ch === "*" ? ".*" : ch === "_" ? "." : reEsc(ch);
  }
  return new RegExp(`^${re}$`, flags);
}
function matches(val, f) {
  if (f.startsWith("eq.")) return val !== undefined && val !== null && String(val) === f.slice(3);
  if (f === "is.null") return val === undefined || val === null;
  if (f === "not.is.true") return val !== true;
  if (f === "is.true") return val === true;
  if (f.startsWith("in.(")) return f.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(val));
  if (f.startsWith("ilike.")) return likeToRegex(f.slice(6), "i").test(String(val ?? ""));
  if (f.startsWith("like.")) return likeToRegex(f.slice(5), "").test(String(val ?? ""));
  return true;
}
const SKIP = new Set(["select", "order", "limit", "offset", "or", "on_conflict", "columns"]);

const net = { casLose: false };
const rpcHits = new Map();
const vercelCalls = [];
/** Every Supabase read, decoded: { table, url }. */
const supaReads = [];

const harnessFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url.startsWith(`${SUPA}/rest/v1/rpc/servolia_rate_hit`)) {
    const key = JSON.parse(String(init.body)).p_key;
    rpcHits.set(key, (rpcHits.get(key) ?? 0) + 1);
    return json(200, rpcHits.get(key));
  }
  if (url.startsWith(SUPA) && (method === "GET" || method === "HEAD")) {
    const u = new URL(url);
    const table = u.pathname.replace("/rest/v1/", "");
    supaReads.push({ table, url: decodeURIComponent(url) });
    let rows = H.reads[table] ?? [];
    for (const [k, v] of u.searchParams) if (!SKIP.has(k)) rows = rows.filter((r) => matches(r[k], v));
    const wantsObject = (new Headers(init.headers ?? {}).get("accept") ?? "").includes("vnd.pgrst.object");
    return wantsObject ? (rows[0] ? json(200, rows[0]) : json(406, { message: "no rows", details: "0 rows" })) : json(200, rows);
  }
  if (url.startsWith(SUPA) && method === "PATCH" && net.casLose && /notes=(is\.null|eq\.)/.test(decodeURIComponent(url))) {
    await harnessFetch(input, init); // recorded as attempted
    return json(200, []); // ...but another delivery's claim won: zero rows updated
  }
  if (url.startsWith("https://api.vercel.com")) {
    vercelCalls.push(url);
    if (url.includes("/price")) return json(200, { years: 1, purchasePrice: 11.25, renewalPrice: 11.25, transferPrice: 11.25 });
    if (url.includes("/availability")) return json(200, { available: true });
    if (url.includes("/buy")) return json(200, { orderId: "ord_bi", _links: {} });
    return json(200, {});
  }
  return harnessFetch(input, init);
};

/* ── A Stripe that records ──────────────────────────────────────────── */

const SM = await import("../src/lib/stripeMode.ts");
const stripeCalls = [];
const stripeState = { subs: {}, updateAnswer: null, updateThrows: null, piStatus: "requires_payment_method", createFailsFor: null, charge: { customer: "cus_disp", billing_details: { email: "payer@example.com" } } };
SM.__setStripeFactoryForTests(() => ({
  checkout: { sessions: {
    create: async (p) => {
      stripeCalls.push({ op: "sessions.create", p });
      // A stored customer Stripe no longer has: what Stripe answers.
      if (stripeState.createFailsFor && p.customer === stripeState.createFailsFor) {
        throw Object.assign(new Error(`No such customer: '${p.customer}'`), { type: "StripeInvalidRequestError", code: "resource_missing", param: "customer", statusCode: 400 });
      }
      return { id: "cs_fake", url: "https://checkout.stripe.test/s" };
    },
    list: async () => ({ data: [] }),
    retrieve: async (id) => ({ id, metadata: {} }),
  } },
  billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.test/p" }) } },
  subscriptions: {
    retrieve: async (id) => {
      if (stripeState.subs[id]) return stripeState.subs[id];
      throw Object.assign(new Error(`No such subscription: ${id}`), { statusCode: 404 });
    },
    update: async (id, p) => {
      stripeCalls.push({ op: "subscriptions.update", id, p });
      if (stripeState.updateThrows && p.items) throw stripeState.updateThrows;
      return stripeState.updateAnswer ? stripeState.updateAnswer(id, p) : { id };
    },
    list: async ({ customer }) => ({ data: Object.values(stripeState.subs).filter((s) => s.customer === customer) }),
  },
  invoices: { voidInvoice: async (id) => { stripeCalls.push({ op: "invoices.void", id }); return { id, status: "void" }; } },
  charges: { retrieve: async (id) => ({ id, ...stripeState.charge }) },
  customers: { retrieve: async (id) => ({ id, metadata: {} }), update: async (id) => ({ id, metadata: {}, lastResponse: { headers: {} } }) },
  paymentIntents: { retrieve: async (id) => { stripeCalls.push({ op: "paymentIntents.retrieve", id }); return { id, payment_method: "pm_x", status: stripeState.piStatus }; } },
}));

function clear() {
  H.reset();
  net.casLose = false;
  rpcHits.clear();
  vercelCalls.length = 0;
  supaReads.length = 0;
  stripeCalls.length = 0;
  stripeState.subs = {};
  stripeState.updateAnswer = null;
  stripeState.updateThrows = null;
  stripeState.piStatus = "requires_payment_method";
  stripeState.createFailsFor = null;
  SC.__forgetStaleCustomersForTests();
}
const seed = (reads) => { for (const [t, rows] of Object.entries(reads)) H.reads[t] = rows; };
const tg = () => H.outbound.filter((o) => o.url.includes("api.telegram.org")).map((o) => JSON.parse(o.body).text);
const mails = () => H.outbound.filter((o) => o.url.includes("api.resend.com")).map((o) => JSON.parse(o.body));
const OWNER = "hello@servolia.com";
const clientMails = () => mails().filter((m) => ![m.to].flat().includes(OWNER));
const writesTo = (table, method) => H.writes.filter((w) => w.table === table && (!method || w.method === method));
function withEnv(vars, fn) {
  const before = {};
  for (const k of Object.keys(vars)) before[k] = process.env[k];
  Object.assign(process.env, vars);
  return Promise.resolve().then(fn).finally(() => {
    for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });
}

let n = 0;
const evt = (type, object, id) => ({ id: id ?? `evt_bi_${++n}`, object: "event", type, livemode: true, created: 1790000000, api_version: "2026-05-27.dahlia", data: { object } });
const send = (ev) => POST(request(ev, H.LIVE_WH));

const SC = await import("../src/lib/stripeCustomer.ts");
const AS = await import("../src/lib/addonSubscriptions.ts");
const VAT = await import("../src/lib/vat.ts");
const { writeDomainRecord } = await import("../src/lib/domainSales.ts");
const { writeExtraDomain, readExtraDomains } = await import("../src/lib/extraDomains.ts");
const { createClientSession, getClientCookieName } = await import("../src/lib/clientAuth.ts");
const { PLANS } = await import("../src/lib/pricing.ts");
const { NextRequest } = await import("next/server");

/* ══ Units ═════════════════════════════════════════════════════════════ */

test("P2 invoiceSubscriptionId: dahlia parent.subscription_details, the legacy top-level field, an expanded object; null for a standalone invoice", () => {
  assert.equal(SC.invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } } }), "sub_new");
  assert.equal(SC.invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: "sub_obj" } } } }), "sub_obj");
  assert.equal(SC.invoiceSubscriptionId({ subscription: "sub_old" }), "sub_old");
  assert.equal(SC.invoiceSubscriptionId({ subscription: { id: "sub_old_obj" } }), "sub_old_obj");
  assert.equal(SC.invoiceSubscriptionId({ parent: { type: "quote_details", quote_details: {} } }), null);
  assert.equal(SC.invoiceSubscriptionId({ customer: "cus_x" }), null);
  assert.equal(SC.invoiceSubscriptionId(null), null);
});

test("P3 exact address: wildcards escaped for ilike, and sameEmail is exact (case aside)", () => {
  assert.equal(SC.exactLikePattern(" Jean_Du%pont@x.fr "), `Jean${BS}_Du${BS}%pont@x.fr`);
  assert.ok(likeToRegex(SC.exactLikePattern("jean_dupont@x.fr"), "i").test("JEAN_DUPONT@X.FR"));
  assert.ok(!likeToRegex(SC.exactLikePattern("jean_dupont@x.fr"), "i").test("jeanXdupont@x.fr"), "the escaped _ still matched any character");
  assert.ok(SC.sameEmail("A@B.fr ", "a@b.FR"));
  assert.ok(!SC.sameEmail("a@b.fr", "a@b.fr.evil"));
  assert.ok(!SC.sameEmail("", ""));
});

test("P3/P7 buyerFields and businessTaxFields: existing customer (with customer_update) or the address; tax ID + billing address; invoice only in payment mode; never automatic_tax", () => {
  assert.deepEqual(SC.buyerFields("cus_1", "a@b.fr"), { customer: "cus_1", customer_update: { name: "auto", address: "auto" } });
  assert.deepEqual(SC.buyerFields(null, " a@b.fr "), { customer_email: "a@b.fr" });
  assert.deepEqual(SC.buyerFields(null, null), {});
  assert.deepEqual(SC.businessTaxFields("subscription", false), { tax_id_collection: { enabled: true }, billing_address_collection: "required" });
  assert.deepEqual(SC.businessTaxFields("payment", false), { tax_id_collection: { enabled: true }, billing_address_collection: "required", invoice_creation: { enabled: true }, customer_creation: "always" });
  assert.deepEqual(SC.businessTaxFields("payment", true), { tax_id_collection: { enabled: true }, billing_address_collection: "required", invoice_creation: { enabled: true } });
  for (const f of [SC.businessTaxFields("payment", false), SC.businessTaxFields("subscription", true)]) {
    assert.ok(!("automatic_tax" in f));
  }
});

test("P5 add-on record: keyed by subscription, other lines kept, idempotent, cancellation stamped once", () => {
  const notes = AS.writeAddon("servolia-topup: +50 | month: 2026-10 | session: cs_t", { subscription: "sub_a", addon: "email", since: "2026-10-02", session: "cs_a", amountEur: 12 });
  assert.ok(notes.startsWith("servolia-topup: +50"));
  assert.equal(AS.addonFor(notes, "sub_a").addon, "email");
  assert.equal(AS.addonFor(notes, "sub_b"), null);
  assert.equal(AS.writeAddon(notes, { subscription: "sub_a", addon: "email", since: "2026-10-02", session: "cs_a", amountEur: 12 }), notes, "writing the same add-on twice changed the notes");
  const cancelled = AS.markAddonCancelled(notes, "sub_a", "2026-11-02");
  assert.equal(AS.addonFor(cancelled, "sub_a").cancelled, "2026-11-02");
  assert.equal(AS.markAddonCancelled(cancelled, "sub_a", "2026-12-01"), cancelled, "re-stamped");
  assert.equal(AS.markAddonCancelled(notes, "sub_zzz", "2026-11-02"), null);
  // `_` in an id is not a wildcard for the exact check.
  assert.equal(AS.addonFor(notes, "subXa"), null);
});

test("P7 reverse charge: only an eu_vat number with an EU billing address; EN and FR wording; receipts unchanged otherwise", () => {
  const fr = { tax_ids: [{ type: "eu_vat", value: "fr12345678901" }], address: { country: "FR" } };
  assert.equal(VAT.reverseChargeVat(fr), "FR12345678901");
  assert.equal(VAT.reverseChargeVat({ ...fr, address: { country: "US" } }), null, "a US address is not reverse charge");
  assert.equal(VAT.reverseChargeVat({ tax_ids: [{ type: "gb_vat", value: "GB1" }], address: { country: "GB" } }), null);
  assert.equal(VAT.reverseChargeVat({ address: { country: "FR" } }), null, "no VAT number, no mention");
  const E = { subject: "S", html: "<p>body</p>\n      <p class=\"sv-faint\">\n        Servolia LLC &middot; Wyoming, USA\n      </p>\n</body></html>" };
  assert.equal(VAT.withReverseCharge(E, null, "en"), E);
  // A FRENCH buyer is pointed at the CGI, in the receipt's language...
  const en = VAT.withReverseCharge(E, fr, "en").html;
  assert.ok(en.includes("Reverse charge — VAT due by the customer (Article 283-2 of the French General Tax Code, CGI)."), en);
  assert.ok(!en.includes("Directive"), "a French buyer was cited the Directive");
  assert.ok(en.includes("FR12345678901"));
  assert.ok(en.indexOf("Reverse charge") > en.indexOf("Wyoming, USA"), "not in the footer");
  assert.ok(VAT.withReverseCharge(E, fr, "fr").html.includes("Autoliquidation — TVA due par le preneur (article 283-2 du CGI)."));
  // ...any other EU buyer at the Directive, never the French code.
  const de = { tax_ids: [{ type: "eu_vat", value: "DE123456789" }], address: { country: "DE" } };
  const deEn = VAT.withReverseCharge(E, de, "en").html;
  assert.ok(deEn.includes("Reverse charge — VAT to be accounted for by the customer (Article 196, Directive 2006/112/EC)."));
  assert.ok(!deEn.includes("CGI"), "a German buyer was cited the French code");
  const deFr = VAT.withReverseCharge(E, de, "fr").html;
  assert.ok(deFr.includes("Autoliquidation — TVA due par le preneur (article 196 de la directive 2006/112/CE)."));
  assert.ok(!deFr.includes("CGI"));
  assert.equal(VAT.readVatNote(VAT.writeVatNote("keep", fr)), "FR12345678901");
  assert.equal(VAT.writeVatNote("keep", null), "keep");
});

test("P7 the real email wrapper still carries the footer anchor withReverseCharge inserts after", async () => {
  const E = await import("../src/lib/email.ts");
  const tpl = E.topupReceiptEmail({ businessName: "Cabinet", conversations: 50, priceEur: 49, month: "2026-10", lang: "fr" });
  const out = VAT.withReverseCharge(tpl, { tax_ids: [{ type: "eu_vat", value: "FR1" }], address: { country: "FR" } }, "fr");
  assert.ok(out.html.includes("Autoliquidation"));
  assert.ok(out.html.indexOf("Autoliquidation") < out.html.indexOf("</body>"));
  assert.ok(out.html.includes("Wyoming, USA\n      </p>\n      <p"), "the mention did not land in the footer");
});

/* ══ P1 — invoices match by SUBSCRIPTION only ═════════════════════════ */

test("P1 a STANDALONE paid invoice on a returning client's customer touches nothing: no status, no auto-renew, no gate, no notice", async () => {
  clear();
  seed({
    hosting_clients: [
      { id: "h-churned", business: "Gone Co", status: "churned", plan: "hosting", customer_id: "cus_back", subscription_id: "sub_gone", notes: null },
      { id: "h-susp", business: "Dark Co", status: "suspended", plan: "hosting", customer_id: "cus_back", subscription_id: "sub_dark", repo: "AmraniHub/x", notes: null },
    ],
    clients: [{ id: "c-back", business: "Back", customer_id: "cus_back", subscription_id: "sub_gone2", status: "churned" }],
  });
  // An owned-domain year invoiced on its own (ownedDomain.ts chargeOwnedRenewalInvoice): no subscription anywhere.
  const res = await send(evt("invoice.paid", { id: "in_own", object: "invoice", customer: "cus_back", amount_paid: 2790, currency: "usd", billing_reason: "manual", parent: null }));
  assert.equal(res.status, 200);
  assert.deepEqual(H.writes, [], "a standalone invoice wrote to a client row");
  assert.deepEqual(vercelCalls, [], "Vercel was called (auto-renew back on?)");
  assert.deepEqual(tg(), [], "the owner was told of a 'renewal' that is not one");
  assert.ok(!supaReads.some((r) => r.url.includes("customer_id")), "a row was looked up by customer");
});

test("P1 a standalone FAILED invoice marks nobody past due", async () => {
  clear();
  seed({ clients: [{ id: "c-x", customer_id: "cus_back", subscription_id: "sub_y", email: "x@y.fr", past_due_since: null }] });
  await send(evt("invoice.payment_failed", { id: "in_f", object: "invoice", customer: "cus_back", amount_due: 2790, currency: "usd", attempt_count: 1 }));
  assert.deepEqual(H.writes, []);
  assert.deepEqual(tg(), []);
});

test("P1/P2 a subscription invoice (dahlia shape) clears past_due by subscription_id only", async () => {
  clear();
  seed({ hosting_clients: [{ id: "h-ok", business: "Ok Co", status: "past_due", plan: "hosting", subscription_id: "sub_h", customer_id: "cus_h", notes: null }] });
  await send(evt("invoice.paid", { id: "in_p", object: "invoice", customer: "cus_h", amount_paid: 4200, currency: "usd", billing_reason: "subscription_cycle", parent: { type: "subscription_details", subscription_details: { subscription: "sub_h" } } }));
  const patches = H.writes.filter((w) => w.method === "PATCH");
  assert.ok(patches.length >= 2, JSON.stringify(H.writes));
  for (const w of patches) assert.equal(w.query, "?subscription_id=eq.sub_h");
  assert.equal(writesTo("hosting_clients", "PATCH")[0].body.status, "active");
  assert.ok(tg().some((t) => t.includes("Hosting") && t.includes("renewal")), JSON.stringify(tg()));
});

/* ══ P4 — an exception is a 500 and one alert ════════════════════════ */

test("P4 a handler exception answers 500 (Stripe retries) and alerts the owner ONCE per event, however many retries", async () => {
  clear();
  const ev = evt("checkout.session.completed", null, "evt_bi_throws"); // data.object null: the handler throws
  const first = await send(ev);
  assert.equal(first.status, 500);
  const alerts = tg().filter((t) => t.startsWith("WEBHOOK FAILED"));
  assert.equal(alerts.length, 1, JSON.stringify(tg()));
  assert.ok(alerts[0].includes("evt_bi_throws") && alerts[0].includes("checkout.session.completed"));
  H.outbound.length = 0;
  const retry = await send(ev);
  assert.equal(retry.status, 500);
  assert.equal(tg().filter((t) => t.startsWith("WEBHOOK FAILED")).length, 0, "the retry alerted again");
});

/* ══ P5 — add-ons recorded ═══════════════════════════════════════════ */

const addonSession = (id = "cs_add") => evt("checkout.session.completed", {
  id, object: "checkout.session", mode: "subscription", payment_status: "paid", amount_total: 1200, currency: "eur",
  customer: "cus_plan", subscription: "sub_add2", customer_details: { email: "AD@x.fr" }, metadata: { kind: "addon", addon: "email", email: "ad@x.fr" },
});
const addonClient = (notes = null) => ({ id: "c-a", business: "Cabinet Addon", email: "ad@x.fr", status: "active", subscription_id: "sub_plan", notes });

test("P5 an add-on purchase is recorded on the client's row by its subscription id, and the owner notice names the client", async () => {
  clear();
  seed({ clients: [addonClient()] });
  const res = await send(addonSession());
  assert.equal(res.status, 200);
  const [w] = writesTo("clients", "PATCH");
  assert.ok(w, JSON.stringify(H.writes));
  assert.equal(w.query, "?id=eq.c-a");
  assert.match(w.body.notes, /^servolia-addon: sub: sub_add2 \| addon: email \| since: \d{4}-\d{2}-\d{2} \| session: cs_add \| amount: 12$/);
  const notice = tg().find((t) => t.includes("add-on Extra mailbox"));
  assert.ok(notice && notice.includes("Cabinet Addon") && notice.includes("Recorded on Cabinet Addon"), JSON.stringify(tg()));
});

test("P5 a redelivered add-on purchase writes nothing and asks nothing", async () => {
  clear();
  seed({ clients: [addonClient(AS.writeAddon(null, { subscription: "sub_add2", addon: "email", since: "2026-10-02" }))] });
  const res = await send(addonSession());
  assert.deepEqual(await res.json(), { received: true, line: "addon", replay: true });
  assert.deepEqual(H.writes, []);
  assert.deepEqual(tg(), []);
});

test("P5 an add-on with no client row is provisioned but flagged NOT RECORDED", async () => {
  clear();
  await send(addonSession());
  assert.ok(tg().some((t) => t.includes("NOT RECORDED")), JSON.stringify(tg()));
  assert.deepEqual(writesTo("clients", "PATCH"), []);
});

test("P5 an add-on's failed renewal names the client and the add-on; the plan row is not marked past due", async () => {
  clear();
  seed({ clients: [addonClient(AS.writeAddon(null, { subscription: "sub_add2", addon: "email", since: "2026-10-01" }))] });
  await send(evt("invoice.payment_failed", { id: "in_af", object: "invoice", customer: "cus_plan", amount_due: 1200, currency: "eur", attempt_count: 1, parent: { subscription_details: { subscription: "sub_add2" } } }));
  const alert = tg().find((t) => t.includes("Add-on payment failed"));
  assert.ok(alert && alert.includes("Cabinet Addon") && alert.includes("Extra mailbox"), JSON.stringify(tg()));
  assert.deepEqual(H.writes, [], "a row was marked past due for an add-on");
});

test("P5 an add-on's cancellation names the client (not 'Unknown client') and stamps the record cancelled", async () => {
  clear();
  seed({ clients: [addonClient(AS.writeAddon(null, { subscription: "sub_add2", addon: "email", since: "2026-10-01" }))] });
  await send(evt("customer.subscription.deleted", { id: "sub_add2", object: "subscription", customer: "cus_plan", items: { data: [] } }));
  const notice = tg().find((t) => t.includes("Subscription ended"));
  assert.ok(notice && notice.includes("Cabinet Addon") && notice.includes("add-on Extra mailbox"), JSON.stringify(tg()));
  assert.ok(!notice.includes("Unknown client"));
  const stamp = writesTo("clients", "PATCH").find((w) => w.query === "?id=eq.c-a");
  assert.ok(stamp && AS.addonFor(stamp.body.notes, "sub_add2").cancelled, JSON.stringify(H.writes));
});

/* ══ P6 — a paid extra domain is never silent ════════════════════════ */

const extraDomain = (id = "cs_dom") => evt("checkout.session.completed", {
  id, object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 2790, currency: "usd",
  customer: "cus_h", customer_details: { email: "h@x.fr" }, metadata: { kind: "domain_addon", domain: "extra-bi.com", domain_retail_usd: "27.9", subscription_id: "sub_h", ref: "" },
});

test("P6 an extra domain whose hosting row is not found: 500 (Stripe retries) and the owner is alerted once", async () => {
  clear();
  const ev = extraDomain();
  const res = await send(ev);
  assert.equal(res.status, 500);
  assert.ok(tg().some((t) => t.includes("Extra domain paid, NOT bought") && t.includes("extra-bi.com")), JSON.stringify(tg()));
  H.outbound.length = 0;
  await send(ev);
  assert.equal(tg().length, 0, "the retry alerted again");
});

test("P6 a domain the row already records from ANOTHER payment is alerted as paid again; the SAME session's redelivery is quiet", async () => {
  clear();
  seed({ hosting_clients: [{ id: "h-d", business: "Dom Co", subscription_id: "sub_h", notes: writeExtraDomain(null, { domain: "extra-bi.com", retailUsd: 27.9, boughtAt: "2026-09-01", orderId: "o1", session: "cs_first" }) }] });
  const res = await send(extraDomain("cs_second"));
  assert.equal(res.status, 200);
  assert.ok(tg().some((t) => t.includes("Extra domain paid AGAIN") && t.includes("cs_first")), JSON.stringify(tg()));
  assert.deepEqual(vercelCalls, [], "bought again");
  clear();
  seed({ hosting_clients: [{ id: "h-d", business: "Dom Co", subscription_id: "sub_h", notes: writeExtraDomain(null, { domain: "extra-bi.com", retailUsd: 27.9, boughtAt: "2026-09-01", orderId: "o1", session: "cs_first" }) }] });
  const again = await send(extraDomain("cs_first"));
  assert.deepEqual(await again.json(), { received: true, line: "extra-domain", replay: true });
  assert.deepEqual(tg(), []);
});

test("P6 a first purchase records its session on the extra-domain line", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    seed({ hosting_clients: [{ id: "h-d", business: "Dom Co", subscription_id: "sub_h", notes: null }] });
    await send(extraDomain("cs_new"));
    const [claim, w] = writesTo("hosting_clients", "PATCH");
    // First the atomic claim (item 11), then the outcome, which replaces it.
    assert.match(claim.query, /notes=is\.null/);
    assert.ok(claim.body.notes.startsWith("servolia-extra-domain-claim: extra-bi.com | session: cs_new"), claim.body.notes);
    assert.ok(w.body.notes.includes("domain: extra-bi.com") && w.body.notes.includes("session: cs_new"), w.body.notes);
    assert.ok(!w.body.notes.includes("servolia-extra-domain-claim:"), "the claim line outlived the purchase");
    assert.ok(vercelCalls.some((u) => u.includes("/buy")), "control: a won claim buys");
  }));

test("11 extra domain, two deliveries at once: the one that loses the claim buys nothing and says nothing", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    net.casLose = true;
    seed({ hosting_clients: [{ id: "h-d", business: "Dom Co", subscription_id: "sub_h", notes: null }] });
    const res = await send(extraDomain("cs_race"));
    assert.deepEqual(await res.json(), { received: true, line: "extra-domain", concurrent: true });
    assert.ok(!vercelCalls.some((u) => u.includes("/buy")), "both deliveries reached the registrar");
    assert.deepEqual(tg(), []);
  }));

test("11 extra domain whose earlier claim never resolved: nothing bought again, the owner is told once", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    const notes = "servolia-extra-domain-claim: extra-bi.com | session: cs_first | since: 2026-10-02T00:00:00.000Z";
    seed({ hosting_clients: [{ id: "h-d", business: "Dom Co", subscription_id: "sub_h", notes }] });
    const ev = extraDomain("cs_first");
    await send(ev);
    assert.ok(!vercelCalls.some((u) => u.includes("/buy")));
    assert.ok(tg().some((t) => t.includes("never recorded how it ended")), JSON.stringify(tg()));
    H.outbound.length = 0;
    await send(ev);
    assert.deepEqual(tg(), [], "told twice");
  }));

test("11 a claim line is invisible to everything that reads extra domains (billing cron, account page)", () => {
  const notes = "servolia-extra-domain-claim: extra-bi.com | session: cs_x | since: 2026-10-02T00:00:00.000Z";
  assert.deepEqual(readExtraDomains(notes), []);
});

/* ══ P10 — funded, and claimed atomically ════════════════════════════ */

const hostWithDomain = (fields = {}) => {
  const e = H.hostingPurchase(true, "");
  Object.assign(e.data.object, fields);
  return e;
};

test("P10 control: a funded plan domain IS bought (the guard below is not just 'never buy')", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    await send(hostWithDomain());
    assert.ok(vercelCalls.some((u) => u.includes("/buy")), JSON.stringify(vercelCalls));
    const claim = writesTo("hosting_clients", "PATCH").find((w) => /notes=is\.null/.test(w.query));
    assert.ok(claim && claim.body.notes.includes("note: purchasing since"), "no atomic claim before the purchase");
  }));

test("P10 a promotion code that takes the total to 0: the domain is NOT bought, recorded pending, and the owner is told", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    await send(hostWithDomain({ amount_total: 0, payment_status: "no_payment_required" }));
    assert.ok(!vercelCalls.some((u) => u.includes("/buy")), "bought a domain nobody paid for");
    const alert = tg().find((t) => t.startsWith("DOMAIN NOT BOUGHT"));
    assert.ok(alert && alert.includes("does not cover the domain") && alert.includes("Nothing was spent"), JSON.stringify(tg()));
    const rec = writesTo("hosting_clients", "PATCH").find((w) => w.body?.notes?.includes("servolia-domain:"));
    assert.ok(rec && rec.body.notes.includes("status: pending"), JSON.stringify(H.writes));
  }));

test("P10 a total below Vercel's cost (domain_cost_usd) is not bought either", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    const e = hostWithDomain({ amount_total: 900 });
    e.data.object.metadata.domain_cost_usd = "11.25";
    await send(e);
    assert.ok(!vercelCalls.some((u) => u.includes("/buy")));
  }));

test("P10 two deliveries at once: the one that loses the claim buys nothing, emails nothing, alerts nothing", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    net.casLose = true;
    const res = await send(hostWithDomain());
    assert.deepEqual(await res.json(), { received: true, line: "hosting", concurrent: true });
    assert.ok(!vercelCalls.some((u) => u.includes("/buy")), "both deliveries reached the registrar");
    assert.deepEqual(clientMails(), [], "a second receipt");
    assert.ok(!tg().some((t) => t.includes("Paid:")), "a second owner notice");
  }));

test("P10 an earlier delivery's claim never resolved: nothing is bought, the owner checks Vercel, the claim is left in place", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    const claimed = writeDomainRecord(null, { domain: "harness-example.com", status: "pending", retailUsd: 20, note: "purchasing since 2026-10-02T00:00:00.000Z" });
    seed({ hosting_clients: [{ id: "h-int", subscription_id: "sub_host1", email: "host@example.com", notes: claimed }] });
    await send(hostWithDomain());
    assert.ok(!vercelCalls.some((u) => u.includes("/buy")));
    assert.ok(tg().some((t) => t.includes("an earlier delivery started buying it")), JSON.stringify(tg()));
    assert.ok(!writesTo("hosting_clients", "PATCH").some((w) => w.body?.site_url), "the claim was overwritten");
  }));

/* ══ P3 — the webhook's second-subscription alerts ═══════════════════ */

test("P3/4 a second live PLAN for the same address is alerted as 'second practice or duplicate?' — never 'refund', nothing cancelled", async () => {
  clear();
  seed({ clients: [{ id: "c-old", email: "Dup@example.com", status: "active", subscription_id: "sub_old", plan: "croissance", created_at: "2026-01-01" }] });
  const res = await send(H.planPurchase(true, "dup@example.com"));
  assert.equal(res.status, 200);
  const alert = tg().find((t) => t.startsWith("Second plan for the same email"));
  assert.ok(alert && alert.includes("sub_old") && alert.includes("sub_plan1"), JSON.stringify(tg()));
  assert.ok(alert.includes("Second practice or duplicate? Check with the client before refunding"), alert);
  assert.ok(!/Cancel and refund/i.test(alert), alert);
  assert.deepEqual(stripeCalls.filter((c) => c.op !== "sessions.create"), [], "something was changed in Stripe");
});

test("P3 a first plan (no other live row; a churned one does not count) is not alerted", async () => {
  clear();
  seed({ clients: [{ id: "c-gone", email: "dup@example.com", status: "churned", subscription_id: "sub_old", plan: "essentiel" }] });
  await send(H.planPurchase(true, "dup@example.com"));
  assert.ok(!tg().some((t) => t.startsWith("Second plan")), JSON.stringify(tg()));
});

test("P3 hosting: a second live subscription for the SAME site is alerted; another site of the same owner is not", async () => {
  const repo = "AmraniHub/yiwugoodsco-com";
  clear();
  seed({ hosting_clients: [{ id: "h-old", email: "host@example.com", plan: "hosting_business", status: "active", subscription_id: "sub_old_h", repo }] });
  await send(H.hostingPurchase(true, "goodscochina"));
  assert.ok(tg().some((t) => t.startsWith("SECOND SUBSCRIPTION for the same site") && t.includes("sub_old_h")), JSON.stringify(tg()));
  clear();
  seed({ hosting_clients: [{ id: "h-other", email: "host@example.com", plan: "hosting", status: "active", subscription_id: "sub_other_site", repo: "AmraniHub/another-site" }] });
  await send(H.hostingPurchase(true, "goodscochina"));
  assert.ok(!tg().some((t) => t.startsWith("SECOND SUBSCRIPTION")), JSON.stringify(tg()));
});

/* ══ P3 / P7 — the checkouts ═════════════════════════════════════════ */

/** A route request; `as` = the logged-in portal client (their signed session cookie). */
const post = async (route, body, { as } = {}) => {
  const headers = { "content-type": "application/json", origin: "https://servolia.com" };
  if (as) headers.cookie = `${getClientCookieName()}=${await createClientSession(as)}`;
  return route.POST(new NextRequest("https://servolia.com/api/x", { method: "POST", body: JSON.stringify(body), headers }));
};
const planCheckout = await import("../src/app/api/checkout-subscription/route.ts");
const hostingCheckout = await import("../src/app/api/hosting-checkout/route.ts");

test("P3 plan checkout: a LOGGED-IN client with a live plan is refused before Stripe and sent to the portal; the notice explains a second practice, in their language", async () => {
  clear();
  seed({ clients: [{ id: "c-live", email: "Live@Cabinet.fr", status: "active", subscription_id: "sub_live", customer_id: "cus_live", created_at: "2026-09-01" }] });
  const res = await post(planCheckout, { plan: "essentiel", billing: "monthly", lang: "fr" }, { as: "live@cabinet.fr" });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.url, "https://servolia.com/portal?notice=has-plan&lang=fr");
  assert.ok(body.error.startsWith("Vous avez déjà un abonnement Servolia"), body.error);
  assert.ok(body.error.includes("second cabinet") && body.error.includes("hello@servolia.com"), body.error);
  assert.equal(stripeCalls.length, 0, "a checkout session was still created");
  const { HAS_PLAN_TEXT } = await import("../src/lib/planNotice.ts");
  assert.ok(HAS_PLAN_TEXT.en.includes("second practice") && HAS_PLAN_TEXT.en.includes("hello@servolia.com"));
});

test("3 plan checkout: an address typed in the BODY is only a prefill — no refusal (nothing revealed), no existing customer selected", async () => {
  clear();
  seed({ clients: [{ id: "c-live", email: "live@cabinet.fr", status: "active", subscription_id: "sub_live", customer_id: "cus_live", created_at: "2026-09-01" }] });
  const res = await post(planCheckout, { plan: "essentiel", email: "live@cabinet.fr", billing: "monthly", lang: "fr" });
  assert.equal(res.status, 200, "an anonymous caller learned that this address pays us");
  assert.equal(stripeCalls[0].p.customer, undefined, "a stranger's checkout was put on a client's Stripe customer");
  assert.equal(stripeCalls[0].p.customer_email, "live@cabinet.fr");
  assert.ok(!supaReads.some((r) => r.table === "clients"), "an anonymous body address was looked up at all");
});

test("P3/P7 plan checkout: a returning (churned) client reuses their Stripe customer; tax ID + billing address collected; no automatic tax", async () => {
  clear();
  seed({ clients: [{ id: "c-gone", email: "back@cabinet.fr", status: "churned", subscription_id: "sub_gone", customer_id: "cus_back", created_at: "2026-01-01" }] });
  const res = await post(planCheckout, { plan: "essentiel", billing: "monthly", lang: "en" }, { as: "back@cabinet.fr" });
  assert.equal(res.status, 200);
  const [{ p }] = stripeCalls;
  assert.equal(p.customer, "cus_back");
  assert.equal(p.customer_email, undefined, "customer and customer_email together are refused by Stripe");
  assert.deepEqual(p.customer_update, { name: "auto", address: "auto" });
  assert.deepEqual(p.tax_id_collection, { enabled: true });
  assert.equal(p.billing_address_collection, "required");
  assert.equal(p.automatic_tax, undefined);
  assert.equal(p.invoice_creation, undefined, "invoice_creation is payment-mode only");
});

test("P3 plan checkout: a look-alike address (marie_x vs marieXx) neither blocks nor lends its customer", async () => {
  clear();
  seed({ clients: [{ id: "c-look", email: "marieXdubois@cabinet.fr", status: "active", subscription_id: "sub_l", customer_id: "cus_look" }] });
  const res = await post(planCheckout, { plan: "essentiel", billing: "monthly", lang: "en" }, { as: "marie_dubois@cabinet.fr" });
  assert.equal(res.status, 200);
  assert.equal(stripeCalls[0].p.customer, undefined);
  assert.equal(stripeCalls[0].p.customer_email, "marie_dubois@cabinet.fr");
});

test("P3 hosting checkout: a live subscription for the same site is refused (bilingual); another site of the same owner goes through on their customer", async () => {
  const repo = "AmraniHub/yiwugoodsco-com";
  const owner = "samiramousa77@hotmail.com"; // the goodscochina ref's agreed address
  clear();
  seed({ hosting_clients: [{ id: "h-live", email: owner, plan: "hosting", status: "active", subscription_id: "sub_live_h", repo, customer_id: "cus_h" }] });
  const res = await post(hostingCheckout, { plan: "hosting", billing: "monthly", ref: "goodscochina", lang: "fr" });
  assert.equal(res.status, 409);
  // A known client is answered in THEIR language (langFor), whatever the page posted.
  const { langFor } = await import("../src/lib/clientRefs.ts");
  const want = langFor("goodscochina", "fr") === "fr" ? "Ce site a déjà un abonnement actif" : "This site already has an active subscription";
  assert.ok((await res.json()).error.startsWith(want));
  assert.equal(stripeCalls.length, 0);
  clear();
  seed({ hosting_clients: [{ id: "h-other", email: owner, plan: "hosting", status: "active", subscription_id: "sub_other", repo: "AmraniHub/other-site", customer_id: "cus_h" }] });
  const ok = await post(hostingCheckout, { plan: "hosting", billing: "monthly", ref: "goodscochina", lang: "en" });
  assert.equal(ok.status, 200);
  const { p } = stripeCalls[0];
  assert.equal(p.customer, "cus_h");
  assert.deepEqual(p.tax_id_collection, { enabled: true });
  assert.equal(p.billing_address_collection, "required");
});

test("P3 hosting checkout, LOGGED-IN client buying a domain that their live row already hosts: refused in French when the page is French", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    seed({ hosting_clients: [{ id: "h-dom", email: "fr@cabinet.fr", plan: "hosting", status: "active", subscription_id: "sub_fr", site_url: "https://www.bi-site.com", customer_id: "cus_fr" }] });
    const res = await post(hostingCheckout, { plan: "hosting", billing: "annual", lang: "fr", buyDomain: true, domain: "bi-site.com" }, { as: "fr@cabinet.fr" });
    assert.equal(res.status, 409);
    assert.ok((await res.json()).error.startsWith("Ce site a déjà un abonnement actif"));
    assert.equal(stripeCalls.length, 0);
  }));

test("3 hosting checkout: the same purchase with the address only in the BODY — not refused, no existing customer, the address only prefilled", () =>
  withEnv(VERCEL_ENV, async () => {
    clear();
    seed({ hosting_clients: [{ id: "h-dom", email: "fr@cabinet.fr", plan: "hosting", status: "active", subscription_id: "sub_fr", site_url: "https://www.bi-site.com", customer_id: "cus_fr" }] });
    const res = await post(hostingCheckout, { plan: "hosting", billing: "annual", email: "fr@cabinet.fr", lang: "fr", buyDomain: true, domain: "bi-site.com" });
    assert.equal(res.status, 200, "an anonymous caller learned that this address pays us");
    assert.equal(stripeCalls[0].p.customer, undefined);
    assert.equal(stripeCalls[0].p.customer_email, "fr@cabinet.fr");
  }));

test("5 a stored customer Stripe no longer has: the checkout is retried ONCE as a new customer (address prefilled), and that id is not offered again", async () => {
  clear();
  seed({ clients: [{ id: "c-gone", email: "back@cabinet.fr", status: "churned", subscription_id: "sub_gone", customer_id: "cus_deleted", created_at: "2026-01-01" }] });
  stripeState.createFailsFor = "cus_deleted";
  const res = await post(planCheckout, { plan: "essentiel", billing: "monthly", lang: "en" }, { as: "back@cabinet.fr" });
  assert.equal(res.status, 200);
  assert.equal(stripeCalls.length, 2);
  assert.equal(stripeCalls[0].p.customer, "cus_deleted");
  const retry = stripeCalls[1].p;
  assert.equal(retry.customer, undefined);
  assert.equal(retry.customer_update, undefined, "customer_update without a customer is refused by Stripe");
  assert.equal(retry.customer_email, "back@cabinet.fr");
  assert.deepEqual(retry.tax_id_collection, { enabled: true });
  stripeCalls.length = 0;
  await post(planCheckout, { plan: "essentiel", billing: "monthly", lang: "en" }, { as: "back@cabinet.fr" });
  assert.equal(stripeCalls.length, 1, "the stale customer was tried again");
  assert.equal(stripeCalls[0].p.customer, undefined);
});

test("5 withStaleCustomerRetry: payment mode gets customer_creation on the retry; any other error is rethrown, not retried", async () => {
  const calls = [];
  const missing = Object.assign(new Error("No such customer: 'cus_x'"), { code: "resource_missing", param: "customer" });
  const fake = { checkout: { sessions: { create: async (p) => { calls.push(p); if (p.customer) throw missing; return { id: "cs" }; } } } };
  await SC.withStaleCustomerRetry(fake, "a@b.fr").checkout.sessions.create({ mode: "payment", customer: "cus_x", customer_update: { name: "auto" } });
  assert.deepEqual(calls[1], { mode: "payment", customer_email: "a@b.fr", customer_creation: "always" });
  const other = { checkout: { sessions: { create: async () => { calls.push("x"); throw Object.assign(new Error("rate limited"), { code: "rate_limit" }); } } } };
  calls.length = 0;
  await assert.rejects(SC.withStaleCustomerRetry(other, "a@b.fr").checkout.sessions.create({ mode: "payment", customer: "cus_y" }), /rate limited/);
  assert.equal(calls.length, 1);
});

test("P3/P7 every business checkout passes the shared buyer and tax fields; nothing enables automatic tax or Managed Payments", () => {
  const routes = [
    "src/app/api/checkout/route.ts", "src/app/api/checkout-subscription/route.ts", "src/app/api/checkout-addon/route.ts",
    "src/app/api/checkout-topup/route.ts", "src/app/api/checkout-receptionist/route.ts", "src/app/api/hosting-checkout/route.ts",
    "src/app/api/admin/hosting/checkout/route.ts", "src/app/api/admin/custom-requests/route.ts",
  ];
  for (const f of routes) {
    const s = src(f);
    let i = 0;
    let calls = 0;
    while ((i = s.indexOf("checkout.sessions.create(", i)) !== -1) {
      calls++;
      const head = s.slice(i, i + 1500);
      assert.ok(head.includes("businessTaxFields("), `${f}: a session without the tax fields`);
      assert.ok(head.includes("buyerFields("), `${f}: a session without the shared buyer fields`);
      assert.ok(!/customer_email:/.test(head), `${f}: a bare customer_email (a new Stripe customer every time)`);
      i += 10;
    }
    assert.ok(calls >= 1, f);
  }
  const offenders = [];
  const walk = (dir) => {
    for (const x of readdirSync(dir)) {
      const p = path.join(dir, x);
      if (statSync(p).isDirectory()) walk(p);
      // A params KEY, not the words in a comment explaining why it is absent.
      else if (/\.(ts|tsx)$/.test(x) && /(automatic_tax|managed_payments)\s*:/.test(src(path.relative(ROOT, p)))) offenders.push(p);
    }
  };
  walk(path.join(ROOT, "src"));
  assert.deepEqual(offenders, []);
});

test("9 the two DOMAIN checkouts collect a VAT number + billing address and create an invoice too", async () => {
  for (const f of ["src/lib/domainOrders.ts", "src/lib/domainCheckout.ts"]) {
    const s = src(f);
    const i = s.indexOf("checkout.sessions.create({");
    assert.ok(i > 0, f);
    assert.ok(s.slice(i, i + 1500).includes('businessTaxFields("payment"'), `${f}: no tax fields`);
  }
  // The panel domain is billed to the subscription's existing customer: Stripe needs name + address "auto".
  assert.match(src("src/lib/domainCheckout.ts"), /customer_update: \{ name: "auto", address: "auto" \}/);
  // And it really reaches Stripe that way.
  const { domainCheckoutUrl } = await import("../src/lib/domainCheckout.ts");
  clear();
  stripeState.subs.sub_dc = { id: "sub_dc", customer: "cus_dc", status: "active", metadata: {}, items: { data: [] } };
  await domainCheckoutUrl({ subscriptionId: "sub_dc", domain: "x-bi.com", retailUsd: 27.9, ref: "", email: null, origin: "https://servolia.com" });
  const { p } = stripeCalls.find((c) => c.op === "sessions.create");
  assert.equal(p.customer, "cus_dc");
  assert.deepEqual(p.tax_id_collection, { enabled: true });
  assert.equal(p.billing_address_collection, "required");
  assert.deepEqual(p.invoice_creation, { enabled: true });
  assert.equal(p.customer_creation, undefined, "customer_creation with an existing customer is refused by Stripe");
});

test("P9 the admin hosting link copies its metadata onto the SUBSCRIPTION (subscriptionContext reads it there)", () => {
  const s = src("src/app/api/admin/hosting/checkout/route.ts");
  assert.match(s, /subscription_data: \{ metadata: \{ \.\.\.metadata \} \}/);
  assert.match(s, /^\s+metadata,$/m);
  const block = s.slice(s.indexOf("const metadata: Record<string, string> = {"), s.indexOf("try {", s.indexOf("const metadata")));
  for (const k of ["kind: HOSTING_METADATA_KIND", "plan: hostingPlan.key", "period: billing", "business", "repo", "vercel_project: vercelProject"]) assert.ok(block.includes(k), k);
});

test("P9 applyOwnedDomainLink keeps the subscription metadata when it adds free days", async () => {
  const { applyOwnedDomainLink } = await import("../src/lib/ownedDomain.ts");
  const out = applyOwnedDomainLink({ mode: "subscription", subscription_data: { metadata: { plan: "hosting", business: "X" } }, metadata: { plan: "hosting" } }, { trialDays: 10, owned: null });
  assert.deepEqual(out.subscription_data, { metadata: { plan: "hosting", business: "X" }, trial_period_days: 10 });
});

/* ══ P8 — monthly → yearly only once paid ════════════════════════════ */

const { applyUpgrade, mintUpgradeToken } = await import("../src/lib/upgrade.ts");
const upgradeRoute = await import("../src/app/api/hosting-upgrade/route.ts");
function monthlySub() {
  stripeState.subs.sub_up = {
    id: "sub_up", status: "active", customer: "cus_u", metadata: { plan: "hosting", lang: "fr", period: "monthly", business: "Up Co" },
    items: { data: [{ id: "si_1", price: { product: "prod_1", unit_amount: 1000, recurring: { interval: "month" } } }] },
  };
}
/** The switch's unpaid invoice, as dahlia shapes it: the PaymentIntent is on its default InvoicePayment. */
const openSwitchInvoice = () => ({
  id: "in_up", status: "open", hosted_invoice_url: "https://invoice.stripe.test/i/in_up",
  payments: { data: [{ is_default: true, payment: { type: "payment_intent", payment_intent: "pi_up" } }] },
});

test("P8 a declined switch: nothing applied, the open invoice is voided, no metadata written, 'payment-failed'", async () => {
  clear();
  monthlySub();
  // A declined card: the invoice's default payment's PaymentIntent wants a new payment method.
  stripeState.updateAnswer = () => ({ id: "sub_up", pending_update: { expires_at: 1790086400 }, latest_invoice: openSwitchInvoice() });
  stripeState.piStatus = "requires_payment_method";
  const r = await applyUpgrade("sub_up");
  assert.deepEqual(r, { problem: "payment-failed" });
  assert.deepEqual(stripeCalls.filter((c) => c.op === "paymentIntents.retrieve").map((c) => c.id), ["pi_up"]);
  const updates = stripeCalls.filter((c) => c.op === "subscriptions.update");
  assert.equal(updates.length, 1, "metadata written after a failed charge");
  assert.equal(updates[0].p.payment_behavior, "pending_if_incomplete");
  assert.equal(updates[0].p.metadata, undefined, "pending updates refuse metadata");
  assert.deepEqual(stripeCalls.filter((c) => c.op === "invoices.void").map((c) => c.id), ["in_up"]);
});

test("P8 a paid switch: confirmed, then the period metadata is written", async () => {
  clear();
  monthlySub();
  stripeState.updateAnswer = (id, p) => (p.items ? { id, pending_update: null, latest_invoice: { id: "in_up", status: "paid" } } : { id });
  const r = await applyUpgrade("sub_up");
  assert.equal(r.ok, true);
  const updates = stripeCalls.filter((c) => c.op === "subscriptions.update");
  assert.equal(updates.length, 2);
  assert.equal(updates[1].p.metadata.period, "annual");
  assert.equal(stripeCalls.filter((c) => c.op === "invoices.void").length, 0);
});

test("P8 the route answers 402 on a declined switch and leaves our row and the client's email alone", async () => {
  clear();
  monthlySub();
  stripeState.updateAnswer = () => ({ id: "sub_up", pending_update: { expires_at: 1 }, latest_invoice: { id: "in_up", status: "open" } });
  const token = await mintUpgradeToken("sub_up");
  const res = await post(upgradeRoute, { token });
  assert.equal(res.status, 402);
  assert.deepEqual(await res.json(), { error: "payment-failed" });
  assert.deepEqual(H.writes, [], "the row was switched to annual");
  assert.deepEqual(mails(), []);
});

test("P8 the page explains a declined switch, a bank confirmation and an internal error in both languages", () => {
  const s = src("src/components/UpgradeConfirm.tsx");
  assert.ok(s.includes('"payment-failed": "Your card was declined, so nothing changed'));
  assert.ok(s.includes('"payment-failed": "Votre carte a été refusée, donc rien n\'a changé'));
  assert.ok(s.includes('"needs-authentication": "Your bank needs to confirm this payment.'));
  assert.ok(s.includes('"needs-authentication": "Votre banque doit confirmer ce paiement.'));
  assert.ok(s.includes('error: "Something went wrong on our side. Nothing changed and nothing was charged'));
  assert.ok(s.includes("error: \"Un problème est survenu de notre côté. Rien n'a changé et rien n'a été débité"));
  assert.match(s, /data\?\.error === "needs-authentication" && typeof data\.url === "string"/);
});

test("6 3-D Secure on the switch: NOT voided, NOT 'declined' — the client gets the invoice page to confirm on", async () => {
  clear();
  monthlySub();
  stripeState.updateAnswer = () => ({ id: "sub_up", pending_update: { expires_at: 1790086400 }, latest_invoice: openSwitchInvoice() });
  stripeState.piStatus = "requires_action";
  const r = await applyUpgrade("sub_up");
  assert.deepEqual(r, { problem: "needs-authentication", authUrl: "https://invoice.stripe.test/i/in_up" });
  assert.equal(stripeCalls.filter((c) => c.op === "invoices.void").length, 0, "voided an invoice the client can still confirm");
  assert.equal(stripeCalls.filter((c) => c.op === "subscriptions.update").length, 1, "metadata written before payment");
  // The route hands the page over, with 402, and touches nothing of ours.
  clear();
  monthlySub();
  stripeState.updateAnswer = () => ({ id: "sub_up", pending_update: { expires_at: 1790086400 }, latest_invoice: openSwitchInvoice() });
  stripeState.piStatus = "requires_action";
  const res = await post(upgradeRoute, { token: await mintUpgradeToken("sub_up") });
  assert.equal(res.status, 402);
  assert.deepEqual(await res.json(), { error: "needs-authentication", url: "https://invoice.stripe.test/i/in_up" });
  assert.deepEqual(H.writes, []);
});

test("2 a thrown CARD error is 'payment-failed'; any other thrown error is 'error' with its detail, never 'declined'", async () => {
  const { isCardError } = await import("../src/lib/upgrade.ts");
  assert.ok(isCardError({ type: "StripeCardError", code: "card_declined" }));
  assert.ok(isCardError({ code: "insufficient_funds" }));
  assert.ok(!isCardError({ type: "StripeConnectionError", message: "socket hang up" }));
  assert.ok(!isCardError({ type: "StripeInvalidRequestError", code: "parameter_invalid_empty" }));
  clear();
  monthlySub();
  stripeState.updateThrows = Object.assign(new Error("Your card was declined."), { type: "StripeCardError", code: "card_declined" });
  assert.deepEqual(await applyUpgrade("sub_up"), { problem: "payment-failed" });
  clear();
  monthlySub();
  stripeState.updateThrows = Object.assign(new Error("Received unknown parameter: items[0][price_data][product]"), { type: "StripeInvalidRequestError" });
  assert.deepEqual(await applyUpgrade("sub_up"), { problem: "error", detail: "Received unknown parameter: items[0][price_data][product]" });
});

test("2 the route: a non-card failure answers 502 'error' and Telegrams the owner the actual error (plain); nothing of ours changes", async () => {
  clear();
  monthlySub();
  stripeState.updateThrows = Object.assign(new Error("An error occurred with our connection to Stripe."), { type: "StripeConnectionError" });
  const res = await post(upgradeRoute, { token: await mintUpgradeToken("sub_up") });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: "error" });
  const alert = tg().find((t) => t.startsWith("Switch to yearly FAILED"));
  assert.ok(alert && alert.includes("sub_up") && alert.includes("connection to Stripe"), JSON.stringify(tg()));
  const tgBody = JSON.parse(H.outbound.find((o) => o.url.includes("api.telegram.org")).body);
  assert.equal(tgBody.parse_mode, undefined, "Markdown alert");
  assert.deepEqual(H.writes, []);
});

/* ══ 1 — the switch's failed invoice is not a failed renewal ═════════ */

const switchFailed = (sub = "sub_up") => evt("invoice.payment_failed", {
  id: "in_up", object: "invoice", customer: "cus_u", amount_due: 4000, currency: "usd", attempt_count: 1,
  billing_reason: "subscription_update", hosted_invoice_url: "https://invoice.stripe.test/i/in_up",
  parent: { subscription_details: { subscription: sub } },
});

test("1 a failed subscription_update invoice: no row marked past due, no client email, one quiet owner line, once", async () => {
  clear();
  seed({
    hosting_clients: [{ id: "h-up", business: "Up Co", email: "up@x.fr", plan: "hosting", subscription_id: "sub_up", past_due_since: null, payment_status: "ok" }],
    clients: [{ id: "c-up", business: "Plan Co", email: "plan@x.fr", plan: "essentiel", subscription_id: "sub_up", past_due_since: null }],
  });
  const ev = switchFailed();
  const res = await send(ev);
  assert.equal(res.status, 200);
  assert.deepEqual(H.writes, [], "a row was marked past due for a switch that changed nothing");
  assert.deepEqual(clientMails(), [], "the client was told their service stops");
  const quiet = H.outbound.filter((o) => o.url.includes("api.telegram.org")).map((o) => JSON.parse(o.body));
  assert.equal(quiet.length, 1, JSON.stringify(quiet));
  assert.ok(quiet[0].text.startsWith("Plan-change invoice not paid") && quiet[0].disable_notification === true, JSON.stringify(quiet[0]));
  H.outbound.length = 0;
  await send(ev);
  assert.deepEqual(tg(), [], "the redelivery spoke again");
});

test("1 control: a failed RENEWAL (subscription_cycle) on the same row is still handled as before", async () => {
  clear();
  seed({ hosting_clients: [{ id: "h-up", business: "Up Co", email: "up@x.fr", plan: "hosting", subscription_id: "sub_up", past_due_since: null, payment_status: "ok" }] });
  const ev = switchFailed();
  ev.data.object.billing_reason = "subscription_cycle";
  await send(ev);
  assert.equal(writesTo("hosting_clients", "PATCH")[0].body.status, "past_due");
  assert.equal(clientMails().length, 1);
});

test("1 invoice.voided: a row past due on exactly that invoice goes back to ok; a suspended one is left and the owner told; others untouched", async () => {
  const url = "https://invoice.stripe.test/i/in_v";
  const voided = evt("invoice.voided", { id: "in_v", object: "invoice", customer: "cus_v", status: "void", hosted_invoice_url: url, parent: { subscription_details: { subscription: "sub_v" } } });
  clear();
  seed({
    clients: [{ id: "c-v", business: "Plan V", subscription_id: "sub_v", open_invoice_url: url }],
    hosting_clients: [
      { id: "h-v", business: "Host V", subscription_id: "sub_v", status: "past_due", open_invoice_url: url },
      { id: "h-other", business: "Other", subscription_id: "sub_v", status: "past_due", open_invoice_url: "https://invoice.stripe.test/i/in_other" },
    ],
  });
  await send(voided);
  const pc = writesTo("clients", "PATCH");
  assert.deepEqual(pc.map((w) => w.query), ["?id=eq.c-v"]);
  assert.equal(pc[0].body.payment_status, "ok");
  const hc = writesTo("hosting_clients", "PATCH");
  assert.deepEqual(hc.map((w) => w.query), ["?id=eq.h-v"], "a row past due on ANOTHER invoice was cleared");
  assert.equal(hc[0].body.status, "active");
  clear();
  seed({ hosting_clients: [{ id: "h-s", business: "Dark V", subscription_id: "sub_v", status: "suspended", open_invoice_url: url }] });
  await send(voided);
  assert.deepEqual(H.writes, [], "a suspended site was lifted by a void");
  assert.ok(tg().some((t) => t.includes("Dark V is SUSPENDED")), JSON.stringify(tg()));
});

test("6 the client confirms 3-D Secure later: Stripe's invoice.paid (subscription_update) moves our row to yearly", async () => {
  clear();
  seed({ hosting_clients: [{ id: "h-up", business: "Up Co", plan: "hosting", status: "active", subscription_id: "sub_up", notes: null }] });
  stripeState.subs.sub_up = { id: "sub_up", customer: "cus_u", status: "active", metadata: { plan: "hosting", period: "monthly" }, items: { data: [{ price: { unit_amount: 9600, recurring: { interval: "year" } } }] } };
  await send(evt("invoice.paid", { id: "in_up", object: "invoice", customer: "cus_u", amount_paid: 9000, currency: "usd", billing_reason: "subscription_update", parent: { subscription_details: { subscription: "sub_up" } } }));
  const w = writesTo("hosting_clients", "PATCH").find((x) => x.body.billing_period);
  assert.deepEqual(w && w.body, { billing_period: "annual", monthly_usd: 8 });
  const meta = stripeCalls.find((c) => c.op === "subscriptions.update");
  assert.equal(meta.p.metadata.period, "annual");
});

/* ══ Lower priority ══════════════════════════════════════════════════ */

const subUpdated = (unit, interval = "month") => evt("customer.subscription.updated", {
  id: "sub_u", object: "subscription", status: "active", customer: "cus_u",
  items: { data: [{ quantity: 1, price: { unit_amount: unit, currency: "eur", recurring: { interval } } }] },
});
const planRow = () => ({ clients: [{ id: "c-u", business: "Cabinet U", email: "u@x.fr", plan: "essentiel", monthly_amount: 149, subscription_id: "sub_u", status: "active" }] });

test("subscription.updated: a plan changed by hand in Stripe is synced to clients.plan / monthly_amount, and the owner told", async () => {
  clear();
  seed(planRow());
  await send(subUpdated(PLANS.croissance.monthlyEur * 100));
  const [w] = writesTo("clients", "PATCH");
  assert.deepEqual(w.body, { plan: "croissance", monthly_amount: PLANS.croissance.monthlyEur });
  assert.equal(w.query, "?id=eq.c-u");
  assert.ok(tg().some((t) => t.startsWith("Plan changed in Stripe") && t.includes("Croissance")), JSON.stringify(tg()));
  clear();
  seed(planRow());
  await send(subUpdated(PLANS.croissance.annualEur * 100, "year"));
  assert.equal(writesTo("clients", "PATCH")[0].body.monthly_amount, Math.round(PLANS.croissance.annualEur * 100 / 12) / 100);
});

test("subscription.updated: the same price (a renewal, a status change) writes nothing and says nothing", async () => {
  clear();
  seed(planRow());
  await send(subUpdated(PLANS.essentiel.monthlyEur * 100));
  assert.deepEqual(H.writes, []);
  assert.deepEqual(tg(), []);
});

test("charge.dispute.created: the owner is alerted with the amount, the client and the evidence deadline", async () => {
  clear();
  seed({ clients: [{ id: "c-d", business: "Cabinet Dispute", email: "d@x.fr", customer_id: "cus_disp" }] });
  await send(evt("charge.dispute.created", { id: "dp_1", object: "dispute", amount: 14900, currency: "eur", charge: "ch_1", reason: "fraudulent", evidence_details: { due_by: Date.parse("2026-10-20T00:00:00Z") / 1000 } }));
  const alert = tg().find((t) => t.includes("Dispute opened"));
  assert.ok(alert, JSON.stringify(tg()));
  for (const s of ["€149", "Cabinet Dispute", "2026-10-20", "fraudulent", "https://servolia.com/admin/clients/c-d"]) assert.ok(alert.includes(s), `${s} missing: ${alert}`);
  assert.deepEqual(H.writes, []);
});

test("10 a redelivered dispute event alerts nothing the second time", async () => {
  clear();
  seed({ clients: [{ id: "c-d", business: "Cabinet Dispute", email: "d@x.fr", customer_id: "cus_disp" }] });
  const ev = evt("charge.dispute.created", { id: "dp_2", object: "dispute", amount: 14900, currency: "eur", charge: "ch_1", reason: "fraudulent", evidence_details: { due_by: 1790600000 } });
  await send(ev);
  assert.equal(tg().filter((t) => t.includes("Dispute opened")).length, 1);
  H.outbound.length = 0;
  await send(ev);
  assert.deepEqual(tg(), [], "the same dispute was announced twice");
});

test("7 top-up: credited to the row of metadata.email (the portal login our server set), even when Stripe's address differs", async () => {
  clear();
  seed({ clients: [
    { id: "c-login", business: "Cabinet Login", email: "login@cabinet.fr", status: "active", notes: null },
    { id: "c-typed", business: "Other Account", email: "typed@elsewhere.fr", status: "active", notes: null },
  ] });
  const res = await send(evt("checkout.session.completed", { id: "cs_top2", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 4900, currency: "eur", customer_details: { email: "typed@elsewhere.fr" }, metadata: { kind: "topup", conversations: "50", pack: "pack50", lang: "fr", email: "login@cabinet.fr" } }));
  assert.equal((await res.json()).credited, true);
  assert.deepEqual(writesTo("clients", "PATCH").map((w) => w.query), ["?id=eq.c-login"]);
});

test("7 top-up: with no row for metadata.email, Stripe's address is tried next", async () => {
  clear();
  seed({ clients: [{ id: "c-typed", business: "Typed", email: "typed@elsewhere.fr", status: "active", notes: null }] });
  await send(evt("checkout.session.completed", { id: "cs_top3", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 4900, currency: "eur", customer_details: { email: "typed@elsewhere.fr" }, metadata: { kind: "topup", conversations: "50", pack: "pack50", lang: "fr", email: "nobody@cabinet.fr" } }));
  assert.deepEqual(writesTo("clients", "PATCH").map((w) => w.query), ["?id=eq.c-typed"]);
});

test("7 add-on: recorded on the row of metadata.email, not on the account of the address typed at Stripe", async () => {
  clear();
  seed({ clients: [
    { ...addonClient(), id: "c-login", email: "login@cabinet.fr" },
    { ...addonClient(), id: "c-typed", email: "typed@elsewhere.fr", business: "Other Account" },
  ] });
  const ev = addonSession();
  ev.data.object.customer_details.email = "typed@elsewhere.fr";
  ev.data.object.metadata.email = "login@cabinet.fr";
  await send(ev);
  assert.deepEqual(writesTo("clients", "PATCH").map((w) => w.query), ["?id=eq.c-login"]);
});

test("top-up: credited by EXACT address — a look-alike (jeanXdupont) is never credited jean_dupont's pack", async () => {
  clear();
  seed({ clients: [{ id: "c-look", business: "Wrong", email: "jeanXdupont@cabinet.fr", status: "active", notes: null }] });
  const res = await send(evt("checkout.session.completed", { id: "cs_top", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 4900, currency: "eur", customer_details: { email: "jean_dupont@cabinet.fr" }, metadata: { kind: "topup", conversations: "50", pack: "pack50", lang: "fr" } }));
  assert.equal((await res.json()).credited, false);
  assert.deepEqual(writesTo("clients", "PATCH"), []);
  const lookup = supaReads.find((r) => r.table === "clients" && r.url.includes("email=ilike."));
  assert.ok(lookup.url.includes(`jean${BS}_dupont`), lookup.url);
});

/* ══ P3d — the daily billing check ═══════════════════════════════════ */

const cron = await import("../src/app/api/cron/billing-check/route.ts");
const cronGet = (auth = "Bearer cron_harness") => cron.GET(new NextRequest("https://servolia.com/api/cron/billing-check", { headers: auth ? { authorization: auth } : {} }));
const sub = (id, customer, status, unit, currency = "eur") => ({ id, customer, status, items: { data: [{ quantity: 1, price: { unit_amount: unit, currency } }] } });

test("billing check: refuses without the cron secret", async () => {
  clear();
  assert.equal((await cronGet(null)).status, 401);
  assert.equal((await cronGet("Bearer wrong")).status, 401);
});

test("billing check: flags a double plan (two customers, one address), an untracked subscription and a missing one; one alert; changes nothing", async () => {
  clear();
  seed({
    clients: [
      { id: "c1", email: "a@x.fr", business: "A", plan: "essentiel", status: "active", customer_id: "cus_a", subscription_id: "sub_a1", notes: AS.writeAddon(null, { subscription: "sub_add", addon: "email", since: "2026-10-01" }) },
      { id: "c2", email: "A@x.fr", business: "A again", plan: "croissance", status: "active", customer_id: "cus_a2", subscription_id: "sub_a2", notes: null },
      { id: "c3", email: "m@x.fr", business: "M", plan: "essentiel", status: "active", customer_id: "cus_m", subscription_id: "sub_m", notes: null },
      { id: "c4", email: "ok@x.fr", business: "Ok", plan: "essentiel", status: "active", customer_id: "cus_ok", subscription_id: "sub_ok", notes: null },
    ],
    hosting_clients: [{ id: "h1", email: "h@x.fr", business: "H", plan: "hosting", status: "active", customer_id: "cus_h", subscription_id: "sub_h", repo: "o/site", site_url: null }],
  });
  stripeState.subs = {
    sub_a1: sub("sub_a1", "cus_a", "active", 14900),
    sub_add: sub("sub_add", "cus_a", "active", 1200), // a recorded add-on: known, not a plan
    sub_x: sub("sub_x", "cus_a", "active", 999, "usd"), // nothing records it
    sub_a2: sub("sub_a2", "cus_a2", "trialing", 24900),
    sub_m: sub("sub_m", "cus_m", "canceled", 14900),
    sub_ok: sub("sub_ok", "cus_ok", "active", 14900),
    sub_h: sub("sub_h", "cus_h", "active", 800, "usd"),
  };
  const res = await cronGet();
  assert.equal(res.status, 200);
  const body = await res.json();
  const flags = body.report.map((r) => `${r.flag}:${r.subscription ?? r.subscriptions?.join("+")}`).sort();
  assert.deepEqual(flags, ["double:sub_a1+sub_a2", "missing:sub_m", "untracked:sub_x"], JSON.stringify(body.report));
  const alerts = tg().filter((t) => t.startsWith("Billing check"));
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0].includes("Nothing was changed"));
  // 4: two plans on one email may be a second practice — the owner is asked to check, not told to refund.
  assert.ok(alerts[0].includes("second plan for the same email") && alerts[0].includes("Second practice or duplicate? Check before refunding."), alerts[0]);
  assert.ok(!/cancel the extra subscription in Stripe \(with a refund/i.test(alerts[0]), alerts[0]);
  assert.deepEqual(H.writes, [], "the check wrote to the database");
  assert.deepEqual(stripeCalls.filter((c) => c.op !== "sessions.create"), [], "the check changed something in Stripe");
});

test("billing check: a clean book sends no alert", async () => {
  clear();
  seed({ clients: [{ id: "c4", email: "ok@x.fr", business: "Ok", plan: "essentiel", status: "active", customer_id: "cus_ok", subscription_id: "sub_ok", notes: null }] });
  stripeState.subs = { sub_ok: sub("sub_ok", "cus_ok", "active", 14900) };
  const body = await (await cronGet()).json();
  assert.equal(body.flagged, 0);
  assert.deepEqual(tg(), []);
});

test("billing check is scheduled with the other Vercel crons; the two new webhook events are in the setup script and the webhook's header", () => {
  const v = JSON.parse(src("vercel.json"));
  assert.ok(v.crons.some((c) => c.path === "/api/cron/billing-check"));
  const setup = src("scripts/stripe-setup.mjs");
  for (const e of ["customer.subscription.updated", "charge.dispute.created"]) {
    assert.ok(setup.includes(`"${e}"`), e);
    assert.ok(src("src/app/api/webhooks/stripe/route.ts").includes(e), e);
  }
  assert.match(src("src/app/api/cron/billing-check/route.ts"), /authorization"\) !== `Bearer \$\{process\.env\.CRON_SECRET\}`/);
});

test("documented: systemGuide explains it, roadmap holds the owner's Stripe dashboard steps", () => {
  const g = src("src/lib/systemGuide.ts");
  assert.ok(g.includes("Billing integrity"));
  assert.ok(g.includes("billing-check 06:30"));
  const r = src("src/lib/roadmap.ts");
  assert.ok(r.includes("customer.subscription.updated, charge.dispute.created"));
  assert.ok(r.includes("Settings > Billing > Invoices"));
});
