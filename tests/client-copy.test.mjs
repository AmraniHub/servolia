/**
 * "Can I have a copy of my website?" — the state machine behind the button.
 *
 * The thing that must not go wrong: a download that works without an approval,
 * or an approval that never runs out. Both are decided by pure functions here
 * so they can be checked without a database or a clock.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readCopyRequest, writeCopyRequest, copyState, approvedNow, COPY_WINDOW_DAYS,
} from "../src/lib/clientCopy.ts";

const NOW = Date.parse("2026-09-18T12:00:00.000Z");

test("no marker means nothing has been asked", () => {
  assert.equal(readCopyRequest(null), null);
  assert.equal(copyState(null), "none");
  assert.equal(copyState(readCopyRequest("servolia-fulfilled: 2026-09-11")), "none");
});

test("asked but not answered is waiting, and waiting is not ready", () => {
  const notes = writeCopyRequest(null, { requested: "2026-09-18T11:00:00.000Z" });
  const rec = readCopyRequest(notes);
  assert.equal(rec.requested, "2026-09-18T11:00:00.000Z");
  assert.equal(copyState(rec, NOW), "waiting");
});

test("approval opens a window, and the window closes on its own", () => {
  const approved = approvedNow({ requested: "2026-09-18T11:00:00.000Z" }, new Date(NOW));
  assert.equal(copyState(approved, NOW), "ready");
  assert.equal(copyState(approved, NOW + 60_000), "ready");
  // One second after the window: not ready any more, without anyone acting.
  const expiry = Date.parse(approved.until);
  assert.equal(expiry - NOW, COPY_WINDOW_DAYS * 86_400_000);
  assert.equal(copyState(approved, expiry + 1000), "expired");
  assert.equal(copyState(approved, expiry - 1000), "ready");
});

test("a refusal is not an approval, and never becomes one by waiting", () => {
  const rec = readCopyRequest(writeCopyRequest(null, {
    requested: "2026-09-18T11:00:00.000Z",
    refused: "2026-09-18T11:30:00.000Z",
  }));
  assert.equal(copyState(rec, NOW), "refused");
  assert.equal(copyState(rec, NOW + 400 * 86_400_000), "refused");
});

test("the marker survives a round trip and leaves the column's other lines alone", () => {
  const before = [
    "servolia-fulfilled: 2026-09-11",
    "servolia-editor-pw: hash: " + "a".repeat(64) + " | set: 2026-09-18T00:00:00.000Z",
  ].join("\n");
  const after = writeCopyRequest(before, approvedNow(null, new Date(NOW)));
  for (const line of before.split("\n")) {
    assert.ok(after.includes(line), `a copy request dropped: ${line}`);
  }
  assert.equal(copyState(readCopyRequest(after), NOW), "ready");
  // And approving twice must not leave two markers behind.
  const twice = writeCopyRequest(after, approvedNow(null, new Date(NOW)));
  assert.equal(twice.split("\n").filter((l) => l.startsWith("servolia-copy:")).length, 1);
});

test("an approval replaces a refusal rather than sitting beside it", () => {
  const refused = writeCopyRequest(null, { requested: "2026-09-18T11:00:00.000Z", refused: "2026-09-18T11:30:00.000Z" });
  const now = writeCopyRequest(refused, approvedNow(readCopyRequest(refused), new Date(NOW)));
  const rec = readCopyRequest(now);
  assert.equal(rec.refused, undefined, "a stale refusal must not outlive the approval that replaced it");
  assert.equal(copyState(rec, NOW), "ready");
});
