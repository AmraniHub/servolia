/**
 * C3 — her "go" is a button (src/app/sites/[slug]/go/route.ts,
 * src/lib/publishSite.ts, src/components/DraftApproval.tsx).
 *
 *   node --import ./tests/register.mjs --test tests/draft-go.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("only the holder of her preview link can say go, and only for her own draft", () => {
  const r = code("src/app/sites/[slug]/go/route.ts");
  const guard = r.indexOf("previewGrantsView(config, token)");
  assert.ok(guard > 0 && guard < r.indexOf("publishSite("), "the preview token is checked before anything is published");
  assert.ok(r.includes("(await cookies()).get(PREVIEW_COOKIE)"), "the cookie her emailed link set is accepted");
  assert.ok(!r.includes("isAdminAuthed"), "the founder publishes from /admin/sites, not from her button");
  assert.ok(r.includes("config.assistantOnly || config.isDemo"), "no demo, no assistant-only config");
  assert.ok(r.includes("tooMany(slug)"), "rate-limited");
});

test("one publish function for both hands, published once and announced once", () => {
  const lib = code("src/lib/publishSite.ts");
  assert.ok(lib.includes('.neq("status", "published").select("id")'), "the flip is conditional: two clicks publish once");
  assert.ok(lib.includes('if (error) return { ok: false, reason: "write-failed" }'), "a failed write is never passed off as a launch");
  assert.ok(lib.includes("goLiveEmailed = await sendEmail("), "the email's real result is reported");
  const admin = code("src/app/api/admin/set-site-status/route.ts");
  assert.ok(admin.includes("publishSite(slug, { by: \"admin\" })"), "the founder's button uses the same function");
  assert.ok(code("src/app/sites/[slug]/go/route.ts").includes('publishSite(config.slug, { by: "client", markBuildLive: true })'), "her go also marks the build live");
});

test("her draft offers the two answers, and the ribbon no longer promises a person will read her email", () => {
  const gate = src("src/lib/draftGate.tsx");
  assert.ok(gate.includes("<DraftApproval slug={slug}"), "the buttons sit in the ribbon");
  assert.ok(!gate.includes("nous le mettons en ligne quand vous le dites"), "the old promise is gone");
  const ui = src("src/components/DraftApproval.tsx");
  assert.ok(ui.includes("window.confirm("), "go asks once before publishing");
  for (const f of ["src/app/sites/[slug]/page.tsx", "src/app/sites/[slug]/[page]/page.tsx", "src/app/sites/[slug]/confidentialite/page.tsx"]) {
    assert.ok(src(f).includes("slug={"), `${f} passes the slug to the ribbon`);
  }
});

test("a change request reaches the founder, and a new draft answers it", () => {
  const r = code("src/app/sites/[slug]/go/route.ts");
  assert.ok(r.includes("CHANGE requested on her draft"), "Telegram");
  assert.ok(src("src/lib/today.ts").includes('kind: "draft-change"'), "…and /admin/today");
  assert.ok(src("src/lib/generateSite.ts").includes('!l.startsWith("servolia-change-request:")'), "regenerating clears it");
});
