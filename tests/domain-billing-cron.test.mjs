/**
 * The domain-billing cron, driven for real on a PLAN client's domain: a fake
 * Supabase (tests/webhook-harness.mjs), a fake Stripe through the stripeFor()
 * seam, Vercel and Resend answered here. What the review asked of it:
 *
 *  - M3: a client who bought before the 27.90 floor keeps their price while
 *    the margin holds (26 stays 26), and a rise is emailed 37-30 days ahead
 *    like every other domain, recorded only when the email went;
 *  - H1: a rise found inside the 30 days is not announced at all.
 *
 *   node --import ./tests/register.mjs --test tests/domain-billing-cron.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as H from "./webhook-harness.mjs";

await H.bootHarness();
const harnessFetch = globalThis.fetch;

/* Vercel's renewal price and Resend's answer, per test. */
const net = { renewal: 11.25, resendOk: true };
const resend = [];
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === "string" ? input : input.url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://api.vercel.com")) {
    if (url.includes("/price")) return json(200, { years: 1, purchasePrice: net.renewal, renewalPrice: net.renewal, transferPrice: net.renewal });
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

async function run({ inDays, paid = 26, renewal = 11.25, resendOk = true }) {
  H.reset();
  items.length = 0;
  resend.length = 0;
  Object.assign(net, { renewal, resendOk });
  const renewsOn = day(inDays);
  H.reads.hosting_clients = [{
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

test("M3 + H1: a registry rise is emailed 30 days ahead and recorded only once the email went", async () => {
  const ok = await run({ inDays: 30, paid: 26, renewal: 20 });
  assert.equal(items.length, 0, "nothing billed at the notice");
  assert.equal(ok.clientMails.length, 1);
  assert.match(ok.clientMails[0].html, /up from \$26\.00 last year: the registry raised its price/);
  assert.match(ok.clientMails[0].html, /next invoice/, "a plan client is billed on the invoice, not the card");
  assert.ok(ok.notes.some((n) => n.includes(`noticed: ${ok.renewsOn}=35.9`)), `notice not recorded: ${JSON.stringify(ok.notes)}`);

  const fail = await run({ inDays: 30, paid: 26, renewal: 20, resendOk: false });
  assert.equal(fail.notes.length, 0, "an unsent notice is not recorded");
  assert.ok(fail.body.failed.some((f) => /price-rise notice: email to client@example\.com NOT sent/.test(f)), JSON.stringify(fail.body.failed));
});

test("H1: a rise found at day -20 is not announced; at the charge it bills last year's price and says what was held back", async () => {
  const late = await run({ inDays: 20, paid: 26, renewal: 20 });
  assert.equal(late.clientMails.length, 0);
  assert.equal(late.notes.length, 0);
  const charge = await run({ inDays: 7, paid: 26, renewal: 20 });
  assert.equal(items[0].amount, 2600, "no notice went out: last year's price");
  assert.ok(charge.body.warnings.some((w) => /billed \$26\.00, not the \$35\.90/.test(w)), JSON.stringify(charge.body.warnings));
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
