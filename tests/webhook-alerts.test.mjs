/**
 * Alerts, receipts and Meta events from the Stripe webhook ARRIVE.
 *
 * Found in a live founder test purchase (2026-09-25): the client row and the
 * [TEST] email were written, and no Telegram alert came. Four causes, one
 * test group each:
 *
 *  1. Fire-and-forget in serverless. The webhook started its Telegram /
 *     Resend / Meta requests and returned the response without waiting for
 *     them; Vercel may freeze the function the moment the response is out,
 *     and the request dies half-sent. Here every outbound call is DELAYED
 *     (as a real network is) and only counted once it has completed — so a
 *     send that is started but not awaited is visibly missing when the
 *     handler resolves.
 *  2. Markdown. An interpolated address like jean_dupont@... opens an italic
 *     run that never closes; Telegram answers 400 "can't parse entities" and
 *     the alert is gone. The fake Telegram here answers exactly that.
 *  3. "Hi hello," — the welcome email greeted the buyer by the local part of
 *     their address.
 *  4. A test purchase must never reach Meta.
 *
 *   node --import ./tests/register.mjs --test tests/webhook-alerts.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as H from "./webhook-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const { POST, request } = await H.bootHarness();
const TEST_KEY = "sk_test_harness_key";
process.env.FOUNDER_EMAIL = "founder@example.com";

/* ── A network that takes time, and a Telegram that parses like Telegram ── */

const harnessFetch = globalThis.fetch; // the harness's fake Supabase + recorder
/** Outbound calls that COMPLETED: { host, body }. */
const delivered = [];
/** Telegram requests refused with a 400, as Telegram refuses them. */
const refused = [];
const net = { delayMs: 25, hangTelegram: false };

/** Legacy Markdown, as Telegram's parser sees it: an odd number of _ or *
 *  outside a link leaves an entity unclosed. */
function unparsable(text) {
  const bare = String(text).replace(/\[[^\]]*\]\([^)]*\)/g, "");
  return (bare.split("_").length - 1) % 2 === 1 || (bare.split("*").length - 1) % 2 === 1;
}

globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === "string" ? input : input.url);
  if (url.startsWith("https://harness.supabase.co")) return harnessFetch(input, init);
  const host = new URL(url).host;
  if (host === "api.telegram.org" && net.hangTelegram) {
    // Never answers — only an abort ends it.
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  }
  await new Promise((r) => setTimeout(r, net.delayMs));
  if (host === "api.telegram.org" && url.includes("/sendMessage")) {
    const body = JSON.parse(String(init.body));
    if (body.parse_mode === "Markdown" && unparsable(body.text)) {
      refused.push(body);
      return new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 12" }), { status: 400, headers: { "content-type": "application/json" } });
    }
  }
  const res = await harnessFetch(input, init);
  delivered.push({ host, body: init.body ? String(init.body) : null });
  return res;
};

function clear() {
  H.reset();
  delivered.length = 0;
  refused.length = 0;
  net.delayMs = 25;
  net.hangTelegram = false;
}

