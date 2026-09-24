/**
 * Founder test mode (decided 2026-09-24): the LIVE site accepts Stripe TEST
 * purchases from the admin's own browser, tags everything they write
 * is_test, keeps it out of every number, and never lets it reach the real
 * world. And — the owner's hard rule — LIVE events for real clients are
 * handled exactly as before.
 *
 *   node --import ./tests/register.mjs --test tests/test-mode.test.mjs
 *
 * The webhook is driven for real (signed events, a fake Supabase over fetch)
 * by tests/webhook-harness.mjs. tests/webhook-live-baseline.json is the live
 * scenarios' output captured on the webhook BEFORE test mode (8851b6b); the
 * first webhook test compares today's output to it byte for byte.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import * as H from "./webhook-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// CR stripped: autocrlf leaves some working-tree files CRLF, some LF.
const src = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

// The harness sets env + the fetch stub BEFORE any app module loads.
const { POST: webhookPOST, request } = await H.bootHarness();
const TM = await import("../src/lib/testMode.ts");
const SM = await import("../src/lib/stripeMode.ts");
const TC = await import("../src/lib/testContext.ts");
const { NextRequest } = await import("next/server");

const TEST_KEY = "sk_test_harness_key";
const LIVE_KEY = process.env.STRIPE_SECRET_KEY; // sk_live_harness

/* ── A fake Stripe, installed through the one test seam ─────────────────── */
const stripeCalls = [];
function missing() {
  const e = new Error("No such subscription");
  e.code = "resource_missing";
  e.statusCode = 404;
  return e;
}
function fakeStripe(key) {
  return {
    key,
    checkout: {
      sessions: {
        create: async (params) => {
          stripeCalls.push({ key, op: "sessions.create", params });
          return { id: key.startsWith("sk_test") ? "cs_test_fake" : "cs_live_fake", url: "https://checkout.stripe.test/s" };
        },
        retrieve: async (id) => ({ id, subscription: "sub_test_x", status: "complete", mode: "subscription", metadata: {} }),
        list: async () => ({ data: [] }),
      },
    },
    subscriptions: {
      retrieve: async (id) => {
        stripeCalls.push({ key, op: "subscriptions.retrieve", id });
        // A test subscription exists only under the test key, and vice versa.
        if (key.startsWith("sk_live") !== id.startsWith("sub_live")) throw missing();
        return { id, customer: "cus_x", status: "active", metadata: {}, cancel_at_period_end: false, items: { data: [] } };
      },
    },
    billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.test/p" }) } },
  };
}
SM.__setStripeFactoryForTests(fakeStripe);

function withEnv(vars, fn) {
  const before = {};
  for (const k of Object.keys(vars)) before[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  return Promise.resolve().then(fn).finally(restore);
}

const FOUNDER = "founder@example.com";
process.env.FOUNDER_EMAIL = FOUNDER;

/** An admin-session-shaped JWT whose payload carries `exp` (seconds). The
 *  test cookie is bound to it, and reads it only for its expiry. */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function adminToken(expSec = Math.floor(Date.now() / 1000) + 3600, salt = "a") {
  return `${b64({ alg: "HS256" })}.${b64({ role: "admin", exp: expSec, salt })}.sig-${salt}`;
}
const ADMIN = adminToken();
const validCookie = () => TM.signTestCookie(Date.now() + 3600_000, ADMIN);

function post(url, body, cookie, admin = ADMIN) {
  const headers = { "content-type": "application/json", origin: "https://servolia.com" };
  const jar = [];
  if (cookie) jar.push(`sv_test=${cookie}`);
  if (cookie && admin) jar.push(`servolia_admin=${admin}`);
  if (jar.length) headers.cookie = jar.join("; ");
  return new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers });
}

/* ══ 1. The cookie ═════════════════════════════════════════════════════════ */

test("a signed, unexpired cookie is test mode; expired, forged, tampered or garbage is live", () => {
  const exp = Date.now() + 60_000;
  const good = TM.signTestCookie(exp, ADMIN);
  assert.equal(TM.verifyTestCookie(good, ADMIN), exp);
  assert.equal(TM.verifyTestCookie(good, ADMIN, exp + 1), null, "expired");
  const [v, e, mac] = good.split(".");
  assert.equal(TM.verifyTestCookie(`${v}.${e}.${mac.slice(0, -2)}${mac.endsWith("AA") ? "BB" : "AA"}`, ADMIN), null, "forged MAC");
  assert.equal(TM.verifyTestCookie(`${v}.${Number(e) + 3600_000}.${mac}`, ADMIN), null, "expiry pushed out without re-signing");
  for (const junk of ["", "1", "v1.abc.def", "v2." + e + "." + mac, null, undefined]) {
    assert.equal(TM.verifyTestCookie(junk, ADMIN), null, `garbage ${junk}`);
  }
  const jar = (m) => ({ cookies: { get: (n) => (m[n] ? { value: m[n] } : undefined) } });
  assert.equal(TM.isTestRequest(jar({ sv_test: good, servolia_admin: ADMIN })), true);
  assert.equal(TM.isTestRequest(jar({})), false);
});

test("the test cookie dies with its admin session: logged out, another session, or an expired one", () => {
  const good = TM.signTestCookie(Date.now() + 3600_000, ADMIN);
  const jar = (m) => ({ cookies: { get: (n) => (m[n] ? { value: m[n] } : undefined) } });
  assert.equal(TM.isTestRequest(jar({ sv_test: good })), false, "admin logged out (cookie cleared)");
  assert.equal(TM.isTestRequest(jar({ sv_test: good, servolia_admin: adminToken(undefined, "b") })), false, "a different admin session");
  const old = adminToken(Math.floor(Date.now() / 1000) - 5, "c");
  const bound = TM.signTestCookie(Date.now() + 3600_000, old);
  assert.equal(TM.isTestRequest(jar({ sv_test: bound, servolia_admin: old })), false, "the admin session has expired");
});

