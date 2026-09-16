/**
 * The tag transformation, applied to the actual pages of the first site it
 * will be committed to: the local clone of excellence-agency.org.
 *
 * The installer's GitHub plumbing is exercised separately; this proves the
 * part that touches a client's HTML does exactly one thing to each page and
 * nothing else — byte for byte, line endings included. Skipped if the clone
 * is not on this machine.
 *
 *   node --test tests/install-on-real-pages.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { withAssistantTag, hasAssistantTag, installSnippet } from "../src/lib/assistant.ts";

const SITE = "C:/Users/Elamr/Music/APPS/Www.excellenceagency.ma";
const skip = !existsSync(SITE) ? "excellence-agency clone not present" : false;

test("every page of excellence-agency.org gets exactly one tag, before its last </body>, and nothing else changes", { skip }, () => {
  const pages = readdirSync(SITE).filter((f) => /\.html?$/i.test(f));
  assert.ok(pages.length >= 10, `expected the site's pages, found ${pages.length}`);
  const snippet = installSnippet("excellenceagency", "right");

  for (const page of pages) {
    const before = readFileSync(path.join(SITE, page), "utf8");
    assert.equal(hasAssistantTag(before), false, `${page} must start without the tag`);

    const after = withAssistantTag(before, "excellenceagency", "right");
    assert.notEqual(after, before, `${page}: nothing was inserted`);
    assert.equal(after.split(snippet).length - 1, 1, `${page}: the tag appears exactly once`);

    // Removing the inserted line gives back the original file, byte for byte.
    const nl = before.includes("\r\n") ? "\r\n" : "\n";
    assert.equal(after.replace(snippet + nl, ""), before, `${page}: something other than the tag changed`);

    // It sits right before the LAST </body>, so it loads after the page's own scripts.
    const at = after.lastIndexOf(snippet);
    const bodyClose = after.toLowerCase().lastIndexOf("</body>");
    assert.equal(at + snippet.length + nl.length, bodyClose, `${page}: tag is not immediately before </body>`);

    // Idempotent on the real page too.
    assert.equal(withAssistantTag(after, "excellenceagency", "right"), after, `${page}: second run changed the file`);
  }
});