function withEnv(vars, fn) {
  const before = {};
  for (const k of Object.keys(vars)) before[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

const telegramTexts = () => delivered.filter((d) => d.host === "api.telegram.org").map((d) => JSON.parse(d.body).text);
const mails = () => delivered.filter((d) => d.host === "api.resend.com").map((d) => JSON.parse(d.body));
const metaCalls = () => delivered.filter((d) => d.host === "graph.facebook.com");

/** The owner's money notices (src/lib/notify.ts notifyOwner): "💶 Paid: …" / "⚠️ …: …". */
const OWNER = "hello@servolia.com";
const isOwnerSubject = (s) => /^(\[TEST\] )?(💶 Paid|⚠️ (Payment failed|Subscription ended)): .+ — .+/.test(s);
const ownerMails = () => mails().filter((m) => isOwnerSubject(m.subject));
const ownerAlerts = () => telegramTexts().filter((t) => isOwnerSubject(t.replace(/^TEST — /, "").split("\n")[0]));
/** Emails to anyone for anything other than an owner notice: what the CLIENT gets. */
const clientMails = () => mails().filter((m) => !isOwnerSubject(m.subject));

let n = 0;
function evt(type, object, livemode) {
  n += 1;
  return { id: `evt_alerts_${n}`, object: "event", type, livemode, created: 1790000000, api_version: "2025-01-01", data: { object } };
}

/** A /pricing plan purchase, with the buyer's name and address chosen. */
function plan(livemode, { email = "buyer@example.com", name } = {}) {
  const ev = H.planPurchase(livemode, email);
  if (name !== undefined) ev.data.object.customer_details.name = name;
  return ev;
}

/** A one-off build payment (the legacy branch at the bottom of checkout.session.completed). */
function buildPayment(livemode, email = "buyer@example.com") {
  return evt("checkout.session.completed", {
    id: livemode ? "cs_live_build_a" : "cs_test_build_a", object: "checkout.session", mode: "payment", payment_status: "paid",
    amount_total: 69000, customer: "cus_b", customer_details: { email },
    metadata: { plan: "installation", lang: "fr", ...(livemode ? {} : { test: "1" }) },
  }, livemode);
}

const LIVE = { RESEND_API_KEY: "re_harness" };
const TEST = { RESEND_API_KEY: "re_harness", STRIPE_TEST_SECRET_KEY: TEST_KEY, STRIPE_TEST_WEBHOOK_SECRET: H.TEST_WH };

/* ══ 1. Everything is delivered BEFORE the handler resolves ══════════════ */

test("live plan purchase: the Telegram alert, the welcome email and the Meta event have all ARRIVED when the webhook resolves", () =>
  withEnv(LIVE, async () => {
    clear();
    const res = await POST(request(plan(true), H.LIVE_WH));
    // No sleep here on purpose: whatever is not delivered now would be lost
    // to a frozen serverless function.
    assert.equal(res.status, 200);
    assert.ok(telegramTexts().some((t) => t.includes("New Essentiel subscriber")), "subscriber alert not delivered before the response");
    assert.equal(clientMails().length, 1, "welcome email not delivered before the response");
    assert.equal(ownerMails().length, 1, "owner email not delivered before the response");
    assert.equal(metaCalls().length, 1, "Meta Purchase not delivered before the response");
  }));

test("live hosting purchase: every alert and the receipt arrive before the response", () =>
  withEnv(LIVE, async () => {
    clear();
    const res = await POST(request(H.hostingPurchase(true, "goodscochina"), H.LIVE_WH));
    assert.equal(res.status, 200);
    const texts = telegramTexts();
    assert.equal(ownerAlerts().length, 1, `hosting paid alert missing: ${JSON.stringify(texts)}`);
    assert.ok(texts.some((t) => t.includes("DOMAIN NOT BOUGHT")), "domain alert missing");
    assert.ok(texts.some((t) => t.includes("NOT switched on")), "activation alert missing");
    assert.equal(clientMails().length, 1, "hosting receipt missing");
    assert.equal(ownerMails().length, 1, "owner email missing");
  }));

test("live one-off build payment and a cancelled subscription: alert (and email, Meta) arrive before the response", () =>
  withEnv(LIVE, async () => {
    clear();
    await POST(request(buildPayment(true), H.LIVE_WH));
    assert.ok(telegramTexts().some((t) => t.includes("Payment received")), "payment alert missing");
    assert.equal(clientMails().length, 1);
    assert.equal(ownerMails().length, 1);
    assert.equal(metaCalls().length, 1);
    clear();
    await POST(request(H.subscriptionDeleted(true), H.LIVE_WH));
    assert.ok(telegramTexts().some((t) => t.includes("Subscription cancelled")), "cancellation alert missing");
  }));

test("the founder's TEST purchase alert also arrives before the response (the bug as reported)", () =>
  withEnv(TEST, async () => {
    clear();
    const res = await POST(request(plan(false), H.TEST_WH));
    assert.equal(res.status, 200);
    const texts = telegramTexts();
    assert.ok(texts.some((t) => t.startsWith("TEST — ") && t.includes("New Essentiel subscriber")), `no TEST subscriber alert: ${JSON.stringify(texts)}`);
    assert.equal(mails().length, 2, "the buyer's [TEST] welcome and the owner's [TEST] notice");
    for (const m of mails()) {
      assert.ok(m.subject.startsWith("[TEST] "), m.subject);
      assert.deepEqual([m.to].flat(), ["founder@example.com"], "a test email left the founder's inbox");
    }
  }));

test("a Telegram that never answers cannot hang the webhook: every alert gives up at ~5 s, together", () =>
  withEnv(LIVE, async () => {
    clear();
    net.hangTelegram = true;
    const t0 = Date.now();
    // Three alerts in this branch; waited for side by side, not one after another.
    const res = await POST(request(H.hostingPurchase(true, "goodscochina"), H.LIVE_WH));
    const took = Date.now() - t0;
    assert.equal(res.status, 200);
    assert.ok(took < 8000, `webhook took ${took} ms with Telegram hanging`);
    assert.equal(clientMails().length, 1, "the receipt still went");
    assert.equal(ownerMails().length, 1, "the owner email still went");
  }));

test("notify.bounded: resolves undefined on a hang or a throw, never rejects", async () => {
  const { bounded } = await import("../src/lib/notify.ts");
  const t0 = Date.now();
  assert.equal(await bounded("hang", new Promise(() => {}), 40), undefined);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(await bounded("boom", Promise.reject(new Error("boom")), 40), undefined);
  assert.equal(await bounded("thrower", () => { throw new Error("sync"); }, 40), undefined);
  assert.equal(await bounded("ok", Promise.resolve(7), 40), 7);
});

/* ══ 2. Markdown can no longer eat an alert ══════════════════════════════ */

test("an underscore in the buyer's address: the alert is delivered, and the address is printed intact", () =>
  withEnv(LIVE, async () => {
    clear();
    await POST(request(plan(true, { email: "jean_dupont@cabinet.fr" }), H.LIVE_WH));
    const alert = telegramTexts().find((t) => t.includes("New Essentiel subscriber"));
    assert.ok(alert, "the subscriber alert vanished");
    assert.ok(alert.includes("jean_dupont@cabinet.fr"), `address mangled: ${alert}`);
    assert.equal(refused.length, 0, "an alert was sent as Markdown and refused");
    // Balanced underscores parse fine as Markdown — and italicise the address
    // instead of printing it. Plain means no parse mode at all.
    const bodies = delivered.filter((d) => d.host === "api.telegram.org").map((d) => JSON.parse(d.body));
    for (const b of bodies) assert.equal(b.parse_mode, undefined, `Markdown alert: ${b.text.slice(0, 60)}`);
  }));

test("underscores in a hosting client's name and address: alert delivered intact", () =>
  withEnv(LIVE, async () => {
    clear();
    const ev = H.hostingPurchase(true, "");
    ev.data.object.customer_details.email = "dr_house@clinic_x.com";
    ev.data.object.metadata.business = "Cabinet_Dentaire";
    await POST(request(ev, H.LIVE_WH));
    const [alert] = ownerAlerts();
    assert.ok(alert, "the hosting alert vanished");
    assert.ok(alert.includes("dr_house@clinic_x.com") && alert.includes("Cabinet_Dentaire"), alert);
    assert.equal(refused.length, 0, "an alert was sent as Markdown and refused");
  }));

test("webhook source: no raw Telegram fetch, and every sendTelegramMessage call is plain", () => {
  const w = src("src/app/api/webhooks/stripe/route.ts");
  assert.ok(!w.includes("api.telegram.org"), "a raw Telegram fetch is back in the webhook");
  assert.ok(!/parse_mode/.test(w), "Markdown parse_mode in the webhook");
  // Each direct call must carry { plain: true } (alert() is plain by construction).
  let i = 0;
  let calls = 0;
  while ((i = w.indexOf("sendTelegramMessage(", i)) !== -1) {
    let depth = 0;
    let j = i + "sendTelegramMessage".length;
    for (; j < w.length; j++) {
      if (w[j] === "(") depth++;
      else if (w[j] === ")" && --depth === 0) break;
    }
    const call = w.slice(i, j + 1);
    assert.match(call, /plain: true/, `non-plain Telegram call: ${call.slice(0, 120)}`);
    i = j;
  }
});

test("no route or library sends a raw Telegram message outside the helper (preflight's own checks excepted)", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) {
        const rel = path.relative(ROOT, p).split(path.sep).join("/");
        if (rel === "src/lib/telegram.ts" || rel === "src/app/api/admin/preflight/route.ts") continue;
        if (/api\.telegram\.org\/bot[^`]*\/sendMessage/.test(src(rel))) offenders.push(rel);
      }
    }
  };
  walk(path.join(ROOT, "src"));
  assert.deepEqual(offenders, []);
});

test("no route or library starts an alert, email, push or Meta event without awaiting it", () => {
  /* A send is fine when its line begins with await/return/assignment, or it
     is an element of an awaited Promise.all([...]) / a ternary arm (the
     previous line ends in [ , ( ? : or =). A bare statement is the bug. */
  // Awaited in the other session's pending edit (2026-09-25); not touched here to avoid a merge conflict.
  const PENDING_ELSEWHERE = new Set(["src/app/api/cron/domain-billing/route.ts"]);
  const START = /^(if \([^)]*\) )?(sendEmail|sendTelegramMessage|sendMetaCapiEvent|notifyClientOfLead|sendPushToClient)\(/;
  const offenders = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) {
        const rel = path.relative(ROOT, p).split(path.sep).join("/");
        if (PENDING_ELSEWHERE.has(rel) || rel.startsWith("src/components/")) continue;
        const lines = src(rel).split("\n");
        lines.forEach((line, i) => {
          if (!START.test(line.trim())) return;
          let j = i - 1;
          while (j >= 0 && (lines[j].trim() === "" || lines[j].trim().startsWith("//"))) j--;
          const prev = j >= 0 ? lines[j].trim() : "";
          if (!/[[,(?:=]$/.test(prev)) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 70)}`);
        });
      }
    }
  };
  walk(path.join(ROOT, "src"));
  assert.deepEqual(offenders, []);
});

