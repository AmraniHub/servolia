/**
 * The installer against GitHub for real — the plumbing the webhook will run
 * the moment a hosted client pays for the assistant.
 *
 * Two passes:
 *   1. DRY RUN on the real client repository: reads the branch, the tree
 *      and every page, computes the changes, writes NOTHING. Proves the read
 *      path and the page discovery against the exact repo that will be
 *      committed to.
 *   2. A REAL COMMIT on a throwaway repository, twice: the first run must
 *      change the untagged pages and skip the pre-tagged one; the second must
 *      change nothing. Then the files are read back through the API.
 *
 * Needs GH_TOKEN in the environment (never printed). Not a *.test.mjs on
 * purpose — it touches the network and is run by hand:
 *
 *   GH_TOKEN=$(gh auth token) node --import ./tests/register.mjs tests/install-smoke.mjs [owner/throwaway-repo]
 *
 * The throwaway is AmraniHub/assistant-install-smoke (private). The first
 * run tags it, so before a re-run reset the fixture: three pages at the
 * root — index.html (LF), about.html (CRLF), already.html (carrying the
 * tag) — plus a `.gitattributes` of `* -text` so git does not normalise
 * the CRLF file, committed with core.autocrlf=false and force-pushed to
 * main. Without the attributes file the CRLF assertion tests git, not us.
 */
import assert from "node:assert/strict";
import { installAssistantTag } from "@/lib/assistantInstall";
import { hasAssistantTag } from "@/lib/assistant";

const REAL = { repo: "AmraniHub/excellenceagency-ma", branch: "master", siteRoot: null };
const THROWAWAY = process.argv[2] || null;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

if (!process.env.GH_TOKEN) { console.error("GH_TOKEN missing"); process.exit(2); }

console.log("1. dry run on", REAL.repo);
const dry = await installAssistantTag(REAL, "excellenceagency", "right", { dryRun: true });
console.log("   ", JSON.stringify(dry));
assert.equal(dry.ok, true, "dry run failed");
assert.ok(dry.changed >= 10, `expected the site's pages to need the tag, got ${dry.changed}`);
assert.ok(dry.files.includes("index.html"), "index.html must be among the pages");
const stillClean = await gh(`/repos/${REAL.repo}/contents/index.html?ref=${REAL.branch}`);
assert.equal(hasAssistantTag(Buffer.from(stillClean.content, "base64").toString("utf8")), false, "DRY RUN WROTE TO THE CLIENT REPO");
console.log("    read-only confirmed: index.html on", REAL.branch, "is untouched");

if (!THROWAWAY) { console.log("2. no throwaway repo given — skipping the write test"); process.exit(0); }

console.log("2. real commits on", THROWAWAY);
const t = { repo: THROWAWAY, branch: "main", siteRoot: null };
const first = await installAssistantTag(t, "smoke", "left");
console.log("    first run:", JSON.stringify(first));
assert.equal(first.ok, true);
assert.equal(first.changed, 2, "two untagged pages should change");
assert.equal(first.skipped, 1, "the pre-tagged page should be skipped");
assert.ok(first.commit, "a commit sha is returned");

const second = await installAssistantTag(t, "smoke", "left");
console.log("    second run:", JSON.stringify(second));
assert.equal(second.ok, true);
assert.equal(second.changed, 0, "second run must be a no-op");
assert.equal(second.commit, undefined, "no commit on a no-op");

for (const f of ["index.html", "about.html", "already.html"]) {
  const file = await gh(`/repos/${THROWAWAY}/contents/${f}?ref=main`);
  const html = Buffer.from(file.content, "base64").toString("utf8");
  const n = (html.match(/servolia\.com\/assistant\.js/g) ?? []).length;
  assert.equal(n, 1, `${f} carries the tag exactly once (found ${n})`);
  // The inserted line ends the way the rest of the file does: CRLF stays CRLF.
  const fileNl = html.includes("\r\n") ? "\r\n" : "\n";
  assert.ok(html.includes(`</script>${fileNl}</body>`), `${f}: the tag uses the file's own line ending`);
  if (f === "about.html") assert.equal(fileNl, "\r\n", "the CRLF fixture reached GitHub as CRLF (see .gitattributes)");
  if (f !== "already.html") assert.match(html, /data-position="left"/);
}
const head = await gh(`/repos/${THROWAWAY}/commits/main`);
assert.equal(head.sha, first.commit, "branch head is the installer's commit");
console.log("    read back: every page tagged once, CRLF preserved, head =", head.sha.slice(0, 7));
console.log("PASS");
