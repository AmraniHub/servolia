/**
 * Domains a client bought after their plan.
 *
 * The plan's own domain lives in `servolia-domain:` — one line, written by the
 * checkout, read by the account page, charged by the cron. A second domain
 * written in there would erase the first, which is why these have their own
 * marker and may repeat.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readExtraDomains, writeExtraDomain, hasExtraDomain } from "../src/lib/extraDomains.ts";
import { readDomainRecord } from "../src/lib/domainSales.ts";

const PLAN_DOMAIN = "servolia-domain: goodscochina-shop.com | status: bought | retail: 26";

test("an add-on never touches the domain that came with the plan", () => {
  const notes = writeExtraDomain(PLAN_DOMAIN, {
    domain: "yiwu-goods.com", retailUsd: 26, boughtAt: "2026-09-18", nextChargeAt: "2027-09-18",
  });
  assert.equal(readDomainRecord(notes)?.domain, "goodscochina-shop.com", "the plan's domain must survive");
  assert.deepEqual(readExtraDomains(notes).map((d) => d.domain), ["yiwu-goods.com"]);
  // And an add-on alone is not mistaken for the plan's domain.
  assert.equal(readDomainRecord(writeExtraDomain(null, { domain: "a.com", retailUsd: 26 })), null);
});

test("a client can hold several, each with its own renewal date", () => {
  let notes = writeExtraDomain(null, { domain: "one.com", retailUsd: 26, nextChargeAt: "2027-03-01" });
  notes = writeExtraDomain(notes, { domain: "two.com", retailUsd: 32, nextChargeAt: "2027-09-18" });
  const all = readExtraDomains(notes);
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((d) => d.nextChargeAt), ["2027-03-01", "2027-09-18"]);
  assert.deepEqual(all.map((d) => d.retailUsd), [26, 32]);
});

test("the same domain twice is one domain, because Stripe delivers twice", () => {
  /* A duplicated webhook is normal, not exceptional. Writing by domain name
     means the second delivery updates the record instead of billing the
     client for a second copy of something they own once. */
  let notes = writeExtraDomain(null, { domain: "one.com", retailUsd: 26 });
  notes = writeExtraDomain(notes, { domain: "one.com", retailUsd: 26, orderId: "ord_1", boughtAt: "2026-09-18" });
  const all = readExtraDomains(notes);
  assert.equal(all.length, 1);
  assert.equal(all[0].orderId, "ord_1");
  assert.ok(hasExtraDomain(notes, "one.com"));
  assert.ok(!hasExtraDomain(notes, "two.com"));
});

test("other markers in that column are carried through untouched", () => {
  const before = [
    PLAN_DOMAIN,
    "servolia-editor-pw: hash: " + "a".repeat(64) + " | set: 2026-09-18T00:00:00.000Z",
    "servolia-trial: until: 2026-09-25 | started: 2026-09-18",
  ].join("\n");
  const after = writeExtraDomain(before, { domain: "new.com", retailUsd: 26 });
  for (const line of before.split("\n")) assert.ok(after.includes(line), `dropped: ${line}`);
});

test("a half-written line is no domain, not a domain at no price", () => {
  assert.deepEqual(readExtraDomains("servolia-extra-domain: domain: x.com"), [], "no price means no record");
  assert.deepEqual(readExtraDomains("servolia-extra-domain: retail: 26"), []);
  assert.deepEqual(readExtraDomains(null), []);
});
