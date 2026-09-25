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
import { execFileSync } from "node:child_process";
import * as H from "./webhook-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const { POST, request } = await H.bootHarness();
const TEST_KEY = "sk_test_harness_key";

/* A fake Stripe through the one test seam (src/lib/stripeMode.ts): the
   hosting failure notice reads the subscription and opens a portal session,
   and no test may reach the real Stripe. */
const SM = await import("../src/lib/stripeMode.ts");
SM.__setStripeFactoryForTests(() => ({
  subscriptions: { retrieve: async (id) => ({ id, customer: "cus_x", status: "active", metadata: { lang: "en" }, cancel_at_period_end: false, items: { data: [] } }) },
  checkout: { sessions: { list: async () => ({ data: [] }), retrieve: async (id) => ({ id, metadata: {} }) } },
  billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.test/p" }) } },
}));
process.env.FOUNDER_EMAIL = "founder@example.com";

/* ── A network that takes time, and a Telegram that parses like Telegram ── */

const harnessFetch = globalThis.fetch; // the harness's fake Supabase + recorder
/** Outbound calls that COMPLETED: { host, body }. */
const delivered = [];
/** Telegram requests refused with a 400, as Telegram refuses them. */
const refused = [];
/* clientMailDelayMs: an email to anyone but the owner takes this long. Set
   above everything else, an un-awaited client email cannot finish inside the
   time the awaited sends take and pass by luck. */
const net = { delayMs: 25, clientMailDelayMs: 25, hangTelegram: false, clientMail: "ok" };
// clientMail: "ok" | "refuse" (Resend answers 422) | "hang" (Resend never answers) — for mail to anyone but the owner.

/** Legacy Markdown, as Telegram's parser sees it: an odd number of _ or *
 *  outside a link leaves an entity unclosed. */
function unparsable(text) {
  const bare = String(text).replace(/\[[^\]]*\]\([^)]*\)/g, "");
  return (bare.split("_").length - 1) % 2 === 1 || (bare.split("*").length - 1) % 2 === 1;
}

/** Every Supabase call, reads included (the harness records only writes). */
const supaCalls = [];

globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === "string" ? input : input.url);
  if (url.startsWith("https://harness.supabase.co")) {
    supaCalls.push({ method: (init.method ?? "GET").toUpperCase(), url: decodeURIComponent(url) });
    return harnessFetch(input, init);
  }
  const host = new URL(url).host;
  if (host === "api.telegram.org" && net.hangTelegram) {
    // Never answers — only an abort ends it.
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  }
  const toOwner = host === "api.resend.com" && [JSON.parse(String(init.body ?? "{}")).to].flat().includes(OWNER);
  if (host === "api.resend.com" && !toOwner && net.clientMail === "hang") return new Promise(() => {});
  await new Promise((r) => setTimeout(r, host === "api.resend.com" && !toOwner ? net.clientMailDelayMs : net.delayMs));
  if (host === "api.resend.com" && !toOwner && net.clientMail === "refuse") {
    refused.push({ resend: true });
    return new Response(JSON.stringify({ statusCode: 422, name: "validation_error", message: "The to address is invalid." }), { status: 422, headers: { "content-type": "application/json" } });
  }
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
  supaCalls.length = 0;
  net.delayMs = 25;
  net.clientMailDelayMs = 25;
  net.hangTelegram = false;
  net.clientMail = "ok";
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

const { writeOneOff } = await import("../src/lib/oneOffOrders.ts");
const SEO_ORDER = { service: "seo_multilingual", session: "cs_live_seo", paidAt: "2026-09-21", dueAt: "2026-09-28", amountUsd: 145 };

/** Each money event: the event, reads to seed, the reads that make it a replay
 *  (null = no guard exists), and how many emails the CLIENT gets — all of which
 *  must have ARRIVED when the webhook resolves (the fake network is slow). */
