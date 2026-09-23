/**
 * C2 — a practice's site at her own domain (src/lib/siteHost.ts,
 * src/lib/siteDomain.ts, src/proxy.ts).
 *
 *   node --import ./tests/register.mjs --test tests/site-domain.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const H = await import("../src/lib/siteHost.ts");
const D = await import("../src/lib/siteDomain.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("which hosts are ours, and what her domain is called", () => {
  for (const h of ["servolia.com", "www.servolia.com", "localhost:3000", "servolia-abc.vercel.app", "app.servolia.com", ""]) {
    assert.equal(H.isOurHost(h), true, h);
  }
  assert.equal(H.isOurHost("cabinet-dupont.fr"), false);
  assert.equal(H.apexOf("WWW.Cabinet-Dupont.fr:443"), "cabinet-dupont.fr");
});

test("her domain serves her pages and nothing of servolia.com", () => {
  const s = "cabinet-dupont-fr";
  const multi = { multiPage: true };
  assert.deepEqual(H.hostRoute("/", s), { kind: "rewrite", to: `/sites/${s}` });
  assert.deepEqual(H.hostRoute("/cabinet", s, multi), { kind: "rewrite", to: `/sites/${s}/cabinet` });
  assert.deepEqual(H.hostRoute("/cabinet", s), { kind: "not-found" }, "a single-page site has no /cabinet — a plain 404, never Servolia's branded one");
  assert.deepEqual(H.hostRoute("/confidentialite/", s), { kind: "rewrite", to: `/sites/${s}/confidentialite` });
  assert.deepEqual(H.hostRoute("/robots.txt", s), { kind: "rewrite", to: `/api/sites/${s}/robots` });
  assert.deepEqual(H.hostRoute("/sitemap.xml", s), { kind: "rewrite", to: `/api/sites/${s}/sitemap` });
  assert.deepEqual(H.hostRoute("/api/site-chat", s), { kind: "rewrite", to: `/api/chat?site=${s}` }, "the chat is pinned to HER slug");
  assert.deepEqual(H.hostRoute(`/api/sites/${s}/lead`, s), { kind: "pass" });
  assert.deepEqual(H.hostRoute("/api/track", s), { kind: "pass" });
  assert.deepEqual(H.hostRoute(`/sites/${s}/cabinet`, s), { kind: "redirect", to: "/cabinet" });
  assert.deepEqual(H.hostRoute(`/sites/${s}//evil.com`, s), { kind: "redirect", to: "/evil.com" }, "no protocol-relative redirect");
  for (const p of ["/pricing", "/admin", "/portal", "/api/chat", "/api/admin/today", "/fr", "/sites/other-site", "/favicon.ico", "/cabinet/x", "/dashboard"]) {
    assert.deepEqual(H.hostRoute(p, s, multi), { kind: "not-found" }, p);
  }
});

test("her pages carry her name, her canonical, and are indexable there", () => {
  const m = H.customHostMetadata({ slug: "x", businessName: "Cabinet Dupont", city: "Lyon", heroSub: "Soins", language: "fr" }, "cabinet-dupont.fr", "/cabinet", "Cabinet");
  assert.deepEqual(m.title, { absolute: "Cabinet · Cabinet Dupont · Lyon" }, "no '| Servolia' template");
  assert.deepEqual(m.alternates, { canonical: "https://cabinet-dupont.fr/cabinet" }, "no hreflang to servolia.com");
  assert.deepEqual(m.robots, { index: true, follow: true });
  assert.equal(m.other[H.SITE_MARKER], "x", "the go-live marker names the site");
  assert.ok(!JSON.stringify(m).toLowerCase().includes("servolia"));
  assert.equal(H.siteUrlFor({ slug: "x", customDomain: "d.fr" }), "https://servolia.com/sites/x", "not live yet: the preview");
  assert.equal(H.siteUrlFor({ slug: "x", customDomain: "d.fr", domainLiveAt: "t" }), "https://d.fr");
});

test("the DNS lines she is given come from Vercel, with safe defaults and any ownership TXT", () => {
  const lines = D.dnsLinesFrom("d.fr", { recommendedIPv4: [{ rank: 1, value: ["76.76.21.99"] }], recommendedCNAME: [{ rank: 1, value: "abc.vercel-dns-017.com." }] },
    [{ type: "TXT", domain: "_vercel.d.fr", value: "vc-domain-verify=d.fr,123" }]);
  assert.deepEqual(lines, [
    { type: "A", name: "@", value: "76.76.21.99" },
    { type: "CNAME", name: "www", value: "abc.vercel-dns-017.com" },
    { type: "TXT", name: "_vercel", value: "vc-domain-verify=d.fr,123" },
  ]);
  assert.deepEqual(D.dnsLinesFrom("d.fr", null).map((l) => l.value), ["76.76.21.21", "cname.vercel-dns.com"]);
});

test("'live' means her domain serves THIS site, nothing less", () => {
  assert.equal(D.servesSite('<head><meta name="site-id" content="cabinet-dupont-fr"/></head>', "cabinet-dupont-fr"), true);
  assert.equal(D.servesSite('<meta content="cabinet-dupont-fr" name="site-id">', "cabinet-dupont-fr"), true);
  assert.equal(D.servesSite('<meta name="site-id" content="someone-else"/>', "cabinet-dupont-fr"), false, "another site");
  assert.equal(D.servesSite("<html>parked domain</html>", "cabinet-dupont-fr"), false, "a parking page");
});

test("the proxy: our hosts untouched, a spoofed x-site-host stripped, dotted paths reached", () => {
  const p = code("src/proxy.ts");
  assert.ok(p.includes("if (!isOurHost(host))"), "only foreign hosts are looked up");
  assert.ok(p.includes('requestHeaders.delete("x-site-host")'), "nobody outside can claim to be a custom host");
  assert.ok(p.includes('new NextResponse("Not found", { status: 404 })'));
  assert.ok(/matcher: \["\/\(\(\?!_next\/static\|_next\/image\)\.\*\)"\]/.test(p), "robots.txt and sitemap.xml reach the proxy");
  assert.ok(p.includes("`${proto}://${host}`"), "a redirect lands on her domain, not the internal address");
});

test("nothing on her page names Servolia: head tags, 404 payload, chrome, footer, storage", () => {
  assert.ok(!src("src/app/layout.tsx").includes("facebook-domain-verification\":"), "not in root metadata, which merges into every page");
  const head = src("src/components/ServoliaOnly.tsx");
  assert.ok(head.includes('if (segment === "sites") return null;') && head.includes("<ServoliaTags />"), "schema rendered by the client gate, not passed as children");
  assert.ok(head.includes('dynamic(() => import("@/components/ServoliaTags"))'), "…and loaded on demand, never in her page's bundle");
  assert.ok(src("src/components/ServoliaTags.tsx").includes("<OrgSchema />"));
  const chrome = src("src/components/SiteChrome.tsx");
  for (const c of ["CookieBanner", "Analytics", "ScrollToTop"]) {
    assert.ok(chrome.includes(`const ${c} = dynamic(() => import("@/components/${c}"))`), `${c} on demand`);
  }
  assert.ok(src("src/components/NotFoundLazy.tsx").includes('dynamic(() => import("@/components/NotFoundView"))'), "the 404's Navbar/Footer on demand");
  const w = code("src/components/ChatWidget.tsx");
  assert.ok(!/servolia/i.test(w), "the neutral chat widget names nobody");
  assert.ok(src("src/components/ServoliaChat.tsx").includes('brandName="Solia by Servolia"'), "Servolia's words live in its own wrapper");
  assert.ok(!/<ServoliaHead>[\s\S]*<\/ServoliaHead>/.test(src("src/app/layout.tsx")), "no server children to leak into the payload");
  assert.ok(src("src/components/NotFoundView.tsx").startsWith('"use client"'), "the 404 boundary travels as a reference, not as Servolia's footer");
  assert.ok(src("src/components/SiteChrome.tsx").includes('if (segments[0] === "sites") return <PageTracker'), "no Servolia banner or analytics on a client site");
  const site = code("src/components/ClientSite.tsx");
  assert.ok(!site.includes("Built with Servolia") && !site.includes("servolia-chat-widget"));
  assert.ok(!code("src/components/ChatWidget.tsx").includes("servolia_chat_sid_"), "neutral storage key");
});

test("her own trackers wait for her visitors' consent, and only clean ids reach a script", () => {
  const a = src("src/components/ClientAnalytics.tsx");
  assert.ok(a.includes('choice === "yes" && ga') && a.includes('choice === "yes" && px'), "nothing loads before yes");
  assert.ok(a.includes("CLEAN_ID.test(ga4Id)") && a.includes("/^\\d{5,20}$/.test(metaPixelId)"));
  assert.ok(!a.includes("servolia"), "neutral consent key");
});

test("the go-live email goes once, when it is true, with her address", () => {
  const status = code("src/app/api/admin/set-site-status/route.ts");
  assert.ok(status.includes("!cfg?.customDomain"), "publishing a site with her domain does not announce servolia.com");
  const build = code("src/app/api/admin/builds/[id]/route.ts");
  assert.ok(build.includes("if (!site?.slug)"), "no second go-live email from the build");
  const cron = code("src/app/api/cron/domain-live/route.ts");
  assert.ok(cron.includes("liveEmail(greet, `https://${e.domain}`"), "her domain in the email");
  const lib = code("src/lib/siteDomain.ts");
  assert.ok(lib.indexOf('update({ config: next })') < lib.indexOf("live.push("), "stamped before the caller emails");
  const vc = JSON.parse(src("vercel.json"));
  assert.ok(vc.crons.some((c) => c.path === "/api/cron/domain-live"), "scheduled");
});

test("a live domain takes over from the servolia.com copy, never for a draft preview", () => {
  for (const f of ["src/app/sites/[slug]/page.tsx", "src/app/sites/[slug]/[page]/page.tsx", "src/app/sites/[slug]/confidentialite/page.tsx"]) {
    const s = code(f);
    assert.ok(/!host && access === "public" && \w+\.customDomain && \w+\.domainLiveAt/.test(s), `${f} redirects only public views`);
  }
});

/* ── the C2 review (2026-09-22), each finding held ─────────────────────── */

