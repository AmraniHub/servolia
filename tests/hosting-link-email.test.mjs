/**
 * "Email me my link" by address (/api/hosting-account/link { email }) and the
 * "Check again" endpoint (/api/hosting-setup/check), driven through the real
 * route handlers with a fake Supabase over fetch.
 *
 *   node --import ./tests/register.mjs --test tests/hosting-link-email.test.mjs
 *
 * What must hold: the answer to the browser is byte-identical for a client
 * and a stranger; only the address ON THE ROW is ever emailed; the rate limits
 * bite before any lookup; and "Check again" is rate-limited per subscription.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SUPA = "https://link-test.supabase.co";
const outbound = [];
const lookups = [];
const limits = new Map();
const HOSTING = [
  { id: "h1", email: "Owner@Acme-Dental.com", subscription_id: "sub_live_acme", business: "Acme Dental", status: "active", plan: "hosting", is_test: false },
  { id: "h2", email: "gone@old.com", subscription_id: "sub_live_old", business: "Old", status: "churned", plan: "hosting", is_test: false },
];

function reply(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/* A PostgREST just big enough for these routes: hosting_clients reads with
   eq/ilike/in filters, and a stateful rate_limits table. */
async function fakeFetch(input, init = {}) {
  const url = String(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  if (!url.startsWith(SUPA)) {
    outbound.push({ url, method, body: init.body ? String(init.body) : "" });
    if (url.includes("api.resend.com")) return reply({ id: "email_1" });
    return reply({ ok: true, result: { message_id: 1 } });
  }
  const u = new URL(url);
  const table = u.pathname.replace("/rest/v1/", "");
  const q = u.searchParams;
  const wantsObject = (new Headers(init.headers ?? {}).get("accept") ?? "").includes("vnd.pgrst.object");
  const one = (rows) => (wantsObject ? (rows[0] ? reply(rows[0]) : reply({ code: "PGRST116", message: "no rows" }, 406)) : reply(rows));

  if (table === "rate_limits") {
    const key = (q.get("key") ?? "").replace(/^eq\./, "");
    if (method === "GET") return one(limits.has(key) ? [{ ...limits.get(key) }] : []);
    const body = init.body ? JSON.parse(String(init.body)) : {};
    if (method === "POST") { limits.set(body.key, { count: body.count, window_start: body.window_start }); return reply([]); }
    if (method === "PATCH") { const r = limits.get(key); if (r) r.count = body.count; return reply([]); }
  }
  if (table === "hosting_clients" && method === "GET") {
    let rows = HOSTING.slice();
    const ilike = q.get("email");
    if (ilike?.startsWith("ilike.")) {
      lookups.push(ilike);
      const pat = ilike.slice(6).replace(/\\([%_])/g, "$1").toLowerCase();
      rows = rows.filter((r) => r.email.toLowerCase() === pat);
    }
    const status = q.get("status");
    if (status?.startsWith("in.(")) {
      const allowed = status.slice(4, -1).split(",");
      rows = rows.filter((r) => allowed.includes(r.status));
    }
    const sub = q.get("subscription_id");
    if (sub?.startsWith("eq.")) rows = rows.filter((r) => r.subscription_id === sub.slice(3));
    return one(rows);
  }
  return reply([]);
}

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPA,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  UPGRADE_TOKEN_SECRET: "link-test-secret",
  RESEND_API_KEY: "re_test_key",
  TELEGRAM_BOT_TOKEN: "tg",
  TELEGRAM_CHAT_ID: "1",
});
delete process.env.STRIPE_SECRET_KEY;
globalThis.fetch = fakeFetch;

const LINK = await import("../src/app/api/hosting-account/link/route.ts");
const CHECK = await import("../src/app/api/hosting-setup/check/route.ts");
const UP = await import("../src/lib/upgrade.ts");
const L = await import("../src/lib/accountLinkByEmail.ts");
const { NextRequest } = await import("next/server");

let ipN = 0;
function linkReq(body, ip) {
  return new NextRequest("https://servolia.com/api/hosting-account/link", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip ?? `10.0.0.${++ipN}` },
  });
}
const settle = () => new Promise((r) => setTimeout(r, 150));
const resendCalls = () => outbound.filter((o) => o.url.includes("api.resend.com"));

