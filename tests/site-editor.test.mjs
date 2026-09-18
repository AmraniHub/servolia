/**
 * The page editor's parser, which rewrites a LIVE CLIENT'S pages.
 *
 * Everything here is about one question: can a client's typing, or a marker in
 * the wrong place, produce a broken page? A bug in writeRegion() does not throw
 * an error — it commits a corrupt file to a real business's website and Vercel
 * publishes it within the minute.
 *
 *   node --import ./tests/register.mjs --test tests/site-editor.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translatedStrings, untranslatedAfterEdit, translationNote } from "../src/lib/siteEditorI18n.ts";
import {
  editorMountPaths,
  pagesWithFields,
  pageId,
  fieldId,
  readRegion, writeRegion, validate, escapeHtml, decodeEntities,
  editableSite, fieldsFor, EDITABLE_SITES, MAX_FIELD,
} from "../src/lib/siteEditor.ts";

const page = `<!doctype html>
<html><body>
  <h1 class="hero" data-edit="home.headline">Your Trusted Sourcing Partner in China</h1>
  <p data-edit="home.intro" class="lead">We help businesses source quality products.</p>
  <div data-edit="bad.container"><span>nested</span> markup</div>
  <h3 data-edit="home.s1.title">Verified Factories</h3>
  <p>Not editable at all.</p>
</body></html>`;

test("reads a region whatever order the attributes are in", () => {
  // class-then-marker, and marker-then-class — these pages were written by a
  // generator and by hand, and neither is consistent.
  assert.equal(readRegion(page, "home.headline").value, "Your Trusted Sourcing Partner in China");
  assert.equal(readRegion(page, "home.intro").value, "We help businesses source quality products.");
  assert.equal(readRegion(page, "home.s1.title").value, "Verified Factories");
});

test("a missing marker is reported, never guessed at", () => {
  assert.deepEqual(readRegion(page, "nope"), { ok: false, reason: "not-found" });
  // And a key that is a prefix of a real one must not match it.
  assert.deepEqual(readRegion(page, "home.s1"), { ok: false, reason: "not-found" });
});

test("a marker on a container full of markup is REFUSED, not half-replaced", () => {
  // This is the one that would corrupt a page: "up to the next closing tag"
  // ends inside the nested span, and the write produces broken HTML.
  assert.deepEqual(readRegion(page, "bad.container"), { ok: false, reason: "has-markup" });
  const out = writeRegion(page, "bad.container", "anything");
  assert.equal(out.changed, false, "it must refuse");
  assert.equal(out.html, page, "and leave the page byte-for-byte unchanged");
});

test("writing changes only the one region, and nothing around it", () => {
  const { html, changed } = writeRegion(page, "home.headline", "Sourcing, done properly");
  assert.equal(changed, true);
  assert.equal(readRegion(html, "home.headline").value, "Sourcing, done properly");
  // Every neighbour is untouched.
  assert.equal(readRegion(html, "home.intro").value, "We help businesses source quality products.");
  assert.equal(readRegion(html, "home.s1.title").value, "Verified Factories");
  assert.ok(html.includes("<p>Not editable at all.</p>"));
  assert.ok(html.startsWith("<!doctype html>") && html.trimEnd().endsWith("</html>"));
  // The element and its class survive — only the text between the tags moved.
  assert.match(html, /<h1 class="hero" data-edit="home\.headline">Sourcing, done properly<\/h1>/);
});

test("a client cannot inject markup, however hard they try", () => {
  for (const nasty of [
    '<script>alert(1)</script>',
    '</h1><script>alert(1)</script><h1>',
    'Sourcing & "quality" <b>products</b>',
    "it's <3",
  ]) {
    const { html } = writeRegion(page, "home.headline", nasty);
    const after = html.slice(html.indexOf('data-edit="home.headline"'));
    const inner = after.slice(after.indexOf(">") + 1, after.indexOf("</h1>"));
    assert.ok(!/<[a-zA-Z/]/.test(inner), `markup survived escaping: ${inner}`);
    // It still READS BACK as exactly what they typed — escaped, not mangled.
    assert.equal(readRegion(html, "home.headline").value, nasty.trim());
    // And the document is still one <h1>, not two.
    assert.equal((html.match(/<h1/g) || []).length, 1);
  }
});

test("escaping round-trips, including the ampersand order", () => {
  // & must be escaped FIRST and decoded LAST, or "&lt;" becomes "<".
  for (const s of ["A & B", "<b>", '"quoted"', "it's", "&lt;already escaped&gt;", "5 > 3 & 2 < 4"]) {
    assert.equal(decodeEntities(escapeHtml(s)), s, `round-trip failed for ${s}`);
  }
});

test("saving the same text again is not a commit", () => {
  // Otherwise every visit to the editor rebuilds the client's site for nothing.
  const { changed } = writeRegion(page, "home.headline", "Your Trusted Sourcing Partner in China");
  assert.equal(changed, false);
  assert.equal(writeRegion(page, "home.headline", "  Your Trusted Sourcing Partner in China  ").changed, false,
    "and whitespace alone is not a change either");
});

test("validation refuses what would damage a page or a layout", () => {
  const one = { key: "k", label: "l", file: "index.html", max: 60 };
  const many = { key: "k", label: "l", file: "index.html", multiline: true, max: 240 };
  assert.equal(validate(one, "Fine"), null);
  assert.match(validate(one, ""), /cannot be empty/);
  assert.match(validate(one, "   "), /cannot be empty/);
  assert.match(validate(one, "x".repeat(61)), /Too long/);
  assert.match(validate(one, "two\nlines"), /single line/, "a headline must not become two");
  assert.equal(validate(many, "two\nlines"), null, "a paragraph may");
  assert.match(validate(one, 42), /not text/);
  assert.match(validate(one, null), /not text/);
  assert.equal(validate({ key: "k", label: "l", file: "f" }, "x".repeat(MAX_FIELD)), null);
  assert.match(validate({ key: "k", label: "l", file: "f" }, "x".repeat(MAX_FIELD + 1)), /Too long/);
});

test("the configured site points at the repo Vercel actually deploys", () => {
  const s = editableSite("goodscochina");
  assert.ok(s, "goodscochina must be editable — she is who this was built for");
  // Verified against the live Vercel project on 2026-09-18: yiwugoodsco is
  // linked to this repo, production branch main, root directory web.
  assert.equal(s.repo, "AmraniHub/yiwugoodsco-com");
  assert.equal(s.branch, "main");
  assert.equal(s.siteRoot, "web");
  assert.equal(editableSite("GOODSCOCHINA")?.ref, "goodscochina", "the ref is case-insensitive");
  assert.equal(editableSite("nobody"), undefined);
  assert.equal(editableSite(null), undefined);
});

test("every field belongs to a page the client can actually pick", () => {
  for (const site of Object.values(EDITABLE_SITES)) {
    const tabs = new Set(site.pages.map(pageId));
    for (const f of site.fields) {
      const tab = f.page ?? f.file;
      assert.ok(tabs.has(tab), `${site.ref}: field ${f.key} is on ${tab}, which is not a tab`);
      assert.ok(f.label && f.label.length < 60, `${site.ref}: ${f.key} needs a short human label`);
    }
    /* The id, not the key. A dictionary key exists once per language, so the
       bare key repeats by design and only the id must be unique — if it were
       not, a French edit would overwrite the Arabic one in the same save. */
    const ids = site.fields.map(fieldId);
    assert.equal(new Set(ids).size, ids.length, `${site.ref}: two boxes submit under the same id`);
    assert.ok(fieldsFor(site, pageId(site.pages[0])).length > 0, `${site.ref}: the first page has no fields`);
  }
});

