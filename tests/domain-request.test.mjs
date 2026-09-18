/**
 * A client asking for another domain.
 *
 * The request is kept in its OWN marker, apart from `servolia-domain:`. That
 * one is the real record — what we bought, what it cost, when it renews, which
 * project it is attached to — and the billing cron reads it. Writing a wish
 * into it would put an unbought domain in front of the client as "being
 * registered" and overwrite the record of the domain they already have.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readDomainRequest, writeDomainRequest, domainRequestState } from "../src/lib/domainRequest.ts";
import { readDomainRecord } from "../src/lib/domainSales.ts";

test("a request survives a round trip", () => {
  const notes = writeDomainRequest(null, { domain: "yiwu-goods.com", yearlyUsd: 26, requested: "2026-09-18T12:00:00.000Z" });
  const rec = readDomainRequest(notes);
  assert.equal(rec.domain, "yiwu-goods.com");
  assert.equal(rec.yearlyUsd, 26);
  assert.equal(domainRequestState(rec), "waiting");
});

test("a request cannot be mistaken for a domain they own", () => {
  // The real marker's own format: the domain bare and first, then key: value.
  const owned = "servolia-domain: goodscochina-shop.com | status: bought | retail: 26";
  const notes = writeDomainRequest(owned, { domain: "another.com", yearlyUsd: 26, requested: "2026-09-18T12:00:00.000Z" });
  // The real record is untouched and still parses as the domain they own.
  assert.ok(notes.includes(owned));
  const real = readDomainRecord(notes);
  assert.equal(real?.domain, "goodscochina-shop.com", "the owned domain must not be replaced by a wish");
  assert.equal(readDomainRequest(notes).domain, "another.com");

  /* And the reverse: a request ALONE must not be read as an owned domain.
     "servolia-domain-request:" does not start with "servolia-domain:" only
     because of where the colon falls, which is a thinner margin than it
     looks — so it is pinned here. */
  const onlyAsked = writeDomainRequest(null, { domain: "wish.com", yearlyUsd: 26, requested: "2026-09-18T12:00:00.000Z" });
  assert.equal(readDomainRecord(onlyAsked), null, "a wish is not a domain they own");
});

test("a refused request reads as nothing, so the page offers the search again", () => {
  const notes = writeDomainRequest(null, {
    domain: "another.com", yearlyUsd: 26,
    requested: "2026-09-18T12:00:00.000Z", refused: "2026-09-18T13:00:00.000Z",
  });
  assert.equal(domainRequestState(readDomainRequest(notes)), "none");
});

test("asking again replaces the request rather than stacking a second", () => {
  let notes = writeDomainRequest(null, { domain: "one.com", yearlyUsd: 26, requested: "2026-09-18T12:00:00.000Z" });
  notes = writeDomainRequest(notes, { domain: "two.com", yearlyUsd: 30, requested: "2026-09-18T14:00:00.000Z" });
  assert.equal(notes.split("\n").filter((l) => l.startsWith("servolia-domain-request:")).length, 1);
  assert.equal(readDomainRequest(notes).domain, "two.com");
  assert.equal(writeDomainRequest(notes, null).includes("servolia-domain-request:"), false, "clearing removes it");
});

test("a malformed marker is no request, not a request for nothing", () => {
  assert.equal(readDomainRequest("servolia-domain-request: domain: x.com"), null, "no price is not a quote");
  assert.equal(readDomainRequest("servolia-domain-request: usd: 26"), null);
  assert.equal(readDomainRequest(null), null);
  assert.equal(domainRequestState(null), "none");
});
