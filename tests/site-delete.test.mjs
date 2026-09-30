/**
 * Deleting a client site: drafts nobody pays for only, archived first.
 *   node --import ./tests/register.mjs --test tests/site-delete.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteRefusal, deleteDraftSite } from "../src/lib/siteDelete.ts";

const draft = (over = {}) => ({ slug: "cabinet-x", status: "draft", build_id: null, config: {}, ...over });

test("an unlinked draft, or one from a test build, may go", () => {
  assert.equal(deleteRefusal(draft(), null), null);
  assert.equal(deleteRefusal(draft({ build_id: "b1" }), { is_test: true }), null);
  // Its build was deleted (the FK set build_id null, or the row is gone).
  assert.equal(deleteRefusal(draft({ build_id: "b1" }), null), null);
});

test("anything real is refused", () => {
  assert.match(deleteRefusal(null, null), /No such site/);
  assert.match(deleteRefusal(draft({ status: "published" }), null), /Only drafts/);
  assert.match(deleteRefusal(draft({ config: { customDomain: "x.fr" } }), null), /domain attached/);
  assert.match(deleteRefusal(draft({ config: { receptionist: { paidAt: "2026-09-01" } } }), null), /receptionist/);
  assert.match(deleteRefusal(draft({ config: { isDemo: true } }), null), /Demo/);
  assert.match(deleteRefusal(draft({ build_id: "b1" }), { is_test: false }), /real client's build/);
  assert.match(deleteRefusal(draft({ build_id: "b1" }), { is_test: null }), /real client's build/);
});

test("no archive snapshot, no delete", async () => {
  // No GITHUB_ARCHIVE_* in the test env, so archiveSite fails: nothing may be deleted.
  delete process.env.GITHUB_ARCHIVE_TOKEN;
  let deletes = 0;
  const q = (result) => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result, delete: () => { deletes++; return chain; } };
    return chain;
  };
  const db = { from: (t) => q(t === "client_sites" ? { data: draft(), error: null } : { data: null, error: null }) };
  const out = await deleteDraftSite(db, "cabinet-x");
  assert.equal(out.ok, false);
  assert.match(out.reason, /archive snapshot failed/);
  assert.equal(deletes, 0);
});
