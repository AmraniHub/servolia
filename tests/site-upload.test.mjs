/**
 * What a client may put on their own live website.
 *
 * Every case here is one that would otherwise reach their production site.
 * The SVG case is the one worth reading twice: it looks like an image, it is
 * markup, browsers run <script> inside it, and it would be served from the
 * client's own origin — a cross-site scripting hole with a file picker in
 * front of it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  uploadProblem, safeTarget, contentTypeFor, extensionOf, MAX_UPLOAD_BYTES,
} from "../src/lib/siteUpload.ts";

const OK = 500 * 1024;

test("the pictures a client actually wants to change go through", () => {
  for (const name of ["logo.png", "product-1.JPG", "hero.webp", "banner.gif", "prices.pdf", "Photo 2026.jpeg"]) {
    assert.equal(uploadProblem(name, OK), null, `${name} should be accepted`);
    assert.ok(contentTypeFor(name), `${name} needs a content type`);
  }
});

test("anything that could run on their site is refused, with a reason", () => {
  for (const name of ["logo.svg", "index.html", "app.js", "style.css", "shell.php", "setup.exe"]) {
    const why = uploadProblem(name, OK);
    assert.ok(why, `${name} must be refused`);
    assert.ok(why.length > 30, `${name}: the refusal must explain itself`);
  }
  assert.match(uploadProblem("logo.svg", OK), /carry code/);
  assert.match(uploadProblem("logo.svg", OK), /PNG or JPG/, "and say what to do instead");
});

test("size and naming", () => {
  assert.equal(uploadProblem("big.png", MAX_UPLOAD_BYTES), null, "exactly the limit is fine");
  assert.match(uploadProblem("big.png", MAX_UPLOAD_BYTES + 1), /3\.5 MB/);
  assert.match(uploadProblem("empty.png", 0), /empty/);
  assert.match(uploadProblem(".htaccess", OK), /Hidden files/);
  assert.match(uploadProblem("a;rm -rf.png", OK), /letters, numbers/);
  assert.match(uploadProblem("x".repeat(90) + ".png", OK), /too long/);
  assert.equal(extensionOf("a/b/c.PNG"), "png");
});

test("nothing can be written outside the folder it was aimed at", () => {
  assert.equal(safeTarget("img", "cat.png"), "img/cat.png");
  assert.equal(safeTarget("", "cat.png"), "cat.png");
  assert.equal(safeTarget("img/products", "cat.png"), "img/products/cat.png");
  // The name is always reduced to its last segment, so a path in the NAME
  // cannot climb out of the folder.
  assert.equal(safeTarget("img", "../../../etc/passwd"), "img/passwd");
  // Written with String.raw so the shell cannot eat the backslashes: an
  // earlier version of this line arrived as "....web.config" and tested
  // nothing about Windows-style paths at all.
  assert.equal(safeTarget("img", String.raw`..\..\web.config`), "img/web.config");
  // A folder that tries to climb is refused outright.
  assert.equal(safeTarget("../secrets", "cat.png"), null);
  assert.equal(safeTarget("img/../..", "cat.png"), null);
  assert.equal(safeTarget("img", ".hidden"), null);
});
