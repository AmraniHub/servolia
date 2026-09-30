/**
 * A slug made twice is the same slug. A cut left a trailing hyphen, so a long
 * domain's draft was saved under one slug and looked up under another.
 *   node --import ./tests/register.mjs --test tests/slug-idempotent.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/lib/clientSites.ts";
import { slugifyHost } from "../src/lib/assistant.ts";

test("slugify is idempotent at the 48-character cut", () => {
  const s = slugify("selarl-blomart-avenir-odontologique.chirurgiens-dentistes.fr");
  assert.equal(s, "selarl-blomart-avenir-odontologique-chirurgiens");
  assert.equal(slugify(s), s);
  for (const x of ["a".repeat(47) + "-b", "cabinet dentaire du docteur jean-pierre martin de lyon"]) {
    assert.equal(slugify(slugify(x)), slugify(x));
    assert.ok(!slugify(x).endsWith("-"));
  }
});

test("slugifyHost is idempotent too", () => {
  const s = slugifyHost("selarl-blomart-avenir-odontologique.chirurgiens-dentistes.fr");
  assert.ok(!s.endsWith("-"));
  assert.equal(slugifyHost(s), s);
});
