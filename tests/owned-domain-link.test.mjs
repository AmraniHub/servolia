/**
 * An admin hosting link for a domain we ALREADY own, with free days first
 * (src/lib/ownedDomain.ts). First client: Ithar Digital, 2026-09-25 -- the
 * domain ithardigital.com was bought on our Vercel team and attached to
 * project "ithar-digital" before they paid.
 *
 *   node --import ./tests/register.mjs --test tests/owned-domain-link.test.mjs
 *
 * The admin route itself is not driven: isAdminAuthed() needs Next's request
 * scope and the route's Stripe client talks node:https, not fetch. So the
 * session it sends is tested through the builder it calls, the refusal
 * through the Vercel check it calls, and the ORDER of those calls in the
 * route by reading it. The webhook IS driven, with signed events and a fake
 * Supabase (tests/webhook-harness.mjs).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as H from "./webhook-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const { POST, request } = await H.bootHarness();
const OD = await import("../src/lib/ownedDomain.ts");
const SM = await import("../src/lib/stripeMode.ts");
const { writeFulfilment } = await import("../src/lib/fulfilment.ts");

/* Stripe's own trial_end, deliberately NOT created + 14 days (5 Oct): the
   email must show the date Stripe will charge, not one worked out here. */
const TRIAL_END = Date.UTC(2026, 9, 9) / 1000; // 9 October 2026
const stripeReads = [];
SM.__setStripeFactoryForTests(() => ({
  subscriptions: {
    retrieve: async (id) => {
      stripeReads.push(id);
      return { id, customer: "cus_ith", status: "trialing", trial_end: TRIAL_END, metadata: {}, items: { data: [] } };
    },
  },
}));

const CONTACT = JSON.stringify({
  firstName: "A", lastName: "B", email: "reg@servolia.com", phone: "+212600000000",
  address1: "1 Rue", city: "Tangier", state: "TA", zip: "90000", country: "MA",
});
/* Every credential the domain-PURCHASE path needs, so that if this branch
   ever reached it, it would really call Vercel and the test would see it. */
const LIVE_ENV = { RESEND_API_KEY: "re_harness", VERCEL_TOKEN: "vt_harness", VERCEL_TEAM_ID: "team_harness", DOMAIN_CONTACT_JSON: CONTACT };
for (const [k, v] of Object.entries(LIVE_ENV)) process.env[k] = v;

const BASE_BODY = { business: "Ithar Digital", email: "owner@ithardigital.com", vercelProject: "ithar-digital" };

/* ══ 1. What the admin may send ═══════════════════════════════════════════ */

test("parse: nothing extra is an ordinary link", () => {
  assert.deepEqual(OD.parseOwnedDomainLink(BASE_BODY), { ok: true, value: { trialDays: 0, owned: null } });
  assert.deepEqual(OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: "", ownedDomain: " ", domainUsd: "" }), { ok: true, value: { trialDays: 0, owned: null } });
});

test("parse: Ithar's link — 14 free days, ithardigital.com at 27.90", () => {
  const r = OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: "14", ownedDomain: " ItharDigital.com ", domainUsd: "27.90" });
  assert.deepEqual(r, { ok: true, value: { trialDays: 14, owned: { domain: "ithardigital.com", usd: 27.9 } } });
  assert.equal(OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: 14, ownedDomain: "x-y.co.uk", domainUsd: 10.9 }).ok, true);
  assert.equal(OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: 30, ownedDomain: "ab.io", domainUsd: "79.90" }).ok, true);
});

test("parse: free days are a whole number 0-30", () => {
  for (const bad of ["31", 31, "-1", -1, "1.5", 1.5, "two", "1e1"]) {
    const r = OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: bad });
    assert.equal(r.ok, false, `trialDays ${JSON.stringify(bad)} accepted`);
  }
  assert.equal(OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: "30" }).ok, true);
  assert.equal(OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: 0 }).ok, true);
});

test("parse: the domain price is 10-80 and ends in .90", () => {
  for (const bad of ["27.99", "27", "27.9O", "9.90", "80.90", "27.901", "", null, "-27.90"]) {
    const r = OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: 14, ownedDomain: "ithardigital.com", domainUsd: bad });
    assert.equal(r.ok, false, `domainUsd ${JSON.stringify(bad)} accepted`);
    assert.match(r.error, /\.90|10-80/);
  }
});