test("a cookie signed with another secret is not test mode", () => withEnv({ UPGRADE_TOKEN_SECRET: "a-different-secret" }, () => {
  const other = TM.signTestCookie(Date.now() + 60_000, ADMIN);
  return withEnv({ UPGRADE_TOKEN_SECRET: "harness-upgrade-secret" }, () => {
    assert.equal(TM.verifyTestCookie(other, ADMIN), null);
  });
}));

test("the admin route sets the cookie httpOnly + SameSite=Lax for 8 hours, bound to the admin session; the pill asks the server", () => {
  const r = src("src/app/api/admin/test-mode/route.ts");
  assert.match(r, /if \(!\(await isAdminAuthed\(\)\)\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\n  const \{ on \}/, "POST checks the admin session first");
  assert.match(r, /const adminToken = req\.cookies\.get\(getCookieName\(\)\)\?\.value \?\? "";\n\s*res\.cookies\.set\(TEST_COOKIE, signTestCookie\(exp, adminToken\), \{ httpOnly: true, secure, sameSite: "lax"/);
  assert.equal(TM.TEST_HOURS, 8);
  const pill = src("src/components/TestModeNote.tsx");
  assert.match(pill, /fetch\("\/api\/admin\/test-mode"/, "the pill is verified by the same server check");
  assert.match(pill, /setOn\(s\?\.on === true\)/);
});

/* ══ 2. Which Stripe key ═══════════════════════════════════════════════════ */

test("stripeFor: live key for live, test key for test — and a LIVE key in the test variable is refused", () => withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY }, async () => {
  assert.equal(SM.stripeFor(true).key, LIVE_KEY);
  assert.equal(SM.stripeFor(false).key, TEST_KEY);
  assert.equal(SM.testModeAvailable(), true);
  await withEnv({ STRIPE_TEST_SECRET_KEY: "sk_live_pasted_by_mistake" }, () => {
    assert.equal(SM.testModeAvailable(), false);
    assert.equal(SM.stripeFor(false), null);
  });
  await withEnv({ STRIPE_TEST_SECRET_KEY: undefined }, () => {
    assert.equal(SM.stripeFor(false), null);
  });
}));

test("inEitherMode: a live id is found with the live key alone; a test id falls through to the test key", () => withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY }, async () => {
  stripeCalls.length = 0;
  const live = await SM.inEitherMode((s) => s.subscriptions.retrieve("sub_live_1"));
  assert.equal(live.livemode, true);
  assert.deepEqual(stripeCalls.map((c) => c.key), [LIVE_KEY], "one live call, exactly as before");
  stripeCalls.length = 0;
  const t = await SM.inEitherMode((s) => s.subscriptions.retrieve("sub_test_1"));
  assert.equal(t.livemode, false);
  assert.deepEqual(stripeCalls.map((c) => c.key), [LIVE_KEY, TEST_KEY]);
  // The webhook knows the mode: that mode only.
  stripeCalls.length = 0;
  await SM.inEitherMode((s) => s.subscriptions.retrieve("sub_test_1"), false);
  assert.deepEqual(stripeCalls.map((c) => c.key), [TEST_KEY]);
}));

/* ══ 3. Every checkout-creating route ══════════════════════════════════════ */

const CHECKOUT_FILES = [
  "src/app/api/checkout/route.ts",
  "src/app/api/checkout-subscription/route.ts",
  "src/app/api/checkout-receptionist/route.ts",
  "src/app/api/checkout-topup/route.ts",
  "src/app/api/checkout-addon/route.ts",
  "src/app/api/hosting-checkout/route.ts",
];
/** Payment links the ADMIN makes are for real clients: always live. */
const ADMIN_LINK_FILES = [
  "src/app/api/admin/hosting/checkout/route.ts",
  "src/app/api/admin/custom-requests/route.ts",
];

