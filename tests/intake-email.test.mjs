/**
 * A paying plan buyer's intake is accepted without an email field.
 *
 * Found 2026-09-25 in a founder test walk: after paying for Essentiel at
 * /pricing the buyer lands on /onboarding?...&session_id=cs_..., fills the
 * five steps and submits. The form never asks for an email (the payment has
 * one), and POST /api/contact rejected the body at its spam gate with 400
 * "Invalid email" -- BEFORE the intake branch that knows how to read the
 * paid email from the Stripe session. The form then blamed the buyer's
 * connection. No plan buyer could submit an intake; no draft was ever built.
 *
 * The route is driven for real: a fake PostgREST over `fetch` (installed
 * before supabase-js is first imported), a fake Stripe through the one test
 * seam (src/lib/stripeMode.ts), and a stand-in Next work store so after()
 * can be called the way a real request calls it.
 *
 *   node --import ./tests/register.mjs --test tests/intake-email.test.mjs
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const SUPA = "https://intake-email.supabase.co";
const LIVE_KEY = "sk_live_intake_email";
const TEST_KEY = "sk_test_intake_email";
const FOUNDER = "founder@example.com";

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPA,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-intake-email",
  STRIPE_SECRET_KEY: LIVE_KEY,
  STRIPE_TEST_SECRET_KEY: TEST_KEY,
  UPGRADE_TOKEN_SECRET: "intake-email-upgrade-secret",
  FOUNDER_EMAIL: FOUNDER,
});
for (const k of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "GOOGLE_SHEETS_WEBHOOK_URL", "RESEND_API_KEY",
                 "META_CAPI_ACCESS_TOKEN", "META_PIXEL_ID", "ANTHROPIC_API_KEY"]) delete process.env[k];

/* ── A tiny PostgREST: the builds table is real rows, filtered for real ── */
const db = { builds: [] };
const writes = [];
const outbound = [];

function reply(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function matches(row, key, raw) {
  if (["select", "order", "limit", "on_conflict", "columns"].includes(key)) return true;
  const v = row[key];
  if (raw.startsWith("eq.")) return String(v) === raw.slice(3);
  if (raw.startsWith("in.(")) return raw.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
  if (raw === "not.is.true") return v !== true;
  if (raw === "is.true") return v === true;
  if (raw === "is.null") return v == null;
  throw new Error(`fake PostgREST: unsupported filter ${key}=${raw}`);
}
function filtered(table, u) {
  let rows = (db[table] ?? []).filter((r) => [...u.searchParams].every(([k, raw]) => matches(r, k, raw)));
  if ((u.searchParams.get("order") ?? "").startsWith("created_at.desc")) rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const limit = Number(u.searchParams.get("limit"));
  return limit ? rows.slice(0, limit) : rows;
}
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  if (!url.startsWith(SUPA)) {
    outbound.push({ url, method });
    return reply({ ok: true });
  }
  const u = new URL(url);
  const table = u.pathname.replace("/rest/v1/", "");
  const wantsObject = (new Headers(init.headers ?? {}).get("accept") ?? "").includes("vnd.pgrst.object");
  if (method === "GET" || method === "HEAD") return reply(filtered(table, u));
  const body = init.body ? JSON.parse(String(init.body)) : null;
  writes.push({ method, table, query: decodeURIComponent(u.search), body });
  if (method === "PATCH" && table === "builds") {
    const hit = filtered("builds", u);
    for (const r of hit) Object.assign(r, body);
    return reply(hit.map((r) => ({ id: r.id })));
  }
  const row = { id: table === "leads" ? "lead-new" : `row-${table}` };
  return wantsObject ? reply(row) : reply([row]);
};

/* ── A fake Stripe: sessions exist only under their own mode's key ─────── */
const SM = await import("../src/lib/stripeMode.ts");
const sessions = {};
const stripeCalls = [];
SM.__setStripeFactoryForTests((key) => ({
  checkout: {
    sessions: {
      retrieve: async (id) => {
        stripeCalls.push({ key, id });
        const s = sessions[id];
        if (!s || key.startsWith("sk_test_") !== id.startsWith("cs_test_")) {
          const e = new Error(`No such checkout.session: ${id}`);
          e.code = "resource_missing";
          e.statusCode = 404;
          throw e;
        }
        return s;
      },
    },
  },
}));

