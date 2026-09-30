import { test } from "node:test";
import assert from "node:assert/strict";
import { draftKey, readDraft, writeDraft, clearDraft, DRAFT_MAX_AGE_MS } from "../src/lib/intakeDraft.ts";

const area = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
};
const blank = { businessName: "", phone: "", preferredLanguage: "French" };

test("a saved draft comes back after a reload, step included", () => {
  const a = area();
  const key = draftKey("cs_live_1", "essentiel");
  writeDraft(a, key, { form: { ...blank, businessName: "Cabinet Dupont", phone: "0612" }, step: 2 }, 1000);
  assert.deepEqual(readDraft(a, key, blank, 5, 2000), { form: { businessName: "Cabinet Dupont", phone: "0612", preferredLanguage: "French" }, step: 2 });
});

test("another purchase on the same browser does not see it", () => {
  const a = area();
  writeDraft(a, draftKey("cs_live_1", "essentiel"), { form: { ...blank, businessName: "A" }, step: 1 }, 1000);
  assert.equal(readDraft(a, draftKey("cs_live_2", "essentiel"), blank, 5, 2000), null);
  assert.notEqual(draftKey(null, "essentiel"), draftKey("cs_live_1", "essentiel"));
});

test("only known string fields are taken; the step is clamped", () => {
  const a = area();
  a.setItem("k", JSON.stringify({ form: { businessName: "B", phone: 42, injected: "x" }, step: 99, at: 1000 }));
  assert.deepEqual(readDraft(a, "k", blank, 5, 2000), { form: { businessName: "B", phone: "", preferredLanguage: "French" }, step: 4 });
});

test("stale, malformed or empty drafts are ignored, never thrown", () => {
  const a = area();
  a.setItem("old", JSON.stringify({ form: { businessName: "Old" }, step: 1, at: 0 }));
  assert.equal(readDraft(a, "old", blank, 5, DRAFT_MAX_AGE_MS + 1), null);
  assert.equal(a.getItem("old"), null, "a stale draft is removed");
  a.setItem("bad", "{not json");
  assert.equal(readDraft(a, "bad", blank, 5), null);
  a.setItem("none", JSON.stringify({ form: { other: "x" }, at: Date.now() }));
  assert.equal(readDraft(a, "none", blank, 5), null);
  assert.equal(readDraft(null, "k", blank, 5), null);
});

test("storage that throws never breaks the form", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(readDraft(broken, "k", blank, 5), null);
  assert.doesNotThrow(() => writeDraft(broken, "k", { form: blank, step: 0 }));
  assert.doesNotThrow(() => clearDraft(broken, "k"));
});

test("submitting clears it", () => {
  const a = area();
  writeDraft(a, "k", { form: { ...blank, businessName: "C" }, step: 0 });
  clearDraft(a, "k");
  assert.equal(readDraft(a, "k", blank, 5), null);
});