test("parse: a domain is a bare hostname, needs its Vercel project and free days; a price needs a domain", () => {
  const withDomain = (o) => OD.parseOwnedDomainLink({ ...BASE_BODY, trialDays: 14, domainUsd: "27.90", ...o });
  for (const bad of ["https://ithardigital.com", "ithardigital.com/", "ithardigital", "ithar digital.com", "-x.com"]) {
    assert.equal(withDomain({ ownedDomain: bad }).ok, false, `${bad} accepted`);
  }
  assert.match(withDomain({ ownedDomain: "ithardigital.com", vercelProject: "" }).error, /Vercel project/);
  assert.match(withDomain({ ownedDomain: "ithardigital.com", trialDays: 0 }).error, /free days/);
  assert.match(OD.parseOwnedDomainLink({ ...BASE_BODY, domainUsd: "27.90" }).error, /without a domain/);
});

/* ══ 2. The Checkout session ══════════════════════════════════════════════ */

/** The route's own base params, as it builds them (hosting_lite, annual). */
const baseParams = () => ({
  mode: "subscription",
  payment_method_types: ["card"],
  customer_email: "owner@ithardigital.com",
  line_items: [{
    price_data: { currency: "usd", product_data: { name: "Website hosting — Ithar Digital", description: "d" }, unit_amount: 6600, recurring: { interval: "year" } },
    quantity: 1,
  }],
  metadata: { kind: "hosting", plan: "hosting_lite", period: "annual", business: "Ithar Digital", vercel_project: "ithar-digital" },
  success_url: "https://servolia.com/portal?hosting=active",
  cancel_url: "https://servolia.com/",
});

test("session: subscription, card only, hosting recurring as before, trial, and the domain as a ONE-TIME line", () => {
  const p = OD.applyOwnedDomainLink(baseParams(), { trialDays: 14, owned: { domain: "ithardigital.com", usd: 27.9 } });
  assert.equal(p.mode, "subscription");
  assert.deepEqual(p.payment_method_types, ["card"]);
  assert.deepEqual(p.subscription_data, { trial_period_days: 14 });
  assert.equal(p.line_items.length, 2);
  assert.deepEqual(p.line_items[0], baseParams().line_items[0], "the hosting line is untouched");
  const dom = p.line_items[1];
  assert.equal(dom.quantity, 1);
  assert.equal(dom.price_data.currency, "usd");
  assert.equal(dom.price_data.unit_amount, 2790);
  assert.equal(dom.price_data.product_data.name, "Domain ithardigital.com — first year");
  assert.equal("recurring" in dom.price_data, false, "the domain line must be one-time");
});

test("session: metadata names the owned domain and NEVER the keys the purchase path reads", () => {
  const p = OD.applyOwnedDomainLink(baseParams(), { trialDays: 14, owned: { domain: "ithardigital.com", usd: 27.9 } });
  assert.equal(p.metadata.owned_domain, "ithardigital.com");
  assert.equal(p.metadata.owned_domain_usd, "27.90");
  assert.equal(p.metadata.trial_days, "14");
  assert.equal(p.metadata.kind, "hosting");
  assert.equal(p.metadata.plan, "hosting_lite");
  for (const k of Object.keys(p.metadata)) {
    assert.ok(!/^domain/.test(k), `metadata key ${k} would reach the domain-purchase path`);
  }
  // The purchase paths' own keys, read from the webhook, so a renamed key there shows up here.
  const wh = src("src/app/api/webhooks/stripe/route.ts");
  assert.ok(wh.includes("session.metadata?.domain ?? \"\"") && wh.includes("session.metadata?.domain_retail_usd"));
});

test("session: no extras leaves the params exactly as they were; free days alone add only the trial", () => {
  assert.deepEqual(OD.applyOwnedDomainLink(baseParams(), { trialDays: 0, owned: null }), baseParams());
  const t = OD.applyOwnedDomainLink(baseParams(), { trialDays: 7, owned: null });
  assert.deepEqual(t.subscription_data, { trial_period_days: 7 });
  assert.equal(t.line_items.length, 1);
  assert.equal(t.metadata.trial_days, "7");
  assert.equal(t.metadata.owned_domain, undefined);
});

test("route: validates, checks Vercel, and only then creates the session through the builder", () => {
  const r = src("src/app/api/admin/hosting/checkout/route.ts");
  const parse = r.indexOf("parseOwnedDomainLink(body");
  const refuse = r.indexOf("if (!extra.ok) return NextResponse.json({ error: extra.error }, { status: 400 });");
  const verify = r.indexOf("await verifyOwnedDomain(extra.value.owned.domain");
  const refused = r.indexOf("if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });");
  const stripe = r.indexOf("new Stripe(key)");
  assert.ok(parse > 0 && parse < refuse && refuse < verify && verify < refused && refused < stripe, "order: parse, refuse, verify, refuse, Stripe");
  assert.match(r, /sessions\.create\(applyOwnedDomainLink\(\{/);
  assert.match(r, /\}, extra\.value\)\);/);
  assert.match(r, /mode: "subscription",/);
  assert.match(r, /payment_method_types: \["card"\],/);
});

