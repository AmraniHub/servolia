/**
 * The domain-billing cron, driven for real on a PLAN client's domain: a fake
 * Supabase (tests/webhook-harness.mjs), a fake Stripe through the stripeFor()
 * seam, Vercel and Resend answered here. What the review asked of it:
 *
 *  - M3: a client who bought before the 27.90 floor keeps their price while
 *    the margin holds (26 stays 26), and a rise is emailed 44-37 days before the renewal date (at least 30 days before the money moves)
 *    like every other domain, recorded only when the email went;
 *  - H1: a rise found later than 37 days out is not announced at all.
 *
 *   node --import ./tests/register.mjs --test tests/domain-billing-cron.test.mjs
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import * as H from "./webhook-harness.mjs";

await H.bootHarness();
const harnessFetch = globalThis.fetch;

/* Vercel's renewal price and Resend's answer, per test. */
const net = { renewal: 11.25, resendOk: true, patchFails: false, expiry: null, gone: false };
const autoRenew = [];
const resend = [];
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === "string" ? input : input.url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  // A Supabase write that fails (the row update after an email went out).
  if (net.patchFails && url.includes("/rest/v1/hosting_clients") && (init.method ?? "GET").toUpperCase() === "PATCH") {
    return json(500, { code: "XX000", message: "database unavailable" });
  }
  if (url.startsWith("https://api.vercel.com")) {
    if (url.includes("/price")) return json(200, { years: 1, purchasePrice: net.renewal, renewalPrice: net.renewal, transferPrice: net.renewal });
    if (url.includes("/auto-renew")) { autoRenew.push(JSON.parse(String(init.body))); return new Response(null, { status: 204 }); }
    if (url.includes("/v5/domains/") && net.gone) return json(404, { error: { code: "not_found" } });
    if (url.includes("/v5/domains/")) return json(200, { domain: { name: "owned-harness.com", boughtAt: Date.parse("2026-09-01T00:00:00Z"), expiresAt: net.expiry ? Date.parse(net.expiry + "T00:00:00Z") : null } });
    return json(404, {});
  }
  if (url.startsWith("https://api.resend.com")) {
    resend.push(JSON.parse(String(init.body ?? "{}")));
    return net.resendOk ? json(200, { id: "email_1" }) : json(500, { statusCode: 500, name: "internal_server_error", message: "down" });
  }
  return harnessFetch(input, init);
};

const SM = await import("../src/lib/stripeMode.ts");
const items = [];
SM.__setStripeFactoryForTests(() => ({
  invoiceItems: {
    create: async (p, o) => { items.push({ ...p, key: o?.idempotencyKey }); return {}; },
    // What is already on the account (the lines added so far): the second-line guard reads this.
    list: async () => ({ data: items.map((i, n) => ({ id: `ii_${n}`, metadata: i.metadata ?? {} })) }),
  },
  customers: { search: async () => ({ data: [], has_more: false }) },
  invoices: { list: async () => ({ data: [] }) },
}));

Object.assign(process.env, {
  CRON_SECRET: "cron_harness", RESEND_API_KEY: "re_harness",
  VERCEL_TOKEN: "vt", VERCEL_TEAM_ID: "team_x",
});
const S = await import("../src/lib/domainSales.ts");
const { GET } = await import("../src/app/api/cron/domain-billing/route.ts");
const { NextRequest } = await import("next/server");

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function run({ inDays, paid = 26, renewal = 11.25, resendOk = true, patchFails = false, expiry = null, row = null, at = null, keepItems = false, gone = false }) {
  H.reset();
  if (!keepItems) items.length = 0;
  resend.length = 0;
  Object.assign(net, { renewal, resendOk, patchFails, expiry, gone });
  autoRenew.length = 0;
  const renewsOn = day(inDays);
  H.reads.hosting_clients = [row ? row(renewsOn) : {
    id: "h1", business: "Harness Co", email: "client@example.com", customer_id: "cus_h", billing_period: "monthly", status: "active",
    notes: S.writeDomainRecord(null, { domain: "plan-harness.com", status: "bought", retailUsd: paid, nextChargeAt: renewsOn }),
  }];
  // `at`: run the cron on that calendar day (its clock mocked), for the dated Ithar fixture.
  if (at) mock.timers.enable({ apis: ["Date"], now: Date.parse(`${at}T11:00:00Z`) });
  let res, body;
  try {
    res = await GET(new NextRequest("https://servolia.com/api/cron/domain-billing", { headers: { authorization: "Bearer cron_harness" } }));
    body = await res.json();
  } finally {
    if (at) mock.timers.reset();
  }
  const notes = H.writes.filter((w) => w.table === "hosting_clients" && w.body?.notes).map((w) => w.body.notes);
  const clientMails = resend.filter((m) => [m.to].flat().includes("client@example.com"));
  return { res, body, notes, clientMails, renewsOn };
}

