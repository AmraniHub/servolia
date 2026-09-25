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
const net = { renewal: 11.25, resendOk: true, patchFails: false, expiry: null, gone: false, unreadable: false };
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
    if (url.includes("/v5/domains/") && net.unreadable) return json(503, { error: { code: "service_unavailable" } });
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
/* Stripe, faked: invoice items (pending or on an invoice), invoices of
   their own, and the hosting subscription whose next invoice date decides
   where an owned domain's year is charged. */
const items = [];
const invoices = [];
const hosting = { next: "2027-10-09", status: "active", pm: "pm_ithar", payFails: false, cancelAtPeriodEnd: false };
const payCalls = [];
const clone = (x) => JSON.parse(JSON.stringify(x));
const findInv = (id) => invoices.find((i) => i.id === id);
SM.__setStripeFactoryForTests(() => ({
  invoiceItems: {
    create: async (p, o) => {
      items.push({ ...p, key: o?.idempotencyKey });
      const inv = p.invoice ? findInv(p.invoice) : null;
      if (inv) inv.total += p.amount;
      return {};
    },
    // What is already on the account (the lines added so far): the second-line guard reads this.
    list: async () => ({ data: items.map((i, n) => ({ id: `ii_${n}`, invoice: i.invoice ?? null, amount: i.amount, metadata: i.metadata ?? {} })) }),
  },
  customers: { search: async () => ({ data: [], has_more: false }) },
  invoices: {
    // `hidden`: an invoice the list does not return (past a page), reachable only through its tagged item.
    list: async ({ customer }) => ({ data: invoices.filter((i) => i.customer === customer && !i.hidden).map(clone) }),
    create: async (p, o) => {
      const inv = { id: `in_${invoices.length + 1}`, customer: p.customer, status: "draft", total: 0, metadata: { ...p.metadata }, params: p, key: o?.idempotencyKey };
      invoices.push(inv);
      return clone(inv);
    },
    retrieve: async (id) => clone(findInv(id)),
    finalizeInvoice: async (id, p) => { const inv = findInv(id); inv.status = "open"; inv.finalizeParams = p; return clone(inv); },
    pay: async (id, p) => {
      payCalls.push(id);
      if (hosting.payFails) throw new Error("card_declined");
      const inv = findInv(id); inv.status = "paid"; inv.amount_paid = inv.total; inv.payParams = p; return clone(inv);
    },
    del: async (id) => { invoices.splice(invoices.indexOf(findInv(id)), 1); return { id, deleted: true }; },
    update: async (id, p) => { const inv = findInv(id); Object.assign(inv.metadata, p.metadata ?? {}); return clone(inv); },
  },
  subscriptions: {
    retrieve: async (id) => ({
      id, status: hosting.status, default_payment_method: hosting.pm, cancel_at_period_end: hosting.cancelAtPeriodEnd,
      items: { data: [{ current_period_end: Date.parse(`${hosting.next}T00:00:00Z`) / 1000 }] },
    }),
  },
}));

