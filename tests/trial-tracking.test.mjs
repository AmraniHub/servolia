/**
 * The /fr/essai funnel tells Meta what an ad bought: a Lead when a practice
 * asks for its link, a StartTrial when the 7 days start. Without them the ad
 * test (2026-09-30) could optimise for nothing and measure nothing.
 *   node --import ./tests/register.mjs --test tests/trial-tracking.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/app/api/receptionist-trial/route.ts", import.meta.url), "utf8");
const capi = readFileSync(new URL("../src/lib/metaCapi.ts", import.meta.url), "utf8");

test("a link request sends Lead, after the email actually went", () => {
  const sent = route.indexOf('if (!sent) return NextResponse.json({ ok: false, reason: "send-failed" }');
  const lead = route.indexOf('eventName: "Lead"');
  assert.ok(sent > 0 && lead > sent, "Lead only once the confirmation email is sent");
});

test("a started trial sends StartTrial once, with a dedup id", () => {
  const block = route.slice(route.indexOf('if (action === "start")'), route.indexOf('if (action === "details")'));
  assert.match(block, /if \(!out\.already\) \{[\s\S]*eventName: "StartTrial"[\s\S]*eventId: `trial-\$\{out\.slug\}`/);
});

test("server events carry the pixel's click and browser cookies", () => {
  assert.match(capi, /"StartTrial"/);
  assert.match(capi, /cookies\.get\("_fbc"\)/);
  assert.match(capi, /cookies\.get\("_fbp"\)/);
  assert.match(capi, /if \(inTestContext\(\)\) return;/, "never for a founder test");
});
