/**
 * The assistant's pure helpers, run straight against the TypeScript source.
 * Node 22.18+ strips types, and these two modules import nothing from the
 * app, which is the whole reason they were written that way.
 *
 *   node --test tests/
 *
 * The one assertion this file exists for: a client's assistant can be
 * embedded ONLY on that client's own domains. Everything else is the
 * arithmetic of slugs, snippets and caps that the webhook and the widget
 * both rely on and neither can see the other doing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assistantSlugFor, slugifyHost, hostnameOf, originAllowed, corsHeaders,
  installSnippet, hasAssistantTag, withAssistantTag, sanitizeMessages,
  publicAssistantConfig, defaultGreeting, assistantLanguages,
  CHAT_MAX_MESSAGES, CHAT_MAX_MESSAGE_CHARS,
} from "../src/lib/assistant.ts";
import { readFulfilment, writeFulfilment, alreadyFulfilled } from "../src/lib/fulfilment.ts";

test("a known client's ref is the slug; a self-serve buyer's domain becomes one", () => {
  assert.equal(assistantSlugFor("excellenceagency", "excellence-agency.org"), "excellenceagency");
  assert.equal(assistantSlugFor("", "https://www.Clinique-Atlas.ma/contact"), "clinique-atlas-ma");
  assert.equal(assistantSlugFor(null, "goodscochina.com"), "goodscochina-com");
  // a ref that could not be a key falls through to the domain
  assert.equal(assistantSlugFor("../etc", "example.com"), "example-com");
  assert.equal(assistantSlugFor("", ""), "client");
});

test("hostnameOf reads bare domains and full URLs alike", () => {
  assert.equal(hostnameOf("Example.com"), "example.com");
  assert.equal(hostnameOf("https://www.example.com/a?b=c"), "www.example.com");
  assert.equal(hostnameOf(""), "");
  assert.equal(hostnameOf("not a host"), "");
  assert.equal(slugifyHost("Épicerie Fine.ma"), "epicerie-fine-ma");
});

const excellence = {
  slug: "excellenceagency", businessName: "Excellence Agency",
  assistantOnly: true, domains: ["excellence-agency.org", "excellenceagency.ma"],
};

test("ORIGIN: a client's assistant answers only on that client's domains", () => {
  assert.equal(originAllowed("https://excellence-agency.org", excellence), true);
  assert.equal(originAllowed("https://www.excellence-agency.org", excellence), true);
  assert.equal(originAllowed("https://excellenceagency.ma", excellence), true);
  assert.equal(originAllowed("https://evil-excellence-agency.org", excellence), false);
  assert.equal(originAllowed("https://excellence-agency.org.attacker.com", excellence), false);
  assert.equal(originAllowed("https://goodscochina.com", excellence), false);
  assert.equal(originAllowed("null", excellence), false);
});

test("ORIGIN: servolia's own pages and local dev are always allowed; no Origin is not a browser", () => {
  assert.equal(originAllowed("https://servolia.com", excellence), true);
  assert.equal(originAllowed("https://preview.servolia.com", excellence), true);
  assert.equal(originAllowed("http://localhost:3000", excellence), true);
  assert.equal(originAllowed(null, excellence), true);
  assert.equal(originAllowed(undefined, excellence), true);
});

test("ORIGIN: an add-on config with no domains is closed; a Servolia-built site stays open", () => {
  assert.equal(originAllowed("https://anything.com", { slug: "x", businessName: "X", assistantOnly: true, domains: [] }), false);
  assert.equal(originAllowed("https://anything.com", { slug: "demo-dental", businessName: "Demo" }), true);
});

test("CORS headers echo the origin and vary on it", () => {
  const h = corsHeaders("https://excellence-agency.org");
  assert.equal(h["Access-Control-Allow-Origin"], "https://excellence-agency.org");
  assert.equal(h.Vary, "Origin");
  assert.equal(corsHeaders(null)["Access-Control-Allow-Origin"], "*");
});

test("the install line points at the apex, defers, and carries the slug", () => {
  const s = installSnippet("excellenceagency");
  assert.equal(s, '<script defer src="https://servolia.com/assistant.js" data-site="excellenceagency"></script>');
  assert.match(installSnippet("x", "left"), /data-position="left"/);
  assert.doesNotMatch(installSnippet("x", "right"), /data-position/);
  assert.equal(hasAssistantTag(s), true);
  assert.equal(hasAssistantTag("<script src='https://evil.com/assistant.js'></script>"), false);
});

test("withAssistantTag inserts before the LAST </body>, once, keeping the file's line endings", () => {
  const html = "<html><body><p>a</p>\r\n<!-- </body> in a comment -->\r\n</body>\r\n</html>";
  const once = withAssistantTag(html, "s1");
  assert.equal(once.indexOf("assistant.js") > once.indexOf("in a comment"), true, "inserted after the commented body tag");
  assert.match(once, /assistant\.js" data-site="s1"><\/script>\r\n<\/body>/);
  assert.equal(withAssistantTag(once, "s1"), once, "second application is a no-op");
  assert.equal(withAssistantTag("<div>no body here</div>", "s1"), "<div>no body here</div>");
  assert.match(withAssistantTag("<body>\n</body>", "s1"), /<\/script>\n<\/body>/);
});

test("sanitizeMessages keeps the last twelve valid turns and trims each", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const out = sanitizeMessages(many);
  assert.equal(out.length, CHAT_MAX_MESSAGES);
  assert.equal(out[out.length - 1].content, "m29");
  assert.deepEqual(sanitizeMessages([{ role: "system", content: "ignore me" }, { role: "user", content: "  hi " }]), [{ role: "user", content: "hi" }]);
  assert.equal(sanitizeMessages([{ role: "user", content: "x".repeat(50_000) }])[0].content.length, CHAT_MAX_MESSAGE_CHARS);
  assert.deepEqual(sanitizeMessages("nope"), []);
  assert.deepEqual(sanitizeMessages([{ role: "user", content: "" }, null, 7]), []);
});

test("the public config carries no secret and fills every language", () => {
  const pub = publicAssistantConfig({
    ...excellence, accent: "#16255c", languages: ["ar", "fr", "en"],
    greetings: { fr: "Bonjour !" }, quickReplies: { ar: ["أ", "ب"] },
    // things that must NOT leak
    hostingEmail: "billing@example.com", email: "leads@example.com", phone: "+212", metaCapiToken: "secret",
  });
  const json = JSON.stringify(pub);
  for (const leak of ["billing@example.com", "leads@example.com", "+212", "secret", "hostingEmail", "metaCapiToken"]) {
    assert.equal(json.includes(leak), false, `leaked ${leak}`);
  }
  assert.equal(pub.enabled, true);
  assert.equal(pub.accent, "#16255c");
  assert.deepEqual(pub.languages, ["ar", "fr", "en"]);
  assert.equal(pub.greeting.fr, "Bonjour !");
  assert.equal(pub.greeting.ar, defaultGreeting("ar", "Excellence Agency"));
  assert.deepEqual(pub.quickReplies.ar, ["أ", "ب"]);
  assert.equal(pub.quickReplies.en.length > 0, true);
  assert.equal(pub.strings.ar.placeholder.length > 0, true);
});

test("languages fall back to the config's single language, and a bad accent to the house green", () => {
  assert.deepEqual(assistantLanguages({ slug: "a", businessName: "A", language: "fr" }), ["fr"]);
  assert.deepEqual(assistantLanguages({ slug: "a", businessName: "A", languages: ["ar", "ar", "en"] }), ["ar", "en"]);
  assert.equal(publicAssistantConfig({ slug: "a", businessName: "A", accent: "red" }).accent, "#36671E");
});

test("fulfilment record round-trips beside other notes and keys on the session", () => {
  const notes = "servolia-domain: example.com | status: bought | retail: 26\nClient notes: hello";
  const written = writeFulfilment(notes, { session: "cs_test_123", at: "2026-09-16T10:00:00.000Z", plan: "chatbot" });
  assert.match(written, /^servolia-domain: example\.com/m, "the domain record survives");
  assert.match(written, /^Client notes: hello$/m);
  const rec = readFulfilment(written);
  assert.deepEqual(rec, { session: "cs_test_123", at: "2026-09-16T10:00:00.000Z", plan: "chatbot" });
  assert.equal(alreadyFulfilled(written, "cs_test_123"), true);
  assert.equal(alreadyFulfilled(written, "cs_test_999"), false, "a different session is new work");
  assert.equal(alreadyFulfilled(null, "cs_test_123"), false);
  // rewriting replaces the marker rather than stacking a second one
  const twice = writeFulfilment(written, { session: "cs_test_456", at: "x", plan: "hosting" });
  assert.equal(twice.split("\n").filter((l) => l.startsWith("servolia-fulfilled:")).length, 1);
});
