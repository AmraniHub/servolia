/**
 * "Hébergement, domaine et email pro inclus" was on every plan and nothing
 * delivered or tracked the domain or the mailbox. The words now say exactly
 * what is done, and src/lib/owedToPractice.ts keeps /admin/today on it until
 * her domain answers and publishes MX records.
 *
 *   node --import ./tests/register.mjs --test tests/owed-to-practice.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { whatIsOwed, mailDomainFor, mailState } from "../src/lib/owedToPractice.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?)$/.test(f)) out.push(p);
  }
  return out;
}

const site = (config, status = "published") => ({ slug: "cabinet-x", status, config });

test("a paying practice with no domain of her own is owed one", () => {
  assert.deepEqual(whatIsOwed(site({ businessName: "X" })), { kind: "domain-owed" });
  assert.equal(whatIsOwed(site({ businessName: "X" }, "draft")), null, "a draft is the delivery rows' business");
  assert.equal(whatIsOwed(site({ assistantOnly: true })), null, "a receptionist-only client came with her own site and mail");
  assert.equal(whatIsOwed(site({ isDemo: true })), null);
});

test("her domain attached but not answering is already the domain-waiting row", () => {
  assert.equal(whatIsOwed(site({ customDomain: "cabinet.fr", domainAttachedAt: "2026-09-01" })), null);
  assert.equal(mailDomainFor(site({ customDomain: "cabinet.fr" })), null, "no MX lookup before the domain is live");
});

test("once her domain answers, the mailbox is owed until MX records exist", () => {
  const live = site({ customDomain: "www.Cabinet.fr", domainLiveAt: "2026-09-20" });
  assert.equal(mailDomainFor(live), "cabinet.fr");
  assert.deepEqual(whatIsOwed(live, { state: "none" }), { kind: "mailbox-owed", domain: "cabinet.fr" });
  assert.equal(whatIsOwed(live, { state: "ready", hosts: ["mx.zoho.eu"] }), null, "delivered — or she already had email there");
  assert.deepEqual(whatIsOwed(live, { state: "unknown" }), { kind: "mailbox-unchecked", domain: "cabinet.fr" }, "a failed lookup is never reported as missing email");
  assert.deepEqual(whatIsOwed(live), { kind: "mailbox-unchecked", domain: "cabinet.fr" });
});

test("a malformed domain is unknown, not 'no email'", async () => {
  assert.deepEqual(await mailState("not a domain"), { state: "unknown" });
});

test("/admin/today lists what is owed, from the paying clients", () => {
  const t = src("src/lib/today.ts");
  assert.ok(t.includes('select("id, business, email, plan, status, payment_status, suspend_at, build_id, started_at")'));
  assert.ok(t.includes("whatIsOwed(s, mail.get(s.slug))"));
  for (const k of ['kind: "domain-owed"', 'kind: "mailbox-owed"', 'kind: "mailbox-unchecked"']) assert.ok(t.includes(k), k);
});

test("no page promises a domain or an email the terms and the code do not cover", () => {
  const vague = [
    /Hosting, domain and pro email included/i,
    /Hébergement, domaine et email pro inclus/i,
    /Hébergement, nom de domaine, SSL et email pro inclus/i,
    /Hosting, domain, SSL and pro email included/i,
    /Domain, hosting,? (?:SSL )?(?:&|and) (?:pro|professional) email/i,
    /Domaine, hébergement & email pro/i,
    /domaine et email configurés/i,
    /domain and email set up/i,
    /hébergement, domaine et email pro\./i,
    /hosting, domain and pro email\./i,
    /avec le domaine, le SSL et l'email professionnel/i,
    /along with your domain, SSL and professional email\./i,
  ];
  const files = [...walk(path.join(ROOT, "src/app")), ...walk(path.join(ROOT, "src/components")), ...walk(path.join(ROOT, "src/lib"))];
  const hits = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const re of vague) if (re.test(text)) hits.push(`${path.relative(ROOT, f)}: ${re}`);
  }
  assert.deepEqual(hits, []);
  assert.ok(src("src/app/fr/tarifs/page.tsx").includes("1 adresse email pro et votre domaine (un nouveau est offert)"));
  assert.ok(src("src/app/pricing/page.tsx").includes("1 pro email address and your domain (a new one is on us)"));
});

test("the terms say who holds a domain Servolia registers — what the code does", () => {
  // domainSales.ts registers with DOMAIN_CONTACT_JSON, Servolia's own contact.
  const fr = src("src/app/fr/legal/cgv/page.tsx");
  const en = src("src/app/legal/cgv/page.tsx");
  assert.ok(fr.includes("elle l&apos;enregistre à son nom, pour le compte du client"));
  assert.ok(en.includes("Servolia registers it in its own name, on the client&apos;s behalf"));
  assert.ok(!fr.includes("le client en est le titulaire") && !en.includes("the client is the registrant"), "no promise the registrar record contradicts");
  assert.match(src("src/app/hosting/terms/page.tsx"), /is registered\s+by Servolia on your behalf/, "the hosting terms say the same");
});

test("the terms say what the one address is", () => {
  assert.ok(src("src/app/fr/legal/cgv/page.tsx").includes("<strong>Adresse email professionnelle.</strong> L&apos;abonnement comprend une adresse email"));
  assert.ok(src("src/app/legal/cgv/page.tsx").includes("<strong>Professional email address.</strong> The plan includes one email address"));
});