test("M3: a plan client at 26 (before the floor) renews at 26 while the margin holds — never raised to 27.90", async () => {
  const r = await run({ inDays: 7, paid: 26, renewal: 11.25 });
  assert.equal(r.res.status, 200);
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 2600);
  assert.equal(items[0].key, `domain-renewal-h1-${r.renewsOn}`);
  assert.match(r.notes.at(-1), /retail: 26 /);
  assert.equal(r.clientMails.length, 1, "told on the invoice email");
  assert.doesNotMatch(r.clientMails[0].html, /registry raised/, "no rise, no rise wording");
});

test("M3 + H1: a registry rise is emailed 37 days out (30 before the charge) and recorded only once the email went", async () => {
  const ok = await run({ inDays: 37, paid: 26, renewal: 20 });
  assert.equal(items.length, 0, "nothing billed at the notice");
  assert.equal(ok.clientMails.length, 1);
  assert.match(ok.clientMails[0].html, /up from \$26\.00 last year: the registry raised its price/);
  assert.match(ok.clientMails[0].html, /next invoice/, "a plan client is billed on the invoice, not the card");
  assert.ok(ok.notes.some((n) => n.includes(`noticed: ${ok.renewsOn}=35.9`)), `notice not recorded: ${JSON.stringify(ok.notes)}`);

  const fail = await run({ inDays: 37, paid: 26, renewal: 20, resendOk: false });
  assert.equal(fail.notes.length, 0, "an unsent notice is not recorded");
  assert.ok(fail.body.failed.some((f) => /price-rise notice: email to client@example\.com NOT sent/.test(f)), JSON.stringify(fail.body.failed));
});

test("H1: a rise found at day -36 or -20 is not announced; at the charge it bills last year's price and says what was held back", async () => {
  for (const inDays of [36, 20]) {
    const late = await run({ inDays, paid: 26, renewal: 20 });
    assert.equal(late.clientMails.length, 0, `day -${inDays}`);
    assert.equal(late.notes.length, 0, `day -${inDays}`);
  }
  const charge = await run({ inDays: 7, paid: 26, renewal: 20 });
  assert.equal(items[0].amount, 2600, "no notice went out: last year's price");
  assert.ok(charge.body.warnings.some((w) => /billed \$26\.00, not the \$35\.90/.test(w)), JSON.stringify(charge.body.warnings));
});

test("a notice emailed but NOT saved (Supabase write failed) does not count, and says so; a failed charge-day save is loud", async () => {
  const r = await run({ inDays: 37, paid: 26, renewal: 20, patchFails: true });
  assert.equal(r.clientMails.length, 1, "the email did go");
  assert.equal(r.body.noticed.length, 0, "not reported as a recorded notice");
  assert.ok(r.body.failed.some((f) => /price-rise notice SENT but NOT recorded \(database unavailable\)/.test(f)), JSON.stringify(r.body.failed));
  const c = await run({ inDays: 7, paid: 26, renewal: 11.25, patchFails: true });
  assert.equal(items.length, 1, "the line was added");
  assert.equal(c.body.charged.length, 0, "not reported as a clean renewal");
  assert.ok(c.body.failed.some((f) => /renewal line ADDED \(\$26\.00\) but the row was NOT updated/.test(f)), JSON.stringify(c.body.failed));
});

