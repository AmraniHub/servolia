/**
 * The brand probe's pure parts — everything except the network.
 *
 * The best fixture on this machine is a real one: the local clone of
 * excellence-agency.org. If the probe cannot pull the right name, the navy
 * and the three languages out of THAT site, the whole "type your domain"
 * page mis-dresses the first client it was built for.
 *
 *   node --test tests/brand-probe.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  normalizeDomainInput, isPublicHost, titleFromDomain,
  extractName, extractLanguages, extractAccent, detectNiche,
  firstStylesheetHref,
} from "../src/lib/brandProbe.ts";

test("domain input survives what people actually type", () => {
  assert.equal(normalizeDomainInput("https://www.Clinique-Atlas.ma/contact?x=1"), "clinique-atlas.ma");
  assert.equal(normalizeDomainInput("  Excellence-Agency.ORG  "), "excellence-agency.org");
  assert.equal(normalizeDomainInput("goodscochina.com/needs"), "goodscochina.com");
  assert.equal(normalizeDomainInput("not a domain"), "");
  assert.equal(normalizeDomainInput("nodots"), "");
  assert.equal(normalizeDomainInput(""), "");
  assert.equal(normalizeDomainInput(null), "");
  assert.equal(normalizeDomainInput("a".repeat(300) + ".com"), "");
});

test("SSRF: the probe reaches only the public web", () => {
  for (const ok of ["excellence-agency.org", "sub.example.co.uk", "xn--drome-bsa.fr"]) {
    assert.equal(isPublicHost(ok), true, ok);
  }
  for (const bad of [
    "localhost", "app.localhost", "server.local", "db.internal", "router.lan", "nas.home",
    "127.0.0.1", "10.0.0.5", "172.16.3.9", "192.168.8.1", "169.254.169.254", "0.0.0.0",
    "8.8.8.8", // even a public IP literal is never what a business types
    "nodots",
  ]) {
    assert.equal(isPublicHost(bad), false, bad);
  }
});

test("a name from nothing but the domain still reads like a business", () => {
  assert.equal(titleFromDomain("clinique-atlas.ma"), "Clinique Atlas");
  assert.equal(titleFromDomain("goodscochina.com"), "Goodscochina");
  assert.equal(titleFromDomain("atelier_renov.fr"), "Atelier Renov");
});

test("name extraction prefers og:site_name, then the brand side of <title>", () => {
  assert.equal(extractName('<meta property="og:site_name" content="Ma Clinique"><title>Accueil — Ma Clinique</title>', "x.ma"), "Ma Clinique");
  // content-before-name attribute order, seen in the wild
  assert.equal(extractName('<meta content="Flip Order" property="og:site_name">', "x.ma"), "Flip Order");
  // Brand | long tagline → the short side wins
  assert.equal(extractName("<title>Excellence Agency | مكتب التميز للدراسة في الخارج</title>", "x.org"), "Excellence Agency");
  // Page — Brand → still the short side
  assert.equal(extractName("<title>Nos services et nos équipes — Atlas</title>", "x.ma"), "Atlas");
  assert.equal(extractName("<title>Atlas</title>", "x.ma"), "Atlas");
  assert.equal(extractName("<html></html>", "clinique-atlas.ma"), "Clinique Atlas");
  assert.equal(extractName("<title>Caf&eacute; &amp; Co</title>".replace("&eacute;", "&#233;"), "x.ma"), "Café & Co");
});

test("language detection: switchers count, scripts count, stop-words count", () => {
  assert.deepEqual(extractLanguages('<html lang="fr"><body>' + "les des vous nous votre études nos ".repeat(4) + "</body>"), ["fr"]);
  assert.deepEqual(extractLanguages('<html lang="en"><a hreflang="fr" href="/fr/"></a><body>' + "the and your with our from ".repeat(4) + "</body>"), ["fr", "en"]);
  const arabic = "مرحبا بكم في موقعنا للدراسة في الخارج نحن نساعد الطلاب على تحقيق أحلامهم في أفضل الجامعات حول العالم بخدمات كاملة".repeat(2);
  assert.deepEqual(extractLanguages(`<html lang="ar"><body>${arabic}</body>`), ["ar"]);
  assert.deepEqual(extractLanguages("<html><body>hi</body></html>"), ["fr", "en"], "no signal → the safe pair");
});

test("accent: theme-color wins, else the palette's first saturated custom property", () => {
  assert.equal(extractAccent('<meta name="theme-color" content="#16255c">', ""), "#16255c");
  // whites and greys are not a brand
  assert.equal(extractAccent('<meta name="theme-color" content="#ffffff">', ":root{--main:#d3272e}"), "#d3272e");
  assert.equal(extractAccent("", ":root{--bg:#f8f8f8;--ink:#111111;--navy:#16255c;--gold:#d3272e}"), "#16255c");
  // a too-light brand colour is darkened so white text stays readable
  const light = extractAccent("", ":root{--brand:#ffd28a}");
  assert.notEqual(light, "#ffd28a");
  // nothing usable → the house green
  assert.equal(extractAccent("<html></html>", "body{color:#222222;background:#fefefe}"), "#36671E");
});

test("niche: two independent study-abroad signals or nothing", () => {
  assert.equal(detectNiche("<p>Study abroad with us — student visa help and scholarship advice</p>"), "study-abroad");
  assert.equal(detectNiche("<p>university</p>"), null, "one keyword is a coincidence");
  assert.equal(detectNiche("<p>bathroom renovation quotes</p>"), null);
});

test("stylesheet resolution: the site's OWN sheet, never Google Fonts, data: or private hosts", () => {
  const html = '<link rel="stylesheet" href="data:text/css,x">'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo">'
    + '<link rel="stylesheet" href="//localhost/x.css">'
    + '<link rel="stylesheet" href="css/style.css">';
  assert.equal(firstStylesheetHref(html, "https://example.ma/dir/"), "https://example.ma/dir/css/style.css");
  assert.equal(firstStylesheetHref(html, "https://www.example.ma/dir/"), "https://www.example.ma/dir/css/style.css", "www page still owns its sheet");
  assert.equal(firstStylesheetHref('<link rel="stylesheet" href="https://fonts.googleapis.com/css2">', "https://example.ma/"), null, "fonts alone → no sheet, not the wrong sheet");
  assert.equal(firstStylesheetHref("<p>none</p>", "https://example.ma/"), null);
});

/* ── the real fixture: his own client's site, from the local clone ──────── */
const SITE = "C:/Users/Elamr/Music/APPS/Www.excellenceagency.ma";
const skip = !existsSync(`${SITE}/index.html`) ? "excellence-agency clone not present" : false;

test("the probe dresses excellence-agency.org correctly from its real files", { skip }, () => {
  const html = readFileSync(`${SITE}/index.html`, "utf8");
  const css = readFileSync(`${SITE}/css/style.css`, "utf8");
  assert.equal(extractName(html, "excellence-agency.org"), "Excellence Agency");
  assert.deepEqual(extractLanguages(html), ["ar", "fr", "en"], "lang=ar plus the data-lang switcher");
  assert.equal(extractAccent(html, css), "#16255c", "the navy, not the alert-red gold");
  assert.equal(detectNiche(html), "study-abroad");
  assert.match(firstStylesheetHref(html, "https://excellence-agency.org/") ?? "", /css\/style\.css$/);
});