test("every file that creates a Checkout session is on a list; buyer routes go through checkoutStripe, admin links never do", () => {
  // The inventory: a NEW checkout route must be added here, or this fails.
  const found = execFileSync("git", ["grep", "-l", "checkout.sessions.create", "--", "src"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(Boolean).map((f) => f.trim()).sort();
  assert.deepEqual(found, [...CHECKOUT_FILES, ...ADMIN_LINK_FILES, "src/lib/domainCheckout.ts"].sort());
  for (const f of CHECKOUT_FILES) {
    const s = src(f);
    assert.match(s, /const co = checkoutStripe\(req\);\n\s*if \(co\.refused\) return co\.refused;/, `${f}: refuses before anything else`);
    assert.doesNotMatch(s, /new Stripe\(/, `${f}: no Stripe client of its own`);
    assert.match(s, /\.\.\.co\.tag/, `${f}: tags the session metadata`);
    if (f.includes("receptionist")) assert.match(s, /if \(co\.test && !isFounderEmail\(r\.email\)\)/, `${f}: only the founder's own trial`);
    else assert.match(s, /co\.buyer/, `${f}: a test purchase is made in the founder's name`);
  }
  for (const f of ADMIN_LINK_FILES) {
    const s = src(f);
    assert.doesNotMatch(s, /checkoutStripe|testMode"|isTestRequest/, `${f}: must ignore the test cookie`);
    assert.match(s, /new Stripe\(key\)/, `${f}: the live key, always`);
  }
});

async function routeCase(file, body, { cookie, testKey, admin }) {
  const mod = await import(`../${file}`);
  stripeCalls.length = 0;
  const res = await withEnv({ STRIPE_TEST_SECRET_KEY: testKey }, () =>
    mod.POST(post(`https://servolia.com/${file}`, body, cookie, admin)));
  return { res, calls: stripeCalls.filter((c) => c.op === "sessions.create") };
}

const PUBLIC_ROUTES = [
  ["src/app/api/checkout/route.ts", () => ({ plan: SELLABLE_KEY, leadId: "real-lead-1" })],
  ["src/app/api/checkout-subscription/route.ts", () => ({ plan: "essentiel", billing: "monthly", email: "someone@client.fr" })],
  ["src/app/api/hosting-checkout/route.ts", () => ({ plan: "hosting", billing: "monthly", email: "someone@client.fr" })],
];
const { SELLABLE_BUILD_PLANS } = await import("../src/lib/pricing.ts");
const SELLABLE_KEY = SELLABLE_BUILD_PLANS[0].key;

for (const [file, body] of PUBLIC_ROUTES) {
  test(`${file}: test cookie -> TEST session, tagged, in the founder's name; no cookie -> live, untouched`, async () => {
    const t = await routeCase(file, body(), { cookie: validCookie(), testKey: TEST_KEY });
    assert.equal(t.res.status, 200);
    assert.equal(t.calls.length, 1);
    assert.equal(t.calls[0].key, TEST_KEY);
    assert.equal(t.calls[0].params.metadata.test, "1");
    assert.equal(t.calls[0].params.customer_email, FOUNDER, "a test purchase never carries anyone else's address");
    if (t.calls[0].params.subscription_data) assert.equal(t.calls[0].params.subscription_data.metadata?.test, "1");
    if ("lead_id" in t.calls[0].params.metadata) assert.equal(t.calls[0].params.metadata.lead_id, "", "never linked to a real lead");

    const l = await routeCase(file, body(), { cookie: null, testKey: TEST_KEY });
    assert.equal(l.calls.length, 1);
    assert.equal(l.calls[0].key, LIVE_KEY);
    assert.equal("test" in l.calls[0].params.metadata, false, "live metadata exactly as before");
    assert.notEqual(l.calls[0].params.customer_email, FOUNDER);
    if (l.calls[0].params.subscription_data?.metadata) assert.equal("test" in l.calls[0].params.subscription_data.metadata, false);
    if ("lead_id" in l.calls[0].params.metadata) assert.equal(l.calls[0].params.metadata.lead_id, "real-lead-1");

    const forged = await routeCase(file, body(), { cookie: validCookie().replace(/.$/, (c) => (c === "A" ? "B" : "A")), testKey: TEST_KEY });
    assert.equal(forged.calls[0].key, LIVE_KEY, "a forged cookie is live");
    const loggedOut = await routeCase(file, body(), { cookie: validCookie(), testKey: TEST_KEY, admin: null });
    assert.equal(loggedOut.calls[0].key, LIVE_KEY, "no admin session, no test mode");
  });
}

const REFUSAL_ROUTES = [
  ...PUBLIC_ROUTES,
  ["src/app/api/checkout-receptionist/route.ts", () => ({ token: "x", plan: "essentiel" })],
];
for (const [file, body] of REFUSAL_ROUTES) {
  test(`${file}: test cookie WITHOUT a test key, or without a founder address -> 503, and no session at all`, async () => {
    const r = await routeCase(file, body(), { cookie: validCookie(), testKey: undefined });
    assert.equal(r.res.status, 503);
    assert.equal((await r.res.json()).error, "Test mode is on but no Stripe test key is configured");
    assert.equal(r.calls.length, 0, "never a live session instead");
    await withEnv({ FOUNDER_EMAIL: undefined, EMAIL_REPLY_TO: undefined }, async () => {
      const n = await routeCase(file, body(), { cookie: validCookie(), testKey: TEST_KEY });
      assert.equal(n.res.status, 503);
      assert.match((await n.res.json()).error, /FOUNDER_EMAIL/);
      assert.equal(n.calls.length, 0);
    });
  });
}

test("hosting checkout refuses test mode on a REAL client's ?ref= page; live on that page is unchanged", async () => {
  const body = { plan: "hosting", billing: "monthly", ref: "goodscochina" };
  const t = await routeCase("src/app/api/hosting-checkout/route.ts", body, { cookie: validCookie(), testKey: TEST_KEY });
  assert.equal(t.res.status, 503);
  assert.equal((await t.res.json()).error, "Test mode: use a test ref, not a real client's page");
  assert.equal(t.calls.length, 0);
  const l = await routeCase("src/app/api/hosting-checkout/route.ts", body, { cookie: null, testKey: TEST_KEY });
  assert.equal(l.calls.length, 1);
  assert.equal(l.calls[0].params.metadata.ref, "goodscochina");
});

test("receptionist checkout in test mode: only the founder's own trial can be bought", async () => {
  const { mintReceptionistToken } = await import("../src/lib/receptionistTrial.ts");
  const until = new Date(Date.now() + 5 * 86400000).toISOString();
  const trial = (email) => [{ id: "cs-row", slug: "cabinet-x", build_id: null, notes: "", config: { businessName: "Cabinet X", receptionist: { domain: "cabinet-x.fr", email, started: new Date().toISOString(), until, lang: "fr" } } }];
  for (const [email, expectOk] of [["prospect@cabinet-x.fr", false], [FOUNDER, true]]) {
    H.reset();
    H.reads.client_sites = trial(email);
    const token = await mintReceptionistToken({ slug: "cabinet-x", email, lang: "fr" });
    const r = await routeCase("src/app/api/checkout-receptionist/route.ts", { token, plan: "essentiel" }, { cookie: validCookie(), testKey: TEST_KEY });
    if (expectOk) {
      assert.equal(r.res.status, 200, "the founder's own trial");
      assert.equal(r.calls[0].key, TEST_KEY);
    } else {
      assert.equal(r.res.status, 403, "a prospect's trial is never bought in test mode");
      assert.equal(r.calls.length, 0);
    }
  }
  H.reset();
});

test("checkoutStripe itself: refusal, test client + tag + founder buyer, or live exactly as before", () => withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY }, async () => {
  const jar = (v) => ({ cookies: { get: (n) => (n === "sv_test" && v ? { value: v } : n === "servolia_admin" ? { value: ADMIN } : undefined) } });
  const t = TM.checkoutStripe(jar(validCookie()));
  assert.equal(t.refused, null);
  assert.equal(t.stripe.key, TEST_KEY);
  assert.deepEqual(t.tag, { test: "1" });
  assert.equal(t.buyer, FOUNDER);
  const l = TM.checkoutStripe(jar(null));
  assert.equal(l.stripe.key, LIVE_KEY);
  assert.deepEqual(l.tag, {});
  assert.equal(l.buyer, null);
  await withEnv({ STRIPE_TEST_SECRET_KEY: undefined }, () => {
    const r = TM.checkoutStripe(jar(validCookie()));
    assert.equal(r.refused.status, 503);
  });
}));

test("an extra domain is charged in the subscription's own mode", () => withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY }, async () => {
  const { domainCheckoutUrl } = await import("../src/lib/domainCheckout.ts");
  stripeCalls.length = 0;
  await domainCheckoutUrl({ subscriptionId: "sub_test_9", domain: "x-example.com", retailUsd: 30, ref: "", email: null, origin: "https://servolia.com" });
  const t = stripeCalls.find((c) => c.op === "sessions.create");
  assert.equal(t.key, TEST_KEY);
  assert.equal(t.params.metadata.test, "1");
  stripeCalls.length = 0;
  await domainCheckoutUrl({ subscriptionId: "sub_live_9", domain: "x-example.com", retailUsd: 30, ref: "", email: null, origin: "https://servolia.com" });
  const l = stripeCalls.find((c) => c.op === "sessions.create");
  assert.equal(l.key, LIVE_KEY);
  assert.equal("test" in l.params.metadata, false);
}));

