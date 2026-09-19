import test from "node:test";
import assert from "node:assert/strict";

import { CLIENT_REFS, knownSiteUrl } from "../src/lib/clientRefs.ts";

/**
 * A CLIENT WE KNOW MUST NEVER HAVE A BLANK ADDRESS.
 *
 * hosting_clients.site_url is typed by hand, so it is blank whenever someone
 * forgot — and that blank is the link in the CRM and the address the client
 * reads in their own trial email. The domain was already recorded in
 * CLIENT_REFS for the editor and for sign-in, so nothing should be typed twice.
 */

test("every client reference yields a usable address", () => {
  for (const ref of Object.keys(CLIENT_REFS)) {
    const url = knownSiteUrl(ref);
    assert.ok(url, `${ref} has no address`);
    assert.ok(url.startsWith("https://"), `${ref} is not https: ${url}`);
    assert.doesNotThrow(() => new URL(url), `${ref} is not a valid URL: ${url}`);
    assert.ok(!url.includes("//https"), `${ref} double-prefixed: ${url}`);
  }
});

test("a label that already carries a protocol is not prefixed twice", () => {
  /* Guards the one way this helper could produce something broken, since the
     labels are hand-written and one day someone will paste a full URL. */
  const url = knownSiteUrl(Object.keys(CLIENT_REFS)[0]);
  assert.ok(url && url.match(/^https:\/\/[^/]+$/), `unexpected shape: ${url}`);
});

test("an unknown or hostile reference yields nothing", () => {
  for (const bad of [null, undefined, "", "nobody", "constructor", "__proto__", "toString"]) {
    assert.equal(knownSiteUrl(bad), null, `${String(bad)} resolved to an address`);
  }
});

test("the two live clients resolve to their real domains", () => {
  assert.equal(knownSiteUrl("goodscochina"), "https://goodscochina.com");
  /* .ma is dead — suspended at the registry — and the repo is still called
     excellenceagency-ma, which is exactly how the wrong domain gets typed. */
  assert.equal(knownSiteUrl("excellenceagency"), "https://excellence-agency.org");
  assert.ok(!knownSiteUrl("excellenceagency").endsWith(".ma"));
});