test("sendTelegramMessage: a Markdown message Telegram refuses is re-sent as plain text, and the refusal is logged", async () => {
  const { sendTelegramMessage } = await import("../src/lib/telegram.ts");
  clear();
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a.map(String).join(" "));
  try {
    const r = await sendTelegramMessage("*New client* jean_dupont@cabinet.fr");
    assert.ok(r, "returned null: the alert was lost");
    assert.equal(refused.length, 1, "the Markdown attempt should have been refused by the fake");
    const sent = delivered.filter((d) => d.host === "api.telegram.org").map((d) => JSON.parse(d.body));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].parse_mode, undefined, "the retry must carry no parse mode");
    assert.equal(sent[0].text, "*New client* jean_dupont@cabinet.fr");
    assert.ok(logged.some((l) => l.includes("can't parse entities")), `refusal not logged: ${JSON.stringify(logged)}`);
  } finally {
    console.error = orig;
  }
});

test("sendTelegramMessage: any other refusal is logged (visible in Vercel logs), not silent", async () => {
  const { sendTelegramMessage } = await import("../src/lib/telegram.ts");
  clear();
  const logged = [];
  const orig = console.error;
  const origFetch = globalThis.fetch;
  console.error = (...a) => logged.push(a.map(String).join(" "));
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }), { status: 403 });
  try {
    assert.equal(await sendTelegramMessage("hello", undefined, { plain: true }), null);
    assert.ok(logged.some((l) => l.includes("bot was blocked")), JSON.stringify(logged));
  } finally {
    console.error = orig;
    globalThis.fetch = origFetch;
  }
});