/* ══ 4. The webhook ════════════════════════════════════════════════════════ */

test("LIVE events: writes, alerts and calls are byte-identical to the pre-test-mode webhook", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH }, async () => {
    const baseline = JSON.parse(src("tests/webhook-live-baseline.json"));
    const now = await H.runLiveScenarios();
    assert.deepEqual(now, baseline);
  }));

test("signatures: unsigned and forged are rejected; a test-secret signature is accepted", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH }, async () => {
    H.reset();
    assert.equal((await webhookPOST(request(H.planPurchase(false), H.TEST_WH, { unsigned: true }))).status, 400);
    assert.equal((await webhookPOST(request(H.planPurchase(false), H.TEST_WH, { forge: true }))).status, 400);
    assert.equal((await webhookPOST(request(H.planPurchase(false), "whsec_someone_else"))).status, 400);
    assert.equal(H.writes.length, 0);
    const ok = await webhookPOST(request(H.planPurchase(false), H.TEST_WH));
    assert.equal(ok.status, 200);
  }));

test("a LIVE event carrying the TEST secret's signature is rejected", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH }, async () => {
    H.reset();
    const res = await webhookPOST(request(H.planPurchase(true), H.TEST_WH));
    assert.equal(res.status, 400);
    assert.equal(H.writes.length, 0);
  }));

test("without STRIPE_TEST_WEBHOOK_SECRET, test events keep the old behaviour: live-signed ones are skipped, test-signed ones rejected", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: undefined }, async () => {
    H.reset();
    const skipped = await webhookPOST(request(H.planPurchase(false), H.LIVE_WH));
    assert.deepEqual(await skipped.json(), { received: true, testMode: true, skipped: "crm-writes" });
    assert.equal((await webhookPOST(request(H.planPurchase(false), H.TEST_WH))).status, 400);
    assert.equal(H.writes.length, 0);
  }));

test("a test event with the test secret but no test KEY writes nothing", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: undefined, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH }, async () => {
    H.reset();
    const res = await webhookPOST(request(H.planPurchase(false), H.TEST_WH));
    assert.equal((await res.json()).skipped, "no-test-key");
    assert.equal(H.writes.length, 0);
  }));

test("a test plan purchase: every row tagged is_test, alert says TEST, nothing sent to Meta", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH }, async () => {
    H.reset();
    const res = await webhookPOST(request(H.planPurchase(false), H.TEST_WH));
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(res.status, 200);
    const inserts = H.writes.filter((w) => w.method === "POST");
    assert.deepEqual(inserts.map((w) => w.table), ["builds", "clients"]);
    for (const w of inserts) assert.equal(w.body.is_test, true, `${w.table} insert untagged`);
    const leadMove = H.writes.find((w) => w.table === "leads");
    assert.match(leadMove.query, /is_test=eq\.true/, "a test purchase moves only test leads");
    const tg = H.outbound.filter((o) => o.url.includes("telegram"));
    assert.ok(tg.length > 0);
    for (const o of tg) assert.ok(JSON.parse(o.body).text.startsWith("TEST — "), "alert not marked TEST");
    assert.equal(H.outbound.filter((o) => o.url.includes("facebook")).length, 0, "Meta CAPI called for a test");
  }));

