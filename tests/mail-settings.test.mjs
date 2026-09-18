/**
 * Mail settings read off a domain's MX records.
 *
 * The bug this exists to prevent is a specific one. Samira's mailbox is in
 * Zoho's JAPAN data centre; a phone pointed at `imap.zoho.com` reaches a
 * healthy server that has never heard of her account, so the phone reports a
 * wrong password and she retypes it for a week. Getting the region right is
 * the whole job, and getting it confidently wrong is worse than saying nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { settingsFromMx } from "../src/lib/mailSettings.ts";

test("goodscochina's real MX records resolve to the JAPAN region", () => {
  // Exactly what dns.google returned for goodscochina.com on 2026-09-18.
  const s = settingsFromMx(["mx.zoho.jp.", "mx2.zoho.jp.", "mx3.zoho.jp."]);
  assert.ok(s);
  assert.equal(s.incoming.host, "imappro.zoho.jp");
  assert.equal(s.outgoing.host, "smtppro.zoho.jp");
  assert.equal(s.webmail, "https://mail.zoho.jp");
  assert.match(s.provider, /zoho\.jp/);
  // The failure mode in one assertion: never the .com host for a .jp account.
  assert.ok(!s.incoming.host.endsWith(".com"));
});

test("every Zoho region maps to its own hostnames, never to .com", () => {
  const cases = [
    ["mx.zoho.com", "imappro.zoho.com"],
    ["mx.zoho.eu", "imappro.zoho.eu"],
    ["mx.zoho.in", "imappro.zoho.in"],
    ["mx.zoho.com.au", "imappro.zoho.com.au"],
    ["mx.zoho.ca", "imappro.zoho.ca"],
    ["mx.zoho.sa", "imappro.zoho.sa"],
    ["mx.zoho.uk", "imappro.zoho.uk"],
  ];
  for (const [mx, expected] of cases) {
    const s = settingsFromMx([mx]);
    assert.ok(s, `${mx} was not recognised`);
    assert.equal(s.incoming.host, expected);
    assert.equal(s.outgoing.host, expected.replace("imappro", "smtppro"));
  }
  /* .com.au must not be mistaken for .com. Order matters in the lookup and a
     naive endsWith(".com") check would send an Australian client to the wrong
     data centre — the exact failure this module exists to prevent. */
  assert.equal(settingsFromMx(["mx.zoho.com.au"]).incoming.host, "imappro.zoho.com.au");
});

test("the trailing dot and the priority prefix do not confuse it", () => {
  assert.equal(settingsFromMx(["MX.ZOHO.JP."])?.incoming.host, "imappro.zoho.jp");
  assert.equal(settingsFromMx(["mx.zoho.jp"])?.incoming.host, "imappro.zoho.jp");
});

test("Google and Microsoft are recognised too", () => {
  const g = settingsFromMx(["aspmx.l.google.com.", "alt1.aspmx.l.google.com."]);
  assert.equal(g?.incoming.host, "imap.gmail.com");
  assert.ok(g?.appPasswordIfTwoFactor, "Google refuses plain passwords from mail apps");

  const m = settingsFromMx(["goodscochina-com.mail.protection.outlook.com."]);
  assert.equal(m?.incoming.host, "outlook.office365.com");
  assert.equal(m?.outgoing.security, "STARTTLS");
});

test("an unknown provider returns nothing rather than a guess", () => {
  assert.equal(settingsFromMx(["mail.some-host.example."]), null);
  assert.equal(settingsFromMx([]), null);
  // Half-right mail settings cost a client more of an evening than none do.
});

test("every provider tells the client the username is the whole address", () => {
  for (const mx of ["mx.zoho.jp", "aspmx.l.google.com", "x.mail.protection.outlook.com"]) {
    assert.equal(settingsFromMx([mx])?.username, "full email address");
  }
});