test("a domain attached to a practice never falls through to servolia.com", () => {
  const p = code("src/proxy.ts");
  assert.ok(p.includes('if (site === "error")') && p.includes("status: 503"), "a database error is 'try again', not our homepage");
  assert.ok(p.includes("if (site && !site.published)") && p.includes("notReadyPage(site.lang)"), "a draft or unpublished site shows her 'coming soon', not ours");
  const host = code("src/lib/siteHost.ts");
  assert.ok(!/eq\("status", "published"\)/.test(host.slice(host.indexOf("export async function siteForHost"))), "the lookup finds her site in ANY state");
  assert.ok(!H.notReadyPage("fr").toLowerCase().includes("servolia"));
  const gen = code("src/lib/generateSite.ts");
  assert.ok(gen.includes("config.customDomain = prev.customDomain"), "a regenerate keeps her domain");
  const dom = code("src/lib/siteDomain.ts");
  assert.ok(dom.includes("await rollback([apex])") && dom.includes("await rollback([`www.${apex}`, apex])"), "a half-finished attach is undone");
  assert.ok(dom.includes("if (!apexGone) return false;"), "the row is cleared only once Vercel let go");
});

test("the chat on her domain answers only as her receptionist", () => {
  const chat = code("src/app/api/chat/route.ts");
  assert.ok(/const pinned = req\.nextUrl\.searchParams\.get\("site"\);\s*const siteSlug = pinned \?/.test(chat), "the pinned slug wins over the body");
  assert.ok(code("src/app/api/chat-fallback/route.ts").includes('req.nextUrl.searchParams.get("site") || body.siteSlug'));
});

