/**
 * The things a hosting client can do for themselves.
 *
 * The password marker matters more than it looks: it shares one `notes` column
 * with the trial markers, the fulfilment marker and the invite marker. A
 * writer that is careless with the lines it does not own ends a trial, or
 * re-sends an invitation, as a side effect of somebody changing a password.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readStoredHash, writeStoredHash, hashPassword, hashMatches } from "../src/lib/siteEditorPassword.ts";
import { passwordProblem } from "../src/lib/siteEditorPassword.ts";

const HASH = "a".repeat(64);
const OTHER = "b".repeat(64);

test("a stored hash survives a round trip", () => {
  const notes = writeStoredHash(null, HASH, "2026-09-18T00:00:00.000Z");
  assert.equal(readStoredHash(notes), HASH);
  assert.match(notes, /set: 2026-09-18/);
});

test("changing the password replaces the old hash, never appends a second", () => {
  let notes = writeStoredHash(null, HASH, "2026-09-18T00:00:00.000Z");
  notes = writeStoredHash(notes, OTHER, "2026-09-19T00:00:00.000Z");
  assert.equal(readStoredHash(notes), OTHER);
  assert.equal(notes.split("\n").filter((l) => l.startsWith("servolia-editor-pw:")).length, 1);
});

test("the other markers in that column are left exactly alone", () => {
  const before = [
    "servolia-fulfilled: 2026-09-11",
    "servolia-trial: until: 2026-09-25 | started: 2026-09-18",
    "servolia-invited: 2026-09-17",
  ].join("\n");
  const after = writeStoredHash(before, HASH, "2026-09-18T00:00:00.000Z");
  for (const line of before.split("\n")) {
    assert.ok(after.includes(line), `a password change dropped: ${line}`);
  }
  assert.equal(readStoredHash(after), HASH);
});

test("no marker reads as no password, not as an empty one", () => {
  assert.equal(readStoredHash(null), null);
  assert.equal(readStoredHash(""), null);
  assert.equal(readStoredHash("servolia-fulfilled: 2026-09-11"), null);
  // A truncated or malformed hash must not be accepted as a real one.
  assert.equal(readStoredHash("servolia-editor-pw: hash: abc | set: x"), null);
});

test("the hash is per site, so one client's password is not another's", () => {
  assert.notEqual(hashPassword("goodscochina", "same-password"), hashPassword("excellenceagency", "same-password"));
  const h = hashPassword("goodscochina", "correct horse battery staple");
  assert.ok(hashMatches("goodscochina", "correct horse battery staple", h));
  assert.ok(!hashMatches("excellenceagency", "correct horse battery staple", h));
  assert.ok(!hashMatches("goodscochina", "wrong", h));
  assert.ok(!hashMatches("goodscochina", "", h), "an empty password never matches");
  assert.ok(!hashMatches("goodscochina", "x", null), "no stored hash never matches");
  assert.ok(!hashMatches("goodscochina", "x", "short"), "a length mismatch is false, not a throw");
});

test("a password guarding a live business site has a floor", () => {
  assert.match(passwordProblem("short"), /10 characters/);
  assert.match(passwordProblem(""), /10 characters/);
  assert.match(passwordProblem("password12"), /guessing list/);
  assert.match(passwordProblem("aaaaaaaaaaaa"), /same character/);
  assert.equal(passwordProblem("the blue kettle in yiwu"), null);
  assert.equal(passwordProblem("k7m2-pq4x-r9tf"), null);
  assert.match(passwordProblem("x".repeat(201)), /longer than/);
});
