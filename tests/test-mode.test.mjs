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

const validCookie = () => TM.signTestCookie(Date.now() + 3600_000);

function post(url, body, cookie) {
  const headers = { "content-type": "application/json", origin: "https://servolia.com" };
  if (cookie) headers.cookie = `sv_test=${cookie}`;
  return new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers });
}

/* ══ 1. The cookie ═════════════════════════════════════════════════════════ */

test("a signed, unexpired cookie is test mode; expired, forged, tampered or garbage is live", () => {
  const exp = Date.now() + 60_000;
  const good = TM.signTestCookie(exp);
  assert.equal(TM.verifyTestCookie(good), exp);
  assert.equal(TM.verifyTestCookie(good, exp + 1), null, "expired");
  const [v, e, mac] = good.split(".");
  assert.equal(TM.verifyTestCookie(`${v}.${e}.${mac.slice(0, -2)}${mac.endsWith("AA") ? "BB" : "AA"}`), null, "forged MAC");
  assert.equal(TM.verifyTestCookie(`${v}.${Number(e) + 3600_000}.${mac}`), null, "expiry pushed out without re-signing");
  for (const junk of ["", "1", "v1.abc.def", "v2." + e + "." + mac, null, undefined]) {
    assert.equal(TM.verifyTestCookie(junk), null, `garbage ${junk}`);
  }
  assert.equal(TM.isTestRequest({ cookies: { get: () => ({ value: good }) } }), true);
  assert.equal(TM.isTestRequest({ cookies: { get: () => undefined } }), false);
});

test("a cookie signed with another secret is not test mode", () => withEnv({ UPGRADE_TOKEN_SECRET: "a-different-secret" }, () => {
  const other = TM.signTestCookie(Date.now() + 60_000);
  return withEnv({ UPGRADE_TOKEN_SECRET: "harness-upgrade-secret" }, () => {
    assert.equal(TM.verifyTestCookie(other), null);
  });
}));