// Next's own server sets this global before any request; its work store needs it.
globalThis.AsyncLocalStorage ??= (await import("node:async_hooks")).AsyncLocalStorage;
const { POST } = await import("../src/app/api/contact/route.ts");
const { NextRequest } = await import("next/server");
const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external.js");
const TM = await import("../src/lib/testMode.ts");
const TC = await import("../src/lib/testContext.ts");
const { submitIntake, INTAKE_FAIL } = await import("../src/lib/intakeSubmit.ts");

/** after() tasks the route scheduled; collected, never run (they call Claude). */
let afterTasks = [];
let ipN = 0;
async function send(body, { cookie } = {}) {
  ipN += 1; // a fresh IP per request, so the limiter never decides a test
  const headers = { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ipN}` };
  if (cookie) headers.cookie = cookie;
  const req = new NextRequest("https://servolia.com/api/contact", { method: "POST", body: JSON.stringify(body), headers });
  const store = { afterContext: { after: (t) => afterTasks.push(t) } };
  const res = await workAsyncStorage.run(store, () => POST(req));
  return { status: res.status, json: await res.json() };
}

/** The exact body the founder's browser sent on 2026-09-25 (test mode). */
const CAPTURED = {
  businessName: "Cabinet Test", ownerName: "Dr Test", phone: "+33 6 00 00 00 00", address: "", city: "Paris", country: "France",
  primaryColor: "", stylePreference: "", logoUrl: "", heroImageUrl: "", inspirationUrls: "",
  services: "Implants 2000", targetClient: "Adults in Paris", avgClientValue: "", mainGoal: "",
  competitors: "", launchDeadline: "", specialRequirements: "", domain: "", existingWebsite: "",
  socialHandles: "", googleAnalyticsId: "", preferredLanguage: "French",
  plan: "essentiel", planName: "Servolia System", type: "intake", sessionId: "cs_test_captured", lang: "en",
};
const planSession = (id, email, extra = {}) => ({
  id, status: "complete", mode: "subscription", metadata: { kind: "care_plan", plan: "essentiel" },
  customer_details: { email }, customer_email: null, ...extra,
});
const build = (id, extra) => ({
  id, lead_id: `lead-of-${id}`, status: "intake", email: FOUNDER, checkout_session_id: null,
  is_test: false, created_at: "2026-09-25T10:00:00.000Z", ...extra,
});
const leadInsert = () => writes.find((w) => w.table === "leads" && w.method === "POST");
const claimed = () => writes.filter((w) => w.table === "builds" && w.method === "PATCH" && w.body?.status === "building");

beforeEach(() => {
  db.builds = [];
  writes.length = 0;
  outbound.length = 0;
  stripeCalls.length = 0;
  afterTasks = [];
  for (const k of Object.keys(sessions)) delete sessions[k];
  TC.__resetTestColumnCacheForTests();
});

/* ══ The bug, exactly as captured ═════════════════════════════════════════ */

test("the captured body (no email) is taken: Stripe's email is used, the paid build is started", async () => {
  assert.equal("email" in CAPTURED, false, "the fixture must reproduce the missing field");
  sessions.cs_test_captured = planSession("cs_test_captured", FOUNDER);
  db.builds.push(build("b-paid", { checkout_session_id: "cs_test_captured", is_test: true }));

  const res = await send(CAPTURED);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.ok, true);
  assert.deepEqual(stripeCalls, [{ key: TEST_KEY, id: "cs_test_captured" }], "read once, with the TEST key");
  assert.equal(leadInsert().body.email, FOUNDER, "the lead carries the paid email");
  const c = claimed();
  assert.equal(c.length, 1, "the build was claimed");
  assert.match(c[0].query, /id=eq\.b-paid/);
  assert.equal(c[0].body.intake_data.businessName, "Cabinet Test");
  assert.equal(db.builds[0].status, "building");
  assert.equal(afterTasks.length, 1, "the draft generation was scheduled");
});

test("the same body from the founder's test-mode browser is tagged test", async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const admin = `${b64({ alg: "HS256" })}.${b64({ role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  const cookie = `sv_test=${TM.signTestCookie(Date.now() + 3600_000, admin)}; servolia_admin=${admin}`;
  sessions.cs_test_captured = planSession("cs_test_captured", FOUNDER);
  db.builds.push(build("b-paid", { checkout_session_id: "cs_test_captured", is_test: true }));

  const res = await send(CAPTURED, { cookie });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(leadInsert().body.is_test, true);
  assert.equal(leadInsert().body.email, FOUNDER);
  assert.equal(claimed().length, 1);
});

test("the session's paid email wins over an email in the body", async () => {
  sessions.cs_live_paid = planSession("cs_live_paid", "buyer@clinic.fr");
  db.builds.push(build("b-live", { checkout_session_id: "cs_live_paid", email: "buyer@clinic.fr" }));
  const res = await send({ ...CAPTURED, sessionId: "cs_live_paid", email: "someone-else@example.com" });
  assert.equal(res.status, 200);
  assert.deepEqual(stripeCalls, [{ key: LIVE_KEY, id: "cs_live_paid" }], "a cs_live_ session is read with the live key");
  assert.equal(leadInsert().body.email, "buyer@clinic.fr");
  assert.equal(claimed().length, 1);
});

test("a cs_live_ intake from the founder's test browser still runs live", async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const admin = `${b64({ alg: "HS256" })}.${b64({ role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  const cookie = `sv_test=${TM.signTestCookie(Date.now() + 3600_000, admin)}; servolia_admin=${admin}`;
  sessions.cs_live_paid = planSession("cs_live_paid", "buyer@clinic.fr");
  db.builds.push(build("b-live", { checkout_session_id: "cs_live_paid", email: "buyer@clinic.fr" }));
  const res = await send({ ...CAPTURED, sessionId: "cs_live_paid" }, { cookie });
  assert.equal(res.status, 200);
  assert.equal(leadInsert().body.is_test, undefined, "never tagged test");
  assert.equal(leadInsert().body.email, "buyer@clinic.fr");
});

/* ══ Test sessions never reach a real client ═════════════════════════════ */

test("a test session found by email links only to a TEST build, never the live one with that address", async () => {
  // A scope-flow build keeps its first session id, so this session names no build:
  // Stripe's email finds the waiting one.
  sessions.cs_test_captured = planSession("cs_test_captured", FOUNDER);
  db.builds.push(build("b-live-same-email", { is_test: false, created_at: "2026-09-25T12:00:00.000Z" }));
  db.builds.push(build("b-test", { is_test: true, created_at: "2026-09-25T09:00:00.000Z" }));
  const res = await send(CAPTURED);
  assert.equal(res.status, 200);
  const c = claimed();
  assert.equal(c.length, 1);
  assert.match(c[0].query, /id=eq\.b-test/, "the test build, although the live one is newer");
  assert.equal(db.builds.find((b) => b.id === "b-live-same-email").status, "intake", "the live build is untouched");
});

test("a test session with only a live build to find starts nothing", async () => {
  sessions.cs_test_captured = planSession("cs_test_captured", FOUNDER);
  db.builds.push(build("b-live-same-email", { is_test: false }));
  const res = await send(CAPTURED);
  assert.equal(res.status, 200, "the answers are kept on the lead row");
  assert.equal(claimed().length, 0);
  assert.equal(afterTasks.length, 0);
});

test("a live session never links to a test build by email", async () => {
  sessions.cs_live_paid = planSession("cs_live_paid", FOUNDER);
  db.builds.push(build("b-test", { is_test: true }));
  const res = await send({ ...CAPTURED, sessionId: "cs_live_paid" });
  assert.equal(res.status, 200);
  assert.equal(claimed().length, 0);
});

test("a paid non-plan session supplies the email but never aims at a build by email", async () => {
  sessions.cs_live_topup = planSession("cs_live_topup", FOUNDER, { mode: "payment", metadata: { kind: "topup" } });
  db.builds.push(build("b-live", { is_test: false }));
  const res = await send({ ...CAPTURED, sessionId: "cs_live_topup" });
  assert.equal(res.status, 200);
  assert.equal(leadInsert().body.email, FOUNDER);
  assert.equal(claimed().length, 0);
});

/* ══ Without a readable paid session, an email is required as before ═════ */

test("no session and no email: 400, with a message the form can show, in the buyer's language", async () => {
  const { sessionId: _s, ...noSession } = CAPTURED;
  const en = await send(noSession);
  assert.equal(en.status, 400);
  assert.equal(en.json.error, "Invalid email");
  assert.match(en.json.message, /valid email/);
  const fr = await send({ ...noSession, lang: "fr" });
  assert.match(fr.json.message, /adresse email valide/);
  assert.equal(stripeCalls.length, 0);
  assert.equal(leadInsert(), undefined, "nothing written");
});

test("no session but a valid email: taken, as before, with no build linked", async () => {
  const { sessionId: _s, ...noSession } = CAPTURED;
  const res = await send({ ...noSession, email: "walkin@clinic.fr" });
  assert.equal(res.status, 200);
  assert.equal(leadInsert().body.email, "walkin@clinic.fr");
  assert.equal(claimed().length, 0);
});

test("an unreadable, unknown or unpaid session with no email: 400 'we couldn't match your payment'", async () => {
  // Unknown to Stripe.
  let res = await send({ ...CAPTURED, sessionId: "cs_live_nobody" });
  assert.equal(res.status, 400);
  assert.match(res.json.message, /couldn't match your payment/);
  assert.match(res.json.message, /hello@servolia\.com/);
  // Exists, but never paid.
  sessions.cs_live_open = planSession("cs_live_open", "buyer@clinic.fr", { status: "open" });
  res = await send({ ...CAPTURED, sessionId: "cs_live_open", lang: "fr" });
  assert.equal(res.status, 400);
  assert.match(res.json.message, /relier votre paiement/);
  // A cs_test_ id is never looked up with the live key: with no test key there is nothing to read.
  const saved = process.env.STRIPE_TEST_SECRET_KEY;
  delete process.env.STRIPE_TEST_SECRET_KEY;
  try {
    sessions.cs_test_captured = planSession("cs_test_captured", FOUNDER);
    stripeCalls.length = 0;
    res = await send(CAPTURED);
    assert.equal(res.status, 400);
    assert.equal(stripeCalls.length, 0, "never asked the live account about a test session");
  } finally {
    process.env.STRIPE_TEST_SECRET_KEY = saved;
  }
  assert.equal(leadInsert(), undefined, "nothing written");
});

test("a session id means nothing outside an intake, and the decoy still short-circuits", async () => {
  sessions.cs_live_paid = planSession("cs_live_paid", "buyer@clinic.fr");
  const contact = await send({ type: "contact", name: "A", problem: "B", sessionId: "cs_live_paid" });
  assert.equal(contact.status, 400);
  assert.deepEqual(contact.json, { error: "Invalid email" }, "the other forms' answer is unchanged");
  assert.equal(stripeCalls.length, 0);
  const bot = await send({ ...CAPTURED, sessionId: "cs_live_paid", url: "http://spam.example" });
  assert.equal(bot.status, 200);
  assert.equal(stripeCalls.length, 0, "a bot costs no Stripe call");
  assert.equal(writes.length, 0);
});

test("the other forms still post an email and still pass", async () => {
  const audit = await send({ type: "free-audit", name: "Dr A", email: "a@clinic.fr", business: "Clinic", problems: ["Missed calls"] });
  assert.equal(audit.status, 200);
  const contact = await send({ type: "contact", name: "Dr B", email: "b@clinic.fr", problem: "Need a site" });
  assert.equal(contact.status, 200);
  const noName = await send({ type: "contact", email: "b@clinic.fr" });
  assert.equal(noName.status, 400);
  // And every form that posts here sends its email field.
  for (const f of ["src/app/contact/page.tsx", "src/app/fr/contact/page.tsx", "src/components/AuditForm.tsx"]) {
    const s = src(f);
    assert.match(s, /name="email"[^>]*required|required[^>]*name="email"|email:\s*""/, `${f} has an email field`);
    assert.match(s, /JSON\.stringify\(\{ \.\.\.form, type: "(contact|free-audit)"[^}]*\}\)/, `${f} posts its whole form`);
  }
});

/* ══ The form ═════════════════════════════════════════════════════════════ */

test("the form shows the server's own message, and says 'connection' only when there was none", async () => {
  const answered = (status, body) => async () => ({ ok: status < 400, json: async () => body });
  const said = await submitIntake({}, "en", answered(400, { error: "Invalid email", message: "We couldn't match your payment to this form." }));
  assert.deepEqual(said, { ok: false, kind: "server", message: "We couldn't match your payment to this form." });

  const bare = await submitIntake({}, "fr", answered(500, { error: "Failed" }));
  assert.equal(bare.kind, "server");
  assert.equal(bare.message, INTAKE_FAIL.server.fr);
  assert.match(bare.message, /hello@servolia\.com/);
  assert.doesNotMatch(bare.message, /connexion/, "a server refusal is not a connection problem");

  const notJson = await submitIntake({}, "en", async () => ({ ok: false, json: async () => { throw new Error("html"); } }));
  assert.doesNotMatch(notJson.message, /connection/);

  const dropped = await submitIntake({}, "en", async () => { throw new TypeError("Failed to fetch"); });
  assert.equal(dropped.kind, "network");
  assert.match(dropped.message, /check your connection/);

  assert.deepEqual(await submitIntake({}, "en", answered(200, { ok: true })), { ok: true });
});

test("the real server answer reaches the form's words end to end", async () => {
  const { sessionId: _s, ...noSession } = CAPTURED;
  const viaRoute = async (_url, init) => {
    const r = await send(JSON.parse(init.body));
    return { ok: r.status < 400, json: async () => r.json };
  };
  const out = await submitIntake({ ...noSession, lang: "fr" }, "fr", viaRoute);
  assert.equal(out.ok, false);
  assert.match(out.message, /adresse email valide/);
});

test("the form: email asked only without a session, never from the URL; mainGoal optional; every * enforced", () => {
  const f = src("src/components/OnboardingForm.tsx");
  assert.match(f, /const needsEmail = !sessionId;/);
  assert.match(f, /\{needsEmail && \(\s*<div>\s*<label htmlFor="intake-email"/, "the field renders only when needed");
  assert.doesNotMatch(f, /params\.get\("email"\)/, "nothing prefilled from the URL");
  assert.match(f, /\.\.\.\(needsEmail \? \{ email: typedEmail\.trim\(\) \} : \{\}\)/, "no email sent alongside a session");
  assert.match(f, /else setError\(outcome\.message\)/, "the outcome's message is what is shown");
  assert.match(f, /<p role="alert"[^>]*>\{error\}<\/p>/);
  assert.match(f, /<button onClick=\{next\}/, "Continue validates the step");
  // mainGoal: configFromIntake treats it as optional, so its label promises nothing.
  assert.doesNotMatch(f, /#1 goal with this system\? \*/);
  assert.doesNotMatch(f, /objectif n°1 avec ce système \? \*/);
  assert.doesNotMatch(f.slice(f.indexOf("const REQUIRED"), f.indexOf("const stepProblem")), /mainGoal/);
  assert.match(src("src/lib/clientSites.ts"), /mainGoal\s*\n?\s*\?/, "the generator really does treat it as optional");
  // Every other asterisk is in REQUIRED.
  const req = f.slice(f.indexOf("const REQUIRED"), f.indexOf("const stepProblem"));
  for (const k of ["businessName", "ownerName", "phone", "city", "country", "email", "services", "targetClient"]) {
    assert.match(req, new RegExp(`\\["${k}",`), `${k} is enforced`);
  }
  // Both languages carry the new strings (the FR page renders the same component).
  const fr = f.slice(f.indexOf("  fr: {"));
  for (const key of ["email:", "emailPh:", "emailHelp:", "missing:", "badEmail:"]) {
    assert.ok(f.slice(0, f.indexOf("  fr: {")).includes(key), `en ${key}`);
    assert.ok(fr.includes(key), `fr ${key}`);
  }
  assert.match(src("src/app/fr/demarrage/page.tsx"), /<OnboardingForm lang="fr" \/>/);
  assert.match(src("src/app/onboarding/page.tsx"), /<OnboardingForm lang="en" \/>/);
});
