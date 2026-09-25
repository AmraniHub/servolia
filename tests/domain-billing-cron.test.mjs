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
import { test } from "node:test";
import assert from "node:assert/strict";
import * as H from "./webhook-harness.mjs";

await H.bootHarness();
const harnessFetch = globalThis.fetch;

/* Vercel's renewal price and Resend's answer, per test. */
const net = { renewal: 11.25, resendOk: true, patchFails: false, expiry: null };
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
  invoiceItems: { create: async (p, o) => { items.push({ ...p, key: o?.idempotencyKey }); return {}; } },
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

async function run({ inDays, paid = 26, renewal = 11.25, resendOk = true, patchFails = false, expiry = null, row = null }) {
  H.reset();
  items.length = 0;
  resend.length = 0;
  Object.assign(net, { renewal, resendOk, patchFails, expiry });
  autoRenew.length = 0;
  const renewsOn = day(inDays);
  H.reads.hosting_clients = [row ? row(renewsOn) : {
    id: "h1", business: "Harness Co", email: "client@example.com", customer_id: "cus_h", billing_period: "monthly", status: "active",
    notes: S.writeDomainRecord(null, { domain: "plan-harness.com", status: "bought", retailUsd: paid, nextChargeAt: renewsOn }),
  }];
  const res = await GET(new NextRequest("https://servolia.com/api/cron/domain-billing", { headers: { authorization: "Bearer cron_harness" } }));
  const body = await res.json();
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

/* ── A domain we already owned, sold with the hosting (src/lib/ownedDomain.ts) ── */

const OD = await import("../src/lib/ownedDomain.ts");
const owned = (note, status = "active") => (renewsOn) => ({
  id: "h2", business: "Ithar Digital", email: "client@example.com", customer_id: "cus_o", subscription_id: "sub_o", billing_period: "annual", status,
  notes: OD.writeOwnedDomainNote(null, { domain: "owned-harness.com", usd: 27.9, project: "ithar-digital", paidOn: "2026-09-25", renewsOn, ...note }),
});
const ownedNote = (r) => OD.readOwnedDomainNote(r.notes.at(-1));

test("owned domain: renewed on the HOSTING subscription's invoice at its price, tagged, the date moved a year on", async () => {
  const r = await run({ inDays: 7, renewal: 11.25, expiry: null, row: owned({}) });
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 2790, "last year's price: no floor raise, no re-rounding");
  assert.equal(items[0].subscription, "sub_o", "on the hosting subscription's next invoice");
  assert.equal(items[0].customer, "cus_o");
  assert.deepEqual(items[0].metadata, { kind: "owned_domain_renewal", domain: "owned-harness.com", renews_on: r.renewsOn });
  assert.equal(items[0].key, `owned-domain-h2-${r.renewsOn}`);
  const n = ownedNote(r);
  assert.equal(n.billed, r.renewsOn, "the year just billed");
  assert.equal(n.renewsOn > r.renewsOn, true, "next year due a year on");
  assert.equal(r.clientMails.length, 1, "told on the invoice email");
});

test("owned domain: a registry rise is emailed 37 days out (30 before the charge) and recorded only then", async () => {
  const r = await run({ inDays: 37, renewal: 20, row: owned({}) });
  assert.equal(items.length, 0);
  assert.equal(r.clientMails.length, 1);
  assert.match(r.clientMails[0].html, /up from \$27\.90 last year: the registry raised its price/);
  assert.match(r.clientMails[0].html, /next invoice/);
  assert.equal(ownedNote(r).noticed, `${r.renewsOn}=35.9`);
  const late = await run({ inDays: 20, renewal: 20, row: owned({}) });
  assert.equal(late.clientMails.length, 0, "day -20: too late to announce");
});

test("owned domain: the renewal date follows Vercel's ACTUAL expiry — and a year just billed is never billed again", async () => {
  // Registered days before the client paid: the note's date is late; Vercel's expiry wins.
  const r = await run({ inDays: 60, renewal: 11.25, expiry: day(7), row: owned({}) });
  assert.ok(r.body.checks.some((c) => /renewal date moved .* to match Vercel's expiry/.test(c)), JSON.stringify(r.body.checks));
  assert.equal(items.length, 1, "billed on the real date");
  assert.equal(items[0].metadata.renews_on, day(7));
  // Billed, Vercel not renewed yet (expiry == billed): the note's next date stands, nothing billed.
  const again = await run({ inDays: 372, renewal: 11.25, expiry: day(7), row: owned({ billed: day(7) }) });
  assert.equal(items.length, 0);
  assert.equal(again.notes.length, 0, "the date was not dragged back");
  assert.equal(OD.effectiveRenewsOn({ renewsOn: "2028-09-20", billed: "2027-09-20" }, "2028-09-20"), "2028-09-20", "after Vercel renews, both agree");
});

test("owned domain after a cancellation: auto-renew kept on through a paid year's date, then switched off once", async () => {
  const kept = await run({ inDays: 400, row: owned({ keptUntil: day(3) }, "churned") });
  assert.deepEqual(autoRenew, [], "the paid year has not started");
  assert.equal(items.length, 0, "a churned row is never billed");
  const r = await run({ inDays: 400, row: owned({ keptUntil: day(-1) }, "churned") });
  assert.deepEqual(autoRenew, [{ autoRenew: false }]);
  assert.equal(ownedNote(r).renewalOff, new Date().toISOString().slice(0, 10));
  assert.equal(ownedNote(r).keptUntil, undefined);
  assert.ok(r.body.checks.some((c) => /auto-renew switched OFF/.test(c)));
  void kept;
});

test("owned domain on a hosting that ENDED is never billed, even on its charge day", async () => {
  const r = await run({ inDays: 7, renewal: 11.25, row: owned({}, "churned") });
  assert.equal(items.length, 0);
  assert.equal(r.clientMails.length, 0);
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