test("same answer for a client and a stranger; only the row's own address is emailed", async () => {
  outbound.length = 0;
  const client = await LINK.POST(linkReq({ email: "  OWNER@acme-dental.com " }));
  const clientBody = await client.text();
  await settle();
  const afterClient = resendCalls();
  assert.equal(afterClient.length, 1, "the client gets their link");
  const sent = JSON.parse(afterClient[0].body);
  assert.match(JSON.stringify(sent.to), /Owner@Acme-Dental\.com/, "the address ON THE ROW, not the one typed");
  assert.match(sent.html, /hosting\/account\?t=/, "the portal link");

  outbound.length = 0;
  const stranger = await LINK.POST(linkReq({ email: "nobody@nowhere.com" }));
  const strangerBody = await stranger.text();
  await settle();
  assert.equal(resendCalls().length, 0, "a stranger's address gets nothing");

  outbound.length = 0;
  const churned = await LINK.POST(linkReq({ email: "gone@old.com" }));
  const churnedBody = await churned.text();
  await settle();
  assert.equal(resendCalls().length, 0, "a churned row gets nothing");

  assert.equal(client.status, 200);
  assert.equal(stranger.status, client.status);
  assert.equal(churned.status, client.status);
  assert.equal(strangerBody, clientBody, "byte-identical answers: nothing to enumerate");
  assert.equal(churnedBody, clientBody);
  assert.equal(clientBody, JSON.stringify({ ok: true }));
});

test("wildcards cannot widen the lookup: % is refused, _ is escaped and matched exactly", async () => {
  outbound.length = 0;
  const pct = await LINK.POST(linkReq({ email: "%@acme-dental.com" }));
  assert.equal(pct.status, 400, "not an address");
  lookups.length = 0;
  const underscore = await LINK.POST(linkReq({ email: "own_r@acme-dental.com" }));
  assert.equal(underscore.status, 200, "an underscore is legal in the local part");
  await settle();
  assert.ok(lookups.some((l) => l.includes("\\_")), `underscore escaped in the query: ${lookups.join(" ")}`);
  assert.equal(resendCalls().length, 0, "own_r is not owner");
  assert.equal(await L.sendLinkForEmail("own_r@acme-dental.com", {
    findRows: async () => [{ id: "x", email: "ownXr@acme-dental.com", subscription_id: "s", business: null }],
    send: async () => true,
  }), "no-row", "even if the database matched a wildcard, the exact compare refuses it");
});

test("rate limits bite before any lookup: 5 per IP per hour, 3 per address per hour", async () => {
  lookups.length = 0;
  const ip = "203.0.113.9";
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await LINK.POST(linkReq({ email: `stranger${i}@x.com` }, ip))).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429]);
  await settle();
  assert.equal(lookups.length, 5, "the refused call did no lookup");

  const perAddress = [];
  for (let i = 0; i < 4; i++) perAddress.push((await LINK.POST(linkReq({ email: "target@x.com" }))).status);
  assert.deepEqual(perAddress, [200, 200, 200, 429], "rotating IPs does not beat the per-address limit");
  assert.ok([...limits.keys()].every((k) => !k.includes("target@x.com")), "the address is hashed in the limiter table");
});

test("the ref path is unchanged: no ref and no email is still a 400", async () => {
  const r = await LINK.POST(linkReq({}));
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, "no-ref");
});

test("Check again: needs the signed link, then 4 per subscription per 10 minutes", async () => {
  const noToken = await CHECK.POST(new NextRequest("https://servolia.com/api/hosting-setup/check", { method: "POST", body: "{}", headers: { "x-forwarded-for": "198.51.100.1" } }));
  assert.equal(noToken.status, 401);

  const token = await UP.mintUpgradeToken("sub_nobody_here");
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const res = await CHECK.POST(new NextRequest("https://servolia.com/api/hosting-setup/check", {
      method: "POST", body: JSON.stringify({ token }), headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${10 + i}` },
    }));
    codes.push(res.status);
  }
  assert.deepEqual(codes, [404, 404, 404, 404, 429], "the fifth is refused before the row is read");
});
