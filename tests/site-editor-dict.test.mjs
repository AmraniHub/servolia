/**
 * The writer for a site whose words live in a dictionary.
 *
 * This one rewrites a JavaScript file that a client's whole site depends on to
 * paint. A bug here does not show up as a wrong word — it shows up as a syntax
 * error, and every string on every page falls back to whatever the HTML
 * happened to contain. So the cases below are the ones that would do that:
 * quotes and backslashes in the value, a brace inside a translated sentence,
 * and a key that exists in one language and not the other.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readDictValue, writeDictValue, dictKeys } from "../src/lib/siteEditorDict.ts";

const SRC = `/* Excellence Agency — i18n */
const translations = {
  ar: {
    "nav.home": "الرئيسية",
    "about.p1": "وكالة متخصصة",
    "tricky": "قوس } داخل الجملة",
  },
  fr: {
    "nav.home": "Accueil",
    "about.p1": "Une agence spécialisée",
    "tricky": "une accolade } dans la phrase",
    "only.fr": "seulement en français",
  },
};
`;

test("both languages are read, and they do not bleed into each other", () => {
  assert.equal(readDictValue(SRC, "fr", "nav.home").value, "Accueil");
  assert.equal(readDictValue(SRC, "ar", "nav.home").value, "الرئيسية");
  assert.equal(readDictValue(SRC, "fr", "only.fr").value, "seulement en français");
  // Present in French only: asking for the Arabic must say so, not fall back.
  assert.deepEqual(readDictValue(SRC, "ar", "only.fr"), { ok: false, reason: "not-found" });
  assert.deepEqual(readDictValue(SRC, "de", "nav.home"), { ok: false, reason: "no-language" });
});

test("a closing brace inside a sentence does not end the block early", () => {
  /* The failure this prevents: a brace-counting parser stops at the `}` inside
     "قوس } داخل الجملة", decides the Arabic block ended there, and writes the
     next edit into the middle of a string. */
  assert.equal(readDictValue(SRC, "ar", "tricky").value, "قوس } داخل الجملة");
  assert.equal(readDictValue(SRC, "fr", "tricky").value, "une accolade } dans la phrase");
  assert.ok(dictKeys(SRC, "ar").includes("tricky"));
  assert.equal(dictKeys(SRC, "fr").length, 4);
});

test("a write changes one value and nothing else", () => {
  const { source, changed } = writeDictValue(SRC, "fr", "nav.home", "Page d'accueil");
  assert.ok(changed);
  assert.equal(readDictValue(source, "fr", "nav.home").value, "Page d'accueil");
  assert.equal(readDictValue(source, "ar", "nav.home").value, "الرئيسية", "the other language is untouched");
  assert.deepEqual(dictKeys(source, "fr"), dictKeys(SRC, "fr"), "no key gained or lost");
  assert.ok(source.startsWith("/* Excellence Agency"), "the rest of the file is byte-identical");
});

test("a quote or a backslash cannot break the file", () => {
  for (const nasty of ['un "guillemet" ici', "chemin C:\\\\dossier", 'fin de ligne\nsuite', "emoji 🎓 et accent é"]) {
    const { source } = writeDictValue(SRC, "fr", "about.p1", nasty);
    assert.equal(readDictValue(source, "fr", "about.p1").value, nasty.trim(), `did not round trip: ${nasty}`);
    // The proof it is still valid JavaScript: the literal parses as JSON.
    const m = /"about\.p1":\s*("(?:[^"\\]|\\.)*")/.exec(source.slice(source.indexOf("fr: {")));
    assert.ok(m, "the value is still one double-quoted literal");
    assert.equal(JSON.parse(m[1]), nasty.trim());
  }
});

test("writing the same value again is not a change", () => {
  assert.equal(writeDictValue(SRC, "fr", "nav.home", "Accueil").changed, false);
  assert.equal(writeDictValue(SRC, "fr", "nav.home", "  Accueil  ").changed, false, "whitespace only is not a change");
});

test("an unknown key leaves the file exactly as it was", () => {
  const { source, changed } = writeDictValue(SRC, "fr", "does.not.exist", "x");
  assert.equal(changed, false);
  assert.equal(source, SRC);
});
