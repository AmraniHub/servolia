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
  readDraftEmailed, writeDraftEmailed, draftMissing, keepMarkers, PREVIEW_COOKIE, PREVIEW_TTL_DAYS,
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
  const lib = src("src/lib/intakeBuild.ts");
  assert.ok(lib.includes("notifyDraftReady("), "the intake after() must call notifyDraftReady");
  assert.ok(lib.includes("generateSiteForBuild(buildId)"), "…after generating the draft");
  // Both doors start the build through it: the form, and the webhook when the form beat the payment.
  assert.ok(src("src/app/api/contact/route.ts").includes("startBuildFromIntake("), "the intake form starts the build");
  assert.ok(src("src/app/api/webhooks/stripe/route.ts").includes("startBuildFromIntake("), "the webhook starts it when the intake came first");
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

/* ── what the adversarial review found, kept from coming back ─────────── */

test("the build is the identity: a renamed slug keeps its link, a same-slug later build does not inherit it", async () => {
  const t = await mintPreviewToken("cabinet-martin", "b-OLD");
  // Regenerate renamed the slug; the row kept its build. The old link still opens it.
  assert.equal(await previewGrantsView({ slug: "dentiste-martin", status: "draft", buildId: "b-OLD" }, t), true);
  // A later build that lands on the original slug is a different client's draft.
  assert.equal(await previewGrantsView({ slug: "cabinet-martin", status: "draft", buildId: "b-NEW" }, t), false);
});

test("only a draft is ever granted — not any other non-published status a future change might add", async () => {
  const t = await mintPreviewToken("x", "b");
  for (const status of ["archived", "suspended", "paused", "deleted", "published", undefined]) {
    assert.equal(await previewGrantsView({ slug: "x", status }, t), false, `status ${status} must not grant`);
  }
  assert.equal(await previewGrantsView({ slug: "x", status: "draft" }, t), true);
});

test("keepMarkers carries every servolia-* line through a wholesale notes rewrite", () => {
  const old = "Platform: Vercel\nservolia-draft-emailed: at: 2026-09-20 | to: a@b.c\nservolia-fulfilled: cs_1 | at: x | plan: y";
  const out = keepMarkers(old, "RESTORED from GitHub archive 2026-10-01");
  assert.ok(out.startsWith("RESTORED from GitHub archive 2026-10-01"), "the new summary leads");
  assert.ok(!out.includes("Platform: Vercel"), "the old summary is replaced");
  assert.ok(out.includes("servolia-draft-emailed:"), "the draft marker survives");
  assert.ok(out.includes("servolia-fulfilled:"), "the fulfilment marker survives");
  assert.equal(keepMarkers(null, "fresh"), "fresh");
  // A marker already present in the fresh text wins over the old one.
  const dup = keepMarkers("servolia-draft-emailed: at: OLD | to: a@b.c", "note\nservolia-draft-emailed: at: NEW | to: a@b.c");
  assert.equal(dup.split("\n").filter((l) => l.startsWith("servolia-draft-emailed:")).length, 1);
  assert.ok(dup.includes("at: NEW"));
});

test("the two admin routes that rewrite client_sites.notes go through keepMarkers", () => {
  assert.ok(src("src/lib/siteArchive.ts").includes("keepMarkers("), "restoreSite must preserve markers");
  assert.ok(src("src/app/api/assistant-brief/route.ts").includes("keepMarkers("), "the assistant brief must preserve markers");
});

test("the intake's Telegram follow-up is plain text and has a budget the Claude call fits in", () => {
  const lib = src("src/lib/intakeBuild.ts");
  const start = lib.indexOf("Draft site ready");
  const call = lib.indexOf("sendTelegramMessage(", start);
  const args = lib.slice(call, lib.indexOf(")", call));
  assert.ok(/plain:\s*true/.test(args), "one underscore in the client's address must not kill the alert");
  // Both routes that run it after their response need the budget for the Claude call.
  for (const f of ["src/app/api/contact/route.ts", "src/app/api/webhooks/stripe/route.ts"]) {
    const m = src(f).match(/export const maxDuration = (\d+)/);
    assert.ok(m && Number(m[1]) >= 120, `${f}: maxDuration must be >= 120, is ${m && m[1]}`);
  }
});

test("an invalid link lands on a page that says so, not on the sales homepage or a 404", () => {
  const route = src("src/app/api/draft-preview/route.ts");
  assert.ok(route.includes("/draft-expired"), "the route redirects there");
  assert.ok(!route.includes("draft=expired"), "…and not to a homepage flag nothing renders");
  const page = src("src/app/draft-expired/page.tsx");
  assert.ok(/hello@servolia\.com/.test(page), "the page names the way to get a new link");
  assert.ok(/n'est plus valable/.test(page) && /no longer valid/.test(page), "both languages, since the token carries none");
  assert.ok(route.includes('eq("build_id", claim.buildId)'), "the current slug is looked up by build, so a rename does not strand the link");
});

test("a draft never fires the client's own analytics", () => {
  for (const p of ["src/app/sites/[slug]/page.tsx", "src/app/sites/[slug]/[page]/page.tsx"]) {
    assert.ok(/\{!viewer && <ClientAnalytics/.test(src(p)), `${p} must render analytics only for a published visitor`);
  }
});

test("the intake's thank-you screen appears only when the server took the answers", () => {
  const form = src("src/components/OnboardingForm.tsx");
  assert.ok(/ok = res\.ok/.test(form), "the response status is read");
  assert.ok(/if \(ok\) setSubmitted\(true\);/.test(form), "success only on ok");
  assert.ok(/setFailed\(true\)/.test(form), "…and a visible failure otherwise");
  assert.ok(/role="alert"/.test(form), "the failure is announced, not just coloured");
});

test("the admin Regenerate button cannot 500 after the site is already regenerated", () => {
  const route = src("src/app/api/admin/generate-site/route.ts");
  assert.ok(/try \{\s*notified = await notifyDraftReady\(/.test(route));
  assert.ok(/try \{\s*previewUrl = await previewLinkFor\(/.test(route));
});

test("a database read that fails is never read as 'not sent yet'", () => {
  const dp = src("src/lib/draftPreview.ts");
  assert.ok(/error: buildErr/.test(dp) && /error: siteErr/.test(dp), "both reads capture their error");
  assert.ok(/reason: "db-error"/.test(dp), "…and report it instead of sending");
  assert.ok(/reason: "no-row"/.test(dp), "a missing row is not a licence to send unrecorded");
});