/* ══ 3. Ownership is checked with Vercel, and a no is a refusal ═══════════ */

async function withVercel(answers, fn, { boughtAt, expiresAt } = {}) {
  const before = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === "string" ? input : input.url);
    calls.push({ url, method: init.method ?? "GET" });
    const u = new URL(url);
    const status = answers(u.pathname) ?? 404;
    const body = status === 200 ? { domain: { name: "ithardigital.com", boughtAt: boughtAt === undefined ? Date.parse("2026-09-20T10:00:00Z") : boughtAt, expiresAt: expiresAt === undefined ? Date.now() + 365 * 86400000 : expiresAt }, name: "ithardigital.com" } : { error: { code: "not_found", message: "Not found" } };
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  try { return { out: await fn(), calls }; } finally { globalThis.fetch = before; }
}

test("verify: in our team AND on the project -> ok, with read-only calls", async () => {
  const { out, calls } = await withVercel(() => 200, () => OD.verifyOwnedDomain("ithardigital.com", "ithar-digital"));
  assert.deepEqual(out, { ok: true });
  assert.deepEqual(calls.map((c) => c.method), ["GET", "GET"], "never writes to Vercel");
  assert.ok(calls[0].url.startsWith("https://api.vercel.com/v5/domains/ithardigital.com?teamId=team_harness"));
  assert.ok(calls[1].url.startsWith("https://api.vercel.com/v9/projects/ithar-digital/domains/ithardigital.com?teamId=team_harness"));
});

test("verify: in the team but NOT registered through Vercel (boughtAt null) -> refused, like domainInTeam", async () => {
  const { out, calls } = await withVercel(() => 200, () => OD.verifyOwnedDomain("ithardigital.com", "ithar-digital"), { boughtAt: null });
  assert.equal(out.ok, false);
  assert.equal(out.status, 400);
  assert.match(out.error, /NOT registered through Vercel/);
  assert.equal(calls.length, 1, "refused before the project is even asked");
});

test("verify: a 'first year' must be a real year — Ithar's (bought 2026-09-25, expires 2027-09-25) passes; one expiring within ~11 months is refused", async () => {
  const bought = Date.parse("2026-09-25T09:00:00Z");
  const expires = Date.parse("2027-09-25T09:00:00Z");
  const ithar = await withVercel(() => 200, () => OD.verifyOwnedDomain("ithardigital.com", "ithar-digital", Date.parse("2026-09-25T12:00:00Z")), { boughtAt: bought, expiresAt: expires });
  assert.deepEqual(ithar.out, { ok: true });
  const late = await withVercel(() => 200, () => OD.verifyOwnedDomain("ithardigital.com", "ithar-digital", Date.parse("2026-12-01T12:00:00Z")), { boughtAt: bought, expiresAt: expires });
  assert.equal(late.out.ok, false, "sold in December, it ends in September: not a year");
  assert.match(late.out.error, /registration ends 2027-09-25, less than 335 days away/);
  const unknown = await withVercel(() => 200, () => OD.verifyOwnedDomain("ithardigital.com", "ithar-digital"), { boughtAt: bought, expiresAt: null });
  assert.equal(unknown.out.ok, false);
  assert.match(unknown.out.error, /ends an unknown date/);
});

test("verify: not in our team -> refused, clear error", async () => {
  const { out } = await withVercel(() => 404, () => OD.verifyOwnedDomain("ithardigital.com", "ithar-digital"));
  assert.equal(out.ok, false);
  assert.equal(out.status, 400);
  assert.match(out.error, /ithardigital\.com is not a domain in our Vercel team/);
});

test("verify: in our team but not on that project -> refused, clear error", async () => {
  const { out } = await withVercel((p) => (p.startsWith("/v5/") ? 200 : 404), () => OD.verifyOwnedDomain("ithardigital.com", "other-project"));
  assert.equal(out.ok, false);
  assert.equal(out.status, 400);
  assert.match(out.error, /not attached to Vercel project "other-project"/);
});