test("a test hosting purchase with a ref and a domain: no domain bought, no repository touched", () =>
  withEnv({
    STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH,
    // Everything a LIVE purchase would need to buy the domain and commit the gate.
    GH_TOKEN: "gh-harness", VERCEL_TOKEN: "vercel-harness", VERCEL_TEAM_ID: "team_harness",
    DOMAIN_CONTACT_JSON: JSON.stringify({ firstName: "A", lastName: "B", email: "a@b.c", phone: "+1.5555555555", address1: "1 St", city: "X", zip: "1", country: "US" }),
  }, async () => {
    H.reset();
    const res = await webhookPOST(request(H.hostingPurchase(false, "goodscochina"), H.TEST_WH));
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(res.status, 200);
    const hosts = H.outbound.map((o) => new URL(o.url).host);
    assert.equal(hosts.filter((h) => h === "api.github.com").length, 0, "GitHub touched");
    assert.equal(hosts.filter((h) => h === "api.vercel.com").length, 0, "Vercel registrar touched");
    const insert = H.writes.find((w) => w.method === "POST" && w.table === "hosting_clients");
    assert.equal(insert.body.is_test, true);
    assert.ok(H.writes.some((w) => String(w.body?.notes ?? "").includes("TEST: domain not bought")), "the domain is recorded as not bought");
    const texts = H.outbound.filter((o) => o.url.includes("telegram")).map((o) => JSON.parse(o.body).text);
    assert.ok(texts.every((t) => t.startsWith("TEST — ")));
    assert.ok(!texts.some((t) => t.includes("DOMAIN NOT BOUGHT")), "nobody is told to buy a test domain by hand");
  }));

function evt(type, object) {
  return { id: `evt_d_${Math.random().toString(36).slice(2)}`, object: "event", type, livemode: false, created: 1790000000, api_version: "2025-01-01", data: { object } };
}
const resendMails = () => H.outbound.filter((o) => o.url.includes("api.resend.com")).map((o) => JSON.parse(o.body));

test("every email sent during a test event goes to the founder, subject [TEST]; live emails are untouched", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH, RESEND_API_KEY: "re_harness" }, async () => {
    H.reset();
    await webhookPOST(request(H.planPurchase(false, "real.client@cabinet.fr"), H.TEST_WH));
    await new Promise((r) => setTimeout(r, 50));
    const t = resendMails();
    assert.ok(t.length > 0, "the test buyer's receipt was sent");
    for (const m of t) {
      assert.deepEqual([m.to].flat(), [FOUNDER], "a test email reached someone other than the founder");
      assert.ok(m.subject.startsWith("[TEST] "));
    }
    H.reset();
    await webhookPOST(request(H.planPurchase(true, "real.client@cabinet.fr"), H.LIVE_WH));
    await new Promise((r) => setTimeout(r, 50));
    const l = resendMails();
    assert.deepEqual([l[0].to].flat(), ["real.client@cabinet.fr"]);
    assert.ok(!l[0].subject.startsWith("[TEST]"));
  }));

test("with no founder address, a test email is not sent at all — the founder is told on Telegram", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH, RESEND_API_KEY: "re_harness", FOUNDER_EMAIL: undefined, EMAIL_REPLY_TO: undefined }, async () => {
    H.reset();
    await webhookPOST(request(H.planPurchase(false, "real.client@cabinet.fr"), H.TEST_WH));
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(resendMails().length, 0);
    const tg = H.outbound.filter((o) => o.url.includes("telegram")).map((o) => JSON.parse(o.body).text);
    assert.ok(tg.some((x) => x.includes("TEST MODE: email NOT sent")));
  }));

test("a test receptionist payment never claims or links a trial that is not the founder's", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH }, async () => {
    const until = new Date(Date.now() + 5 * 86400000).toISOString();
    const session = (email) => evt("checkout.session.completed", {
      id: "cs_test_rec", object: "checkout.session", mode: "subscription", payment_status: "paid", amount_total: 14900,
      customer: "cus_r", subscription: `sub_r_${email.length}`, customer_details: { email: FOUNDER },
      metadata: { kind: "receptionist", slug: "cabinet-x", plan: "essentiel", billing: "monthly", email: FOUNDER, lang: "fr", test: "1" },
    });
    for (const [owner, linked] of [["prospect@cabinet-x.fr", false], [FOUNDER, true]]) {
      H.reset();
      H.reads.client_sites = [{ id: "cs-row", slug: "cabinet-x", build_id: null, notes: "", config: { businessName: "Cabinet X", receptionist: { domain: "cabinet-x.fr", email: owner, started: new Date().toISOString(), until, lang: "fr" } } }];
      const res = await webhookPOST(request(session(owner), H.TEST_WH));
      assert.equal(res.status, 200);
      const siteWrites = H.writes.filter((w) => w.table === "client_sites");
      if (linked) assert.ok(siteWrites.length > 0, "the founder's own trial is linked");
      else assert.equal(siteWrites.length, 0, "a prospect's trial was touched by a test purchase");
      for (const w of H.writes.filter((x) => x.method === "POST")) assert.equal(w.body.is_test, true);
    }
    H.reset();
  }));

