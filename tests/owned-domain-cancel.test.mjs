/**
 * A hosting subscription that carried a domain WE ALREADY OWNED ends
 * (customer.subscription.deleted), driven through the real Stripe webhook
 * (tests/webhook-harness.mjs): unbilled renewal lines go, Vercel's auto-renew
 * goes off — unless a paid year has not started yet, when it stays on until
 * then — and the owner's cancellation notice names the domain and what
 * happened. A founder test cancellation never reaches Vercel.
 *
 *   node --import ./tests/register.mjs --test tests/owned-domain-cancel.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as H from "./webhook-harness.mjs";

const { POST, request } = await H.bootHarness();
const harnessFetch = globalThis.fetch;
const OD = await import("../src/lib/ownedDomain.ts");

/* Vercel: records auto-renew changes. Everything else: the harness. */
const autoRenew = [];
const vercel = { autoRenewStatus: 204 };
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === "string" ? input : input.url);
  if (url.startsWith("https://api.vercel.com")) {
    if (url.includes("/auto-renew")) {
      autoRenew.push({ url, body: JSON.parse(String(init.body)) });
      return vercel.autoRenewStatus === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ error: { code: "internal_server_error" } }), { status: vercel.autoRenewStatus, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404 });
  }
  return harnessFetch(input, init);
};
Object.assign(process.env, { VERCEL_TOKEN: "vt", VERCEL_TEAM_ID: "team_x" });

/* Stripe through the seam: the customer's invoice items and their invoices. */
const SM = await import("../src/lib/stripeMode.ts");
const stripeState = { items: [], invoices: {}, deleted: [] };
SM.__setStripeFactoryForTests(() => ({
  invoiceItems: {
    list: async () => ({ data: stripeState.items }),
    del: async (id) => { stripeState.deleted.push(id); return { id, deleted: true }; },
  },
  invoices: { retrieve: async (id) => stripeState.invoices[id] },
}));

const TODAY = new Date().toISOString().slice(0, 10);
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const NOTE = { domain: "ithardigital.com", usd: 27.9, project: "ithar-digital", paidOn: "2026-09-25", renewsOn: day(200) };
const item = (id, invoice, renewsOn) => ({ id, invoice, metadata: { kind: "owned_domain_renewal", domain: "ithardigital.com", renews_on: renewsOn } });

function reset({ items = [], invoices = {}, status = 204 } = {}) {
  H.reset();
  autoRenew.length = 0;
  Object.assign(stripeState, { items, invoices, deleted: [] });
  vercel.autoRenewStatus = status;
  H.reads.hosting_clients = [{ id: "h-owned", business: "Ithar Digital", notes: OD.writeOwnedDomainNote(null, NOTE) }];
}
const noteWrites = () => H.writes.filter((w) => w.table === "hosting_clients" && w.body?.notes).map((w) => OD.readOwnedDomainNote(w.body.notes));
const telegram = () => H.outbound.filter((o) => o.url.includes("api.telegram.org")).map((o) => JSON.parse(o.body).text);

test("cancelled, nothing paid ahead: unbilled line removed, auto-renew OFF, the note says so, the owner is told with the domain named", async () => {
  reset({ items: [item("ii_pending", null, day(200))] });
  const res = await POST(request(H.subscriptionDeleted(true), H.LIVE_WH));
  assert.equal(res.status, 200);
  assert.deepEqual(stripeState.deleted, ["ii_pending"], "the line no invoice will ever carry is gone");
  assert.equal(autoRenew.length, 1);
  assert.match(autoRenew[0].url, /\/v1\/registrar\/domains\/ithardigital\.com\/auto-renew/);
  assert.deepEqual(autoRenew[0].body, { autoRenew: false });
  const [n] = noteWrites();
  assert.equal(n.renewalOff, TODAY);
  const t = telegram().find((x) => x.includes("Subscription ended"));
  assert.ok(t, JSON.stringify(telegram()));
  assert.match(t, /Subscription ended: hosting \+ domain ithardigital\.com — Ithar Digital/);
  assert.match(t, /Owned domain ithardigital\.com: Vercel auto-renew switched OFF/);
});

