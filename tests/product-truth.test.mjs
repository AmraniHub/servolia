/**
 * Phase A of the Servolia product plan: every promise true, the cap real.
 *
 * The pure parts run; the wiring is held by source guards so the next edit
 * cannot quietly reopen a hole the review found.
 *
 *   node --import ./tests/register.mjs --test tests/product-truth.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const {
  TOPUP_PACKS, monthKey, topupsFor, writeTopup, capNotified, writeCapNotified,
} = await import("../src/lib/conversationCap.ts");
const { PLANS, PLAN_ORDER, ADDONS, SELLABLE_ADDONS, addonsFor, pricingPromptLines } = await import("../src/lib/pricing.ts");
const { conversationsEmail, topupReceiptEmail, oneOffServicePaidEmail } = await import("../src/lib/email.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(f)) out.push(p);
  }
  return out;
}

/* ── the cap ───────────────────────────────────────────────────────────── */

test("a top-up is credited once per Stripe session, to the month it was bought in", () => {
  const m = "2026-09";
  const a = writeTopup(null, { conversations: 100, month: m, session: "cs_1" });
  const b = writeTopup(a, { conversations: 100, month: m, session: "cs_1" }); // replayed webhook
  assert.equal(a, b, "same session must not credit twice");
  assert.equal(topupsFor(b, m), 100);
  const c = writeTopup(b, { conversations: 50, month: m, session: "cs_2" });
  assert.equal(topupsFor(c, m), 150);
  assert.equal(topupsFor(c, "2026-10"), 0, "a pack belongs to its month");
});

test("the 80 % and 100 % emails go once a month each, and reset next month", () => {
  const m = "2026-09";
  assert.deepEqual([...capNotified(null, m)], []);
  let n = writeCapNotified(null, m, 80);
  assert.deepEqual([...capNotified(n, m)], [80]);
  n = writeCapNotified(n, m, 80); // again — no second line
  assert.equal(n.split("\n").filter((l) => l.includes("level: 80")).length, 1);
  n = writeCapNotified(n, m, 100);
  assert.deepEqual([...capNotified(n, m)].sort((a, b) => a - b), [80, 100]);
  assert.deepEqual([...capNotified(n, "2026-10")], [], "a new month starts clean");
});

test("monthKey is UTC and zero-padded", () => {
  assert.equal(monthKey(new Date(Date.UTC(2026, 0, 31, 23, 59))), "2026-01");
  assert.equal(monthKey(new Date(Date.UTC(2026, 8, 1, 0, 0))), "2026-09");
});

test("a top-up costs more per conversation than moving up a tier — a pack is for a spike, the tier for growth", () => {
  const upgrade = (PLANS.croissance.monthlyEur - PLANS.essentiel.monthlyEur) / (PLANS.croissance.conversations - PLANS.essentiel.conversations);
  for (const p of Object.values(TOPUP_PACKS)) {
    const perConv = p.priceEur / p.conversations;
    assert.ok(perConv > upgrade, `${p.key}: €${perConv.toFixed(2)}/conv must exceed the upgrade rate €${upgrade.toFixed(2)}`);
    assert.ok(perConv < PLANS.essentiel.monthlyEur / PLANS.essentiel.conversations, `${p.key}: …but not the Essentiel rate, or nobody buys it`);
  }
});

test("the cap check runs after a NEW conversation is recorded, never blocks the reply", () => {
  const route = src("src/app/api/chat/route.ts");
  assert.ok(/after\(\(\) => checkConversationCap\(siteSlug\)\)/.test(route), "after(), not await");
  assert.ok(route.includes('import { NextRequest, NextResponse, after } from "next/server"'));
  const insertAt = route.indexOf('.insert({ session_id: sessionId, ...row })');
  const checkAt = route.indexOf("after(() => checkConversationCap");
  assert.ok(insertAt > 0 && checkAt > insertAt, "the check follows the insert of a new session, not an update");
});

