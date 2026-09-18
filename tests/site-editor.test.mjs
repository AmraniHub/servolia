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
import {
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
    const pages = new Set(site.pages.map((p) => p.file));
    for (const f of site.fields) {
      assert.ok(pages.has(f.file), `${site.ref}: field ${f.key} is on ${f.file}, which is not in pages`);
      assert.ok(f.label && f.label.length < 60, `${site.ref}: ${f.key} needs a short human label`);
    }
    const keys = site.fields.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length, `${site.ref}: duplicate field keys`);
    assert.ok(fieldsFor(site, site.pages[0].file).length > 0, `${site.ref}: the first page has no fields`);
  }
});
