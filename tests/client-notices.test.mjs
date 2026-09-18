/**
 * What the client is told when they open the panel.
 *
 * The rule this pins: a DERIVED notice must disappear when the thing it is
 * about stops being true, and must not come back after the client has
 * dismissed it — while still returning if the condition genuinely recurs. Get
 * that wrong in either direction and the bell is either a nag or a liar, and
 * the one notice that mattered gets ignored with the rest.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  noticesFor, readDismissed, writeDismissed, readSentNotices, writeSentNotice,
} from "../src/lib/clientNotices.ts";

const base = {
  notes: null,
  lang: "en",
  assistantWaiting: false,
  copyReady: false,
  paymentDue: false,
  siteUp: true,
  linkFor: (p) => `/hosting/account?page=${p}`,
  assistantTrialHref: "/hosting/assistant/trial?t=abc",
  billingHref: "/api/billing-portal?t=abc",
};

test("a quiet account is told nothing", () => {
  assert.deepEqual(noticesFor(base), []);
});

test("the assistant trial appears only when one is built and waiting", () => {
  const on = noticesFor({ ...base, assistantWaiting: true });
  assert.equal(on.length, 1);
  assert.equal(on[0].kind, "assistant-trial");
  assert.match(on[0].body, /7 days/);
  assert.equal(on[0].href, "/hosting/assistant/trial?t=abc");
  // No link to start it means no notice: an offer with no way to accept is worse than none.
  assert.deepEqual(noticesFor({ ...base, assistantWaiting: true, assistantTrialHref: null }), []);
});

test("bad news comes before the offer", () => {
  const all = noticesFor({ ...base, assistantWaiting: true, paymentDue: true, siteUp: false });
  assert.deepEqual(all.map((n) => n.kind), ["payment-due", "site-down", "assistant-trial"]);
  assert.equal(all[0].tone, "warn");
});

test("a site we could not reach is not a site that is down", () => {
  /* null means the check itself failed. Telling a client their site is down
     because our fetch timed out is the fastest way to lose them. */
  assert.deepEqual(noticesFor({ ...base, siteUp: null }), []);
  assert.equal(noticesFor({ ...base, siteUp: false })[0].kind, "site-down");
});

test("dismissing one hides it and leaves the others", () => {
  const notes = writeDismissed(null, new Set(["assistant-trial"]));
  const left = noticesFor({ ...base, notes, assistantWaiting: true, paymentDue: true });
  assert.deepEqual(left.map((n) => n.kind), ["payment-due"]);
  assert.ok(readDismissed(notes).has("assistant-trial"));
});

test("dismissals are one line and capped, not one line each", () => {
  const many = new Set(Array.from({ length: 200 }, (_, i) => `n${i}`));
  const notes = writeDismissed(null, many);
  const lines = notes.split("\n").filter((l) => l.startsWith("servolia-notice-read:"));
  assert.equal(lines.length, 1, "one line however many ids");
  assert.equal(readDismissed(notes).size, 60, "oldest dropped");
  assert.ok(readDismissed(notes).has("n199"), "the newest survive");
});

test("the other markers in that column survive a dismissal", () => {
  const before = [
    "servolia-domain: goodscochina-shop.com | status: bought | retail: 26",
    "servolia-editor-pw: hash: " + "a".repeat(64) + " | set: 2026-09-18T00:00:00.000Z",
  ].join("\n");
  const after = writeDismissed(before, new Set(["x"]));
  for (const l of before.split("\n")) assert.ok(after.includes(l), `dropped: ${l}`);
});

test("a notice Servolia sends by hand is stored as an id and a kind, never as prose", () => {
  const notes = writeSentNotice(null, "welcome-1", "assistant-trial", "2026-09-18T00:00:00.000Z");
  const sent = readSentNotices(notes);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, "assistant-trial");
  // The text comes from the copy table, so it is translated and correctable.
  const shown = noticesFor({ ...base, notes });
  assert.equal(shown.length, 1);
  assert.match(shown[0].title, /assistant/i);
  assert.match(noticesFor({ ...base, notes, lang: "fr" })[0].title, /assistant/i);
  // An unknown kind is dropped rather than rendered as an empty card.
  assert.deepEqual(readSentNotices("servolia-notice: id: x | kind: nonsense | at: z"), []);
});