test("a test build payment never links to (or writes a scope for) a real lead from its metadata", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH }, async () => {
    H.reset();
    const res = await webhookPOST(request(evt("checkout.session.completed", {
      id: "cs_test_build", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 69000,
      customer: "cus_b", customer_details: { email: FOUNDER },
      metadata: { plan: SELLABLE_KEY, lead_id: "real-lead-1", lang: "fr", test: "1" },
    }), H.TEST_WH));
    assert.equal(res.status, 200);
    assert.ok(!JSON.stringify(H.writes).includes("real-lead-1"), "the real lead was linked or written to");
    const lead = H.writes.find((w) => w.method === "POST" && w.table === "leads");
    assert.equal(lead?.body.is_test, true, "a fresh tagged lead instead");
    H.reset();
  }));

test("cleanup reverts a paid trial row that points at a test build, and only that", async () => {
  const until = "2026-10-01T00:00:00.000Z";
  const site = { id: "s1", slug: "cabinet-x", status: "published", build_id: "b1", config: { status: "published", receptionist: { email: FOUNDER, started: "x", until, paidAt: "2026-09-24", plan: "essentiel", paying: "sub|t" } } };
  const draft = { id: "s2", slug: "draft-site", status: "draft", build_id: "b1", config: { status: "draft" } };
  const r = await runCleanup({ builds: [{ id: "b1", is_test: true }], client_sites: [site, draft] }, ["--apply"]);
  assert.equal(r.code, 0, r.text);
  const patches = r.requests.filter((q) => q.method === "PATCH");
  assert.equal(patches.length, 1, "only the paid receptionist row is reverted");
  assert.equal(patches[0].table, "client_sites");
  assert.match(patches[0].query, /^\?id=eq\.s1&build_id=eq\.b1$/);
  const body = JSON.parse(patches[0].body);
  assert.equal(body.build_id, null);
  assert.equal(body.status, "draft");
  assert.equal(body.config.status, "draft");
  assert.deepEqual(body.config.receptionist, { email: FOUNDER, started: "x", until }, "paidAt, plan and paying removed; the trial itself kept");
  assert.match(r.text, /REVERT receptionist trial cabinet-x/);
  // The revert happens before the build it was found through is deleted.
  const order = r.requests.filter((q) => q.method !== "GET").map((q) => q.method);
  assert.deepEqual(order, ["PATCH", "DELETE"]);
});

test("before the SQL has run, a test event is refused whole: nothing written, founder told", () =>
  withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH }, async () => {
    H.reset();
    H.missingColumn.on = true;
    const res = await webhookPOST(request(H.planPurchase(false), H.TEST_WH));
    const body = await res.json();
    assert.equal(body.refused, "is_test column missing");
    assert.equal(H.writes.length, 0);
    const tg = H.outbound.filter((o) => o.url.includes("telegram")).map((o) => JSON.parse(o.body).text);
    assert.ok(tg.some((t) => t.includes("TEST MODE: run supabase/2026-09-24-test-mode.sql first")));
    H.missingColumn.on = false;
  }));

test("webhook source: every real-world side effect is gated on test mode", () => {
  const w = src("src/app/api/webhooks/stripe/route.ts");
  assert.match(w, /if \(session\.metadata\?\.gate_widget && session\.metadata\?\.repo && !test\)/);
  assert.match(w, /if \(isTier && hostRef\?\.repo && !hostRef\.gateWidget && !test\)/);
  assert.match(w, /if \(isAssistant && test\) \{/);
  assert.match(w, /const outcome = test\n\s*\? \{ ok: false as const, reason: "error" as const, detail: "TEST: domain not bought" \}/);
  assert.match(w, /const outcome = test\n\s*\? \{ ok: false as const, reason: "TEST: domain not bought" \}/);
  assert.match(w, /wasTier && !test\)/);
  assert.match(w, /churnedDomain\?\.status === "bought" && !test\)/);
  assert.match(w, /return runAsTest\(!event\.livemode, \(\) => handleEvent\(event, modeStripe, db\)\)/);
  // Every raw Telegram send is marked in test mode.
  const raw = w.match(/text: [a-zA-Z(]+msg\)?, parse_mode/g) ?? [];
  assert.ok(raw.length >= 7);
  for (const r of raw) assert.match(r, /text: testPrefixed\(msg\)/);
});

/* ══ 5. The libraries refuse in test context ═══════════════════════════════ */

test("inside a test context: registrar, GitHub and Meta refuse; Telegram is prefixed; tags appear", async () => {
  const { registrar } = await import("../src/lib/domainSales.ts");
  const { sendMetaCapiEvent } = await import("../src/lib/metaCapi.ts");
  const { sendTelegramMessage } = await import("../src/lib/telegram.ts");
  const { applyGate } = await import("../src/lib/hostingGate.ts");
  const { installAssistantTag } = await import("../src/lib/assistantInstall.ts");
  await withEnv({ VERCEL_TOKEN: "v", VERCEL_TEAM_ID: "t", GH_TOKEN: "g" }, async () => {
    H.reset();
    await TC.runAsTest(true, async () => {
      assert.deepEqual(TC.testTag(), { is_test: true });
      const r = await registrar("/v1/registrar/domains/x.com/buy", { method: "POST" });
      assert.equal(r.code, "test_mode");
      const g = await applyGate({ repo: "o/r", branch: "main", siteRoot: null, gateWidget: null }, false);
      assert.equal(g.ok, false);
      const a = await installAssistantTag({ repo: "o/r", branch: "main", siteRoot: null }, "slug", "right");
      assert.equal(a.ok, false);
      await sendMetaCapiEvent({ eventName: "Purchase", email: "a@b.c", value: 1, currency: "EUR" });
      await sendTelegramMessage("hello");
    });
    assert.equal(H.outbound.filter((o) => /vercel|github|facebook/.test(o.url)).length, 0);
    assert.equal(JSON.parse(H.outbound.find((o) => o.url.includes("telegram")).body).text, "TEST — hello");
    // Outside: untouched.
    H.reset();
    assert.deepEqual(TC.testTag(), {});
    await sendTelegramMessage("hello");
    assert.equal(JSON.parse(H.outbound[0].body).text, "hello");
  });
});

