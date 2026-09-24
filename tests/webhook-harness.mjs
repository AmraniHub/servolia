/**
 * Drives the real Stripe webhook route (src/app/api/webhooks/stripe) with
 * signed events and a fake Supabase, and records every database write.
 *
 * Supabase-js talks PostgREST over `fetch`, and captures `fetch` when the
 * client is first created — so the stub has to be in place BEFORE the route
 * module (and therefore src/lib/supabase.ts) is imported. `bootHarness()`
 * does that, once per test file.
 *
 * Not a test file on its own (no .test. in the name); tests/test-mode.test.mjs
 * imports it.
 */
import Stripe from "stripe";

export const LIVE_WH = "whsec_live_harness_secret";
export const TEST_WH = "whsec_test_harness_secret";
const SUPA = "https://harness.supabase.co";

/** Every PostgREST write, in order: { method, table, query, body }. */
export const writes = [];
/** Every non-Supabase fetch (Telegram, Resend, Meta, GitHub, Vercel...). */
export const outbound = [];
/** Canned GET answers, by table name: rows returned for any read of it. */
export const reads = {};
/** Tables whose writes fail as if the is_test column did not exist yet. */
export const missingColumn = { on: false };

function reply(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fakeFetch(input, init = {}) {
  const url = String(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  if (!url.startsWith(SUPA)) {
    outbound.push({ url, method, body: init.body ? String(init.body) : null });
    return reply({ ok: true, result: { message_id: 1 } });
  }
  const u = new URL(url);
  const table = u.pathname.replace("/rest/v1/", "");
  const query = decodeURIComponent(u.search);
  const headers = new Headers(init.headers ?? {});
  const wantsObject = (headers.get("accept") ?? "").includes("vnd.pgrst.object");
  if (missingColumn.on && (query.includes("is_test") || String(init.body ?? "").includes("is_test"))) {
    return reply({ code: "42703", message: `column ${table}.is_test does not exist` }, 400);
  }
  if (method === "GET" || method === "HEAD") {
    const rows = reads[table] ?? [];
    return wantsObject ? (rows[0] ? reply(rows[0]) : reply({ message: "no rows" }, 406)) : reply(rows);
  }
  const body = init.body ? JSON.parse(String(init.body)) : null;
  writes.push({ method, table, query, body });
  const row = { id: `row-${table}`, notes: null };
  return wantsObject ? reply(row) : reply([row]);
}

let booted = null;

/** Env + fetch stub, then the route. Returns { POST, sign }. */
export async function bootHarness(extraEnv = {}) {
  if (booted) return booted;
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_live_harness",
    STRIPE_WEBHOOK_SECRET: LIVE_WH,
    NEXT_PUBLIC_SUPABASE_URL: SUPA,
    SUPABASE_SERVICE_ROLE_KEY: "service-role-harness",
    TELEGRAM_BOT_TOKEN: "tg-harness",
    TELEGRAM_CHAT_ID: "42",
    META_CAPI_ACCESS_TOKEN: "meta-harness",
    UPGRADE_TOKEN_SECRET: "harness-upgrade-secret",
    ...extraEnv,
  });
  delete process.env.RESEND_API_KEY;
  globalThis.fetch = fakeFetch;
  const route = await import("../src/app/api/webhooks/stripe/route.ts");
  const signer = new Stripe("sk_test_signer_only");
  const { NextRequest } = await import("next/server");

  /** A request carrying `event`, signed with `secret` (or unsigned / forged). */
  function request(event, secret, { forge = false, unsigned = false } = {}) {
    const payload = JSON.stringify(event);
    const headers = { "content-type": "application/json" };
    if (!unsigned) {
      let sig = signer.webhooks.generateTestHeaderString({ payload, secret });
      if (forge) sig = sig.replace(/v1=([0-9a-f])/, (_m, c) => `v1=${c === "0" ? "1" : "0"}`);
      headers["stripe-signature"] = sig;
    }
    return new NextRequest("https://servolia.com/api/webhooks/stripe", { method: "POST", body: payload, headers });
  }

  booted = { POST: route.POST, request };
  return booted;
}

export function reset() {
  writes.length = 0;
  outbound.length = 0;
  for (const k of Object.keys(reads)) delete reads[k];
  missingColumn.on = false;
}

/* ── Events ─────────────────────────────────────────────────────────── */

let n = 0;
function evt(type, object, livemode) {
  n += 1;
  return {
    id: `evt_harness_${n}`,
    object: "event",
    type,
    livemode,
    created: 1790000000,
    api_version: "2025-01-01",
    data: { object },
  };
}

/** A /pricing monthly plan purchase (the subscription branch). */
export function planPurchase(livemode, email = "buyer@example.com") {
  return evt("checkout.session.completed", {
    id: livemode ? "cs_live_plan1" : "cs_test_plan1",
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    amount_total: 83900,
    customer: "cus_plan1",
    subscription: "sub_plan1",
    customer_details: { email },
    metadata: { plan: "essentiel", kind: "care_plan", billing: "monthly", installation_cents: "69000", lang: "fr", ...(livemode ? {} : { test: "1" }) },
  }, livemode);
}

/** A hosting subscription bought from /hosting, with a domain and a ref. */
export function hostingPurchase(livemode, ref = "") {
  return evt("checkout.session.completed", {
    id: livemode ? "cs_live_host1" : "cs_test_host1",
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    amount_total: 4200,
    customer: "cus_host1",
    subscription: "sub_host1",
    customer_details: { email: "host@example.com" },
    metadata: { kind: "hosting", plan: "hosting", period: "monthly", business: "Harness Co", ref, domain: "harness-example.com", domain_retail_usd: "20", lang: "en", ...(livemode ? {} : { test: "1" }) },
  }, livemode);
}

export function invoicePaid(livemode) {
  return evt("invoice.paid", { id: "in_1", object: "invoice", customer: "cus_plan1", subscription: "sub_plan1" }, livemode);
}

export function subscriptionDeleted(livemode) {
  return evt("customer.subscription.deleted", { id: "sub_host1", object: "subscription", customer: "cus_host1" }, livemode);
}

/** Timestamps move between runs; everything else must not. */
const stamp = (s) => s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<ts>");

/**
 * The LIVE scenarios, run in order, as { name: { status, body, writes,
 * outbound } }. tests/webhook-live-baseline.json is this function's output
 * captured on the webhook as it was BEFORE test mode existed (commit 8851b6b);
 * the test compares today's output to it, so any change test mode makes to a
 * live event's writes, alerts or calls shows up as a diff.
 */
export async function runLiveScenarios() {
  const { POST, request } = await bootHarness();
  const out = {};
  const scenarios = [
    ["plan", planPurchase(true)],
    ["hosting", hostingPurchase(true, "goodscochina")],
    ["invoicePaid", invoicePaid(true)],
    ["deleted", subscriptionDeleted(true)],
  ];
  for (const [name, ev] of scenarios) {
    reset();
    if (name === "deleted") reads.hosting_clients = [{ id: "h1", business: "Harness Co", notes: null }];
    const res = await POST(request(ev, LIVE_WH));
    await new Promise((r) => setTimeout(r, 50)); // fire-and-forget alerts land
    out[name] = JSON.parse(stamp(JSON.stringify({
      status: res.status,
      body: await res.json(),
      writes,
      outbound: outbound.map((o) => ({ to: o.url.replace(/bot[^/]+/, "bot*").split("?")[0], body: o.url.includes("telegram") ? o.body : null })),
    })));
  }
  return out;
}
