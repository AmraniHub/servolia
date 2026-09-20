/**
 * The draft reaches the client — the pure parts.
 *
 * The token grants exactly one thing (viewing one unpublished draft), the
 * once-per-site marker round-trips, the missing-facts list names only what
 * is absent, the email says the true thing, and the source guards hold: the
 * intake path calls the notifier, and no receipt or thank-you screen still
 * promises a Loom in 48 hours that nothing sends.
 *
 *   node --import ./tests/register.mjs --test tests/draft-preview.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

process.env.UPGRADE_TOKEN_SECRET = "test-only-secret-never-in-production";

const {
  mintPreviewToken, readPreviewToken, previewLinkFor, previewGrantsView,
  readDraftEmailed, writeDraftEmailed, draftMissing, PREVIEW_COOKIE, PREVIEW_TTL_DAYS,
} = await import("../src/lib/draftPreview.ts");
const { draftReadyEmail } = await import("../src/lib/email.ts");
const { mintUpgradeToken } = await import("../src/lib/upgrade.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");

/* ── the token ─────────────────────────────────────────────────────────── */

test("a preview token round-trips its slug and build", async () => {
  const t = await mintPreviewToken("clinique-atlas", "b-123");
  assert.deepEqual(await readPreviewToken(t), { slug: "clinique-atlas", buildId: "b-123" });
});

test("a tampered or empty token reads as null, never throws", async () => {
  const t = await mintPreviewToken("clinique-atlas", "b-123");
  assert.equal(await readPreviewToken(t.slice(0, -4) + "AAAA"), null);
  assert.equal(await readPreviewToken(""), null);
  assert.equal(await readPreviewToken(null), null);
});

test("a token minted for another purpose is refused even though it verifies", async () => {
  // The hosting-upgrade token shares the secret. Sharing a secret must not
  // mean sharing a grant: an upgrade link in one inbox is not a draft key.
  const upgrade = await mintUpgradeToken("sub_123");
  assert.equal(await readPreviewToken(upgrade), null);
});

test("the emailed link lands on the cookie route, not the page", async () => {
  const url = await previewLinkFor("clinique-atlas", "b-123", "https://servolia.com");
  assert.match(url, /^https:\/\/servolia\.com\/api\/draft-preview\?t=/);
  assert.equal(PREVIEW_COOKIE, "sv_draft_preview");
  assert.equal(PREVIEW_TTL_DAYS, 90);
});

/* ── the grant ─────────────────────────────────────────────────────────── */

test("a valid token shows its own draft and nothing else", async () => {
  const t = await mintPreviewToken("clinique-atlas", "b-123");
  assert.equal(await previewGrantsView({ slug: "clinique-atlas", status: "draft" }, t), true);
  assert.equal(await previewGrantsView({ slug: "another-clinic", status: "draft" }, t), false, "a token for A must not open B");
  assert.equal(await previewGrantsView({ slug: "clinique-atlas", status: "draft" }, null), false);
  assert.equal(await previewGrantsView({ slug: "clinique-atlas", status: "draft" }, "garbage"), false);
});

test("a published site has nothing to grant", async () => {
  const t = await mintPreviewToken("clinique-atlas", "b-123");
  assert.equal(await previewGrantsView({ slug: "clinique-atlas", status: "published" }, t), false);
  assert.equal(await previewGrantsView({ slug: "clinique-atlas" }, t), false);
});

/* ── the marker ────────────────────────────────────────────────────────── */

test("the once-per-site marker round-trips and survives other notes", () => {
  const notes = "Platform: Vercel\nservolia-fulfilled: cs_1 | at: 2026-09-16 | plan: business";
  const rec = { at: "2026-09-20T10:00:00.000Z", to: "owner@example.com" };
  const written = writeDraftEmailed(notes, rec);
  assert.deepEqual(readDraftEmailed(written), rec);
  assert.ok(written.includes("Platform: Vercel"), "other lines kept");
  assert.ok(written.includes("servolia-fulfilled:"), "the fulfilment marker kept");
  assert.equal(readDraftEmailed(notes), null, "absent before it is written");
  assert.equal(readDraftEmailed(null), null);
});

test("writing the marker twice keeps one line", () => {
  const a = writeDraftEmailed(null, { at: "2026-09-20T10:00:00.000Z", to: "a@example.com" });
  const b = writeDraftEmailed(a, { at: "2026-09-21T10:00:00.000Z", to: "a@example.com" });
  assert.equal(b.split("\n").filter((l) => l.startsWith("servolia-draft-emailed:")).length, 1);
  assert.equal(readDraftEmailed(b).at, "2026-09-21T10:00:00.000Z");
});

/* ── what is missing ───────────────────────────────────────────────────── */