/* ══ 6. Exclusion: `is_test is not true`, tolerant of the column not existing ═ */

/** A db whose is_test probe answers `probeError`, recording each probe. */
function probeDb(probeError) {
  const probes = [];
  return {
    probes,
    from: (t) => ({ select: (c) => ({ limit: async () => { probes.push(`${t}.${c}`); return { error: probeError }; } }) }),
  };
}

test("excludeTest: the column is detected ONCE by a probe (not by parsing errors); `is_test is not true` when it exists", async () => {
  TC.__resetTestColumnCacheForTests();
  const db = probeDb(null);
  const seen = [];
  const builder = { not(col, op, val) { seen.push([col, op, val]); return this; }, then: (r) => r({ data: ["rows"], error: null }) };
  await TC.excludeTest(db, (live) => live(builder));
  await TC.excludeTest(db, (live) => live(builder));
  assert.deepEqual(seen, [["is_test", "is", true], ["is_test", "is", true]], "NOT eq(false): null rows must stay counted");
  assert.deepEqual(db.probes, ["clients.is_test", "builds.is_test", "hosting_clients.is_test", "leads.is_test"], "probed once, cached");
  // keepTest (the founder's own test browser): unfiltered.
  seen.length = 0;
  await TC.excludeTest(db, (live) => live(builder), { keepTest: true });
  assert.deepEqual(seen, []);
  TC.__resetTestColumnCacheForTests();
});

test("excludeTest before the SQL: a head/count query runs unfiltered and its count survives (it read 0 before)", async () => {
  TC.__resetTestColumnCacheForTests();
  const db = probeDb({ code: "42703", message: "" });
  let filtered = false;
  // A head:true count query: PostgREST answers errors on it with an EMPTY message.
  const headQuery = { not() { filtered = true; return { then: (r) => r({ count: null, error: { message: "" } }) }; }, then: (r) => r({ count: 7, error: null }) };
  const res = await TC.excludeTest(db, (live) => live(headQuery));
  assert.equal(filtered, false, "never filtered on a column that does not exist");
  assert.equal(res.count, 7);
  TC.__resetTestColumnCacheForTests();
});