test("the webhook credits a top-up before the build-payment fallthrough, and a one-off service never reads as arrears", () => {
  const wh = src("src/app/api/webhooks/stripe/route.ts");
  const topup = wh.indexOf('session.metadata?.kind === "topup"');
  const custom = wh.indexOf('session.metadata?.kind === "custom_request"');
  const oneOff = wh.indexOf('session.metadata?.plan === "seo_multilingual"');
  const arrears = wh.indexOf('const label = session.metadata?.label || "Outstanding balance"');
  assert.ok(topup > 0 && custom > 0 && topup < custom, "topup branch sits before the custom-request branch");
  assert.ok(oneOff > 0 && arrears > 0 && oneOff < arrears, "the one-off branch sits before the arrears branch");
  assert.ok(wh.includes("writeTopup(c.notes"), "credited via the idempotent marker");
});

/* ── what is sold ──────────────────────────────────────────────────────── */

test("add-ons with no fulfilment code are not for sale anywhere", () => {
  assert.equal(ADDONS.sms.available, false);
  assert.equal(ADDONS.reviews.available, false);
  assert.deepEqual(SELLABLE_ADDONS.map((a) => a.key), ["email"]);
  for (const plan of PLAN_ORDER) {
    const keys = addonsFor(plan).map((a) => a.key);
    assert.ok(!keys.includes("sms") && !keys.includes("reviews"), `${plan} must not be offered sms/reviews`);
  }
  assert.ok(!src("src/components/CarePlansSection.tsx").includes("Object.values(ADDONS)"), "pricing page renders SELLABLE_ADDONS");
  assert.ok(src("src/components/PortalDashboard.tsx").includes("addonsFor(subscription?.plan)"), "portal offers only what the plan lacks and what exists");
});

test("the tiers differ by conversations, not by features nothing performs", () => {
  const plans = src("src/components/CarePlansSection.tsx");
  for (const claim of ["Google reviews automation", "SMS / WhatsApp appointment reminders", "Ads closed loop", "Custom AI training", "Multi-practitioner / multi-site",
                       "Automatisation des avis Google", "Rappels de rendez-vous SMS", "Boucle publicitaire", "IA entraînée sur vos propres protocoles", "Multi-praticiens"]) {
    assert.ok(!plans.includes(claim), `pricing page must not claim: ${claim}`);
  }
  const prompt = pricingPromptLines();
  for (const claim of ["reviews automation", "SMS reminders", "closed-loop", "custom AI training", "multi-practitioner"]) {
    assert.ok(!prompt.toLowerCase().includes(claim.toLowerCase()), `the bot must not claim: ${claim}`);
  }
  assert.ok(prompt.includes("differ by included conversations, not by features"));
});

/* ── promises ──────────────────────────────────────────────────────────── */

test("no page, component or email promises a Loom, a PDF audit, or a delivery in hours that no code performs", () => {
  const files = [...walk(path.join(ROOT, "src/app")), ...walk(path.join(ROOT, "src/components")), path.join(ROOT, "src/lib/email.ts")]
    .filter((p) => !/email-preview|\.test\./.test(p));
  const bad = [];
  for (const p of files) {
    const s = readFileSync(p, "utf8");
    const rel = path.relative(ROOT, p);
    if (/\bLoom\b/.test(s)) bad.push(`${rel}: Loom`);
    if (/PDF (audit|report)|audit PDF|rapport PDF/.test(s)) bad.push(`${rel}: PDF audit`);
    if (/(sent|delivered|livr[ée]|envoy[ée]e?) (within|sous) 24 ?h/i.test(s)) bad.push(`${rel}: within 24h`);
    if (/go live within 24|mise en ligne sous 24/i.test(s)) bad.push(`${rel}: live within 24h`);
    if (/First leads usually arrive within|premières demandes arrivent en général/.test(s)) bad.push(`${rel}: leads within 48h`);
    if (/"Approve scope"/.test(s)) bad.push(`${rel}: approve-scope step on a self-serve path`);
  }
  assert.deepEqual(bad, [], "promises with nothing behind them");
});