test("missing names only what the intake did not give, in the client's language", () => {
  const full = { language: "en", phone: "+212 5", hours: "9–6", services: [{ name: "X" }], city: "Tangier" };
  assert.deepEqual(draftMissing(full), []);
  const bare = { language: "en", services: [] };
  assert.deepEqual(draftMissing(bare), [
    "a phone number or WhatsApp", "your opening hours", "the list of your services", "your city",
  ]);
  assert.deepEqual(draftMissing({ language: "fr", whatsapp: "2126", hours: "9h–18h", services: [{ name: "X" }] }), ["votre ville"]);
});

/* ── the email ─────────────────────────────────────────────────────────── */

test("the draft-ready email carries the link, the missing list, and the honest wording note", () => {
  const url = "https://servolia.com/api/draft-preview?t=abc";
  const en = draftReadyEmail({ businessName: "Atlas Dental", previewUrl: url, missing: ["your opening hours"], aiWritten: false, lang: "en" });
  assert.ok(en.subject.includes("Atlas Dental"));
  assert.ok(en.html.includes(url), "the link is in the email");
  assert.ok(en.html.includes("your opening hours"), "what is still needed is named");
  assert.ok(/first pass/i.test(en.html), "mechanical copy is called a first pass, not finished");
  assert.ok(!/Loom/.test(en.html), "no Loom promised here either");

  const done = draftReadyEmail({ businessName: "Atlas Dental", previewUrl: url, missing: [], aiWritten: true, lang: "en" });
  assert.ok(!/still need/i.test(done.html), "nothing missing → no 'still need' block");
  assert.ok(!/first pass/i.test(done.html));

  const fr = draftReadyEmail({ businessName: "Atlas Dental", previewUrl: url, missing: ["votre ville"], aiWritten: true, lang: "fr" });
  assert.ok(/brouillon/i.test(fr.subject) || /brouillon/i.test(fr.html));
  assert.ok(fr.html.includes("votre ville"));
});

/* ── source guards ─────────────────────────────────────────────────────── */

test("the intake path sends the email by the same code that made the draft", () => {
  const route = src("src/app/api/contact/route.ts");
  assert.ok(route.includes("notifyDraftReady("), "the intake after() must call notifyDraftReady");
  assert.ok(route.includes("generateSiteForBuild(buildId)"), "…after generating the draft");
});

test("the admin Regenerate button sends it too — one code path, no second implementation", () => {
  const route = src("src/app/api/admin/generate-site/route.ts");
  assert.ok(route.includes("notifyDraftReady("), "generate-site must call notifyDraftReady");
});

test("every /sites page honours the preview cookie, so the client can click around their draft", () => {
  // The gate reads the cookie itself when no token is passed, so a page that
  // calls isHiddenDraft(c) with nothing else is correct — what must be true
  // is that every page goes through the gate, and that the gate reads it.
  const gate = src("src/lib/draftGate.tsx");
  assert.ok(gate.includes("PREVIEW_COOKIE"), "the gate reads the preview cookie when no token is passed");
  assert.ok(gate.includes("previewGrantsView("), "…and checks it against the slug");
  for (const p of ["src/app/sites/[slug]/page.tsx", "src/app/sites/[slug]/[page]/page.tsx", "src/app/sites/[slug]/confidentialite/page.tsx"]) {
    assert.ok(/draftAccess\(|isHiddenDraft\(/.test(src(p)), `${p} gates on the draft`);
  }
  const route = src("src/app/api/draft-preview/route.ts");
  assert.ok(route.includes('path: "/sites"'), "the cookie is scoped to /sites, nowhere else");
  assert.ok(route.includes("httpOnly: true"), "…and unreadable to page scripts");
});

test("no receipt or thank-you screen still promises a Loom walkthrough in 48 hours", () => {
  // The audit confirmation (free audit → Loom in 24h) is a different product
  // and keeps its promise. The INSTALLATION receipt and the intake's
  // thank-you screen used to promise a Loom of the draft in 48h / day 3–5 —
  // now the draft itself arrives by email in minutes, and a promise no code
  // keeps is the bug class this repo keeps finding.
  const email = src("src/lib/email.ts");
  const start = email.indexOf("export const installationPaidEmail");
  const end = email.indexOf("export const", start + 10);
  const receipt = email.slice(start, end);
  assert.ok(start > 0 && !/Loom/.test(receipt), "installationPaidEmail must not promise a Loom");

  const form = src("src/components/OnboardingForm.tsx");
  assert.ok(!/Loom/.test(form), "OnboardingForm must not promise a Loom");
  assert.ok(!/48 hours|48 heures/.test(form), "…nor a 48-hour wait");
});