test("verify: Vercel unreachable or unconfigured -> refused, never assumed", async () => {
  const { out } = await withVercel(() => 500, () => OD.verifyOwnedDomain("ithardigital.com", "ithar-digital"));
  assert.equal(out.ok, false);
  assert.equal(out.status, 502);
  const token = process.env.VERCEL_TOKEN;
  delete process.env.VERCEL_TOKEN;
  try {
    const r = await OD.verifyOwnedDomain("ithardigital.com", "ithar-digital");
    assert.equal(r.ok, false);
    assert.match(r.error, /VERCEL_TOKEN/);
  } finally { process.env.VERCEL_TOKEN = token; }
});

/* ══ 4. The webhook ═══════════════════════════════════════════════════════ */

function ownedSession(extraMeta = {}, over = {}) {
  return {
    id: "evt_owned_1",
    object: "event",
    type: "checkout.session.completed",
    livemode: true,
    created: 1790000000, // 2026-09-21
    api_version: "2025-01-01",
    data: {
      object: {
        id: "cs_live_ithar",
        object: "checkout.session",
        mode: "subscription",
        payment_status: "paid",
        amount_total: 2790,
        currency: "usd",
        customer: "cus_ith",
        subscription: "sub_ith",
        customer_details: { email: "owner@ithardigital.com" },
        metadata: {
          kind: "hosting", plan: "hosting_lite", period: "annual", business: "Ithar Digital",
          contact_name: "", site_url: "", repo: "", branch: "main", site_root: "", vercel_project: "ithar-digital",
          owned_domain: "ithardigital.com", owned_domain_usd: "27.90", trial_days: "14",
          ...extraMeta,
        },
        ...over,
      },
    },
  };
}

const OWNER = "hello@servolia.com";
const resendMails = () => H.outbound.filter((o) => o.url.startsWith("https://api.resend.com")).map((o) => JSON.parse(o.body));
const clientMails = () => resendMails().filter((m) => ![m.to].flat().includes(OWNER));
const ownerMails = () => resendMails().filter((m) => [m.to].flat().includes(OWNER));
const telegram = () => H.outbound.filter((o) => o.url.includes("api.telegram.org")).map((o) => JSON.parse(o.body).text);
const vercelCalls = () => H.outbound.filter((o) => o.url.includes("api.vercel.com"));

async function run(ev) {
  H.reset();
  stripeReads.length = 0;
  const res = await POST(request(ev, H.LIVE_WH));
  return { status: res.status, body: await res.json() };
}

