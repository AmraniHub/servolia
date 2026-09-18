/**
 * What a client is shown of their own site, and what is kept back.
 *
 * The same filter guards the list on their page and the archive they download.
 * It did not always: the first version filtered only the archive, so a
 * client's own service page listed `site-status.js` and `middleware.js` by
 * name — the hosting gate, the switch that takes their site down when an
 * invoice goes unpaid — shown to the one person who should never have to think
 * about it. Caught by looking at the rendered page, not by reading the code.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isOurs, humanSize } from "../src/lib/clientFiles.ts";

test("the hosting gate is never shown to the client it gates", () => {
  for (const f of ["site-status.js", "middleware.js", "promo.js", "promo-config.json"]) {
    assert.ok(isOurs(f), `${f} is the gate and must not appear`);
    assert.ok(isOurs(`web/${f}`), "path or bare name, same answer");
  }
});

test("our notes and build tooling are not part of their website", () => {
  for (const f of ["README.md", "build.py", "NOTES.md", "scripts/deploy.py", "package.json", "vercel.json"]) {
    assert.ok(isOurs(f), `${f} should not be listed as the client's`);
  }
});

test("everything that IS their website comes through", () => {
  for (const f of ["index.html", "sourcing.html", "css/style.css", "img/hero.jpg",
                   "js/i18n.js", "favicon.ico", "robots.txt", "sitemap.xml", "fonts/inter.woff2"]) {
    assert.ok(!isOurs(f), `${f} is theirs and must be listed`);
  }
});

test("sizes read as a person would say them", () => {
  assert.equal(humanSize(0), "0 B");
  assert.equal(humanSize(900), "900 B");
  assert.equal(humanSize(2048), "2 KB");
  assert.equal(humanSize(1_572_864), "1.5 MB");
});
