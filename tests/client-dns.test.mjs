import test from "node:test";
import assert from "node:assert/strict";

const dns = await import("../src/lib/clientDns.ts");
const { writeDomainRecord } = await import("../src/lib/domainSales.ts");
const { writeOwnedDomainNote } = await import("../src/lib/ownedDomain.ts");
const { writeExtraDomain } = await import("../src/lib/extraDomains.ts");

const D = "clientice360.com";
const ok = (raw) => {
  const r = dns.validateDnsInput(raw, D);
  assert.equal(r.ok, true, r.error);
  return r.value;
};
const bad = (raw, re) => {
  const r = dns.validateDnsInput(raw, D);
  assert.equal(r.ok, false, `expected refusal for ${JSON.stringify(raw)}`);
  if (re) assert.match(r.error, re);
};

test("names: @ is the root, a pasted full host is reduced, junk is refused", () => {
  assert.equal(dns.normaliseName("@", D), "");
  assert.equal(dns.normaliseName(" Mail ", D), "mail");
  assert.equal(dns.normaliseName("mail.clientice360.com.", D), "mail");
  assert.equal(dns.normaliseName("clientice360.com", D), "");
  assert.equal(dns.normaliseName("_dmarc", D), "_dmarc");
  assert.equal(dns.normaliseName("google._domainkey", D), "google._domainkey");
  assert.equal(dns.normaliseName("bad name", D), null);
  assert.equal(dns.normaliseName("-x", D), null);
});

test("the names where the hosting answers cannot take A/AAAA/CNAME", () => {
  bad({ type: "A", name: "@", value: "1.2.3.4" }, /hosted/);
  bad({ type: "CNAME", name: "www", value: "evil.example.net" }, /hosted/);
  bad({ type: "AAAA", name: "", value: "2001:db8::1" }, /hosted/);
  bad({ type: "A", name: "*", value: "1.2.3.4" }, /Wildcard/);
  bad({ type: "TXT", name: "*.x", value: "hi" }, /Wildcard/);
  // ...but mail and verification at the root are the client's.
  assert.equal(ok({ type: "MX", name: "@", value: "MX.Zoho.EU", mxPriority: 10 }).value, "mx.zoho.eu");
  assert.equal(ok({ type: "TXT", name: "@", value: '"google-site-verification=abc"' }).value, "google-site-verification=abc");
  assert.equal(ok({ type: "A", name: "shop", value: "192.0.2.10" }).name, "shop");
  assert.equal(ok({ type: "CNAME", name: "blog", value: "ghs.googlehosted.com" }).value, "ghs.googlehosted.com");
});

test("values are checked per type, and only five types exist", () => {
  bad({ type: "A", name: "x", value: "999.1.1.1" }, /IPv4/);
  bad({ type: "AAAA", name: "x", value: "1.2.3.4" }, /IPv6/);
  bad({ type: "CNAME", name: "x", value: "not a host" }, /host name/);
  bad({ type: "MX", name: "@", value: "mx.zoho.eu", mxPriority: 70000 }, /priority/);
  bad({ type: "NS", name: "x", value: "ns1.example.com" }, /type/);
  bad({ type: "CAA", name: "@", value: '0 issue "x"' }, /type/);
  bad({ type: "TXT", name: "x", value: "" }, /empty/);
  bad({ type: "TXT", name: "x", value: "a" + String.fromCharCode(10) + "b" }, /characters/);
  bad({ type: "TXT", name: "x", value: "v", ttl: 5 }, /TTL/);
  assert.equal(ok({ type: "TXT", name: "x", value: "v" }).ttl, dns.DEFAULT_TTL);
});

test("what Vercel made, and the hosting names, come back locked", () => {
  assert.equal(dns.lockReasonFor({ type: "ALIAS", name: "", creator: "system" }), "system");
  assert.equal(dns.lockReasonFor({ type: "CAA", name: "", creator: "system" }), "system");
  assert.equal(dns.lockReasonFor({ type: "A", name: "www", creator: "abc" }), "hosting");
  assert.equal(dns.lockReasonFor({ type: "NS", name: "x", creator: "abc" }), "type");
  assert.equal(dns.lockReasonFor({ type: "MX", name: "", creator: "abc" }), null);
  assert.equal(dns.lockReasonFor({ type: "TXT", name: "_dmarc", creator: "abc" }), null);
});

test("the hosting's own proof names are refused at any depth, and shown locked", () => {
  bad({ type: "TXT", name: "_vercel", value: "vc-domain-verify=x" }, /hosting itself/);
  bad({ type: "TXT", name: "_acme-challenge", value: "x" }, /hosting itself/);
  bad({ type: "CNAME", name: "_acme-challenge.www", value: "x.example.net" }, /hosting itself/);
  assert.equal(dns.lockReasonFor({ type: "TXT", name: "_vercel", creator: "abc" }), "system");
});

test("a domain-only order counts only once the founder links it (never by email)", () => {
  const linked = dns.writeLinkedDomain("other-line", "ClientIce360.com ");
  assert.deepEqual(dns.domainsFromNotes(linked), ["clientice360.com"]);
  // Idempotent, and it keeps the notes' other lines.
  const twice = dns.writeLinkedDomain(linked, "clientice360.com");
  assert.equal(twice.split(String.fromCharCode(10)).filter((l) => l.includes("clientice360")).length, 1);
  assert.ok(twice.startsWith("other-line"));
});

test("a client's domains come from all three note markers, failed ones excluded", () => {
  let notes = "";
  notes = writeDomainRecord(notes, { domain: "Plan.com", status: "bought", retailUsd: 27.9 });
  notes = writeOwnedDomainNote(notes, { domain: "owned.com", usd: 27.9, project: "p", renewsOn: "2027-09-25", paidOn: "2026-09-25" });
  notes = writeExtraDomain(notes, { domain: "extra.net", retailUsd: 30, boughtAt: "2026-09-30" });
  notes = writeExtraDomain(notes, { domain: "broken.io", retailUsd: 30, failed: "taken" });
  assert.deepEqual(dns.domainsFromNotes(notes).sort(), ["extra.net", "owned.com", "plan.com"]);
  // A plan domain still being bought is not manageable yet.
  assert.deepEqual(dns.domainsFromNotes(writeDomainRecord("", { domain: "p.com", status: "pending", retailUsd: 1 })), []);
});