/* ══ 3. The greeting is a first name or nothing — never the address ══════ */

test("welcome email: greets by the Stripe customer's first name", () =>
  withEnv(LIVE, async () => {
    clear();
    await POST(request(plan(true, { email: "hello@cabinet.fr", name: "Jean Dupont" }), H.LIVE_WH));
    const [m] = clientMails();
    assert.ok(m, "no email");
    assert.match(m.html, /Bonjour Jean,/);
  }));

test("welcome email: no name on the payment means a neutral 'Bonjour,' — never 'Bonjour hello,'", () =>
  withEnv(LIVE, async () => {
    clear();
    await POST(request(plan(true, { email: "hello@cabinet.fr" }), H.LIVE_WH));
    const [m] = clientMails();
    assert.ok(m, "no email");
    assert.match(m.html, /Bonjour,/);
    assert.ok(!/Bonjour hello/.test(m.html), "greeted by the address's local part");
    clear();
    await POST(request(buildPayment(true, "contact@cabinet.fr"), H.LIVE_WH));
    const [b] = clientMails();
    assert.match(b.html, /Bonjour,/);
    assert.ok(!/Bonjour contact/.test(b.html));
  }));

test("firstNameFrom and greeting: first word, tidy case, never an address; neutral when unknown", async () => {
  const E = await import("../src/lib/email.ts");
  assert.equal(E.firstNameFrom("Jean Dupont"), "Jean");
  assert.equal(E.firstNameFrom("JEAN DUPONT"), "Jean");
  assert.equal(E.firstNameFrom("  marie-claire  x"), "Marie-claire");
  assert.equal(E.firstNameFrom("jean@cabinet.fr"), "");
  assert.equal(E.firstNameFrom("SCI 2024"), "Sci"); // a word is a word; digits alone are not
  assert.equal(E.firstNameFrom("2024"), "");
  assert.equal(E.firstNameFrom(null), "");
  assert.equal(E.greeting("", "fr"), "Bonjour,");
  assert.equal(E.greeting("", "en"), "Hello,");
  assert.equal(E.greeting("Jean", "fr"), "Bonjour Jean,");
  assert.equal(E.greeting("Jean", "en"), "Hi Jean,");
  assert.equal(E.greeting("<b>x</b>", "en"), "Hi &lt;b&gt;x&lt;/b&gt;,");
  for (const lang of ["en", "fr"]) {
    for (const html of [
      E.installationPaidEmail("", "Essentiel", 690, lang).html,
      E.auditConfirmationEmail("", lang).html,
      E.newPortalMessageEmail("", "hi", lang).html,
      E.liveEmail("", "https://x.test", lang).html,
    ]) {
      assert.ok(!/(Bonjour|Hi) ,/.test(html), "an empty name left a dangling space");
      assert.ok(/(Bonjour|Hello),/.test(html), "no neutral greeting");
    }
  }
});

