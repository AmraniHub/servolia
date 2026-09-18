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
import { refForEmail } from "../src/lib/hostingRow.ts";
import { CLIENT_REFS } from "../src/lib/clientRefs.ts";
import { CLIENT_PRODUCTS as PRODUCTS, hostingAmountCents as amountCents } from "../src/lib/hosting.ts";
import { EDITABLE_SITES as EDITABLE_SITES_FOR_LOOKUP } from "../src/lib/siteEditor.ts";
import {
  staffEnvName, staffSecretValue, staffPasswordOk, readStaffSecret,
} from "../src/lib/siteEditorPassword.ts";

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

/* ── our own temporary password ─────────────────────────────────────────── */

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-18T12:00:00.000Z");

test("our password is separate from the client's and salted the same way", () => {
  assert.equal(staffEnvName("goodscochina"), "EDITOR_STAFF_GOODSCOCHINA");
  assert.equal(staffEnvName("excellence-agency"), "EDITOR_STAFF_EXCELLENCE_AGENCY");
  const v = staffSecretValue("goodscochina", "look-around-please", new Date(NOW + DAY));
  assert.ok(staffPasswordOk("goodscochina", "look-around-please", v, NOW));
  // Salted per site: the same password must not open another client's editor.
  assert.ok(!staffPasswordOk("excellenceagency", "look-around-please", v, NOW));
  assert.ok(!staffPasswordOk("goodscochina", "wrong", v, NOW));
});

test("it stops working on its own, without anyone acting", () => {
  const v = staffSecretValue("goodscochina", "look-around-please", new Date(NOW + DAY));
  assert.ok(staffPasswordOk("goodscochina", "look-around-please", v, NOW + DAY - 1000));
  assert.ok(!staffPasswordOk("goodscochina", "look-around-please", v, NOW + DAY + 1000));
  assert.ok(!staffPasswordOk("goodscochina", "look-around-please", v, NOW + 400 * DAY));
});

test("a value with no expiry is refused outright", () => {
  /* The whole point of the format. A bare hash would be a permanent second
     password on a live client's website, left behind after the afternoon it
     was needed — the thing nobody notices for a year. */
  const bare = "a".repeat(64);
  assert.equal(readStaffSecret(bare), null);
  assert.ok(!staffPasswordOk("goodscochina", "x", bare, NOW));
  assert.equal(readStaffSecret(`${bare}|not-a-date`), null);
  assert.equal(readStaffSecret("short|2026-12-01T00:00:00.000Z"), null);
  assert.equal(readStaffSecret(null), null);
  assert.equal(readStaffSecret(""), null);
});

test("the client reference and the billing row are bridged by email", () => {
  /* THE BUG THIS PINS. hosting_clients has no `client_ref` column — the
     reference lives in clientRefs.ts and the email joins the two. A query on
     a column that does not exist does not throw: PostgREST returns an error
     object and supabase-js hands back `data: null`, which reads exactly like
     "no such client". So a password change did nothing, a copy request did
     nothing, and a correct password was refused, all silently. */
  for (const ref of ["goodscochina", "excellenceagency"]) {
    const client = CLIENT_REFS[ref];
    assert.ok(client, `${ref} must be in CLIENT_REFS or nothing can find its row`);
    assert.ok(client.email, `${ref} needs an email — it is the only key into hosting_clients`);
    assert.equal(refForEmail(client.email), ref, `${ref}: the email must map back to it`);
    assert.equal(refForEmail(client.email.toUpperCase()), ref, "and case must not matter");
  }
  assert.equal(refForEmail("nobody@example.com"), null);
  assert.equal(refForEmail(null), null);
  assert.equal(refForEmail(""), null);
});

test("every editable site can actually be found in the billing table", () => {
  // An editor with no route to a row cannot store a password, so its client
  // could never change one — the feature would be a button that does nothing.
  for (const ref of Object.keys(EDITABLE_SITES_FOR_LOOKUP)) {
    assert.ok(CLIENT_REFS[ref]?.email, `${ref} is editable but has no email to find its row by`);
  }
});

/* ── a product sold once, not rented ─────────────────────────────────────── */

test("multilingual search is charged once, and says so", () => {
  /* It was $45/month with a $345 setup. The work is finite — hreflang, a
     sitemap per language, the structured data — so a monthly charge for it is
     rent on a finished job, and the client who asks what this month's payment
     bought would be right to. */
  const seo = PRODUCTS.seo_multilingual;
  assert.equal(seo.oneOffUsd, 145);
  // The same price whichever period the page was showing, because there is
  // no period: a one-off cannot be cheaper by the year.
  assert.equal(amountCents(seo, "monthly"), 14500);
  assert.equal(amountCents(seo, "annual"), 14500);
});

test("the recurring products are untouched by that", () => {
  assert.equal(PRODUCTS.hosting.oneOffUsd, undefined);
  assert.equal(amountCents(PRODUCTS.hosting, "monthly"), 800);
  assert.equal(amountCents(PRODUCTS.hosting, "annual"), 8800);
  assert.equal(amountCents(PRODUCTS.chatbot, "monthly"), 1200);
  assert.equal(amountCents(PRODUCTS.chatbot, "annual"), 12000);
});