test("the scope page no longer sells an installation with no plan behind it", () => {
  const scope = src("src/app/scope/[token]/page.tsx");
  assert.ok(!scope.includes("<CheckoutButton"), "the payment-mode checkout is gone from the scope page");
  assert.ok(scope.includes('href="/pricing#plans"'), "…and points at the plan checkout that collects the installation");
});

test("the audit confirmation promises a person and a working day, and the working day is on /admin/today", () => {
  const e = src("src/lib/email.ts");
  const start = e.indexOf("export const auditConfirmationEmail");
  const end = e.indexOf("export const", start + 10);
  const tpl = e.slice(start, end);
  assert.ok(/one working day/.test(tpl) && /un jour ouvré/.test(tpl));
  assert.ok(!/24 hours|24 heures|Loom/.test(tpl));
  assert.ok(src("src/lib/today.ts").includes("SLA is 48h"), "the clock the promise leans on exists");
});

/* ── the emails ────────────────────────────────────────────────────────── */

test("the cap emails say nothing stops, and name both ways forward", () => {
  const at100 = conversationsEmail({ businessName: "Atlas", level: 100, used: 100, allowance: 100, planName: "Essentiel", nextPlan: { name: "Croissance", monthlyEur: 249 }, topupUrl: "https://servolia.com/portal?topup=1", lang: "en" });
  assert.ok(/Nothing stops/.test(at100.html));
  assert.ok(at100.html.includes("Croissance") && at100.html.includes("€249"));
  assert.ok(at100.html.includes("portal?topup=1"));
  const top = conversationsEmail({ businessName: "Atlas", level: 80, used: 640, allowance: 800, planName: "Performance", nextPlan: null, topupUrl: "x", lang: "fr" });
  assert.ok(/formule la plus large/.test(top.html), "top tier: no next plan invented");
  const r = topupReceiptEmail({ businessName: "Atlas", conversations: 100, priceEur: 89, month: "2026-09", lang: "en" });
  assert.ok(r.html.includes("100 conversations") && r.html.includes("€89") && r.html.includes("2026-09"));
  const o = oneOffServicePaidEmail({ productName: "Multilingual search setup", amountUsd: 145, siteLabel: "goodscochina.com", whatHappens: "we do X within five working days.", lang: "en" });
  assert.ok(!/Outstanding balance/.test(o.html) && o.html.includes("$145"));
});

/* ── one place to look ─────────────────────────────────────────────────── */

test("today reads both lines, and the morning brief is the same list", () => {
  const today = src("src/lib/today.ts");
  for (const t of ['from("leads")', 'from("builds")', 'from("client_sites")', 'from("hosting_clients")', 'from("clients")', 'from("prospects")', 'from("custom_requests")']) {
    assert.ok(today.includes(t), `today.ts must read ${t}`);
  }
  const brief = src("src/app/api/cron/daily-brief/route.ts");
  assert.ok(brief.includes("buildToday()") && brief.includes("todayAsTelegram("), "the brief renders the shared list");
  assert.ok(/plain:\s*true/.test(brief), "…as plain text");
  assert.ok(src("src/components/admin/AdminShell.tsx").includes('href: "/admin/today"'), "…and it is in the nav");
  assert.ok(src("src/app/admin/page.tsx").includes('from("hosting_clients")'), "the dashboard counts the hosting line");
});

test("the two client portals no longer share a cookie name", () => {
  const a = src("src/lib/clientAuth.ts").match(/const COOKIE_NAME = "([^"]+)"/)?.[1];
  const b = src("src/lib/clientAreaAuth.ts").match(/const COOKIE = "([^"]+)"/)?.[1];
  assert.ok(a && b && a !== b, `clientAuth=${a} clientAreaAuth=${b}`);
});