test("no email is ever addressed to an address's local part (source check)", () => {
  const hits = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) {
        const rel = path.relative(ROOT, p).split(path.sep).join("/");
        if (/split\("@"\)\[0\]/.test(src(rel))) hits.push(rel);
      }
    }
  };
  walk(path.join(ROOT, "src", "app", "api"));
  walk(path.join(ROOT, "src", "lib"));
  assert.deepEqual(hits, []);
});

/* ══ 4. A test purchase never reaches Meta ═══════════════════════════════ */

test("Meta: a LIVE plan and build payment send Purchase; the same purchases in TEST send nothing", () =>
  withEnv(TEST, async () => {
    clear();
    await POST(request(plan(true), H.LIVE_WH));
    assert.equal(metaCalls().length, 1, "live plan purchase should reach Meta (else this test proves nothing)");
    clear();
    await POST(request(buildPayment(true), H.LIVE_WH));
    assert.equal(metaCalls().length, 1, "live build payment should reach Meta");

    clear();
    await POST(request(plan(false), H.TEST_WH));
    assert.ok(telegramTexts().length > 0, "the test purchase ran");
    assert.equal(metaCalls().length, 0, "Meta CAPI called for a TEST plan purchase");
    clear();
    await POST(request(buildPayment(false, "founder@example.com"), H.TEST_WH));
    assert.ok(telegramTexts().length > 0, "the test build payment ran");
    assert.equal(metaCalls().length, 0, "Meta CAPI called for a TEST build payment");
  }));

/* ══ 5. The owner hears of every money event: Telegram AND email, once ═══ */

const { writeFulfilment } = await import("../src/lib/fulfilment.ts");
const { writeTopup, monthKey } = await import("../src/lib/conversationCap.ts");
const { writeExtraDomain } = await import("../src/lib/extraDomains.ts");

function session(id, fields) {
  return evt("checkout.session.completed", {
    id, object: "checkout.session", payment_status: "paid", customer: "cus_o",
    customer_details: { email: "owner.case@example.com" }, ...fields,
  }, true);
}
const invoice = (type, fields) => evt(type, { id: "in_o", object: "invoice", customer: "cus_o", subscription: "sub_o", ...fields }, true);

