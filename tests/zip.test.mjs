/**
 * The ZIP writer.
 *
 * Written by hand rather than pulled in as a package, so it gets tested
 * against the format rather than against itself. The structural checks are
 * here; tests/zip-opens.py then opens the SAME archive with Python's zipfile,
 * which shares no code with this, and compares the bytes back out. A zip that
 * only this file believes in is not a zip.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { makeZip, crc32 } from "../src/lib/zip.ts";

const AT = new Date("2026-09-18T10:30:00Z");

test("crc32 matches the known value for a known string", () => {
  // The canonical check value for "123456789".
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  assert.equal(crc32(Buffer.from("")), 0);
});

test("the archive has a header per file, a directory, and an end record", () => {
  const zip = makeZip([
    { path: "index.html", data: Buffer.from("<h1>hello</h1>") },
    { path: "css/style.css", data: Buffer.from("body{color:red}") },
  ], AT);

  assert.equal(zip.readUInt32LE(0), 0x04034b50, "starts with a local file header");
  // End-of-central-directory is the last 22 bytes when there is no comment.
  const eocd = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocd), 0x06054b50);
  assert.equal(zip.readUInt16LE(eocd + 8), 2, "two entries");
  assert.equal(zip.readUInt16LE(eocd + 10), 2);

  const cdOffset = zip.readUInt32LE(eocd + 16);
  assert.equal(zip.readUInt32LE(cdOffset), 0x02014b50, "the directory starts where the end record says");
  assert.equal(zip.readUInt32LE(eocd + 12), eocd - cdOffset, "the directory is as long as claimed");
});

test("already-compressed bytes are stored, not inflated by deflating them", () => {
  /* Genuinely random bytes stand in for a PNG: deflate makes them bigger, and
     a writer that always deflates hands the client a larger archive than the
     site itself. NOT a pseudo-random formula — the first version of this test
     used `(i * 2654435761) % 251`, which has period 251 and compresses
     beautifully, so the test failed while the code was right. */
  const noise = randomBytes(4096);
  const zip = makeZip([{ path: "img/photo.png", data: noise }], AT);
  assert.equal(zip.readUInt16LE(8), 0, "method 0 = stored");

  const text = Buffer.from("hello ".repeat(600));
  const zip2 = makeZip([{ path: "a.txt", data: text }], AT);
  assert.equal(zip2.readUInt16LE(8), 8, "method 8 = deflate");
  assert.ok(zip2.length < text.length / 2, "and it actually got smaller");
});

test("names are written as UTF-8 with the flag that says so", () => {
  const zip = makeZip([{ path: "img/été.png", data: Buffer.from("x") }], AT);
  assert.equal(zip.readUInt16LE(6) & 0x0800, 0x0800, "the UTF-8 name flag is set");
  const nameLen = zip.readUInt16LE(26);
  assert.equal(zip.subarray(30, 30 + nameLen).toString("utf8"), "img/été.png");
});

test("a leading slash or a backslash cannot escape the archive", () => {
  const zip = makeZip([{ path: "/css\\style.css", data: Buffer.from("x") }], AT);
  const nameLen = zip.readUInt16LE(26);
  assert.equal(zip.subarray(30, 30 + nameLen).toString("utf8"), "css/style.css");
});

test("an archive is written for Python to open independently", () => {
  const dir = join(tmpdir(), "servolia-zip-test");
  mkdirSync(dir, { recursive: true });
  const zip = makeZip([
    { path: "index.html", data: Buffer.from("<h1>Bonjour — hello</h1>\n") },
    { path: "css/style.css", data: Buffer.from("body{color:red}".repeat(80)) },
    { path: "img/été.txt", data: Buffer.from("accented name") },
    { path: "empty.txt", data: Buffer.from("") },
  ], AT);
  writeFileSync(join(dir, "made.zip"), zip);
  assert.ok(zip.length > 0);
});