const MONEY = [
  ["plan subscription", () => plan(true), {}, { clients: [{ id: "c-seen" }] }, 1],
  ["receptionist trial kept", () => session("cs_live_rec", {
    mode: "subscription", subscription: "sub_rec", amount_total: 14900,
    metadata: { kind: "receptionist", slug: "cabinet-x", plan: "essentiel", billing: "monthly", lang: "fr" },
  }), {}, { clients: [{ id: "c-rec", build_id: "b-rec" }] }, 1],
  ["hosting purchase", () => H.hostingPurchase(true, ""), {}, "hosting-replay", 1],
  ["assistant add-on", () => { const e = H.hostingPurchase(true, ""); e.data.object.metadata.plan = "chatbot"; e.data.object.metadata.domain = ""; return e; }, {}, "hosting-replay", 1],
  ["managed add-on", () => session("cs_live_addon", { mode: "subscription", subscription: "sub_addon", amount_total: 3900, metadata: { kind: "addon", addon: "reviews" } }), {}, null, 0],
  ["multilingual one-off (no hosting row: a lead)", () => session("cs_live_seo", { mode: "payment", amount_total: 14500, metadata: { kind: "hosting", plan: "seo_multilingual", business: "Harness Co", lang: "en" } }),
    {}, { leads: [{ id: "l-seen" }] }, 1],
  ["multilingual one-off (on the hosting row)", () => session("cs_live_seo", { mode: "payment", amount_total: 14500, metadata: { kind: "hosting", plan: "seo_multilingual", business: "Harness Co", lang: "en" } }),
    { hosting_clients: [{ id: "h-seo", business: "Harness Co", email: "owner.case@example.com", status: "active", notes: null }] },
    { hosting_clients: [{ id: "h-seo", business: "Harness Co", email: "owner.case@example.com", status: "active", notes: writeOneOff(null, SEO_ORDER) }] }, 1],
  ["top-up", () => session("cs_live_top", { mode: "payment", amount_total: 4900, metadata: { kind: "topup", conversations: "50", pack: "pack50", lang: "fr" } }),
    { clients: [{ id: "c-top", business: "Cabinet Top", notes: null }] },
    { clients: [{ id: "c-top", business: "Cabinet Top", notes: writeTopup(null, { conversations: 50, month: monthKey(new Date(1790000000 * 1000)), session: "cs_live_top" }) }] }, 1],
  ["arrears settled", () => session("cs_live_arr", { mode: "payment", amount_total: 1500, metadata: { kind: "hosting", plan: "arrears", ref: "harness", label: "Old balance", lang: "en" } }), {}, null, 1],
  ["extra domain order", () => session("cs_live_dom", { mode: "payment", amount_total: 2000, metadata: { kind: "domain_addon", domain: "extra-harness.com", domain_retail_usd: "20", subscription_id: "sub_host1", ref: "harness" } }),
    { hosting_clients: [{ id: "h-dom", notes: null, business: "Harness Co" }] },
    { hosting_clients: [{ id: "h-dom", notes: writeExtraDomain(null, { domain: "extra-harness.com", retailUsd: 20, failed: "not-configured" }), business: "Harness Co" }] }, 0],
  ["custom work", () => session("cs_live_custom", { mode: "payment", amount_total: 25000, metadata: { kind: "custom_request", requestId: "req-1", buildId: "b-1" } }), {}, null, 0],
  ["one-off build payment", () => buildPayment(true), {}, { builds: [{ id: "b-seen", checkout_session_id: "cs_live_build_a" }] }, 1],
  ["renewal (invoice.paid)", () => invoice("invoice.paid", { amount_paid: 14900, currency: "eur", billing_reason: "subscription_cycle", customer_email: "owner.case@example.com" }),
    { clients: [{ id: "c-ren", business: "Cabinet Renew", email: "owner.case@example.com", plan: "essentiel" }] }, null, 0],
  ["payment failed (a later attempt)", () => invoice("invoice.payment_failed", { amount_due: 14900, currency: "eur", attempt_count: 2 }),
    { clients: [{ id: "c-fail", past_due_since: "2026-09-20T00:00:00.000Z", business: "Cabinet Fail", email: "owner.case@example.com", plan: "essentiel", build_id: null }] }, null, 0],
  ["hosting payment failed (first failure)", () => invoice("invoice.payment_failed", { amount_due: 4200, currency: "usd", attempt_count: 1, subscription: "sub_hf", customer: "cus_hf" }),
    { hosting_clients: [{ id: "h-fail", past_due_since: null, business: "Harness Host", email: "owner.case@example.com", plan: "hosting", subscription_id: "sub_hf", payment_status: "ok" }] }, null, 1],
  ["subscription ended", () => H.subscriptionDeleted(true), { clients: [{ id: "c-end", business: "Cabinet End", email: "owner.case@example.com" }] }, null, 0],
];

