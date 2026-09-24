/**
 * Every promise a paying client reads is executed by code, or the words say
 * what actually happens.
 *
 * Found by a read-through on 2026-09-24: pages that showed one price while
 * Stripe charged another, add-ons nothing performs still for sale, a mailbox
 * count that differed between the product and the invoice line, a monitor that
 * did not exist. The pure parts run; the wiring is held by source guards so the
 * next edit cannot quietly reopen a hole.
 *
 *   node --import ./tests/register.mjs --test tests/promises-true.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const { CLIENT_PRODUCTS } = await import("../src/lib/hosting.ts");
const { ADDONS, addonForSale } = await import("../src/lib/pricing.ts");
const { hostOf, hostingMailDomain, hostingMailboxOwed, hostingSetupOwed } = await import("../src/lib/owedToPractice.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");

/* ── 1. multilingual search is a one-off, everywhere ───────────────────── */

test("the pay page is handed the one-off price, and shows it before any period price", () => {
  const page = src("src/components/ClientProductPage.tsx");
  assert.ok(/oneOffUsd=\{product\.oneOffUsd\}/.test(page), "ClientProductPage must pass oneOffUsd to ProductCheckout");

  const card = src("src/components/ProductCheckout.tsx");
  // Same order as hostingAmountCents: the one-off wins outright.
  assert.ok(/const amount = oneOff \? oneOffUsd : annual \? annualUsd : monthlyUsd;/.test(card),
    "the displayed amount must put the one-off first");
  assert.ok(/oneOff \? t\.payOnce\(amount\)/.test(card), "the pay button must say once for a one-off");
  assert.ok(/\{oneOff \? null : \(/.test(card), "no yearly/monthly toggle for a one-off");
});

test("the one-off wording exists in both languages", async () => {
  const card = src("src/components/ProductCheckout.tsx");
  for (const key of ["once:", "billedOnce:", "payOnce:", "nothingRecurring:"]) {
    assert.equal(card.split(key).length - 1, 2, `${key} must be defined in en AND fr`);
  }
  assert.equal(CLIENT_PRODUCTS.seo_multilingual.oneOffUsd, 145);
});

test("the thanks page tells a one-off buyer: paid once, five working days, no renewal", () => {
  const page = src("src/app/hosting/thanks/page.tsx");
  const entries = page.match(/seo_multilingual: \{[\s\S]*?\n  \},/g) ?? [];
  assert.equal(entries.length, 2, "seo_multilingual copy in COPY and COPY_FR");
  const [fr, en] = entries;
  assert.ok(/five working days/.test(en) && /nothing renews/.test(en), "EN: five working days, nothing renews");
  assert.ok(/cinq jours ouvrés/.test(fr) && /rien ne se renouvelle/.test(fr), "FR: cinq jours ouvrés, rien ne se renouvelle");
  // The footer's renewal line is not shown for a one-off.
  assert.ok(/\{isOneOff\s*\?\s*\(fr/.test(page), "the renewal footer branches on isOneOff");
  assert.ok(/const isSetup = setup === "1" && !isOneOff;/.test(page), "a one-off never shows the handover step");
});

test("a step whose link could not be minted points at the email, never at nothing", () => {
  const page = src("src/app/hosting/thanks/page.tsx");
  assert.ok(/isStep && !stepUrl \? noLinkNote : ""/.test(page));
  assert.ok(/confirmation email/.test(page) && /email de confirmation\./.test(page));
});

test("the checkout sends a one-off buyer to the thanks page without setup=1", () => {
  const route = src("src/app/api/hosting-checkout/route.ts");
  assert.ok(/: oneOff\s*\n\s*\? `\$\{origin\}\/hosting\/thanks\?product=\$\{hostingPlan\.key\}&lang=\$\{lang\}`/.test(route),
    "the one-off success_url must carry no setup/session flags");
});

/* ── 2. a retired add-on cannot be bought ──────────────────────────────── */

test("the add-on checkout sells only what is available", () => {
  for (const [key, a] of Object.entries(ADDONS)) {
    const sale = addonForSale(key);
    if (a.available === false) assert.deepEqual(sale, { error: "retired" }, `${key} is retired and must be refused`);
    else assert.equal(sale.addon, a, `${key} is for sale`);
  }
  assert.deepEqual(addonForSale("sms"), { error: "retired" });
  assert.deepEqual(addonForSale("reviews"), { error: "retired" });
  assert.deepEqual(addonForSale("constructor"), { error: "unknown" }, "not Object's constructor");
  assert.deepEqual(addonForSale(""), { error: "unknown" });
  assert.deepEqual(addonForSale(undefined), { error: "unknown" });
});

test("the add-on route asks addonForSale and answers a retired add-on with a 4xx", () => {
  const route = src("src/app/api/checkout-addon/route.ts");
  assert.ok(route.includes("addonForSale(addon)"), "the route must go through addonForSale");
  assert.ok(!/ADDONS\[/.test(route), "the route must not index ADDONS directly");
  assert.ok(/status: 410/.test(route), "a retired add-on gets a clear 4xx");
});

test("neither the portal assistant nor the city pages offer a retired add-on", () => {
  assert.ok(!/Object\.values\(ADDONS\)/.test(src("src/lib/portalAssistant.ts")), "the portal assistant lists SELLABLE_ADDONS");
  assert.ok(!/avis Google/i.test(src("src/lib/content/frGeo.ts").replace(/hook: "[^"]*"/g, "")),
    "no city-page answer says a plan includes Google reviews");
});

/* ── 3. Business hosting: ONE mailbox, everywhere it is counted ────────── */

test("the Stripe line and the terms count the Business mailboxes the way the product does", () => {
  const biz = CLIENT_PRODUCTS.hosting_business;
  assert.ok(biz.includes.includes("Business email on your domain — 1 mailbox included"));
  assert.ok(biz.fr.includes.includes("Messagerie professionnelle à votre domaine — 1 boîte incluse"));

  const route = src("src/app/api/hosting-checkout/route.ts");
  assert.ok(!/Up to 3 mailboxes|Jusqu'à 3 boîtes/i.test(route), "the invoice line must not promise three");
  assert.ok(route.includes('"1 mailbox on your domain, with SPF, DKIM and DMARC set up. Charged once."'));
  assert.ok(route.includes('"1 boîte sur votre domaine, avec SPF, DKIM et DMARC configurés. Facturé une seule fois."'));

  const terms = src("src/app/hosting/terms/page.tsx");
  assert.ok(!/up to three\s+mailboxes/i.test(terms), "the terms must not promise three");
  assert.ok(/one mailbox\s+included/.test(terms) && /\$\{BUSINESS\.setupUsd\}/.test(terms), "one included, the fee imported, not typed");

  for (const f of ["src/components/ProductCheckout.tsx", "src/components/PlanChooser.tsx"]) {
    assert.ok(!/mailboxes set up|boîtes email mises en place/.test(src(f)), `${f}: the setup line is for one mailbox`);
  }
});

test("a Business client's mailbox is owed until their domain publishes MX, and lands on /admin/today", () => {
  const row = (o) => ({ plan: "hosting_business", status: "active", site_url: "https://www.acme.com/", ...o });
  assert.equal(hostOf("https://www.Acme.com:443/contact?x=1"), "acme.com");
  assert.equal(hostOf("acme.co.uk"), "acme.co.uk");
  assert.equal(hostOf(""), null);
  assert.equal(hostingMailDomain(row()), "acme.com");
  assert.equal(hostingMailDomain(row({ plan: "hosting" })), null, "only Business includes a mailbox");
  assert.equal(hostingMailDomain(row({ status: "past_due" })), null);
  assert.equal(hostingMailDomain(row({ site_url: null })), null, "no site yet is the needs-setup row's business");
  assert.deepEqual(hostingMailboxOwed(row(), { state: "none" }), { kind: "mailbox-owed", domain: "acme.com" });
  assert.equal(hostingMailboxOwed(row(), { state: "ready", hosts: ["mx.zoho.eu"] }), null, "clears the morning MX appears");
  assert.deepEqual(hostingMailboxOwed(row(), { state: "unknown" }), { kind: "mailbox-unchecked", domain: "acme.com" });

  const today = src("src/lib/today.ts");
  assert.ok(today.includes("hostingMailboxOwed(h, hostMail.get(h.id))") && today.includes('kind: "hosting-mailbox-owed"'));
});

/* ── 5. EUR plans: timing, plan moves, the founding offer ───────────────── */

test("the EUR plan copy says what the checkout does: 7 days after payment, moves made by hand", () => {
  const route = src("src/app/api/checkout-subscription/route.ts");
  assert.ok(/const DELIVERY_TRIAL_DAYS = 7;/.test(route) && /trial_period_days: DELIVERY_TRIAL_DAYS/.test(route), "the fixed 7-day trial this copy describes");
  const pages = [
    "src/components/CarePlansSection.tsx", "src/app/pricing/page.tsx", "src/app/fr/tarifs/page.tsx", "src/app/how-it-works/page.tsx",
    "src/app/fr/comment-ca-marche/page.tsx", "src/app/page.tsx", "src/components/FrenchHome.tsx", "src/app/legal/refund/page.tsx",
    "src/app/fr/legal/remboursement/page.tsx", "src/app/api/chat/route.ts", "src/lib/scopeDocument.ts", "src/app/api/checkout-subscription/route.ts",
  ];
  const claims = [/simply move you/i, /simplement passer/i, /passez simplement/i, /starts? (the day|when) you go live/i, /begins once the site is live/i,
    /plan simply starts/i, /démarre (simplement )?(à|le jour de) la mise en ligne/i, /Une fois en ligne, votre abonnement/i, /Once you're live, your monthly plan/i,
    /never charged for work you haven/i, /jamais facturé pour un travail/i, /, à la mise en ligne`/];
  const bad = [];
  for (const f of pages) {
    const code = src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const c of claims) if (c.test(code)) bad.push(`${f}: ${c}`);
  }
  assert.deepEqual(bad, []);
});

test("the founding waiver is only offered when a checkout can apply it", () => {
  const open = /export const FOUNDING_PLACES_OPEN = true;/.test(src("src/components/FoundingOffer.tsx"));
  const codes = /allow_promotion_codes: true/.test(src("src/app/api/checkout-subscription/route.ts"));
  assert.ok(!open || codes, "FOUNDING_PLACES_OPEN needs promotion codes on /api/checkout-subscription");
});

/* ── 6. the portal's domain panel agrees with CGV 7 bis ────────────────── */

test("the domain panel states both cases of CGV 7 bis, in both languages", () => {
  const panel = src("src/components/portal/DomainPanel.tsx");
  const copy = panel.replace(/\/\*[\s\S]*?\*\//g, "");
  // The old line was true only for a domain she already owned.
  assert.ok(!/Nothing to transfer/i.test(copy) && !/Rien à transférer/i.test(copy), "leaving can mean a transfer");
  assert.ok(!/"In your name, at your own registrar/.test(copy), "not every domain is at her own registrar");
  // Case 1: her own domain stays hers, at her registrar.
  assert.ok(/A domain you already owned stays in your name, at your own registrar/.test(copy));
  assert.ok(/Un domaine que vous possédiez déjà reste à votre nom, chez votre propre bureau d'enregistrement/.test(copy));
  // Case 2: one Servolia registered is in Servolia's name, on her behalf, transferred on request.
  assert.ok(/held in Servolia's name on your behalf/.test(copy) && /détenu au nom de Servolia pour votre compte/.test(copy));
  assert.ok(/within 5 business days of your written request/.test(copy) && /dans les 5 jours ouvrés suivant votre demande écrite/.test(copy));
  assert.ok(/\{t\.cases\}/.test(panel), "the two cases are rendered");
  // …which is what the CGV says, EN and FR.
  assert.ok(src("src/app/legal/cgv/page.tsx").includes("Servolia registers it in its own name, on the client&apos;s behalf"));
  assert.ok(src("src/app/fr/legal/cgv/page.tsx").includes("elle l&apos;enregistre à son nom, pour le compte du client"));
  assert.ok(src("src/app/legal/cgv/page.tsx").includes("within 5 business days of a written request"));
  assert.ok(src("src/app/fr/legal/cgv/page.tsx").includes("dans les 5 jours ouvrés suivant une demande écrite"));
});

/* ── 4. no uptime monitor is promised for a client's site ──────────────── */

test("nothing tells a hosting client they hear about downtime from us first", () => {
  // The only monitor checks servolia.com. Until one watches client sites,
  // no product line, explanation, value line or term may promise it.
  const workflow = src(".github/workflows/uptime.yml");
  assert.ok(workflow.includes("https://servolia.com/"), "the monitor that exists");
  const claims = [/hear it from us/i, /hear about a\s+problem from us/i, /you hear about it from us/i, /uptime watched/i, /we watch uptime/i,
    /apprenez par nous/i, /disponibilité surveillée/i, /c'est nous qui vous prévenons/i];
  const lines = Object.values(CLIENT_PRODUCTS).flatMap((p) => [
    ...p.includes, ...p.fr.includes, ...Object.entries(p.explain ?? {}).flat(), ...Object.entries(p.fr.explain ?? {}).flat(), p.blurb, p.fr.blurb,
  ]);
  const files = ["src/lib/serviceValue.ts", "src/app/hosting/terms/page.tsx", "src/app/hosting/page.tsx", "src/components/PlanChooser.tsx"]
    .map((f) => [f, src(f).replace(/\/\*[\s\S]*?\*\//g, "")]);
  const bad = [];
  for (const c of claims) {
    for (const l of lines) if (c.test(l)) bad.push(`product copy: ${l}`);
    for (const [f, s] of files) if (c.test(s)) bad.push(`${f}: ${c}`);
  }
  assert.deepEqual(bad, []);
  // Every includes line still has its explanation (the key moved with it).
  for (const k of ["hosting_lite", "hosting", "hosting_business"]) {
    const p = CLIENT_PRODUCTS[k];
    for (const l of p.includes) assert.ok(p.explain[l], `${k}: "${l}" has an explanation`);
    for (const l of p.fr.includes) assert.ok(p.fr.explain[l], `${k} fr: "${l}" has an explanation`);
  }
});

/* ── 7. the migration reminder stays until the migration is recorded ───── */

test("a paid hosting client stays on /admin/today until a repo or Vercel project is recorded", () => {
  const row = (o) => ({ plan: "hosting", status: "active", site_url: null, repo: null, vercel_project: null, notes: null, ...o });
  assert.deepEqual(hostingSetupOwed(row()), { handover: false, submitted: null }, "paid, nothing yet");
  // The two things that used to clear it: the handover form, a domain bought with the plan.
  const handover = "Platform: Wix\nRegistrar: OVH\nSubmitted 2026-09-24";
  assert.deepEqual(hostingSetupOwed(row({ site_url: "https://acme.com", notes: handover })), { handover: true, submitted: "2026-09-24" });
  assert.deepEqual(hostingSetupOwed(row({ site_url: "https://acme.com" })), { handover: false, submitted: null }, "a domain purchase alone is not a migration");
  // What clears it: the setup recorded by the founder.
  assert.equal(hostingSetupOwed(row({ site_url: "https://acme.com", notes: handover, repo: "AmraniHub/acme" })), null);
  assert.equal(hostingSetupOwed(row({ vercel_project: "acme" })), null);
  // Not a hosting tier, or not active: not this row's business.
  assert.equal(hostingSetupOwed(row({ plan: "chatbot" })), null);
  assert.equal(hostingSetupOwed(row({ plan: "seo_multilingual" })), null);
  assert.equal(hostingSetupOwed(row({ status: "past_due" })), null);
  assert.deepEqual(hostingSetupOwed(row({ plan: "HOSTING_BUSINESS" })), { handover: false, submitted: null });

  const today = src("src/lib/today.ts");
  assert.ok(today.includes("hostingSetupOwed(h)"), "today.ts asks hostingSetupOwed");
  assert.ok(!/needs-setup[^\n]*!h\.site_url|!h\.site_url && !h\.repo/.test(today), "site_url no longer clears the reminder");
  assert.ok(/select\("id, business, email, plan, status, notes, site_url, repo, vercel_project,/.test(today), "vercel_project is read");
});