test("every number, list, cron and by-email lookup that must not see test rows excludes them", () => {
  const needs = {
    "src/lib/today.ts": 4,
    "src/app/admin/page.tsx": 4,
    "src/app/admin/revenue/page.tsx": 2,
    "src/app/admin/data-room/page.tsx": 2,
    "src/lib/economics.ts": 2,
    "src/lib/crmSnapshot.ts": 3,
    "src/app/api/cron/monthly-invoice/route.ts": 1,
    "src/app/api/cron/dunning/route.ts": 3,
    "src/app/api/cron/domain-billing/route.ts": 3,
    // by-email lookups: a client must never be answered with a test row
    "src/app/hosting/page.tsx": 1,
    "src/app/api/hosting-account/link/route.ts": 1,
    "src/app/api/hosting-upgrade/link/route.ts": 1,
    "src/app/portal/page.tsx": 2,
    "src/lib/portalAssistant.ts": 2,
    "src/app/api/billing-portal/route.ts": 1,
    "src/app/api/assistant-invite/route.ts": 1,
    "src/app/api/portal/leads/route.ts": 2,
    "src/app/api/portal/messages/route.ts": 1,
    "src/app/api/portal/reports/route.ts": 1,
    "src/app/api/portal/traffic/route.ts": 1,
    "src/app/api/checkout-addon/route.ts": 1,
    "src/lib/assistantAccess.ts": 1,
    "src/lib/assistantTrial.ts": 2,
    "src/lib/hostingRow.ts": 1,
    "src/app/api/contact/route.ts": 1,
    "src/app/api/webhooks/stripe/route.ts": 3,
  };
  for (const [f, n] of Object.entries(needs)) {
    const count = (src(f).match(/excludeTest\(db, \((live|only)\) =>/g) ?? []).length;
    assert.ok(count >= n, `${f}: ${count} excluded queries, expected ${n}`);
  }
  // A real client's intake (a cs_live_ session) always runs live, even from the founder's test browser.
  assert.match(src("src/app/api/contact/route.ts"), /runAsTest\(isTestRequest\(req\) && !liveSession,/);
  // The upgrade-link lookup keeps maybeSingle(): live behaviour exactly as
  // before test mode (two monthly rows -> no link), by the owner's rule.
  const upgrade = src("src/app/api/hosting-upgrade/link/route.ts");
  assert.match(upgrade, /\.eq\("status", "active"\)\)\s*\.maybeSingle\(\)/);
  assert.doesNotMatch(upgrade, /\.limit\(1\)/);
  assert.match(src("src/app/api/cron/monthly-report/route.ts"), /if \(siteRow\?\.build_id && testBuilds\.has\(siteRow\.build_id\)\) continue;/);
  assert.match(src("src/lib/conversationCap.ts"), /if \(level === 100 && !\(db && \(await isTestRow\(db, "clients", s\.clientId\)\)\)\)/);
  assert.match(src("src/app/admin/clients/page.tsx"), /const real = \(clients \?\? \[\]\)\.filter\(c => c\.is_test !== true\);/);
  assert.match(src("src/app/admin/hosting/page.tsx"), /const real = clients\.filter\(\(c\) => c\.is_test !== true\);/);
});

test("inventory: no by-email lookup of clients / hosting_clients / builds outside an exclusion", () => {
  const files = execFileSync("git", ["grep", "-lE", "(eq|ilike|in)\\(\"email\"", "--", "src"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const offenders = [];
  for (const f of files) {
    const s = src(f);
    const re = /\.(eq|ilike|in)\("email"/g;
    let m;
    while ((m = re.exec(s))) {
      const before = s.slice(Math.max(0, m.index - 500), m.index);
      const table = [...before.matchAll(/from\("([a-z_]+)"\)/g)].pop()?.[1];
      if (!["clients", "hosting_clients", "builds"].includes(table)) continue;
      const fromAt = before.lastIndexOf(`from("${table}")`);
      const lead = before.slice(Math.max(0, fromAt - 260), fromAt);
      const after = s.slice(m.index, m.index + 400);
      if (/excludeTest\(db, \(live\) =>|excludeTest\(db, \(only\) =>/.test(lead) || /eq\("is_test", true\)/.test(after)) continue;
      offenders.push(`${f}: ${s.slice(m.index, m.index + 40)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("admin domain buy/attach refuse a test row; the detail page marks it TEST", () => {
  const r = src("src/app/api/admin/hosting/[id]/domain/route.ts");
  const guard = r.indexOf('if ((action === "buy" || action === "attach") && (await isTestRow(db, "hosting_clients", id)))');
  assert.ok(guard > 0 && guard < r.indexOf("purchaseDomainForClient(rec.domain"), "refused before any purchase");
  assert.match(src("src/app/api/admin/hosting/[id]/route.ts"), /rec\.attached !== vercelProject && !\(await isTestRow\(db, "hosting_clients", id\)\)/);
  assert.match(src("src/app/admin/hosting/[id]/page.tsx"), /c\.is_test === true && \(/);
});

/* ══ 7. The SQL: adds a column, touches no row ═════════════════════════════ */

test("the SQL only adds is_test (default false) and redefines the KPI view — no update, delete or insert", () => {
  const sql = src("supabase/2026-09-24-test-mode.sql").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of ["clients", "builds", "hosting_clients", "leads"]) {
    assert.match(sql, new RegExp(`alter table ${t}\\s+add column if not exists is_test boolean not null default false;`));
  }
  assert.doesNotMatch(sql, /\b(update|delete|insert|truncate|drop)\b/i, "a statement that changes existing data");
  const view = sql.slice(sql.indexOf("create or replace view crm_kpis"), sql.indexOf(";", sql.indexOf("create or replace view crm_kpis")));
  assert.equal((view.match(/is_test is not true/g) ?? []).length, 8, "every KPI subquery skips test rows");
  assert.doesNotMatch(view, /is_test = false|not is_test/, "must keep null rows too");
});

/* ══ 8. The cleanup script, against a fake PostgREST ═══════════════════════ */

async function runCleanup(rowsByTable, args) {
  const requests = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const u = new URL(req.url, "http://x");
      const table = u.pathname.replace("/rest/v1/", "");
      requests.push({ method: req.method, table, query: decodeURIComponent(u.search), body });
      const rows = rowsByTable[table] ?? [];
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(req.method === "DELETE" ? rows.filter((r) => r.is_test === true) : rows));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const out = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts/test-mode-cleanup.mjs"), ...args], {
      cwd: ROOT,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`, SUPABASE_SERVICE_ROLE_KEY: "k" },
    });
    let text = "";
    child.stdout.on("data", (d) => (text += d));
    child.stderr.on("data", (d) => (text += d));
    child.on("close", (code) => resolve({ code, text }));
  });
  server.close();
  return { ...out, requests };
}

test("cleanup: selects ONLY by is_test=eq.true, and a dry run deletes nothing", async () => {
  const r = await runCleanup({ clients: [{ id: "c1", business: "Me TEST", is_test: true, created_at: "2026-09-24" }] }, []);
  assert.equal(r.code, 0, r.text);
  const reads = r.requests.filter((q) => ["clients", "builds", "hosting_clients", "leads"].includes(q.table) && q.method === "GET");
  assert.equal(reads.length, 4);
  for (const q of reads) assert.match(q.query, /^\?is_test=eq\.true&select=\*&order=created_at\.asc$/, "selected by something other than the tag");
  assert.equal(r.requests.filter((q) => q.method === "DELETE").length, 0);
  assert.match(r.text, /DRY RUN/);
  assert.match(r.text, /c1/);
});

test("cleanup: refuses, deleting nothing, if any selected row is not is_test === true", async () => {
  const r = await runCleanup({ clients: [{ id: "c1", is_test: true }, { id: "REAL", is_test: false }] }, ["--apply"]);
  assert.equal(r.code, 2, r.text);
  assert.match(r.text, /REFUSED/);
  assert.equal(r.requests.filter((q) => q.method === "DELETE").length, 0);
});

test("cleanup --apply: each DELETE names the ids AND is_test=eq.true", async () => {
  const r = await runCleanup({ clients: [{ id: "c1", is_test: true }], leads: [{ id: "l1", is_test: true }] }, ["--apply"]);
  assert.equal(r.code, 0, r.text);
  const dels = r.requests.filter((q) => q.method === "DELETE");
  assert.deepEqual(dels.map((d) => d.table), ["clients", "leads"]);
  for (const d of dels) assert.match(d.query, /^\?id=in\.\([^)]+\)&is_test=eq\.true$/);
});