function seed(reads) {
  for (const [t, rows] of Object.entries(reads)) H.reads[t] = rows;
}

for (const [name, make, reads, replay, clientCount] of MONEY) {
  test(`owner notice — ${name}: exactly one Telegram alert and one email to the owner, subject in the house format`, () =>
    withEnv(LIVE, async () => {
      clear();
      net.clientMailDelayMs = 150; // the slowest call: only an awaited client email is counted
      seed(reads);
      const res = await POST(request(make(), H.LIVE_WH));
      assert.ok(res.status < 500, `status ${res.status}`);
      const tg = ownerAlerts();
      const em = ownerMails();
      assert.equal(tg.length, 1, `Telegram owner alerts: ${JSON.stringify(telegramTexts())}`);
      assert.equal(em.length, 1, `owner emails: ${JSON.stringify(mails().map((m) => m.subject))}`);
      assert.equal(clientMails().length, clientCount, `client emails delivered before the response: ${JSON.stringify(clientMails().map((m) => m.subject))}`);
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

/* ══ 6. The multilingual order is RECORDED, with its due date ════════════ */

const seo = (livemode, email = "owner.case@example.com") => {
  const e = session(livemode ? "cs_live_seo" : "cs_test_seo", {
    mode: "payment", amount_total: 14500, customer_details: { email },
    metadata: { kind: "hosting", plan: "seo_multilingual", business: "Harness Co", lang: "en", ...(livemode ? {} : { test: "1" }) },
  });
  e.livemode = livemode;
  return e;
};
const writesTo = (table, method) => H.writes.filter((w) => w.table === table && w.method === method);

test("multilingual: paid Monday 2026-09-21 → recorded on the client's hosting row, due 2026-09-28, and the owner is told the date", () =>
  withEnv(LIVE, async () => {
    clear();
    seed({ hosting_clients: [{ id: "h-seo", business: "Harness Co", email: "Owner.Case@example.com", status: "active", notes: "servolia-fulfilled: session: cs_old | at: x | plan: hosting" }] });
    await POST(request(seo(true), H.LIVE_WH));
    const [patch] = writesTo("hosting_clients", "PATCH");
    assert.ok(patch, "nothing written to the hosting row");
    assert.match(patch.query, /id=eq\.h-seo/);
    assert.ok(patch.body.notes.includes("servolia-fulfilled: session: cs_old"), "the row's other markers were lost");
    assert.ok(patch.body.notes.includes("servolia-oneoff: service: seo_multilingual | session: cs_live_seo | paid: 2026-09-21 | due: 2026-09-28 | amount: 145"), patch.body.notes);
    assert.equal(writesTo("leads", "POST").length, 0, "a lead was created although the client has a row");
    const [o] = ownerMails();
    assert.ok(o.text.includes("DUE 2026-09-28"), o.text);
    assert.ok(o.text.includes("https://servolia.com/admin/hosting/h-seo"));
    assert.ok(ownerAlerts()[0].includes("DUE 2026-09-28"));
    assert.equal(clientMails().length, 1, "the client's confirmation");
    // The lookup went by the buyer's address, live rows only.
    const lookup = supaCalls.find((c) => c.method === "GET" && c.url.includes("/hosting_clients?") && c.url.includes("email=ilike."));
    assert.ok(lookup, JSON.stringify(supaCalls.map((c) => c.url)));
    assert.ok(!lookup.url.includes("is_test=eq.true"));
  }));

test("multilingual: no hosting row → a one-off lead the admin sees, with its due date; the lead is not a lead-to-answer", () =>
  withEnv(LIVE, async () => {
    clear();
    await POST(request(seo(true), H.LIVE_WH));
    const [lead] = writesTo("leads", "POST");
    assert.ok(lead, "no record at all");
    assert.equal(lead.body.source, "one-off");
    assert.equal(lead.body.stage, "one_off", "a one-off lead must not count as an installation paid / won");
    assert.equal(lead.body.email, "owner.case@example.com");
    assert.deepEqual(lead.body.raw_data, { type: "oneoff", service: "seo_multilingual", session: "cs_live_seo", paidAt: "2026-09-21", dueAt: "2026-09-28", amountUsd: 145, siteLabel: "Harness Co" });
    assert.equal(lead.body.is_test, undefined, "a live order tagged test");
    assert.ok(ownerMails()[0].text.includes("recorded as a lead"));
  }));

test("multilingual: a redelivered event (row marker or lead already there) writes nothing and sends nothing", () =>
  withEnv(LIVE, async () => {
    for (const reads of [
      { hosting_clients: [{ id: "h-seo", business: "Harness Co", notes: writeOneOff(null, SEO_ORDER) }] },
      { leads: [{ id: "l-seen" }] },
    ]) {
      clear();
      seed(reads);
      const res = await POST(request(seo(true), H.LIVE_WH));
      assert.deepEqual(await res.json(), { received: true, line: "one-off", replay: true });
      assert.equal(H.writes.length, 0, JSON.stringify(H.writes));
      assert.equal(delivered.length, 0, "a replay sent something");
    }
  }));

test("multilingual in TEST mode: only test rows are matched, the lead is tagged is_test, mail goes to the founder [TEST]", () =>
  withEnv(TEST, async () => {
    clear();
    await POST(request(seo(false, "founder@example.com"), H.TEST_WH));
    const lookup = supaCalls.find((c) => c.method === "GET" && c.url.includes("/hosting_clients?") && c.url.includes("email=ilike."));
    assert.ok(lookup && lookup.url.includes("is_test=eq.true"), "a test purchase could complete a REAL client's row");
    const [lead] = writesTo("leads", "POST");
    assert.equal(lead.body.is_test, true);
    assert.equal(lead.body.raw_data.session, "cs_test_seo");
    for (const m of mails()) {
      assert.ok(m.subject.startsWith("[TEST] "), m.subject);
      assert.deepEqual([m.to].flat(), ["founder@example.com"]);
    }
    assert.equal(clientMails().length, 1);
    assert.equal(ownerMails().length, 1);
    assert.ok(ownerAlerts()[0].startsWith("TEST — 💶 Paid: multilingual"));
  }));

test("Today lists every open one-off order as '<service> for <site> — due <date>', from a hosting row and from a lead; done ones are gone", async () => {
  const { buildToday } = await import("../src/lib/today.ts");
  const { markOneOffDone } = await import("../src/lib/oneOffOrders.ts");
  clear();
  const other = { ...SEO_ORDER, session: "cs_live_done" };
  seed({
    hosting_clients: [{ id: "h-seo", business: "Harness Co", status: "active", plan: "seo_multilingual", notes: markOneOffDone(writeOneOff(writeOneOff(null, SEO_ORDER), other), "cs_live_done") }],
    // Niche and phone filled in by hand (score 65): without the one-off skip
    // it would also show as a hot lead to answer.
    leads: [{ id: "l-1", business: "Cabinet Lead", email: "x@y.z", niche: "dental", phone: "+33600000000", source: "one-off", stage: "deposit_paid", created_at: "2026-09-21T00:00:00Z",
      raw_data: { type: "oneoff", service: "seo_multilingual", session: "cs_live_l1", paidAt: "2026-09-24", dueAt: "2026-10-01", amountUsd: 145, siteLabel: "Cabinet Lead" } }],
  });
  const t = await buildToday(Date.parse("2026-09-29T09:00:00Z"));
  const s = t.sections.find((x) => x.key === "oneoffs");
  assert.ok(s, JSON.stringify(t.sections.map((x) => x.key)));
  assert.equal(s.items.length, 2, JSON.stringify(s.items));
  const [late, soon] = [s.items.find((i) => i.oneOff.where === "hosting"), s.items.find((i) => i.oneOff.where === "lead")];
  assert.match(late.title, /^Multilingual.* for Harness Co — due 2026-09-28$/);
  assert.match(late.detail, /OVERDUE by 1d/);
  assert.equal(late.urgency, 2);
  assert.deepEqual(late.oneOff, { where: "hosting", id: "h-seo", session: "cs_live_seo" });
  assert.match(soon.title, /for Cabinet Lead — due 2026-10-01$/);
  assert.equal(soon.href, "https://servolia.com/admin/leads/l-1");
  // The one-off lead is not also shown as a lead to answer.
  const leads = t.sections.find((x) => x.key === "leads");
  assert.ok(!leads || !leads.items.some((i) => i.title === "Cabinet Lead"));
  clear();
});

test("oneOffOrders: working days skip weekends; the marker is idempotent per session; done is stamped once", async () => {
  const O = await import("../src/lib/oneOffOrders.ts");
  assert.equal(O.addWorkingDays(new Date("2026-09-21T14:00:00Z"), 5), "2026-09-28"); // Mon → Mon
  assert.equal(O.addWorkingDays(new Date("2026-09-25T09:00:00Z"), 5), "2026-10-02"); // Fri → Fri
  assert.equal(O.addWorkingDays(new Date("2026-09-26T09:00:00Z"), 5), "2026-10-02"); // Sat → Fri
  assert.equal(O.addWorkingDays(new Date("2026-09-23T23:30:00Z"), 5), "2026-09-30"); // Wed → Wed
  const once = O.writeOneOff("keep me", SEO_ORDER);
  assert.equal(O.writeOneOff(once, SEO_ORDER), once, "writing the same session twice changed the notes");
  assert.equal(O.readOneOffs(once).length, 1);
  assert.ok(once.startsWith("keep me\n"));
  const done = O.markOneOffDone(once, "cs_live_seo", new Date("2026-09-27T00:00:00Z"));
  assert.equal(O.readOneOffs(done)[0].doneAt, "2026-09-27");
  assert.equal(O.markOneOffDone(done, "cs_live_seo", new Date("2026-12-01T00:00:00Z")), done, "done re-stamped");
  assert.equal(O.markOneOffDone(once, "cs_other"), null);
  assert.ok(O.hasOneOff(once, "cs_live_seo") && !O.hasOneOff(once, "cs_other"));
});

/* ══ 7. Follow-ups: outcomes stated, stores checked, rows matched exactly ═ */

const hostFail = () => invoice("invoice.payment_failed", { amount_due: 4200, currency: "usd", attempt_count: 1, subscription: "sub_hf", customer: "cus_hf" });
const hostFailRow = { hosting_clients: [{ id: "h-fail", past_due_since: null, business: "Harness Host", email: "owner.case@example.com", plan: "hosting", subscription_id: "sub_hf", payment_status: "ok" }] };

test("M1 hosting payment failed: the owner alert states what the client email REALLY did (sent / FAILED)", () =>
  withEnv(LIVE, async () => {
    clear();
    seed(hostFailRow);
    await POST(request(hostFail(), H.LIVE_WH));
    assert.ok(ownerMails()[0].text.includes("Client emailed (first failure)."), ownerMails()[0].text);
    clear();
    seed(hostFailRow);
    net.clientMail = "refuse";
    await POST(request(hostFail(), H.LIVE_WH));
    const t = ownerMails()[0].text;
    assert.ok(t.includes("CLIENT EMAIL FAILED — tell them by hand."), t);
    assert.ok(t.includes("Next: tell the client by hand."), t);
    assert.ok(ownerAlerts()[0].includes("CLIENT EMAIL FAILED"));
  }));

test("M1/LOW hosting payment failed, Resend never answers: 'NOT CONFIRMED — check', not 'FAILED'", () =>
  withEnv(LIVE, async () => {
    clear();
    seed(hostFailRow);
    net.clientMail = "hang";
    await POST(request(hostFail(), H.LIVE_WH));
    const t = ownerMails()[0].text;
    assert.ok(t.includes("Client email NOT CONFIRMED"), t);
    assert.ok(!t.includes("FAILED"), "a timeout reported as a failure");
    assert.ok(t.includes("Next: check the email went"), t);
  }));

test("emailOutcome: true sent, false failed, undefined (the 5 s cap) unconfirmed; the EUR failure line uses it", async () => {
  const { emailOutcome } = await import("../src/lib/notify.ts");
  assert.equal(emailOutcome(true), "sent");
  assert.equal(emailOutcome(false), "failed");
  assert.equal(emailOutcome(undefined), "unconfirmed");
  const w = src("src/app/api/webhooks/stripe/route.ts");
  assert.match(w, /emailed = emailOutcome\(await sends\.add\("payment failed email", sendEmail\(existing\.email/);
  assert.match(w, /hostEmailed = emailOutcome\(await sends\.add\("payment failed email", sendEmail\(host\.email/);
});

test("M2 multilingual: the owner alert says whether the client's receipt went (sent / FAILED — email them by hand)", () =>
  withEnv(LIVE, async () => {
    clear();
    await POST(request(seo(true), H.LIVE_WH));
    assert.ok(ownerMails()[0].text.includes("Receipt: sent."), ownerMails()[0].text);
    clear();
    net.clientMail = "refuse";
    await POST(request(seo(true), H.LIVE_WH));
    assert.ok(ownerMails()[0].text.includes("Receipt: FAILED — email them by hand."), ownerMails()[0].text);
    assert.ok(ownerAlerts()[0].includes("Receipt: FAILED"));
  }));

test("M2 multilingual: recorded as a lead first, the client buys hosting, Stripe redelivers → no second order anywhere", () =>
  withEnv(LIVE, async () => {
    clear();
    seed({
      // Now a hosting row matches the buyer…
      hosting_clients: [{ id: "h-new", business: "Harness Co", email: "owner.case@example.com", status: "active", notes: null }],
      // …but the first delivery already wrote the order as a lead.
      leads: [{ id: "l-first" }],
    });
    const res = await POST(request(seo(true), H.LIVE_WH));
    assert.deepEqual(await res.json(), { received: true, line: "one-off", replay: true });
    assert.equal(H.writes.length, 0, JSON.stringify(H.writes));
    assert.equal(delivered.length, 0);
    const check = supaCalls.find((c) => c.method === "GET" && c.url.includes("/hosting_clients?") && c.url.includes("notes=like."));
    assert.ok(check && check.url.includes("cs_live_seo"), "the hosting rows were not searched for this session");
  }));

test("M2 multilingual: an order already on ANOTHER hosting row (not the one the lookup would pick) is a replay too", () =>
  withEnv(LIVE, async () => {
    clear();
    seed({ hosting_clients: [
      { id: "h-other", business: "Old row", email: "someone@else.fr", status: "churned", notes: writeOneOff(null, SEO_ORDER) },
      { id: "h-now", business: "Harness Co", email: "owner.case@example.com", status: "active", notes: null },
    ] });
    await POST(request(seo(true), H.LIVE_WH));
    assert.equal(H.writes.length, 0, JSON.stringify(H.writes));
  }));

test("LOW one-off lookup: exact case-insensitive address (ilike wildcards filtered out), active row preferred over a newer one", () =>
  withEnv(LIVE, async () => {
    clear();
    seed({ hosting_clients: [
      { id: "h-wildcard", email: "jeanXdupont@cabinet.fr", status: "active", created_at: "2026-09-01", business: "Wrong", notes: null },
      { id: "h-newer-churned", email: "Jean_Dupont@Cabinet.fr", status: "churned", created_at: "2026-09-10", business: "Old", notes: null },
      { id: "h-active", email: "jean_dupont@cabinet.fr", status: "active", created_at: "2025-01-01", business: "Right", notes: null },
    ] });
    await POST(request(seo(true, "jean_dupont@cabinet.fr"), H.LIVE_WH));
    const [patch] = writesTo("hosting_clients", "PATCH");
    assert.ok(patch, JSON.stringify(H.writes));
    assert.match(patch.query, /id=eq\.h-active/);
  }));

test("LOW one-off lookup: the ref's repository is asked FIRST; the address only when the repo finds nothing", () =>
  withEnv(LIVE, async () => {
    const { clientRefFor } = await import("../src/lib/clientRefs.ts");
    const repo = clientRefFor("goodscochina")?.repo;
    assert.ok(repo, "fixture: goodscochina must carry a repo");
    clear();
    seed({ hosting_clients: [{ id: "h-repo", email: "other@addr.fr", status: "active", business: "Goods Co", notes: null }] });
    const e = seo(true);
    e.data.object.metadata.ref = "goodscochina";
    await POST(request(e, H.LIVE_WH));
    const lookups = supaCalls.filter((c) => c.method === "GET" && c.url.includes("/hosting_clients?") && !c.url.includes("notes=like."));
    assert.ok(lookups[0]?.url.includes(`repo=eq.${repo}`), JSON.stringify(lookups.map((c) => c.url)));
    assert.ok(!lookups.some((c) => c.url.includes("email=ilike.")), "asked by address although the repo matched");
    assert.match(writesTo("hosting_clients", "PATCH")[0].query, /id=eq\.h-repo/);
  }));

test("LOW one_off leads are not pipeline: no lead-SLA deadline, not an open lead, not 'installation paid'", async () => {
  const { collectDeadlines } = await import("../src/lib/deadlines.ts");
  clear();
  seed({ leads: [{ id: "l-oo", business: "One-off Co", email: "x@y.z", stage: "one_off", created_at: "2026-01-01T00:00:00Z", last_contacted_at: null }] });
  const events = await collectDeadlines();
  assert.ok(!events.some((e) => e.kind === "sla"), JSON.stringify(events));
  clear();
  assert.match(src("src/app/admin/analytics/page.tsx"), /\["live","lost","deposit_paid","one_off"\]/);
  assert.match(src("src/app/admin/leads/page.tsx"), /\["live", "lost", "deposit_paid", "one_off"\]/);
  assert.match(src("src/components/admin/LeadStageSelect.tsx"), /key: "one_off"/);
});

test("LOW the hosting setup form cannot wipe a recorded one-off order", async () => {
  const { keepOneOffs, readOneOffs, writeOneOff: w } = await import("../src/lib/oneOffOrders.ts");
  const db = w("servolia-fulfilled: session: cs_a | at: x | plan: hosting", SEO_ORDER);
  // Form opened before the order was recorded: no marker in what it sends.
  const merged = keepOneOffs(db, "Migrated 2026-09-20\nservolia-fulfilled: session: cs_a | at: x | plan: hosting");
  assert.ok(merged.startsWith("Migrated 2026-09-20\n"), merged);
  assert.equal(readOneOffs(merged).length, 1);
  assert.equal(readOneOffs(merged)[0].session, "cs_live_seo");
  // A hand-edited marker in the form does not override the database's.
  const edited = keepOneOffs(db, "servolia-oneoff: service: seo_multilingual | session: cs_live_seo | paid: x | due: 2099-01-01 | amount: 0");
  assert.equal(readOneOffs(edited)[0].dueAt, "2026-09-28");
  assert.equal(readOneOffs(edited).length, 1);
  assert.match(src("src/app/api/admin/hosting/[id]/route.ts"), /mergedNotes = keepOneOffs\(/);
});

test("LOW a subscription_update invoice says 'plan changed', not 'renewal'", () =>
  withEnv(LIVE, async () => {
    clear();
    seed({ clients: [{ id: "c-up", business: "Cabinet Up", email: "owner.case@example.com", plan: "essentiel" }] });
    await POST(request(invoice("invoice.paid", { amount_paid: 50000, currency: "eur", billing_reason: "subscription_update" }), H.LIVE_WH));
    const [o] = ownerMails();
    assert.ok(o, "no notice for a plan change");
    assert.match(o.subject, /plan changed/);
    assert.ok(!/renewal/.test(o.subject), o.subject);
    clear();
    seed({ clients: [{ id: "c-up", business: "Cabinet Up", email: "owner.case@example.com", plan: "essentiel" }] });
    await POST(request(invoice("invoice.paid", { amount_paid: 14900, currency: "eur", billing_reason: "subscription_cycle" }), H.LIVE_WH));
    assert.match(ownerMails()[0].subject, /renewal/);
  }));

test("LOW the dunning cron caps every email at 5 s; the final notice is marked only when confirmed", () => {
  const d = src("src/app/api/cron/dunning/route.ts");
  const sends = d.match(/sendEmail\(/g) ?? [];
  const capped = d.match(/bounded\("[^"]+", sendEmail\(/g) ?? [];
  assert.ok(sends.length >= 5);
  assert.equal(capped.length, sends.length, "a dunning email without the 5 s cap");
  assert.match(d, /if \(\(await bounded\("dunning final notice", sendEmail\([^)]*\)\)\) === true\) \{/);
});

test("LOW every Checkout session is card-only (no delayed method the webhook would never fulfil)", () => {
  const files = execFileSync("git", ["grep", "-l", "checkout.sessions.create", "--", "src"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  assert.ok(files.length >= 9, files.join(", "));
  const bad = [];
  for (const f of files) {
    const s = src(f);
    let i = 0;
    while ((i = s.indexOf("checkout.sessions.create({", i)) !== -1) {
      const head = s.slice(i, i + 700);
      if (!head.includes('payment_method_types: ["card"]')) bad.push(`${f}@${s.slice(0, i).split("\n").length}`);
      i += 10;
    }
  }
  assert.deepEqual(bad, []);
});

test("M3 chat: a booking's clinic alert and Meta Lead run after the reply, and the Lead only on the FIRST booking", () => {
  const c = src("src/app/api/chat/route.ts");
  const block = c.slice(c.indexOf("const firstBooking = isBooking && !wasQualified;"), c.indexOf("} catch { /* table/column may not exist yet"));
  assert.ok(block.length > 100, "firstBooking block not found");
  assert.match(block, /if \(firstBooking && config\) \{/);
  assert.match(block, /after\(\(\) => Promise\.all\(\[/);
  assert.ok(block.includes("notifyClientOfLead(site") && block.includes("sendMetaCapiEvent({"), "both sends inside the first-booking after()");
  assert.ok(!/await (notifyClientOfLead|sendMetaCapiEvent)/.test(c), "the patient waits on a send again");
  assert.ok(!/if \(isBooking && config\?\.metaPixelId/.test(c), "a Meta Lead fires on every booking message again");
});

test("OWNER_ALERT_EMAIL redirects the owner email; hello@servolia.com is only the default", () =>
  withEnv({ ...LIVE, OWNER_ALERT_EMAIL: "boss@example.org" }, async () => {
    clear();
    await POST(request(plan(true), H.LIVE_WH));
    const [o] = ownerMails();
    assert.deepEqual([o.to].flat(), ["boss@example.org"]);
  }));