test("a plan domain with no stored price is refused and reported, never billed at the floor", async () => {
  const r = await run({ inDays: 7, paid: 0, renewal: 11.25 });
  assert.equal(items.length, 0);
  assert.ok(r.body.failed.some((f) => /no stored price on the row .* NOT renewed/.test(f)), JSON.stringify(r.body.failed));
});

/* ── A domain we already owned, sold with the hosting (src/lib/ownedDomain.ts) ──
 * The Ithar-shaped fixture: ithardigital.com bought on our Vercel team on
 * 2026-09-25 (expires 2027-09-25), hosting_lite annual after a 14-day trial,
 * the domain's first year paid on 2026-09-25 at 27.90. The cron's clock is
 * set to the day under test (`at`). */

const OD = await import("../src/lib/ownedDomain.ts");
const ITHAR = { domain: "ithardigital.com", usd: 27.9, project: "ithar-digital", paidOn: "2026-09-25", renewsOn: "2027-09-25" };
const ithar = (note = {}, status = "active") => () => ({
  id: "h-ithar", business: "Ithar Digital", email: "client@example.com", customer_id: "cus_ithar", subscription_id: "sub_ithar",
  plan: "hosting_lite", billing_period: "annual", status,
  notes: OD.writeOwnedDomainNote(null, { ...ITHAR, ...note }),
});
const ownedNote = (r) => OD.readOwnedDomainNote(r.notes.at(-1));
const at = (date, o = {}) => run({ inDays: 0, renewal: 11.25, expiry: "2027-09-25", row: ithar(o.note, o.status), at: date, ...o });

test("Ithar: renewed on 2027-09-18 (7 days before) on the HOSTING subscription's invoice at 27.90, tagged, the date moved a year on", async () => {
  const r = await at("2027-09-18");
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 2790, "last year's price: no floor raise, no re-rounding");
  assert.equal(items[0].subscription, "sub_ithar", "on the hosting subscription's next invoice");
  assert.deepEqual(items[0].metadata, { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: "2027-09-25" });
  const n = ownedNote(r);
  assert.equal(n.billed, "2027-09-25");
  assert.equal(n.renewsOn, "2028-09-25");
  assert.equal(r.clientMails.length, 1, "told on the invoice email");
  const early = await at("2027-09-17");
  assert.equal(items.length, 0, "not before the charge day");
  void early;
});

test("Ithar: a registry rise is emailed on day -37 (30 days before the charge) and recorded; day -20 is too late", async () => {
  const r = await at("2027-08-19", { renewal: 20 });
  assert.equal(items.length, 0);
  assert.equal(r.clientMails.length, 1);
  assert.match(r.clientMails[0].html, /up from \$27\.90 last year: the registry raised its price/);
  assert.equal(ownedNote(r).noticed, "2027-09-25=35.9");
  const late = await at("2027-09-05", { renewal: 20 });
  assert.equal(late.clientMails.length, 0);
});