Object.assign(process.env, {
  CRON_SECRET: "cron_harness", RESEND_API_KEY: "re_harness",
  VERCEL_TOKEN: "vt", VERCEL_TEAM_ID: "team_x",
});
const S = await import("../src/lib/domainSales.ts");
const { GET } = await import("../src/app/api/cron/domain-billing/route.ts");
const { NextRequest } = await import("next/server");

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function run({ inDays, paid = 26, renewal = 11.25, resendOk = true, patchFails = false, expiry = null, row = null, at = null, keepItems = false, gone = false, unreadable = false, hostingNext = "2027-10-09", payFails = false, subStatus = "active", cancelAtPeriodEnd = false }) {
  H.reset();
  if (!keepItems) { items.length = 0; invoices.length = 0; }
  Object.assign(hosting, { next: hostingNext, payFails, status: subStatus, cancelAtPeriodEnd });
  if (!keepItems) payCalls.length = 0;
  resend.length = 0;
  Object.assign(net, { renewal, resendOk, patchFails, expiry, gone, unreadable });
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
 * 2026-09-25 (expires 2027-09-25), hosting_lite annual after a 14-day trial —
 * so the hosting invoices on 2027-10-09, AFTER the domain renews — the
 * domain's first year paid on 2026-09-25 at 27.90. The cron's clock is set to
 * the day under test (`at`). */

const OD = await import("../src/lib/ownedDomain.ts");
const ITHAR = { domain: "ithardigital.com", usd: 27.9, project: "ithar-digital", paidOn: "2026-09-25", renewsOn: "2027-09-25" };
const ithar = (note = {}, status = "active") => () => ({
  id: "h-ithar", business: "Ithar Digital", email: "client@example.com", customer_id: "cus_ithar", subscription_id: "sub_ithar",
  plan: "hosting_lite", billing_period: "annual", status,
  notes: OD.writeOwnedDomainNote(null, { ...ITHAR, ...note }),
});
const ownedNote = (r) => OD.readOwnedDomainNote(r.notes.at(-1));
const at = (date, o = {}) => run({ inDays: 0, renewal: 11.25, expiry: "2027-09-25", row: ithar(o.note, o.status), at: date, ...o });
const ownInvoices = () => invoices.filter((i) => i.metadata.kind === "owned_domain_renewal");

test("Ithar (hosting invoices 2027-10-09, after the 2027-09-25 renewal): charged on 2027-09-18 on an invoice OF ITS OWN, on the subscription's card", async () => {
  const r = await at("2027-09-18");
  const [inv] = ownInvoices();
  assert.ok(inv, "an invoice of its own");
  assert.equal(inv.params.auto_advance, false, "the cron is the only collector");
  assert.equal(inv.params.collection_method, "charge_automatically");
  assert.equal(inv.params.default_payment_method, "pm_ithar", "the card the hosting subscription uses");
  assert.deepEqual({ kind: inv.metadata.kind, domain: inv.metadata.domain, renews_on: inv.metadata.renews_on }, { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: "2027-09-25" });
  assert.equal(inv.metadata.last_attempt, "2027-09-18", "the day of the attempt, written before paying");
  assert.equal(inv.metadata.receipt, "sent", "the receipt recorded on the invoice");
  assert.equal(inv.status, "paid");
  assert.equal(inv.amount_paid, 2790);
  assert.deepEqual(inv.payParams, { payment_method: "pm_ithar" });
  assert.equal(items.filter((i) => !i.invoice).length, 0, "NOT a pending line waiting for the 2027-10-09 hosting invoice");
  const n = ownedNote(r);
  assert.equal(n.billed, "2027-09-25");
  assert.equal(n.renewsOn, "2028-09-25");
  assert.match(r.clientMails[0]?.html ?? "", /charged to your card/, "a receipt, not 'on your next invoice'");
  // Run again (a retry, or the row write failed): the paid invoice is found; never a second.
  await at("2027-09-19", { keepItems: true });
  assert.equal(ownInvoices().length, 1);
});

test("hosting that invoices BEFORE the renewal date (monthly, 2027-09-20): the year is a line pinned to that invoice, as before", async () => {
  const r = await at("2027-09-18", { hostingNext: "2027-09-20" });
  assert.equal(ownInvoices().length, 0);
  assert.equal(items.length, 1);
  assert.equal(items[0].subscription, "sub_ithar");
  assert.deepEqual(items[0].metadata, { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: "2027-09-25" });
  assert.equal(ownedNote(r).billed, "2027-09-25");
});

test("Ithar: a declined card is retried daily on the SAME invoice, counted on the note, and stops after 4 — said once", async () => {
  const steps = [];
  let note = {};
  for (const day of ["2027-09-18", "2027-09-19", "2027-09-20", "2027-09-21", "2027-09-22"]) {
    const r = await at(day, { payFails: true, keepItems: day !== "2027-09-18", note });
    note = ownedNote(r) ? { attempts: ownedNote(r).attempts } : note;
    const f = r.body.failed.find((x) => /renewal NOT charged/.test(x)) ?? "silent";
    steps.push(/STOPPED RETRYING/.test(f) ? "stopped" : /attempt (\d)\/4/.exec(f)?.[0] ?? f);
  }
  assert.deepEqual(steps, ["attempt 1/4", "attempt 2/4", "attempt 3/4", "stopped", "silent"]);
  assert.equal(ownInvoices().length, 1, "one invoice for the year");
});

test("Ithar: the price-rise notice for an own-invoice renewal names the CARD charge, 30 days before it", async () => {
  const r = await at("2027-08-19", { renewal: 20 });
  assert.equal(r.clientMails.length, 1);
  assert.match(r.clientMails[0].html, /up from \$27\.90 last year: the registry raised its price/);
  assert.match(r.clientMails[0].html, /charged to your card on 18 September 2027/);
  assert.equal(ownedNote(r).noticed, "2027-09-25=35.9");
  const late = await at("2027-09-05", { renewal: 20 });
  assert.equal(late.clientMails.length, 0);
});

test("Vercel says the domain is GONE: never billed (first renewal included), reported ONCE", async () => {
  const r = await at("2027-09-18", { gone: true });
  assert.equal(ownInvoices().length + items.length, 0);
  assert.ok(r.body.failed.some((f) => /NO LONGER in our Vercel team — its renewal is NOT billed/.test(f)), JSON.stringify(r.body.failed));
  assert.equal(ownedNote(r).vercelGone, "2027-09-18");
  const again = await at("2027-09-19", { gone: true, note: { vercelGone: "2027-09-18" } });
  assert.equal(again.body.failed.filter((f) => /NO LONGER/.test(f)).length, 0, "reported once");
  assert.equal(ownInvoices().length + items.length, 0);
});

test("Vercel UNREADABLE: nothing billed or announced that day (first renewal included); tomorrow asks again", async () => {
  const r = await at("2027-09-18", { unreadable: true });
  assert.equal(ownInvoices().length + items.length, 0);
  assert.ok(r.body.checks.some((c) => /Vercel could not be read — nothing billed or announced today/.test(c)));
  const notice = await at("2027-08-19", { unreadable: true, renewal: 20 });
  assert.equal(notice.clientMails.length, 0, "no notice on a blind day");
  const ok = await at("2027-09-19");
  assert.equal(ownInvoices().length, 1, "billed the next day, once Vercel answers");
  void ok;
});

test("M1 Ithar: Vercel's expiry is followed only when close (5 days: moved); far off (5 months) it is reported ONCE and our date stands", async () => {
  const near = await at("2027-08-01", { expiry: "2027-09-20" });
  assert.ok(near.body.checks.some((c) => /moved 2027-09-25 -> 2027-09-20 to match Vercel's expiry/.test(c)), JSON.stringify(near.body.checks));
  const far = await at("2027-08-01", { expiry: "2028-03-01" });
  assert.ok(far.body.checks.some((c) => /ends 2028-03-01, far from our renewal date 2027-09-25 — NOT followed/.test(c)));
  assert.equal(ownedNote(far).vercelMismatch, "2028-03-01");
  const again = await at("2027-08-02", { expiry: "2028-03-01", note: { vercelMismatch: "2028-03-01" } });
  assert.equal(again.body.checks.filter((c) => /NOT followed/.test(c)).length, 0, "reported once");
  await at("2027-09-18", { expiry: "2028-03-01", note: { vercelMismatch: "2028-03-01" } });
  assert.equal(ownInvoices()[0]?.metadata.renews_on, "2027-09-25", "billed on OUR date");
});

test("M2 Ithar: the year billed for 2027-09-25 must be RENEWED by Vercel before 2028's is billed; 5 days late it alarms, daily", async () => {
  const billed = { billed: "2027-09-25", renewsOn: "2028-09-25" };
  const within = await at("2027-09-28", { note: billed, expiry: "2027-09-25" });
  assert.equal(within.body.failed.length, 0, "day +3: Vercel may still be renewing");
  const late = await at("2027-10-01", { note: billed, expiry: "2027-09-25" });
  assert.ok(late.body.failed.some((f) => /year from 2027-09-25 was PAID and NOT renewed by Vercel .*renew it by hand in Vercel or refund/.test(f)), JSON.stringify(late.body.failed));
  const nextYear = await at("2028-09-18", { note: billed, expiry: "2027-09-25", hostingNext: "2028-10-09" });
  assert.equal(ownInvoices().length + items.length, 0, "the next year is NEVER billed while the last one was not renewed");
  assert.ok(nextYear.body.failed.some((f) => /NOT renewed by Vercel/.test(f)));
  const renewed = await at("2028-09-18", { note: billed, expiry: "2028-09-25", hostingNext: "2028-10-09" });
  assert.equal(ownInvoices()[0]?.metadata.renews_on, "2028-09-25", "renewed by Vercel: the next year is billed");
  assert.equal(ownedNote(renewed).billed, "2028-09-25");
});

test("Ithar after a cancellation kept auto-renew on until 2027-09-25: switched off only once Vercel renewed that paid year", async () => {
  const kept = { keptUntil: "2027-09-25" };
  await at("2027-09-25", { note: kept, status: "churned" });
  assert.deepEqual(autoRenew, [], "the paid year has not started");
  const notYet = await at("2027-09-27", { note: kept, status: "churned", expiry: "2027-09-25" });
  assert.deepEqual(autoRenew, []);
  assert.equal(notYet.body.failed.length, 0);
  const alarm = await at("2027-10-01", { note: kept, status: "churned", expiry: "2027-09-25" });
  assert.ok(alarm.body.failed.some((f) => /paid year from 2027-09-25 was NOT renewed by Vercel .* Auto-renew left ON/.test(f)));
  const off = await at("2027-09-27", { note: kept, status: "churned", expiry: "2028-09-25" });
  assert.deepEqual(autoRenew, [{ autoRenew: false }]);
  assert.equal(ownedNote(off).renewalOff, "2027-09-27");
});

test("Ithar on a hosting that ENDED is never billed, even on its charge day", async () => {
  const r = await at("2027-09-18", { status: "churned" });
  assert.equal(ownInvoices().length + items.length, 0);
  assert.equal(r.clientMails.length, 0);
});

test("a pinned line added but NOT saved is not added AGAIN the next day (the tag is looked for first)", async () => {
  const first = await at("2027-09-18", { patchFails: true, hostingNext: "2027-09-20" });
  assert.equal(items.length, 1);
  assert.ok(first.body.failed.some((f) => /renewal line ADDED/.test(f)));
  const next = await at("2027-09-19", { keepItems: true, hostingNext: "2027-09-20" });
  assert.equal(items.length, 1, "no second line");
  assert.ok(next.body.checks.some((c) => /already on the account .* not added again/.test(c)), JSON.stringify(next.body.checks));
  assert.equal(ownedNote(next).billed, "2027-09-25", "the row caught up");
  await run({ inDays: 7, paid: 26, renewal: 11.25 });
  assert.equal(items[0].metadata.kind, "plan_domain_renewal");
});

/* ── The hosting must still be there (review of d5b8701) ─────────────────── */

const seedPaid = ({ hidden = false, receipt = null } = {}) => {
  items.length = 0; invoices.length = 0; payCalls.length = 0;
  invoices.push({ id: "in_paid", customer: "cus_ithar", status: "paid", total: 2790, amount_paid: 2790, hidden,
    metadata: { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: "2027-09-25", ...(receipt ? { receipt } : {}) } });
  items.push({ invoice: "in_paid", amount: 2790, metadata: { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: "2027-09-25" } });
};

test("Ithar CANCELLED AT PERIOD END: the renewal is NOT charged, the owner told once; the hosting runs to 2027-10-09, past the domain's 2027-09-25 expiry, so auto-renew stays ON until then", async () => {
  const r = await at("2027-09-18", { cancelAtPeriodEnd: true });
  assert.equal(ownInvoices().length + items.length, 0, "nothing billed on either path");
  assert.ok(r.body.failed.some((f) => /Ithar Digital cancelled — domain ithardigital\.com renewal 2027-09-25 NOT charged \(the hosting subscription is cancelled at the end of its period\); decide: renew at our cost, let it lapse, or ask the client\. Vercel auto-renew KEPT ON until the hosting ends on 2027-10-09 \(the domain expires 2027-09-25, before it\)/.test(f)), JSON.stringify(r.body.failed));
  assert.deepEqual(autoRenew, [], "the site is still served until 2027-10-09");
  assert.equal(ownedNote(r).subEnding, "2027-09-18");
  assert.equal(ownedNote(r).keptUntil, "2027-10-09");
  assert.equal(ownedNote(r).keptWhy, "hosting");
  const again = await at("2027-09-19", { cancelAtPeriodEnd: true, note: { subEnding: "2027-09-18", keptUntil: "2027-10-09", keptWhy: "hosting" } });
  assert.equal(again.body.failed.length, 0, "told once");
  assert.deepEqual(autoRenew, []);
  // After the hosting has ended: off, with no "paid year" check (none was paid).
  const off = await at("2027-10-10", { cancelAtPeriodEnd: true, expiry: "2028-09-25", note: { subEnding: "2027-09-18", keptUntil: "2027-10-09", keptWhy: "hosting" } });
  assert.deepEqual(autoRenew, [{ autoRenew: false }]);
  assert.ok(off.body.checks.some((c) => /the hosting ended on 2027-10-09; auto-renew switched OFF/.test(c)), JSON.stringify(off.body.checks));
});

test("cancelled at period end with the hosting ending BEFORE the domain expires: auto-renew OFF now", async () => {
  const r = await at("2027-09-18", { cancelAtPeriodEnd: true, hostingNext: "2027-09-20" });
  assert.deepEqual(autoRenew, [{ autoRenew: false }]);
  assert.ok(r.body.failed.some((f) => /renewal 2027-09-25 NOT charged .* Vercel auto-renew switched OFF/.test(f)));
  assert.equal(ownedNote(r).renewalOff, "2027-09-18");
});

test("M: the year's $27.90 line already sits on a $217.90 HOSTING invoice (paid, or open): never collected by the domain path; $27.90 recorded as billed", async () => {
  for (const status of ["paid", "open"]) {
    items.length = 0; invoices.length = 0; payCalls.length = 0;
    const tag = { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: "2027-09-25" };
    invoices.push({ id: "in_host", customer: "cus_ithar", status, total: 21790, amount_paid: status === "paid" ? 21790 : 0, metadata: {},
      lines: { data: [{ metadata: tag, amount: 2790 }, { metadata: {}, amount: 19000 }] } });
    items.push({ invoice: "in_host", amount: 2790, metadata: tag });
    const r = await at("2027-09-18", { keepItems: true });
    assert.equal(payCalls.length, 0, `${status}: the hosting invoice is never paid by the domain path`);
    assert.equal(invoices.find((i) => i.id === "in_host").metadata.last_attempt, undefined, `${status}: never stamped`);
    assert.equal(ownInvoices().length, 0, `${status}: no invoice of its own`);
    assert.ok(r.body.checks.some((c) => /already a \$27\.90 line on invoice in_host .* billed there, not charged by the domain path/.test(c)), JSON.stringify(r.body.checks));
    const n = ownedNote(r);
    assert.equal(n.billed, "2027-09-25");
    assert.equal(n.usd, 27.9, `${status}: the line's amount, never the invoice's 217.90`);
    assert.equal(r.clientMails.length, 0, "no receipt for a charge the domain path did not make");
  }
});

test("M: the domain's OWN invoice paid for more than its line (an extra charge on it): $27.90 recorded, never the total", async () => {
  items.length = 0; invoices.length = 0; payCalls.length = 0;
  const tag = { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: "2027-09-25" };
  invoices.push({ id: "in_own_x", customer: "cus_ithar", status: "paid", total: 3000, amount_paid: 3000, metadata: { ...tag, receipt: "sent" },
    lines: { data: [{ metadata: tag, amount: 2790 }, { metadata: {}, amount: 210 }] } });
  items.push({ invoice: "in_own_x", amount: 2790, metadata: tag });
  const r = await at("2027-09-18", { keepItems: true });
  assert.equal(ownedNote(r).usd, 27.9, "the tagged line, not the invoice's 30.00");
  assert.ok(r.body.charged.some((c) => /\$27\.90 .* on its own invoice in_own_x/.test(c)), JSON.stringify(r.body.charged));
});

test("kept for the HOSTING: off once the hosting ended even if Vercel did not renew — there is no paid year to alarm about", async () => {
  const r = await at("2027-10-10", { cancelAtPeriodEnd: true, expiry: "2027-09-25", note: { subEnding: "2027-09-18", keptUntil: "2027-10-09", keptWhy: "hosting" } });
  assert.deepEqual(autoRenew, [{ autoRenew: false }]);
  assert.equal(r.body.failed.filter((f) => /NOT renewed by Vercel/.test(f)).length, 0);
});

test("reinstated AFTER the domain expired: not billed, the owner told to renew by hand", async () => {
  const r = await at("2027-09-18", { expiry: "2027-09-10", note: { subEnding: "2027-09-01", renewalOff: "2027-09-01" } });
  assert.equal(ownInvoices().length + items.length, 0);
  assert.deepEqual(autoRenew, [], "switching auto-renew on would renew nothing");
  assert.ok(r.body.failed.some((f) => /active again but the domain EXPIRED on 2027-09-10 .* renew it by hand in Vercel/.test(f)), JSON.stringify(r.body.failed));
});

test("a subscription already CANCELED (its deletion webhook missed) is treated the same", async () => {
  const r = await at("2027-09-18", { subStatus: "canceled" });
  assert.equal(ownInvoices().length + items.length, 0);
  assert.ok(r.body.failed.some((f) => /renewal 2027-09-25 NOT charged \(the hosting subscription is canceled\)/.test(f)));
  assert.deepEqual(autoRenew, [{ autoRenew: false }]);
});

test("ending, but the next year is ALREADY PAID: auto-renew kept on until it starts, then off once Vercel renewed it", async () => {
  seedPaid();
  const r = await at("2027-09-18", { cancelAtPeriodEnd: true, keepItems: true });
  assert.deepEqual(autoRenew, [], "the client bought that year");
  assert.ok(r.body.failed.some((f) => /auto-renew KEPT ON until 2027-09-25/.test(f)));
  assert.equal(ownedNote(r).keptUntil, "2027-09-25");
  const off = await at("2027-09-27", { cancelAtPeriodEnd: true, expiry: "2028-09-25", note: { subEnding: "2027-09-18", keptUntil: "2027-09-25" } });
  assert.deepEqual(autoRenew, [{ autoRenew: false }]);
  assert.equal(ownedNote(off).renewalOff, "2027-09-27");
});

test("the client takes the cancellation back: markers cleared, Vercel auto-renew back ON, and the year is billed", async () => {
  const r = await at("2027-09-18", { note: { subEnding: "2027-09-10", renewalOff: "2027-09-10" } });
  assert.deepEqual(autoRenew, [{ autoRenew: true }]);
  assert.ok(r.body.checks.some((c) => /hosting is active again — renewal back on, Vercel auto-renew switched back ON/.test(c)));
  // (the fake Supabase re-reads the seeded row, so the reinstating write is looked for, not the last one)
  const cleared = r.notes.map((x) => OD.readOwnedDomainNote(x)).find((n) => !n.subEnding && !n.renewalOff);
  assert.ok(cleared, "the markers were cleared");
  assert.equal(ownInvoices().length, 1, "billed as normal");
});

test("LOW: a tagged line already PENDING for that year means no own invoice — the year is not charged twice", async () => {
  items.length = 0; invoices.length = 0;
  items.push({ amount: 2790, subscription: "sub_ithar", metadata: { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: "2027-09-25" } });
  const r = await at("2027-09-18", { keepItems: true });
  assert.equal(ownInvoices().length, 0);
  assert.ok(r.body.checks.some((c) => /already on the account .* not charged twice; row moved to 2028-09-25/.test(c)), JSON.stringify(r.body.checks));
  assert.equal(ownedNote(r).billed, "2027-09-25");
});

test("LOW: a paid own invoice past the list's pages is found through its tagged item; its receipt is never sent twice", async () => {
  seedPaid({ hidden: true, receipt: "sent" });
  const r = await at("2027-09-18", { keepItems: true });
  assert.equal(invoices.length, 1, "no second invoice");
  assert.equal(payCalls.length, 0);
  assert.equal(ownedNote(r).billed, "2027-09-25", "the row caught up");
  assert.equal(r.clientMails.length, 0, `receipt already sent for that invoice: ${JSON.stringify(r.clientMails.map((m) => m.subject))}`);
});

test("LOW: never two payment attempts on one day, even when the run is repeated", async () => {
  await at("2027-09-18", { payFails: true });
  await at("2027-09-18", { payFails: true, keepItems: true });
  assert.equal(payCalls.length, 1);
  assert.equal(ownInvoices()[0].metadata.last_attempt, "2027-09-18");
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
