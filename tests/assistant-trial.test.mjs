/**
 * The trial's pure parts: the notes marker, the running/ended decision, and
 * the guarantee that the two readers of that marker — assistantTrial.ts and
 * the inlined copy in assistantAccess.ts — agree on every case. Nothing here
 * touches a database; the row logic is exercised in production by the
 * first real trial and guarded by the cron's own idempotence.
 *
 *   node --import ./tests/register.mjs --test tests/assistant-trial.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readTrial, writeTrial, trialRunning, TRIAL_DAYS } from "../src/lib/assistantTrial.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("seven days — his call", () => {
  assert.equal(TRIAL_DAYS, 7);
});

test("the marker round-trips and survives other notes", () => {
  const notes = "servolia-fulfilled: cs_x | at: 2026-09-01 | plan: hosting\nsome operator note";
  const until = "2026-09-24T10:00:00.000Z";
  const out = writeTrial(notes, { until, started: "2026-09-17T10:00:00.000Z" });
  assert.ok(out.includes("servolia-fulfilled: cs_x"), "the fulfilment marker is kept");
  assert.ok(out.includes("some operator note"));
  assert.deepEqual(readTrial(out), { until, started: "2026-09-17T10:00:00.000Z" });
  // Writing twice replaces, never appends a second marker.
  const again = writeTrial(out, { until: "2026-10-01T00:00:00.000Z", started: "x" });
  assert.equal((again.match(/servolia-trial:/g) ?? []).length, 1);
});

test("running = status trial AND the date is ahead", () => {
  const now = Date.parse("2026-09-20T00:00:00Z");
  const notes = writeTrial(null, { until: "2026-09-24T00:00:00.000Z", started: "2026-09-17T00:00:00.000Z" });
  assert.equal(trialRunning({ status: "trial", notes }, now), true);
  assert.equal(trialRunning({ status: "trial", notes }, Date.parse("2026-09-25T00:00:00Z")), false, "past the date: off, cron or no cron");
  assert.equal(trialRunning({ status: "trial_ended", notes }, now), false, "ended by the cron: off");
  assert.equal(trialRunning({ status: "active", notes }, now), false, "a paid row is not a trial");
  assert.equal(trialRunning({ status: "trial", notes: "" }, now), false, "no marker: off, never on by accident");
});

test("assistantAccess's inlined reader agrees with the real one", () => {
  // The switch in assistantAccess.ts cannot import assistantTrial.ts (it is
  // imported BY it), so it carries a two-line copy of the parse. This pins
  // the two together: change the marker format and this fails first.
  const src = readFileSync(path.join(ROOT, "src/lib/assistantAccess.ts"), "utf8");
  const fn = src.match(/function trialStillRunning\(notes[^{]*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(fn, "the inlined reader exists");
  const inlined = new Function("notes", "now", fn);
  const now = Date.parse("2026-09-20T00:00:00Z");
  for (const [until, expect] of [["2026-09-24T00:00:00.000Z", true], ["2026-09-19T00:00:00.000Z", false]]) {
    const notes = writeTrial("other line", { until, started: "s" });
    assert.equal(inlined(notes, now), expect, `inlined reader on until=${until}`);
    assert.equal(trialRunning({ status: "trial", notes }, now), expect, `real reader on until=${until}`);
  }
  assert.equal(inlined("", now), false);
});

test("the trial row is written as zero revenue", () => {
  const src = readFileSync(path.join(ROOT, "src/lib/assistantTrial.ts"), "utf8");
  assert.match(src, /monthly_usd:\s*0/, "a week's gift must not read as income anywhere that sums the column");
  assert.match(src, /status:\s*"trial"/);
  assert.match(src, /subscription_id:\s*null/, "no subscription — that is what lets the webhook COMPLETE this row on payment");
});
