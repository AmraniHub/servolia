/**
 * Receptionist replies reach the patient as plain text, never raw Markdown.
 *   node --import ./tests/register.mjs --test tests/plain-reply.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { plainReply } from "../src/lib/plainReply.ts";

test("the walk S2 reply loses its asterisks", () => {
  assert.equal(
    plainReply("Pouvez-vous me donner votre **nom et numéro de téléphone** ? 🦷"),
    "Pouvez-vous me donner votre nom et numéro de téléphone ? 🦷",
  );
});

test("other Markdown becomes plain text, line breaks kept", () => {
  assert.equal(plainReply("## Horaires\n- Lundi : 9h\n* Mardi : 9h"), "Horaires\n• Lundi : 9h\n• Mardi : 9h");
  assert.equal(plainReply("C'est *très* simple et __rapide__."), "C'est très simple et rapide.");
  assert.equal(plainReply("Tapez `OK`"), "Tapez OK");
});

test("what is not Markdown is left alone", () => {
  assert.equal(plainReply("Écrivez à jean_dupont@cabinet.fr ou jean__x@y.fr"), "Écrivez à jean_dupont@cabinet.fr ou jean__x@y.fr");
  assert.equal(plainReply("5 * 3 = 15"), "5 * 3 = 15");
  assert.equal(plainReply("Bonjour !\n\nÀ bientôt."), "Bonjour !\n\nÀ bientôt.");
});

test("the client-site chat uses it, and the prompt asks for plain text", () => {
  const route = readFileSync(new URL("../src/app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /const reply = plainReply\(rawReply\.replace\(\/\\\[BOOKING\\\]\/gi, ""\)\)\.trim\(\);/);
  const prompt = readFileSync(new URL("../src/lib/clientPrompt.ts", import.meta.url), "utf8");
  assert.match(prompt, /Plain text only/);
});