test("M1 Ithar: Vercel's expiry is followed only when close (5 days: moved); far off (5 months) it is reported ONCE and our date stands", async () => {
  const near = await at("2027-08-01", { expiry: "2027-09-20" });
  assert.ok(near.body.checks.some((c) => /moved 2027-09-25 -> 2027-09-20 to match Vercel's expiry/.test(c)), JSON.stringify(near.body.checks));
  assert.equal(ownedNote(near).renewsOn, "2027-09-20");
  const far = await at("2027-08-01", { expiry: "2028-03-01" });
  assert.ok(far.body.checks.some((c) => /ends 2028-03-01, far from our renewal date 2027-09-25 — NOT followed/.test(c)), JSON.stringify(far.body.checks));
  assert.equal(ownedNote(far).renewsOn, "2027-09-25");
  assert.equal(ownedNote(far).vercelMismatch, "2028-03-01");
  const again = await at("2027-08-02", { expiry: "2028-03-01", note: { vercelMismatch: "2028-03-01" } });
  assert.equal(again.body.checks.filter((c) => /NOT followed/.test(c)).length, 0, "reported once");
  // And on its charge day it bills OUR date, not the far one.
  await at("2027-09-18", { expiry: "2028-03-01", note: { vercelMismatch: "2028-03-01" } });
  assert.equal(items[0]?.metadata.renews_on, "2027-09-25");
});

test("M2 Ithar: the year billed for 2027-09-25 must be RENEWED by Vercel before 2028's is billed; 5 days late it alarms, daily", async () => {
  const billed = { billed: "2027-09-25", renewsOn: "2028-09-25" };
  const within = await at("2027-09-28", { note: billed, expiry: "2027-09-25" });
  assert.equal(within.body.failed.length, 0, "day +3: Vercel may still be renewing");
  const late = await at("2027-10-01", { note: billed, expiry: "2027-09-25" });
  assert.ok(late.body.failed.some((f) => /year from 2027-09-25 was PAID and NOT renewed by Vercel .*renew it by hand in Vercel or refund/.test(f)), JSON.stringify(late.body.failed));
  const gone = await at("2027-10-01", { note: billed, gone: true });
  assert.ok(gone.body.failed.some((f) => /no longer in our Vercel team/.test(f)));
  const nextYear = await at("2028-09-18", { note: billed, expiry: "2027-09-25" });
  assert.equal(items.length, 0, "the next year is NEVER billed while the last one was not renewed");
  assert.ok(nextYear.body.failed.some((f) => /NOT renewed by Vercel/.test(f)), "still alarming on the day it would have billed");
  const renewed = await at("2028-09-18", { note: billed, expiry: "2028-09-25" });
  assert.equal(items.length, 1, "renewed by Vercel: the next year is billed");
  assert.equal(items[0].metadata.renews_on, "2028-09-25");
  assert.equal(ownedNote(renewed).billed, "2028-09-25");
});

test("Ithar after a cancellation kept auto-renew on until 2027-09-25: switched off only once Vercel renewed that paid year", async () => {
  const kept = { keptUntil: "2027-09-25" };
  const before = await at("2027-09-25", { note: kept, status: "churned" });
  assert.deepEqual(autoRenew, [], "the paid year has not started");
  void before;
  const notYet = await at("2027-09-27", { note: kept, status: "churned", expiry: "2027-09-25" });
  assert.deepEqual(autoRenew, [], "Vercel has not renewed it yet: auto-renew must stay ON");
  assert.equal(notYet.body.failed.length, 0, "no alarm within 5 days");
  const alarm = await at("2027-10-01", { note: kept, status: "churned", expiry: "2027-09-25" });
  assert.deepEqual(autoRenew, []);
  assert.ok(alarm.body.failed.some((f) => /paid year from 2027-09-25 was NOT renewed by Vercel .* Auto-renew left ON/.test(f)));
  const off = await at("2027-09-27", { note: kept, status: "churned", expiry: "2028-09-25" });
  assert.deepEqual(autoRenew, [{ autoRenew: false }]);
  assert.equal(ownedNote(off).renewalOff, "2027-09-27");
  assert.equal(ownedNote(off).keptUntil, undefined);
});

test("Ithar on a hosting that ENDED is never billed, even on its charge day", async () => {
  const r = await at("2027-09-18", { status: "churned" });
  assert.equal(items.length, 0);
  assert.equal(r.clientMails.length, 0);
});

test("a line added but NOT saved is not added AGAIN the next day (the tag is looked for first)", async () => {
  const first = await at("2027-09-18", { patchFails: true });
  assert.equal(items.length, 1);
  assert.ok(first.body.failed.some((f) => /renewal line ADDED/.test(f)));
  const next = await at("2027-09-19", { keepItems: true });
  assert.equal(items.length, 1, "no second line");
  assert.ok(next.body.checks.some((c) => /already on the account .* not added again/.test(c)), JSON.stringify(next.body.checks));
  assert.equal(ownedNote(next).billed, "2027-09-25", "the row caught up");
  // Plan domains are tagged the same way.
  await run({ inDays: 7, paid: 26, renewal: 11.25 });
  assert.equal(items[0].metadata.kind, "plan_domain_renewal");
});

test("the cron refuses without CRON_SECRET, even to a caller sending 'Bearer undefined'", async () => {
  const before = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const res = await GET(new NextRequest("https://servolia.com/api/cron/domain-billing", { headers: { authorization: "Bearer undefined" } }));
    assert.equal(res.status, 401);
  } finally {
    process.env.CRON_SECRET = before;
  }
});