test("the admin route sets the cookie httpOnly + SameSite=Lax for 8 hours, behind the admin login", () => {
  const r = src("src/app/api/admin/test-mode/route.ts");
  assert.match(r, /if \(!\(await isAdminAuthed\(\)\)\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\n  const \{ on \}/, "POST checks the admin session first");
  assert.match(r, /res\.cookies\.set\(TEST_COOKIE, signTestCookie\(exp\), \{ httpOnly: true, secure, sameSite: "lax"/);
  assert.equal(TM.TEST_HOURS, 8);
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
  "src/app/api/admin/hosting/checkout/route.ts",
  "src/app/api/admin/custom-requests/route.ts",
];

test("every file that creates a Checkout session is on the list and goes through checkoutStripe", () => {
  // The inventory: a NEW checkout route must be added here, or this fails.
  const found = execFileSync("git", ["grep", "-l", "checkout.sessions.create", "--", "src"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(Boolean).map((f) => f.trim()).sort();
  assert.deepEqual(found, [...CHECKOUT_FILES, "src/lib/domainCheckout.ts"].sort());
  for (const f of CHECKOUT_FILES) {
    const s = src(f);
    assert.match(s, /const co = checkoutStripe\(req\);\n\s*if \(co\.refused\) return co\.refused;/, `${f}: refuses before anything else`);
    assert.doesNotMatch(s, /new Stripe\(/, `${f}: no Stripe client of its own`);
    assert.match(s, /\.\.\.co\.tag/, `${f}: tags the session metadata`);
  }
});

async function routeCase(file, body, { cookie, testKey }) {
  const mod = await import(`../${file}`);
  stripeCalls.length = 0;
  const res = await withEnv({ STRIPE_TEST_SECRET_KEY: testKey }, () =>
    mod.POST(post(`https://servolia.com/${file}`, body, cookie)));
  return { res, calls: stripeCalls.filter((c) => c.op === "sessions.create") };
}

const PUBLIC_ROUTES = [
  ["src/app/api/checkout/route.ts", () => ({ plan: SELLABLE_KEY })],
  ["src/app/api/checkout-subscription/route.ts", () => ({ plan: "essentiel", billing: "monthly" })],
  ["src/app/api/hosting-checkout/route.ts", () => ({ plan: "hosting", billing: "monthly", email: "me@example.com" })],
];
const { SELLABLE_BUILD_PLANS } = await import("../src/lib/pricing.ts");
const SELLABLE_KEY = SELLABLE_BUILD_PLANS[0].key;

for (const [file, body] of PUBLIC_ROUTES) {
  test(`${file}: test cookie + test key -> TEST session tagged test=1; no cookie -> live, untagged`, async () => {
    const t = await routeCase(file, body(), { cookie: validCookie(), testKey: TEST_KEY });
    assert.equal(t.res.status, 200);
    assert.equal(t.calls.length, 1);
    assert.equal(t.calls[0].key, TEST_KEY);
    assert.equal(t.calls[0].params.metadata.test, "1");
    if (t.calls[0].params.subscription_data) assert.equal(t.calls[0].params.subscription_data.metadata?.test, "1");

    const l = await routeCase(file, body(), { cookie: null, testKey: TEST_KEY });
    assert.equal(l.calls.length, 1);
    assert.equal(l.calls[0].key, LIVE_KEY);
    assert.equal("test" in l.calls[0].params.metadata, false, "live metadata exactly as before");
    if (l.calls[0].params.subscription_data?.metadata) assert.equal("test" in l.calls[0].params.subscription_data.metadata, false);

    const forged = await routeCase(file, body(), { cookie: validCookie().replace(/.$/, (c) => (c === "A" ? "B" : "A")), testKey: TEST_KEY });
    assert.equal(forged.calls[0].key, LIVE_KEY, "a forged cookie is live");
  });
}

const REFUSAL_ROUTES = [
  ...PUBLIC_ROUTES,
  ["src/app/api/checkout-receptionist/route.ts", () => ({ token: "x", plan: "essentiel" })],
];
for (const [file, body] of REFUSAL_ROUTES) {
  test(`${file}: test cookie WITHOUT a test key -> 503, and no session at all`, async () => {
    const r = await routeCase(file, body(), { cookie: validCookie(), testKey: undefined });
    assert.equal(r.res.status, 503);
    assert.equal((await r.res.json()).error, "Test mode is on but no Stripe test key is configured");
    assert.equal(r.calls.length, 0, "never a live session instead");
  });
}

test("checkoutStripe itself: refusal, test client + tag, or live exactly as before", () => withEnv({ STRIPE_TEST_SECRET_KEY: TEST_KEY }, async () => {
  const cookies = (v) => ({ cookies: { get: () => (v ? { value: v } : undefined) } });
  const t = TM.checkoutStripe(cookies(validCookie()));
  assert.equal(t.refused, null);
  assert.equal(t.stripe.key, TEST_KEY);
  assert.deepEqual(t.tag, { test: "1" });
  const l = TM.checkoutStripe(cookies(null));
  assert.equal(l.stripe.key, LIVE_KEY);
  assert.deepEqual(l.tag, {});
  await withEnv({ STRIPE_TEST_SECRET_KEY: undefined }, () => {
    const r = TM.checkoutStripe(cookies(validCookie()));
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

test("excludeTest adds `is_test is not true`, and drops it when the column does not exist yet", async () => {
  const seen = [];
  const builder = (missingCol) => ({
    not(col, op, val) {
      seen.push([col, op, val]);
      return { then: (r) => r(missingCol ? { data: null, error: { code: "42703", message: "column clients.is_test does not exist" } } : { data: ["filtered"], error: null }) };
    },
    then: (r) => r({ data: ["unfiltered"], error: null }),
  });
  const a = await TC.excludeTest((live) => live(builder(false)));
  assert.deepEqual(seen, [["is_test", "is", true]], "NOT eq(false): null rows must stay counted");
  assert.deepEqual(a.data, ["filtered"]);
  const b = await TC.excludeTest((live) => live(builder(true)));
  assert.deepEqual(b.data, ["unfiltered"], "column missing -> the query as it always ran");
  // Any other error is returned, not swallowed.
  const c = await TC.excludeTest(() => Promise.resolve({ data: null, error: { code: "57014", message: "timeout" } }));
  assert.equal(c.error.message, "timeout");
});

test("every number, list and cron that must not see test rows excludes them", () => {
  const needs = {
    "src/lib/today.ts": 4,
    "src/app/admin/page.tsx": 4,
    "src/app/admin/revenue/page.tsx": 2,
    "src/app/admin/data-room/page.tsx": 2,
    "src/lib/economics.ts": 2,
    "src/lib/crmSnapshot.ts": 3,
    "src/app/api/cron/monthly-invoice/route.ts": 1,
    "src/app/api/cron/dunning/route.ts": 2,
    "src/app/api/cron/domain-billing/route.ts": 3,
  };
  for (const [f, n] of Object.entries(needs)) {
    const count = (src(f).match(/excludeTest\(\(live\) =>/g) ?? []).length;
    assert.ok(count >= n, `${f}: ${count} excluded queries, expected ${n}`);
  }
  assert.match(src("src/app/api/cron/monthly-report/route.ts"), /if \(siteRow\?\.build_id && testBuilds\.has\(siteRow\.build_id\)\) continue;/);
  assert.match(src("src/lib/conversationCap.ts"), /if \(level === 100 && !\(db && \(await isTestRow\(db, "clients", s\.clientId\)\)\)\)/);
  assert.match(src("src/app/admin/clients/page.tsx"), /const real = \(clients \?\? \[\]\)\.filter\(c => c\.is_test !== true\);/);
  assert.match(src("src/app/admin/hosting/page.tsx"), /const real = clients\.filter\(\(c\) => c\.is_test !== true\);/);
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
    const u = new URL(req.url, "http://x");
    const table = u.pathname.replace("/rest/v1/", "");
    requests.push({ method: req.method, table, query: decodeURIComponent(u.search) });
    const rows = rowsByTable[table] ?? [];
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(req.method === "DELETE" ? rows.filter((r) => r.is_test === true) : rows));
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