/** Each money event: the event, reads to seed, and the reads that make it a replay (null = no guard exists). */
const MONEY = [
  ["plan subscription", () => plan(true), {}, { clients: [{ id: "c-seen" }] }],
  ["receptionist trial kept", () => session("cs_live_rec", {
    mode: "subscription", subscription: "sub_rec", amount_total: 14900,
    metadata: { kind: "receptionist", slug: "cabinet-x", plan: "essentiel", billing: "monthly", lang: "fr" },
  }), {}, { clients: [{ id: "c-rec", build_id: "b-rec" }] }],
  ["hosting purchase", () => H.hostingPurchase(true, ""), {}, "hosting-replay"],
  ["assistant add-on", () => { const e = H.hostingPurchase(true, ""); e.data.object.metadata.plan = "chatbot"; e.data.object.metadata.domain = ""; return e; }, {}, "hosting-replay"],
  ["managed add-on", () => session("cs_live_addon", { mode: "subscription", subscription: "sub_addon", amount_total: 3900, metadata: { kind: "addon", addon: "reviews" } }), {}, null],
  ["multilingual one-off", () => session("cs_live_seo", { mode: "payment", amount_total: 19900, metadata: { kind: "hosting", plan: "seo_multilingual", business: "Harness Co", lang: "en" } }), {}, null],
  ["top-up", () => session("cs_live_top", { mode: "payment", amount_total: 4900, metadata: { kind: "topup", conversations: "50", pack: "pack50", lang: "fr" } }),
    { clients: [{ id: "c-top", business: "Cabinet Top", notes: null }] },
    { clients: [{ id: "c-top", business: "Cabinet Top", notes: writeTopup(null, { conversations: 50, month: monthKey(new Date(1790000000 * 1000)), session: "cs_live_top" }) }] }],
  ["arrears settled", () => session("cs_live_arr", { mode: "payment", amount_total: 1500, metadata: { kind: "hosting", plan: "arrears", ref: "harness", label: "Old balance", lang: "en" } }), {}, null],
  ["extra domain order", () => session("cs_live_dom", { mode: "payment", amount_total: 2000, metadata: { kind: "domain_addon", domain: "extra-harness.com", domain_retail_usd: "20", subscription_id: "sub_host1", ref: "harness" } }),
    { hosting_clients: [{ id: "h-dom", notes: null, business: "Harness Co" }] },
    { hosting_clients: [{ id: "h-dom", notes: writeExtraDomain(null, { domain: "extra-harness.com", retailUsd: 20, failed: "not-configured" }), business: "Harness Co" }] }],
  ["custom work", () => session("cs_live_custom", { mode: "payment", amount_total: 25000, metadata: { kind: "custom_request", requestId: "req-1", buildId: "b-1" } }), {}, null],
  ["one-off build payment", () => buildPayment(true), {}, { builds: [{ id: "b-seen", checkout_session_id: "cs_live_build_a" }] }],
  ["renewal (invoice.paid)", () => invoice("invoice.paid", { amount_paid: 14900, currency: "eur", billing_reason: "subscription_cycle", customer_email: "owner.case@example.com" }),
    { clients: [{ id: "c-ren", business: "Cabinet Renew", email: "owner.case@example.com", plan: "essentiel" }] }, null],
  ["payment failed", () => invoice("invoice.payment_failed", { amount_due: 14900, currency: "eur", attempt_count: 2 }),
    { clients: [{ id: "c-fail", past_due_since: "2026-09-20T00:00:00.000Z", business: "Cabinet Fail", email: "owner.case@example.com", plan: "essentiel", build_id: null }] }, null],
  ["subscription ended", () => H.subscriptionDeleted(true), { clients: [{ id: "c-end", business: "Cabinet End", email: "owner.case@example.com" }] }, null],
];

function seed(reads) {
  for (const [t, rows] of Object.entries(reads)) H.reads[t] = rows;
}