test("no other client's details ship in the JavaScript every page loads", () => {
  const chrome = code("src/components/SiteChrome.tsx");
  assert.ok(!chrome.includes("siteEditor"), "SiteChrome no longer imports the client configs");
  assert.ok(code("src/app/layout.tsx").includes("<SiteChrome editorPaths={editorMountPaths()} />"), "the server passes only the paths");
  const tracker = code("src/components/PageTracker.tsx");
  assert.ok(!tracker.includes("servolia_sid") && !tracker.includes("servolia_utm"), "neutral storage keys");
  assert.ok(!code("src/app/layout.tsx").includes("GOOGLE_SITE_VERIFICATION"), "no verification token merged into her pages");
});

test("the go-live email: once, to the account holder, and honest about whether it went", () => {
  const dom = code("src/lib/siteDomain.ts");
  assert.ok(dom.includes('.is("config->>domainLiveAt", null).select("id")'), "the stamp is conditional: two runs cannot both announce");
  assert.ok(dom.includes("announce: c.liveNotifiedFor !== domain"), "a re-attached domain is not re-announced");
  const cron = code("src/app/api/cron/domain-live/route.ts");
  assert.ok(cron.indexOf('from("builds").select("email")') < cron.indexOf("to = to || e.contactEmail"), "the account address first");
  assert.ok(cron.includes("sent = await sendEmail(") && cron.includes("FAILED - tell her yourself"), "a failed send is reported as failed");
  assert.ok(code("src/app/api/admin/set-site-status/route.ts").includes("to = to || (cfg?.email ?? null);"), "publishing emails the account address first too");
});

test("her domain gets what is hers: no includeSubDomains, a temporary redirect, apex only", () => {
  const cfg = src("next.config.ts");
  assert.ok(cfg.includes('{ key: "Strict-Transport-Security", value: "max-age=31536000" }'), "no includeSubDomains by default");
  // The source holds `\\.` (a backslash-escaped dot in a TS string): four here.
  assert.ok(cfg.includes('has: [{ type: "host", value: "(www\\\\.)?servolia\\\\.com" }]'), "includeSubDomains only on our own host");
  for (const f of ["src/app/sites/[slug]/page.tsx", "src/app/sites/[slug]/[page]/page.tsx", "src/app/sites/[slug]/confidentialite/page.tsx"]) {
    assert.ok(!code(f).includes("permanentRedirect("), `${f}: a browser must not cache the move forever`);
  }
  assert.equal(D.isApexDomain("cabinet-dupont.fr"), true);
  assert.equal(D.isApexDomain("cabinet.co.uk"), true);
  assert.equal(D.isApexDomain("rdv.cabinet-dupont.fr"), false, "a subdomain would get apex DNS lines");
  assert.deepEqual(D.dnsLinesFrom("d.fr", { aValues: ["1.2.3.4"] }).map((l) => l.value)[0], "76.76.21.21", "her CURRENT A record is not the one to set");
});
