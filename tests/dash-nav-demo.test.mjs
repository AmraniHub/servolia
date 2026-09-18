/* The sample client panel has to survive being clicked.
 *
 * /hosting/account?demo=1 is the page a prospect is shown to prove the panel
 * exists: invented figures, no token, nothing real behind it. Every link in
 * DashNav was built as `/hosting/account?page=<p>` plus the token when there
 * is one — and on the sample there is no token, because there is nothing to
 * authenticate. So the first tab a visitor clicked dropped the demo flag and
 * landed them on the sign-in screen.
 *
 * Nothing failed. The page rendered, the links were valid, and the only
 * symptom was a prospect being asked to log in to a demonstration.
 *
 * Checked against the SOURCE rather than by rendering, because the component
 * is .tsx and Node's type stripping does not cover JSX — so importing it here
 * would need a build step for a check that is really about one string.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NAV = readFileSync(join(ROOT, "src/components/client/DashNav.tsx"), "utf8");
const PAGE = readFileSync(join(ROOT, "src/app/hosting/account/page.tsx"), "utf8");

test("the nav can carry the sample flag", () => {
  assert.match(NAV, /demo\?: boolean/, "DashNav must accept a demo flag");
  assert.match(NAV, /demo \? `&demo=1/, "and append it to every link when set");
});

test("every nav link is built by one function", () => {
  /* The fix is only worth anything if there is a single place that builds
     these hrefs. A second hand-written link would silently keep the bug. */
  const hrefs = NAV.match(/href=\{[^}]*\}/g) || [];
  assert.equal(hrefs.length, 1, `DashNav has ${hrefs.length} href expressions; there must be one`);
  assert.match(hrefs[0], /href=\{href\(p\)\}/, "links must come from the href() helper");
});

test("the account page actually passes it", () => {
  // The prop existing and the prop being passed are two different bugs.
  assert.match(PAGE, /<DashNav[\s\S]{0,220}demo=\{isDemo\}/,
    "page.tsx must pass demo={isDemo} to DashNav");
});

test("a real client's link is unchanged", () => {
  /* The token is what a real client arrives with, and it must still ride
     along on its own — the sample flag is additional, never a replacement. */
  assert.match(NAV, /token \? `&t=\$\{encodeURIComponent\(token\)\}` : ""/,
    "the token must still be appended for real clients");
  // And nothing may append demo=1 unconditionally, which would mark a real
  // client's panel as a sample.
  assert.equal(/[^?]demo=1(?!`)/.test(NAV.replace(/demo \? `&demo=1[^`]*`/g, "")), false,
    "demo=1 must only ever be added behind the flag");
});

test("the sample keeps its language", () => {
  // On the demo the language comes from ?lang=, so dropping it sends a French
  // prospect back to English on the first click.
  assert.match(NAV, /lang === "fr" \? "&lang=fr"/, "the sample must carry its language too");
});
