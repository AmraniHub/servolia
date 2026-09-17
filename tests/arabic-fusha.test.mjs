/**
 * EVERY ARABIC STRING WE SHIP IS MODERN STANDARD ARABIC (الفصحى).
 *
 * Servolia sells to businesses whose customers write Moroccan Darija, and
 * the assistant must UNDERSTAND that — but a company replying in dialect
 * reads as a mate rather than a business, and is unreadable to the Gulf,
 * Egyptian or Levantine customer who lands on the same page. The demo
 * shipped with `واش كتديرو`, `بغيت نقرا` and `هاد السيمانة` in the visitor
 * bubbles, which the buyer reads as "this is what my assistant sounds like".
 *
 * This scans the SOURCE FILES as text rather than importing them: a text
 * scan cannot miss a file because someone forgot to export a string, and it
 * covers the demo scripts, the widget's own UI copy and every client brief
 * in one pass. Add a file to FILES and it is covered for ever.
 *
 *   node --test tests/arabic-fusha.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "src/lib/demoScripts.ts",             // the pay-page film's conversations
  "src/components/AssistantDemo.tsx",   // the player (kept listed: it held the
                                        // scripts until 2026-09-17 and must
                                        // never take Arabic back silently)
  "src/lib/assistant.ts",               // the widget's own UI copy
  "src/lib/assistantSites.ts",          // client briefs: greetings, quick replies
  "src/lib/clientPrompt.ts",            // the rule given to the model
];

/** Where the demo's Arabic actually lives — the positive-form test reads it. */
const SCRIPTS = "src/lib/demoScripts.ts";

/**
 * Unambiguous Darija. Every entry is a word that does not exist in Fusha
 * with this meaning, so a hit is a real dialect leak rather than a false
 * positive — `كيف` (how) and `عندي` (I have) are deliberately NOT here
 * because both are perfectly good Fusha.
 *
 * `clientPrompt.ts` is the one file allowed to NAME these: it tells the
 * model which words to avoid, which requires spelling them.
 */
const DARIJA = [
  ["واش", "wach — interrogative particle; Fusha: هل"],
  ["بغيت", "bghit — I want; Fusha: أرغب / أريد"],
  ["باغي", "baghi — wanting; Fusha: أريد"],
  ["كتدير", "katdir — you do; Fusha: تفعل / تقدم"],
  ["كتقبل", "katqbel — you accept; Fusha: تقبلون"],
  ["شحال", "chhal — how much; Fusha: كم"],
  ["دابا", "daba — now; Fusha: الآن"],
  ["ديال", "dyal — of; Fusha: الخاص بـ / إضافة"],
  ["السيمانة", "simana — week; Fusha: الأسبوع"],
  ["فين", "fin — where; Fusha: أين"],
  ["علاش", "3lach — why; Fusha: لماذا"],
  ["مزيان", "mzyan — good; Fusha: جيد"],
  ["غادي", "ghadi — going to; Fusha: سوف / سـ"],
  ["نقرا", "nqra — I study; Fusha: أدرس"],
  ["نهار سعيد", "nhar s3id — good day; Fusha: طاب يومك"],
  ["هاد ال", "had l- — this; Fusha: هذا ال"],
];

/** Arabic-script runs of two or more characters, with their file offsets. */
function arabicRuns(src) {
  return [...src.matchAll(/[؀-ۿ][؀-ۿ\s،؟ـً-ْ.،!?]*/g)]
    .map((m) => ({ text: m[0], at: m.index }))
    .filter((r) => r.text.trim().length > 1);
}

function lineOf(src, at) {
  return src.slice(0, at).split("\n").length;
}

for (const rel of FILES) {
  test(`${rel} ships only Fusha`, () => {
    const src = readFileSync(path.join(ROOT, rel), "utf8");
    // The prompt file must spell the forbidden words in order to forbid them.
    const isPromptRule = rel.endsWith("clientPrompt.ts");
    const hits = [];
    for (const { text, at } of arabicRuns(src)) {
      for (const [word, why] of DARIJA) {
        if (text.includes(word)) hits.push(`${rel}:${lineOf(src, at)} "${word}" (${why}) in: ${text.trim().slice(0, 60)}`);
      }
    }
    if (isPromptRule) {
      // Every hit here must be inside the "never write it back" instruction.
      const bad = hits.filter((h) => !/never write it back|no واش/.test(src.split("\n")[Number(h.match(/:(\d+)/)[1]) - 1] ?? ""));
      assert.deepEqual(bad, [], `dialect outside the forbidding rule:\n${bad.join("\n")}`);
      return;
    }
    assert.deepEqual(hits, [], `Darija found — rewrite in Fusha:\n${hits.join("\n")}`);
  });
}

test("the demo's Arabic is real Fusha, not just Darija-free", () => {
  const src = readFileSync(path.join(ROOT, SCRIPTS), "utf8");
  // Positive markers: the Fusha forms that replaced the dialect.
  for (const [marker, meaning] of [
    ["هل ", "هل — the Fusha interrogative"],
    ["أرغب في", "أرغب في — I would like"],
    ["هل يمكنك تزويدي", "هل يمكنك تزويدي — may I have (formal)"],
    ["طابت ليلتك", "طابت ليلتك — good night (Fusha)"],
    ["طاب يومك", "طاب يومك — good day (Fusha)"],
  ]) {
    assert.ok(src.includes(marker), `missing Fusha form: ${meaning}`);
  }
});

test("the scripts file really does carry Arabic (the scan is not vacuous)", () => {
  const src = readFileSync(path.join(ROOT, SCRIPTS), "utf8");
  const runs = arabicRuns(src);
  assert.ok(runs.length >= 12, `expected the Arabic conversations, found ${runs.length} runs`);
});

test("the model is told to answer Darija in Fusha", () => {
  const src = readFileSync(path.join(ROOT, "src/lib/clientPrompt.ts"), "utf8");
  assert.match(src, /MODERN STANDARD ARABIC/, "the rule must name Fusha in the model's own language");
  assert.ok(src.includes("الفصحى"), "and in Arabic (الفصحى)");
  assert.match(src, /Understand the dialect, never write it back/, "the asymmetry must be explicit");
  // The rule has to reach a multilingual client's prompt, not just the file.
  const rule = src.match(/Arabic OR Moroccan Darija[^`]*/)?.[0] ?? "";
  assert.ok(rule.includes("واش") && rule.includes("بغيت"),
    "name the words to avoid — a model given only 'no dialect' still writes بغيت");
});