test("cancelled AFTER the next year was paid: auto-renew stays ON until that year's date, and the notice says when it goes off", async () => {
  reset({ items: [item("ii_paid", "in_paid", day(20))], invoices: { in_paid: { id: "in_paid", status: "paid" } } });
  await POST(request(H.subscriptionDeleted(true), H.LIVE_WH));
  assert.deepEqual(autoRenew, [], "not switched off: the client bought that year");
  assert.deepEqual(stripeState.deleted, [], "a paid line is never touched");
  const [n] = noteWrites();
  assert.equal(n.keptUntil, day(20));
  assert.equal(n.renewalOff, undefined);
  const t = telegram().find((x) => x.includes("Subscription ended"));
  assert.match(t, new RegExp(`auto-renew KEPT ON until ${day(20)}`));
  assert.match(t, new RegExp(`goes off by itself after ${day(20)}`));
});

test("a paid year that has ALREADY started does not keep auto-renew on", async () => {
  reset({ items: [item("ii_old", "in_old", day(-30))], invoices: { in_old: { id: "in_old", status: "paid" } } });
  await POST(request(H.subscriptionDeleted(true), H.LIVE_WH));
  assert.deepEqual(autoRenew.map((a) => a.body), [{ autoRenew: false }]);
});

test("Vercel refuses: the owner is told to do it by hand, and nothing claims it was done", async () => {
  reset({ status: 500 });
  await POST(request(H.subscriptionDeleted(true), H.LIVE_WH));
  assert.equal(noteWrites().length, 0, "no renewal-off recorded");
  assert.match(telegram().find((x) => x.includes("Subscription ended")), /auto-renew NOT switched off .* do it in Vercel > Domains/);
});

test("a hosting with no owned domain ends exactly as before (no Vercel call, subject unchanged)", async () => {
  reset();
  H.reads.hosting_clients = [{ id: "h-plain", business: "Plain Co", notes: null }];
  await POST(request(H.subscriptionDeleted(true), H.LIVE_WH));
  assert.deepEqual(autoRenew, []);
  assert.match(telegram().find((x) => x.includes("Subscription ended")), /Subscription ended: hosting — Plain Co/);
});

test("a founder TEST cancellation never reaches Vercel and deletes nothing", async () => {
  reset({ items: [item("ii_pending", null, day(200))] });
  Object.assign(process.env, { STRIPE_TEST_SECRET_KEY: "sk_test_harness", STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH });
  try {
    const res = await POST(request(H.subscriptionDeleted(false), H.TEST_WH));
    assert.equal(res.status, 200);
    assert.deepEqual(autoRenew, [], "no Vercel call");
    assert.deepEqual(stripeState.deleted, [], "nothing deleted");
    assert.match(telegram().find((x) => x.includes("Subscription ended")) ?? "", /TEST — Vercel not touched/);
  } finally {
    delete process.env.STRIPE_TEST_SECRET_KEY;
    delete process.env.STRIPE_TEST_WEBHOOK_SECRET;
  }
});

test("the pure pieces: renewal date sync and the notice line", () => {
  assert.equal(OD.effectiveRenewsOn({ renewsOn: "2027-09-25" }, "2027-09-20"), "2027-09-20", "Vercel's real expiry wins before the first bill");
  assert.equal(OD.effectiveRenewsOn({ renewsOn: "2028-09-20", billed: "2027-09-20" }, "2027-09-20"), "2028-09-20", "billed, not yet renewed: ours stands");
  assert.equal(OD.effectiveRenewsOn({ renewsOn: "2027-09-25" }, null), "2027-09-25", "unreadable: ours");
  const round = OD.readOwnedDomainNote(OD.writeOwnedDomainNote(null, { ...NOTE, billed: "2027-09-20", noticed: "2028-09-20=35.9", keptUntil: "2028-09-20" }));
  assert.equal(round.billed, "2027-09-20");
  assert.equal(round.noticed, "2028-09-20=35.9");
  assert.equal(round.keptUntil, "2028-09-20");
  // A note that never renewed keeps exactly the line the hosting link wrote.
  assert.doesNotMatch(OD.writeOwnedDomainNote(null, NOTE), /billed|noticed|kept|renewal-off/);
});