for (const [name, make, reads, replay] of MONEY) {
  test(`owner notice — ${name}: exactly one Telegram alert and one email to the owner, subject in the house format`, () =>
    withEnv(LIVE, async () => {
      clear();
      seed(reads);
      const res = await POST(request(make(), H.LIVE_WH));
      assert.ok(res.status < 500, `status ${res.status}`);
      const tg = ownerAlerts();
      const em = ownerMails();
      assert.equal(tg.length, 1, `Telegram owner alerts: ${JSON.stringify(telegramTexts())}`);
      assert.equal(em.length, 1, `owner emails: ${JSON.stringify(mails().map((m) => m.subject))}`);
      assert.deepEqual([em[0].to].flat(), [OWNER], "the owner email went somewhere else");
      assert.equal(tg[0].split("\n")[0], em[0].subject, "Telegram and email disagree on the headline");
      assert.match(em[0].subject, /^(💶 Paid: .+ — (€|\$)[\d,.]+ — .+|⚠️ (Payment failed|Subscription ended): .+ — .+)$/);
      assert.ok(em[0].html.includes("https://servolia.com/admin/"), "no admin link in the owner email");
      assert.ok(/Next: /.test(em[0].text ?? em[0].html), "no next action for the owner");
      // The owner's notice never reaches the client.
      for (const m of clientMails()) assert.ok(!isOwnerSubject(m.subject));
      for (const m of ownerMails()) assert.deepEqual([m.to].flat(), [OWNER]);
    }));

  if (replay) {
    test(`owner notice — ${name}: a replayed event does not notify twice`, () =>
      withEnv(LIVE, async () => {
        clear();
        const ev = make();
        if (replay === "hosting-replay") {
          seed({ hosting_clients: [{ id: "h-seen", notes: writeFulfilment(null, { session: ev.data.object.id, at: "2026-09-25T00:00:00.000Z", plan: ev.data.object.metadata.plan }) }] });
        } else {
          seed(replay);
        }
        await POST(request(ev, H.LIVE_WH));
        assert.equal(ownerAlerts().length, 0, `replay alerted: ${JSON.stringify(ownerAlerts())}`);
        assert.equal(ownerMails().length, 0, "replay emailed the owner");
      }));
  }
}

test("renewal notices: only invoice.paid, never its twin invoice.payment_succeeded, never the first invoice, never a zero invoice", () =>
  withEnv(LIVE, async () => {
    for (const [type, fields] of [
      ["invoice.payment_succeeded", { amount_paid: 14900, billing_reason: "subscription_cycle" }],
      ["invoice.paid", { amount_paid: 83900, billing_reason: "subscription_create" }],
      ["invoice.paid", { amount_paid: 0, billing_reason: "subscription_cycle" }],
    ]) {
      clear();
      await POST(request(invoice(type, { currency: "eur", ...fields }), H.LIVE_WH));
      assert.equal(ownerAlerts().length + ownerMails().length, 0, `${type} ${JSON.stringify(fields)} notified the owner`);
    }
  }));

test("owner notice in a TEST purchase: [TEST] subject to the founder, TEST — on Telegram; the buyer's email is the same template as live", () =>
  withEnv(TEST, async () => {
    clear();
    await POST(request(plan(false, { name: "Jean Dupont" }), H.TEST_WH));
    const [o] = ownerMails();
    assert.ok(o, "no owner email in test mode");
    assert.ok(o.subject.startsWith("[TEST] 💶 Paid: "), o.subject);
    assert.deepEqual([o.to].flat(), ["founder@example.com"]);
    assert.ok(ownerAlerts()[0].startsWith("TEST — 💶 Paid: "));
    const testBuyer = clientMails()[0];

    clear();
    await POST(request(plan(true, { name: "Jean Dupont" }), H.LIVE_WH));
    const liveBuyer = clientMails()[0];
    assert.equal(testBuyer.subject, `[TEST] ${liveBuyer.subject}`, "the client's email changed shape between test and live");
    assert.equal(testBuyer.html, liveBuyer.html.replace(/cs_live_plan1/g, "cs_test_plan1"));
  }));

test("OWNER_ALERT_EMAIL redirects the owner email; hello@servolia.com is only the default", () =>
  withEnv({ ...LIVE, OWNER_ALERT_EMAIL: "boss@example.org" }, async () => {
    clear();
    await POST(request(plan(true), H.LIVE_WH));
    const [o] = ownerMails();
    assert.deepEqual([o.to].flat(), ["boss@example.org"]);
  }));