test("a bilingual site gets the same boxes in both languages", () => {
  const site = editableSite("excellenceagency");
  assert.ok(site, "excellenceagency must be editable");
  const byLang = new Map();
  for (const f of site.fields) {
    assert.ok(f.lang, `${f.key}: their site paints from a dictionary, so every field names a language`);
    byLang.set(f.lang, [...(byLang.get(f.lang) ?? []), f.key]);
  }
  const [fr, ar] = [byLang.get("fr") ?? [], byLang.get("ar") ?? []];
  assert.ok(fr.length > 0);
  // A key in one language and not the other is a box that silently never saves.
  assert.deepEqual([...fr].sort(), [...ar].sort());
  for (const f of site.fields) {
    assert.ok(!f.key.endsWith(".html"), `${f.key}: those values hold markup and are not a client's to type`);
  }
  assert.equal(site.uiLang, "fr", "they work in French; an English tool undoes the point");
});

test("the editor wears the client's colours, never Servolia's", () => {
  // The screen lives at the client's own /admin. Servolia green there would
  // say, on the one page that should feel like theirs, whose software it is.
  const HOUSE = ["#36671E", "#295115", "#FAFAF7", "#E2E6DD", "#EEF5EA", "#E8E6E0"];
  for (const site of Object.values(EDITABLE_SITES)) {
    for (const [name, value] of [["accent", site.accent], ["surface", site.surface], ["line", site.line]]) {
      assert.ok(value, `${site.ref}: ${name} is missing — it would fall back to nothing`);
      assert.match(value, /^#[0-9A-Fa-f]{6}$/, `${site.ref}: ${name} must be a six-digit hex colour`);
      assert.ok(
        !HOUSE.includes(value.toUpperCase()),
        `${site.ref}: ${name} is ${value}, a Servolia house colour — give the client their own`,
      );
    }
    assert.notEqual(site.accent.toUpperCase(), site.surface.toUpperCase(), `${site.ref}: white text on the accent needs the two to differ`);
  }
});

test("goodscochina gets the navy her own site leads with", () => {
  assert.equal(editableSite("goodscochina")?.accent, "#111C74");
});

/* ── the other language ──────────────────────────────────────────────────── */

const DICT = `
  var AR = {
    "GoodsCoChina | China Sourcing Partner":
      "GoodsCoChina | Arabic title",
    "Verified Factories": "AR verified",
    "We audit and verify trusted factories.": "AR audit",
    "A \\"quoted\\" line": "AR quoted",
  };
`;

test("the dictionary is read without executing a client's file", () => {
  const keys = translatedStrings(DICT);
  assert.ok(keys.has("Verified Factories"));
  // The wrapped-value shape her file actually uses.
  assert.ok(keys.has("GoodsCoChina | China Sourcing Partner"), "a key whose value is on the next line");
  assert.ok(keys.has('A "quoted" line'), "escapes are unescaped, so the key matches the page text");
  assert.equal(keys.size, 4);
});

test("a reworded line is reported as losing its translation", () => {
  assert.deepEqual(untranslatedAfterEdit(DICT, ["Verified Factories"]), [], "unchanged text keeps its Arabic");
  assert.deepEqual(untranslatedAfterEdit(DICT, ["Audited Factories"]), ["Audited Factories"]);
  // Retyped with different spacing is the same line to a reader.
  assert.deepEqual(untranslatedAfterEdit(DICT, ["Verified   Factories"]), []);
  assert.deepEqual(untranslatedAfterEdit(DICT, ["  Verified Factories  "]), []);
});

test("the note only appears when there is something to say", () => {
  assert.equal(translationNote(0, "Arabic"), null, "an every-time warning is a warning nobody reads");
  assert.match(translationNote(1, "Arabic"), /One line .* Arabic/);
  assert.match(translationNote(3, "Arabic"), /^3 lines/);
});

test("a bilingual site says which file holds its other language", () => {
  const s = editableSite("goodscochina");
  assert.equal(s.translations?.file, "js/i18n.js");
  assert.equal(s.translations?.language, "Arabic");
});

test("the chrome gate follows where the editor is mounted, not our own path", () => {
  /* The bug this pins: the editor is served at goodscochina.com/admin by a
     rewrite, so the browser's path is "/admin" and SiteChrome's old check for
     "/client-editor" did not match. Servolia's cookie banner came back over
     her Save button and our tracker logged her editing as our traffic. */
  const paths = editorMountPaths();
  assert.ok(paths.includes("/admin"), `expected /admin among ${JSON.stringify(paths)}`);
  for (const site of Object.values(EDITABLE_SITES)) {
    if (!site.adminUrl) continue;
    const p = new URL(site.adminUrl).pathname;
    assert.ok(paths.includes(p), `${site.ref} is mounted at ${p} and the gate does not cover it`);
    assert.ok(site.adminUrl.startsWith("https://"), `${site.ref}: the editor takes a password, so it is https or nothing`);
    assert.ok(!site.adminUrl.includes("servolia"), `${site.ref}: the client's editor must live on the client's own domain`);
  }
});

test("a page with nothing to edit is not offered as a tab", () => {
  const site = editableSite("goodscochina");
  const offered = pagesWithFields(site);
  assert.ok(offered.length >= 1);
  for (const p of offered) assert.ok(fieldsFor(site, p.file).length > 0, `${p.file} has no fields`);
  // All three of her pages carry markers now, so all three are offered.
  assert.deepEqual(offered.map((p) => p.file), ["index.html", "sourcing.html", "contact.html"]);
  // A page added to `pages` without fields must drop straight back out.
  const halfDone = { ...site, pages: [...site.pages, { file: "about.html", label: "About" }] };
  assert.ok(!pagesWithFields(halfDone).some((p) => p.file === "about.html"));
});

test("the editor page's own title does not carry our name", () => {
  /* The brand leaked here and nowhere else: the root layout's template turned
     "Edit your website" into "Edit your website | Servolia", so a client's
     browser tab on their own /admin said whose software it was. Invisible to
     a check that reads the body, because a title is not in the body. */
  const src = readFileSync(new URL("../src/app/client-editor/[ref]/page.tsx", import.meta.url), "utf8");
  assert.match(src, /title:\s*\{\s*absolute:/, "the title must be absolute or the layout template applies");
});