test("webhook: nothing is bought or attached — even if the session also carried the purchase keys", async () => {
  const r = await run(ownedSession({ domain: "ithardigital.com", domain_retail_usd: "27.90" }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { received: true, line: "hosting" });
  assert.deepEqual(vercelCalls(), [], "the webhook called Vercel");
  assert.ok(!telegram().some((t) => /DOMAIN NOT BOUGHT/.test(t)), "a purchase was attempted");
  for (const w of H.writes) assert.ok(!JSON.stringify(w.body ?? {}).includes("servolia-domain:"), "a purchase record was written");
});

test("webhook: the hosting row is written as today, plus the owned-domain marker for the renewal", async () => {
  await run(ownedSession());
  const insert = H.writes.find((w) => w.table === "hosting_clients" && w.method === "POST");
  assert.ok(insert, "no hosting row");
  assert.equal(insert.body.plan, "hosting_lite");
  assert.equal(insert.body.status, "active");
  assert.equal(insert.body.billing_period, "annual");
  assert.equal(insert.body.subscription_id, "sub_ith");
  assert.equal(insert.body.monthly_usd, 5.5);
  assert.equal(insert.body.vercel_project, "ithar-digital");
  const marker = H.writes.find((w) => w.method === "PATCH" && String(w.body?.notes ?? "").includes("servolia-owned-domain:"));
  assert.ok(marker, "no owned-domain marker on the row");
  assert.equal(
    marker.body.notes,
    "servolia-owned-domain: ithardigital.com | price: 27.90 | paid: 2026-09-21 | renews: 2027-09-21 | project: ithar-digital | bought: no (already ours)",
  );
  assert.deepEqual(OD.readOwnedDomainNote(marker.body.notes), { domain: "ithardigital.com", usd: 27.9, project: "ithar-digital", renewsOn: "2027-09-21", paidOn: "2026-09-21" });
  // The purchase record reader does not see it, so the domain-billing cron leaves it alone.
  const { readDomainRecord } = await import("../src/lib/domainSales.ts");
  assert.equal(readDomainRecord(marker.body.notes), null);
  // And the session is marked done LAST, as for every hosting payment.
  const last = H.writes.filter((w) => w.table === "hosting_clients").at(-1);
  assert.match(String(last.body.notes), /cs_live_ithar/);
});

test("webhook: the client's email says what was paid today, when hosting starts (Stripe's trial_end), and that cancelling costs nothing more", async () => {
  await run(ownedSession());
  assert.deepEqual(stripeReads, ["sub_ith"], "trial_end not read from Stripe");
  const mails = clientMails();
  assert.equal(mails.length, 1, JSON.stringify(mails.map((m) => m.subject)));
  const m = mails[0];
  assert.deepEqual([m.to].flat(), ["owner@ithardigital.com"]);
  assert.equal(m.subject, "Payment received — domain ithardigital.com; hosting starts 9 October 2026");
  const text = m.html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  assert.ok(text.includes("Paid today: Domain ithardigital.com — first year, $27.90."), text);
  assert.ok(text.includes("Hosting (Essential, $66/year) starts on 9 October 2026; your card is charged then."), text);
  assert.ok(text.includes("Cancel before then and nothing more is charged."), text);
  // None of the ordinary receipt's claims, which would be false here.
  for (const lie of ["Renews automatically", "is active", "payment cleared", "Total charged today", "$66 per year"]) {
    assert.ok(!text.includes(lie), `the email says "${lie}"`);
  }
});

test("webhook: the owner is told the same — the amount is what was charged TODAY", async () => {
  await run(ownedSession());
  const om = ownerMails();
  assert.equal(om.length, 1, JSON.stringify(resendMails().map((m) => m.subject)));
  assert.equal(om[0].subject, "💶 Paid: Domain ithardigital.com (first year) + Hosting Essential after 14 free days — $27.90 — Ithar Digital");
  const body = om[0].text;
  assert.ok(body.includes("Charged today: $27.90 — Domain ithardigital.com, first year ($27.90). Already ours on Vercel (project ithar-digital): nothing bought, nothing attached."), body);
  assert.ok(body.includes("Hosting Essential $66/year starts 2026-10-09 after 14 free days; the card is charged then."), body);
  assert.ok(body.includes("Domain second year due 2027-09-21"), body);
  assert.match(body, /Next: /);
  assert.ok(body.includes("https://servolia.com/admin/hosting/"), body);
  const tg = telegram();
  assert.equal(tg.length, 1, JSON.stringify(tg));
  assert.equal(tg[0].split("\n")[0], om[0].subject);
});

test("webhook: Stripe unreadable -> the date falls back to purchase + free days, never blank", async () => {
  SM.__setStripeFactoryForTests(() => ({ subscriptions: { retrieve: async () => { throw new Error("down"); } } }));
  try {
    await run(ownedSession());
    const text = clientMails()[0].html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    assert.ok(text.includes("starts on 5 October 2026; your card is charged then."), text);
  } finally {
    SM.__setStripeFactoryForTests(() => ({ subscriptions: { retrieve: async (id) => { stripeReads.push(id); return { id, trial_end: TRIAL_END }; } } }));
  }
});

test("webhook: free days without a domain — nothing charged today, no marker", async () => {
  const ev = ownedSession({ owned_domain: "", owned_domain_usd: "", trial_days: "7" }, { amount_total: 0, payment_status: "no_payment_required" });
  await run(ev);
  const text = clientMails()[0].html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  assert.ok(text.includes("Nothing is charged today."), text);
  assert.ok(text.includes("Hosting (Essential, $66/year) starts on 9 October 2026; your card is charged then."), text);
  assert.ok(!H.writes.some((w) => String(w.body?.notes ?? "").includes("servolia-owned-domain:")));
  assert.match(ownerMails()[0].subject, /^💶 Paid: Hosting Essential — 7 free days — \$0 — Ithar Digital$/);
});

test("webhook: a replayed event sends nothing twice", async () => {
  H.reset();
  H.reads.hosting_clients = [{ id: "h-ith", notes: writeFulfilment(null, { session: "cs_live_ithar", at: "2026-09-21T00:00:00.000Z", plan: "hosting_lite" }) }];
  const res = await POST(request(ownedSession(), H.LIVE_WH));
  assert.deepEqual(await res.json(), { received: true, line: "hosting", replay: true });
  assert.equal(resendMails().length, 0);
  assert.equal(telegram().length, 0);
});

test("webhook: an ordinary hosting purchase still gets the ordinary receipt", async () => {
  const ev = H.hostingPurchase(true, "");
  ev.data.object.metadata.domain = "";
  await run(ev);
  const m = clientMails();
  assert.equal(m.length, 1);
  assert.match(m[0].subject, /^Payment received — /);
  assert.ok(m[0].html.includes("Renews automatically"), "the ordinary receipt changed");
  assert.deepEqual(stripeReads, [], "an ordinary purchase must not read the subscription");
});
