/**
 * The hosting setup tracker (src/lib/hostingSetup.ts, hostingSetupRun.ts,
 * hostingSetupProbe.ts, hostingSetupEmails.ts).
 *
 *   node --import ./tests/register.mjs --test tests/hosting-setup.test.mjs
 *
 * No network and no database: the checklist is pure, the probe's judgement is
 * pure over DNS answers, the redirect rule takes its fetch as an argument, and
 * the runner takes its store, probe and senders as arguments — so every state,
 * and the "email once" rule under races and failures, is walked with fakes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const S = await import("../src/lib/hostingSetup.ts");
const P = await import("../src/lib/hostingSetupProbe.ts");
const R = await import("../src/lib/hostingSetupRun.ts");
const E = await import("../src/lib/hostingSetupEmails.ts");
const TC = await import("../src/lib/testContext.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const NOW = "2026-09-25T10:00:00.000Z";
const LATER = (min) => new Date(Date.parse(NOW) + min * 60_000).toISOString();

/** A NEW row: created after the tracker shipped. */
function row(over = {}) {
  return {
    id: "row-1",
    plan: "hosting",
    status: "active",
    email: "buyer@walk.test",
    business: "walk-s3-test.example.com",
    site_url: null,
    repo: null,
    vercel_project: null,
    notes: null,
    started_at: "2026-09-25T09:00:00.000Z",
    created_at: "2026-09-25T09:00:00.000Z",
    subscription_id: "sub_test_2THRYC",
    is_test: false,
    setup: null,
    ...over,
  };
}
const DETAILS = "Platform: wordpress\nRegistrar: OVH\nSubmitted 2026-09-25";
/** Details in, Vercel project recorded, "on our hosting" ticked. */
function onboarded(over = {}) {
  const { setup = {}, ...rest } = over;
  return row({
    site_url: "https://acme.com", vercel_project: "acme-site", notes: DETAILS, ...rest,
    setup: { rev: 1, ...setup, hand: { onboard: NOW, ...(setup.hand ?? {}) } },
  });
}

const ctx = (over = {}) => ({ knownClient: false, knownRepo: false, host: "acme.com", domainOurs: false, setupHref: "/hosting/setup?t=x", ...over });

function probe({ pointed = false, tls = null, http = null, host = "acme.com", viaNs = false, dnsError } = {}) {
  return {
    at: NOW,
    host,
    dns: {
      pointed,
      viaNameservers: viaNs,
      records: [
        { type: "A", name: "@", host, value: "76.76.21.21", ok: pointed, found: pointed ? ["216.150.1.65"] : ["93.184.1.1"] },
        { type: "CNAME", name: "www", host: `www.${host}`, value: "cname.vercel-dns.com", ok: pointed, found: [] },
      ],
      ...(dnsError ? { error: dnsError } : {}),
    },
    tls,
    http,
  };
}
const TLS_OK = { ok: true, validTo: "2026-12-20T00:00:00.000Z", issuer: "Let's Encrypt" };
const HTTP_OK = { status: 200, servedByUs: true, attached: true, finalHost: "acme.com" };
const HTTP_OLD_HOST = { status: 200, servedByUs: false, attached: null, finalHost: "acme.com" };
const LIVE = () => probe({ pointed: true, tls: TLS_OK, http: HTTP_OK });

const states = (list) => Object.fromEntries(list.steps.map((s) => [s.id, s.state]));

/* ── Who the tracker is for ────────────────────────────────────────────── */

test("ESTABLISHED: a real row created before the cutover; never a test row; no date counts as established", () => {
  assert.equal(S.SETUP_TRACKER_SINCE, "2026-09-25T00:00:00Z");
  assert.equal(S.isEstablished({ created_at: "2026-09-10T12:00:00Z" }), true);
  assert.equal(S.isEstablished({ created_at: "2026-09-10T12:00:00Z", status: "suspended" }), true, "a suspended existing client is still an existing client");
  assert.equal(S.isEstablished({ created_at: "2026-09-25T00:00:00Z" }), false);
  assert.equal(S.isEstablished({ created_at: "2026-09-10T12:00:00Z", is_test: true }), false);
  assert.equal(S.isEstablished({ created_at: null, started_at: null }), true, "unknown age: leave it alone");
  assert.equal(S.isEstablished({ created_at: null, started_at: "2026-09-26T00:00:00Z" }), false);
});

/* ── The checklist, state by state ─────────────────────────────────────── */

test("just paid, nothing sent: paid is done, details is the client's step, the rest waits", () => {
  const list = S.computeChecklist(row(), ctx({ host: null }), null);
  assert.equal(list.applies, true);
  assert.deepEqual(states(list), { paid: "done", details: "action", onboard: "waiting", dns: "waiting", https: "waiting", live: "waiting", forms: "waiting" });
  assert.equal(list.done, 1);
  assert.equal(list.total, 7, "Complete: paid, details, onboard, dns, https, live, forms+tracking");
  assert.equal(list.current, "details");
  assert.deepEqual(list.steps[1].cta, { label: "Send my site details", href: "/hosting/setup?t=x" });
  assert.equal(list.liveVerified, false);
});

test("details received: onboarding is OURS, with the written promise shown only beside its start date", () => {
  for (const r of [row({ notes: DETAILS }), row({ setup: { rev: 1, detailsAt: "2026-09-25T09:30:00.000Z" } })]) {
    // A probe that HAS records: they must still not be shown before onboarding.
    const list = S.computeChecklist(r, ctx(), probe());
    const onboard = list.steps.find((s) => s.id === "onboard");
    assert.equal(states(list).details, "done");
    assert.equal(onboard.state, "doing");
    assert.equal(onboard.kind, "hand");
    assert.match(onboard.promise, /within one working day/, "the timeframe SetupForm already promises");
    assert.ok(onboard.startedAt, "always with the date it runs from");
    assert.equal(states(list).dns, "waiting", "never ask for DNS before the site is on our servers");
    assert.deepEqual(list.records, [], "no records shown while DNS is not the current step");
  }
  assert.equal(S.submittedFromNotes(DETAILS), "2026-09-25T00:00:00.000Z");
  assert.equal(S.submittedFromNotes("Submitted 2026-09-24"), null, "the date alone is not the form");
});

test("'on our hosting' is the founder's tick AND a recorded Vercel project — a repo alone is not it", () => {
  assert.equal(states(S.computeChecklist(row({ notes: DETAILS, repo: "AmraniHub/x" }), ctx({ knownClient: true, knownRepo: true }), null)).onboard, "doing");
  assert.equal(states(S.computeChecklist(row({ notes: DETAILS, vercel_project: "p" }), ctx(), null)).onboard, "doing", "project recorded, not ticked");
  assert.equal(states(S.computeChecklist(row({ notes: DETAILS, setup: { hand: { onboard: NOW } } }), ctx(), null)).onboard, "doing", "ticked, but the project was cleared");
  assert.equal(states(S.computeChecklist(onboarded(), ctx(), null)).onboard, "done");
  const known = S.computeChecklist(row({ repo: "AmraniHub/x" }), ctx({ knownClient: true, knownRepo: true }), null);
  assert.equal(states(known).details, "done");
  assert.match(known.steps[1].detail, /already host/);
});

test("DNS not pointed: Essential clients add the records; Complete says either of us; our own DNS needs nothing", () => {
  const lite = S.computeChecklist(onboarded({ plan: "hosting_lite" }), ctx(), probe());
  assert.equal(states(lite).dns, "action");
  assert.equal(lite.recordsBy, "client");
  assert.deepEqual(lite.records.map((r) => `${r.type} ${r.name} ${r.value}`), ["A @ 76.76.21.21", "CNAME www cname.vercel-dns.com"]);

  const complete = S.computeChecklist(onboarded(), ctx(), probe());
  assert.equal(states(complete).dns, "doing");
  assert.equal(complete.recordsBy, "either");
  assert.match(complete.steps.find((s) => s.id === "dns").detail, /or add the records below yourself/);

  const ours = S.computeChecklist(onboarded(), ctx({ domainOurs: true }), probe());
  assert.equal(ours.recordsBy, "none");
  assert.deepEqual(ours.records, []);
});

test("a domain already on Vercel before we set anything up is NOT 'pointed to us'", () => {
  const list = S.computeChecklist(row({ notes: DETAILS, vercel_project: "p" }), ctx(), LIVE());
  assert.equal(states(list).onboard, "doing");
  assert.equal(states(list).dns, "waiting");
  assert.equal(states(list).live, "waiting");
  assert.equal(list.liveVerified, false);
});

test("pointed, certificate pending: DNS done, https is ours to wait on; no 'renews automatically' claim", () => {
  const list = S.computeChecklist(onboarded(), ctx(), probe({ pointed: true }));
  assert.equal(states(list).dns, "done");
  assert.equal(states(list).https, "doing");
  const done = S.computeChecklist(onboarded(), ctx(), LIVE());
  for (const lang of ["en", "fr"]) {
    const l = S.computeChecklist(onboarded(), ctx(), LIVE(), lang);
    assert.doesNotMatch(l.steps.find((s) => s.id === "https").detail, /renew/i, "no code renews a certificate");
  }
  assert.match(done.steps.find((s) => s.id === "https").detail, /2026-12-20/);
});

test("LIVE needs 200 + Vercel headers + their own host + Vercel CONFIRMING the recorded project (attached === true)", () => {
  const ok = S.computeChecklist(onboarded(), ctx(), LIVE());
  assert.equal(states(ok).live, "done");
  assert.equal(ok.liveVerified, true);
  assert.equal(states(ok).forms, "doing", "forms start once the site is live");
  assert.equal(ok.steps.find((s) => s.id === "forms").title, "Contact forms and tracking tested");

  const cases = [
    [{ ...HTTP_OK, status: 404 }, /HTTP 404/],
    [{ ...HTTP_OK, servedByUs: false }, /another host/],
    [{ ...HTTP_OK, attached: false }, /another host/],
    [{ ...HTTP_OK, attached: null }, /not yet confirmed/],
    [{ ...HTTP_OK, finalHost: "acme.myshopify.com" }, /another host/],
    [{ status: null, servedByUs: false, attached: null, finalHost: null, error: "ETIMEDOUT" }, /did not answer/],
  ];
  for (const [http, why] of cases) {
    const list = S.computeChecklist(onboarded(), ctx(), probe({ pointed: true, tls: TLS_OK, http }));
    assert.equal(states(list).live, "doing", JSON.stringify(http));
    assert.equal(list.liveVerified, false);
    assert.match(list.steps.find((s) => s.id === "live").detail, why);
  }
});

test("the founder's ticks finish it; Business also needs the mailbox; Essential has no tracking line", () => {
  const complete = S.computeChecklist(onboarded({ setup: { hand: { forms: NOW } } }), ctx(), LIVE());
  assert.equal(complete.complete, true);
  assert.equal(complete.done, 7);
  const biz = S.computeChecklist(onboarded({ plan: "hosting_business", setup: { hand: { forms: NOW } } }), ctx(), LIVE());
  assert.equal(biz.total, 8);
  assert.equal(states(biz).mailbox, "doing");
  const bizDone = S.computeChecklist(onboarded({ plan: "hosting_business", setup: { hand: { forms: NOW, mailbox: NOW } } }), ctx(), LIVE());
  assert.equal(bizDone.complete, true);
  const lite = S.computeChecklist(onboarded({ plan: "hosting_lite" }), ctx(), LIVE());
  assert.equal(lite.steps.find((s) => s.id === "forms").title, "Contact forms tested");
});

test("not a hosting tier: no checklist; a probe of another host proves nothing; French copy", () => {
  assert.equal(S.computeChecklist(row({ plan: "chatbot" }), ctx(), null).applies, false);
  const other = S.computeChecklist(onboarded(), ctx(), probe({ pointed: true, tls: TLS_OK, http: HTTP_OK, host: "old-address.com" }));
  assert.equal(states(other).dns, "doing", "the check was about a different address");
  const fr = S.computeChecklist(row(), ctx({ host: null }), null, "fr");
  assert.equal(fr.steps[0].title, "Paiement reçu");
  assert.equal(fr.steps[1].cta.label, "Envoyer les informations");
});

/* ── Nothing says "online" until (e) passes ────────────────────────────── */

test("NO FALSE ONLINE: the quiet line and the status tile claim 'online' only after the live check AND a live answer", () => {
  const up = { up: true, status: 200 };
  const walk = S.computeChecklist(row(), ctx({ host: "walk-s3-test.example.com" }), null);
  for (const lang of ["en", "fr"]) {
    const line = S.noticedQuiet({ lang, checklist: walk, health: up });
    assert.doesNotMatch(line, /online|en ligne|up to date|à jour/i, `${lang}: the SV-2THRYC walk said "online and up to date" here`);
    assert.doesNotMatch(S.siteTile({ lang, checklist: walk, health: up }).value, /online|en ligne/i);
    assert.equal(S.siteTile({ lang, checklist: walk, health: up }).live, false);
  }
  for (const p of [null, probe(), probe({ pointed: true }), probe({ pointed: true, tls: TLS_OK, http: { ...HTTP_OK, servedByUs: false } }), probe({ pointed: true, tls: TLS_OK, http: { ...HTTP_OK, attached: null } })]) {
    const list = S.computeChecklist(onboarded(), ctx(), p);
    assert.doesNotMatch(S.noticedQuiet({ lang: "en", checklist: list, health: up }), /online/i);
    assert.equal(S.siteTile({ lang: "en", checklist: list, health: up }).value, "Setting up");
  }
  const live = S.computeChecklist(onboarded(), ctx(), LIVE());
  assert.match(S.noticedQuiet({ lang: "en", checklist: live, health: up }), /online — it answered when this page loaded/);
  assert.equal(S.siteTile({ lang: "en", checklist: live, health: up }).value, "Online");
  assert.match(S.noticedQuiet({ lang: "en", checklist: live, health: { up: false, status: 503 } }), /did not answer properly.*HTTP 503/);
  assert.doesNotMatch(S.noticedQuiet({ lang: "en", checklist: live, health: { up: null, status: null } }), /online/i);
  // No checklist (an add-on client, or an ESTABLISHED client): online only on a live answer.
  assert.match(S.noticedQuiet({ lang: "en", checklist: null, health: up }), /online/);
  assert.doesNotMatch(S.noticedQuiet({ lang: "en", checklist: null, health: { up: null, status: null } }), /online/i);
});

test("the old unmeasured sentence is gone from the recommendations copy", async () => {
  const REC = await import("../src/lib/recommendations.ts");
  for (const lang of ["en", "fr"]) assert.doesNotMatch(REC.recommendationCopy(lang).quiet, /online|en ligne|up to date|à jour/i);
});

/* ── The probe: DNS judgement and where a fetch may go ─────────────────── */

test("DNS judgement: every Vercel address we measured counts, anything else does not", () => {
  const exp = P.expectedRecords("acme.com", null);
  assert.deepEqual(exp.map((e) => `${e.type} ${e.name} ${e.host} ${e.value}`), ["A @ acme.com 76.76.21.21", "CNAME www www.acme.com cname.vercel-dns.com"]);
  const answers = (a, www) => ({ ns: [], a: { "acme.com": a, "www.acme.com": www.a ?? [] }, cname: { "acme.com": [], "www.acme.com": www.c ?? [] }, vercelIps: ["66.33.60.67"] });
  assert.equal(P.judgeDns(exp, answers(["216.150.1.65"], { c: ["cname.vercel-dns.com"] })).pointed, true);
  assert.equal(P.judgeDns(exp, answers(["76.76.21.21"], { a: ["216.150.16.129"] })).pointed, true);
  assert.equal(P.judgeDns(exp, answers(["66.33.60.67"], { c: ["abc.vercel-dns-017.com"] })).pointed, true);
  assert.equal(P.judgeDns(exp, answers(["76.76.21.21", "93.184.215.14"], { c: ["cname.vercel-dns.com"] })).pointed, false, "one stray A record splits traffic");
  assert.equal(P.judgeDns(exp, answers(["76.76.21.21"], {})).pointed, false, "www must answer too");
  const sub = P.expectedRecords("walk-s3-test.example.com", null);
  assert.deepEqual(sub.map((e) => `${e.type} ${e.name} ${e.value}`), ["CNAME walk-s3-test cname.vercel-dns.com"]);
  assert.equal(P.registrableOf("shop.cabinet.co.uk"), "cabinet.co.uk");
  assert.equal(P.hostFrom("https://www.Acme.com/contact"), "acme.com");
  assert.equal(P.hostFrom("10.0.0.1"), null);
  for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.20.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1"]) assert.equal(P.isPublicIpv4(ip), false, ip);
  for (const ip of ["216.150.1.65", "93.184.215.14", "8.8.8.8"]) assert.equal(P.isPublicIpv4(ip), true, ip);
});

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, redirect: init.redirect });
    const r = routes[url];
    if (!r) throw Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
    return new Response(null, { status: r.status, headers: r.location ? { location: r.location, server: "Vercel" } : { server: "Vercel" } });
  };
  return { impl, calls };
}

test("SSRF: redirects are manual, ≤2 hops, https only, same registrable domain — refused targets are never requested", async () => {
  for (const [target, why] of [
    ["https://169.254.169.254/latest/meta-data/", "redirect-not-public"],
    ["https://127.0.0.1/", "redirect-not-public"],
    ["http://acme.com/", "redirect-not-https"],
    ["http://169.254.169.254/", "redirect-not-https"],
    ["https://evil.com/", "redirect-other-domain"],
    ["https://acme.com:8443/", "redirect-odd-port"],
  ]) {
    const f = fakeFetch({ "https://acme.com/": { status: 302, location: target } });
    const out = await P.safeFetch("https://acme.com/", f.impl);
    assert.equal(out.stopped, why, target);
    assert.equal(out.status, 302);
    assert.deepEqual(f.calls.map((c) => c.url), ["https://acme.com/"], `${target} was never requested`);
    assert.ok(f.calls.every((c) => c.redirect === "manual"));
  }
  const ok = fakeFetch({ "https://acme.com/": { status: 301, location: "https://www.acme.com/" }, "https://www.acme.com/": { status: 302, location: "/fr" }, "https://www.acme.com/fr": { status: 200 } });
  const followed = await P.safeFetch("https://acme.com/", ok.impl);
  assert.equal(followed.status, 200);
  assert.equal(followed.finalUrl, "https://www.acme.com/fr");
  const loop = fakeFetch({ "https://acme.com/": { status: 302, location: "https://www.acme.com/" }, "https://www.acme.com/": { status: 302, location: "https://acme.com/a" }, "https://acme.com/a": { status: 302, location: "https://acme.com/b" } });
  const stopped = await P.safeFetch("https://acme.com/", loop.impl);
  assert.equal(stopped.stopped, "too-many-redirects");
  assert.equal(loop.calls.length, 3, "the start plus two hops, no more");
});

test("a host that is not a public domain is never probed", async () => {
  const p = await P.probeHost({ host: "192.168.1.1", vercelProject: null }, new Date(NOW));
  assert.equal(p.dns.error, "not-a-public-domain");
  assert.equal(p.tls, null);
  assert.equal(p.http, null);
  assert.equal(S.isMeasured(p), false);
});

test("isMeasured: no resolver error AND a real HTTP status", () => {
  assert.equal(S.isMeasured(null), false);
  assert.equal(S.isMeasured(probe()), false, "no HTTP answer");
  assert.equal(S.isMeasured(probe({ http: HTTP_OLD_HOST })), true, "the old host answering is a measurement");
  assert.equal(S.isMeasured(probe({ http: HTTP_OLD_HOST, dnsError: "ETIMEOUT" })), false);
  assert.equal(S.isMeasured(probe({ http: { status: null, servedByUs: false, attached: null, finalHost: null, error: "ECONNREFUSED" } })), false);
});

/* ── Milestones: news only when it flips after a real measurement ──────── */

test("planTransition: no baseline from a failed probe; baseline at the first measurement; then one claim per flip", () => {
  const notPointed = S.computeChecklist(onboarded(), ctx(), probe({ http: HTTP_OLD_HOST }));
  const failed = S.planTransition(null, notPointed, NOW, false);
  assert.equal(failed.next.baselineAt, undefined, "a failed first probe is never the baseline");
  assert.deepEqual(failed.send, []);

  const base = S.planTransition(failed.next, notPointed, LATER(15), true);
  assert.equal(base.next.baselineAt, LATER(15));
  assert.deepEqual(base.send, []);

  const pointed = S.computeChecklist(onboarded(), ctx(), probe({ pointed: true, http: HTTP_OLD_HOST }));
  const flip = S.planTransition(base.next, pointed, LATER(30), true);
  assert.deepEqual(flip.send, ["dns"]);
  assert.match(flip.next.mail.dns, /^claim:1:/, "claimed, NOT marked sent");
  assert.deepEqual(flip.notify, ["dns"]);
  const again = S.planTransition(flip.next, pointed, LATER(31), true);
  assert.deepEqual(again.send, [], "a fresh claim is someone else's send in progress");
  const stale = S.planTransition(flip.next, pointed, LATER(45), true);
  assert.deepEqual(stale.send, ["dns"], "a claim older than ten minutes is a crashed send: retried");
  assert.match(stale.next.mail.dns, /^claim:2:/);
  assert.deepEqual(stale.notify, [], "the founder is told once");

  // Already live at the first measurement: silent.
  const liveList = S.computeChecklist(onboarded(), ctx(), LIVE());
  const silent = S.planTransition(null, liveList, NOW, true);
  assert.deepEqual(silent.send, []);
  assert.match(silent.next.mail.live, /^baseline:/);
  // Both flipping at once: ONE email, the live one.
  const both = S.planTransition(base.next, liveList, LATER(30), true);
  assert.deepEqual(both.send, ["live"]);
  assert.match(both.next.mail.dns, /^covered:/);
  // Settling.
  assert.equal(S.settleClaim("claim:2:x", true, LATER(50)), LATER(50));
  assert.equal(S.settleClaim("claim:2:x", false, LATER(50)), `failed:2:${LATER(50)}`);
  assert.equal(S.mailAttempt(`failed:${S.MAX_MAIL_TRIES}:${NOW}`, Date.parse(NOW)), null, "gives up after the last try");
});

test("onboardOverdue: one working day, weekends skipped", () => {
  const thu = "2026-09-24T10:00:00Z"; // Thursday
  assert.equal(S.onboardOverdue(thu, Date.parse("2026-09-25T23:00:00Z")), false, "Friday is the working day");
  assert.equal(S.onboardOverdue(thu, Date.parse("2026-09-26T00:00:00Z")), true);
  const fri = "2026-09-25T16:00:00Z";
  assert.equal(S.onboardOverdue(fri, Date.parse("2026-09-28T20:00:00Z")), false, "Monday is the working day after Friday");
  assert.equal(S.onboardOverdue(fri, Date.parse("2026-09-29T00:00:01Z")), true);
  assert.equal(S.onboardOverdue(null, Date.now()), false);
  assert.match(src("src/lib/today.ts"), /onboardOverdue\(setup\.submitted, now\) \? "OVERDUE — "/, "the owner's Today row says OVERDUE");
});

/* ── The runner: stored, raced, failed, established, test rows ─────────── */

function memStore(initial, { writable = true } = {}) {
  let cur = structuredClone(initial);
  let writes = 0;
  return {
    canWrite: async () => writable,
    load: async (id) => (id === cur.id ? structuredClone(cur) : null),
    async cas(id, prevRev, next) {
      await new Promise((r) => setImmediate(r));
      if (id !== cur.id || cur.setup?.rev !== prevRev) return false;
      cur = { ...cur, setup: structuredClone(next) };
      writes += 1;
      return true;
    },
    get row() { return cur; },
    get writes() { return writes; },
  };
}

function deps(store, probeRef, log, { send, now } = {}) {
  return {
    store,
    probe: async () => probeRef.current,
    sendEmail: async (to, subject, html) => {
      const stampNow = /live on Servolia/.test(subject) ? store.row.setup?.mail?.live : store.row.setup?.mail?.dns;
      log.emails.push({ to, subject, html, test: TC.inTestContext(), stampAtSend: stampNow });
      return send ? send() : true;
    },
    notifyOwner: async (n) => { log.owner.push({ ...n, test: TC.inTestContext() }); },
    accountLink: async (sub) => `https://servolia.com/hosting/account?t=${sub}`,
    setupLink: async (sub) => `https://servolia.com/hosting/setup?t=${sub}`,
    langOf: async () => "en",
    now: now ?? (() => new Date(NOW)),
  };
}
const newLog = () => ({ emails: [], owner: [] });

test("NEW client: baseline only after a real measurement, then each milestone emailed once, stamped only after the send", async () => {
  const store = memStore(onboarded());
  const ref = { current: probe({ dnsError: "ETIMEOUT" }) };
  const log = newLog();
  let clock = Date.parse(NOW);
  const d = deps(store, ref, log, { now: () => new Date(clock) });

  await R.runSetupCheck("row-1", d);                       // failed probe
  assert.equal(store.row.setup.baselineAt, undefined, "a failed first probe sets no baseline");

  clock += 15 * 60_000; ref.current = probe({ http: HTTP_OLD_HOST });
  await R.runSetupCheck("row-1", d);                       // first real measurement: not pointed
  assert.ok(store.row.setup.baselineAt);
  assert.equal(log.emails.length, 0);

  clock += 15 * 60_000; ref.current = probe({ pointed: true, http: HTTP_OLD_HOST });
  const r = await R.runSetupCheck("row-1", d);             // flip
  assert.deepEqual(r.sent, ["dns"]);
  assert.equal(log.emails.length, 1);
  assert.match(log.emails[0].subject, /^Your domain now points to us — acme\.com$/);
  assert.match(log.emails[0].stampAtSend, /^claim:1:/, "while sending, the row says CLAIMED, not sent");
  assert.match(log.emails[0].html, /hosting\/account\?t=sub_test_2THRYC/, "the portal link");
  assert.equal(store.row.setup.mail.dns, new Date(clock).toISOString(), "stamped with the send time after it succeeded");
  assert.equal(log.owner.length, 1);
  assert.ok(log.owner[0].lines.some((l) => /Client emailed/.test(l)));
  assert.equal(log.owner[0].link, "https://servolia.com/admin/hosting/row-1");

  clock += 15 * 60_000;
  await R.runSetupCheck("row-1", d);
  assert.equal(log.emails.length, 1, "run again: nothing new");

  // Three checks racing to the SAME milestone:
  clock += 15 * 60_000; ref.current = LIVE();
  await Promise.all([R.runSetupCheck("row-1", d), R.runSetupCheck("row-1", d), R.runSetupCheck("row-1", d)]);
  assert.equal(log.emails.filter((m) => /is live on Servolia hosting/.test(m.subject)).length, 1, "one live email from three racing checks");
  assert.equal(log.owner.filter((o) => /LIVE/.test(o.subject)).length, 1);
});

test("a first measurement that is already live is silent — no email, no notice", async () => {
  const store = memStore(onboarded());
  const log = newLog();
  await R.runSetupCheck("row-1", deps(store, { current: LIVE() }, log));
  assert.equal(log.emails.length + log.owner.length, 0);
  assert.match(store.row.setup.mail.live, /^baseline:/);
});

test("a FAILED send is not stamped sent: retried at the next check, the founder told once", async () => {
  const store = memStore(onboarded({ setup: { rev: 1, baselineAt: NOW, checkedAt: NOW } }));
  const log = newLog();
  let ok = false;
  let clock = Date.parse(NOW);
  const d = deps(store, { current: probe({ pointed: true, http: HTTP_OLD_HOST }) }, log, { send: () => { if (!ok) throw new Error("resend down"); return true; }, now: () => new Date(clock) });
  const first = await R.runSetupCheck("row-1", d);
  assert.deepEqual(first.sent, [], "a throwing send is not reported as sent");
  assert.match(store.row.setup.mail.dns, /^failed:1:/);
  assert.ok(log.owner[0].lines.some((l) => /FAILED/.test(l)));
  ok = true; clock += 15 * 60_000;
  const second = await R.runSetupCheck("row-1", d);
  assert.deepEqual(second.sent, ["dns"]);
  assert.equal(log.emails.length, 2);
  assert.equal(store.row.setup.mail.dns, new Date(clock).toISOString());
  assert.equal(log.owner.length, 1, "not told twice");
});

test("ESTABLISHED client: never emailed or announced — even after a failed probe then a live one — and never written", async () => {
  const old = row({ site_url: "https://acme.com", vercel_project: "acme-site", notes: DETAILS, created_at: "2026-09-12T09:00:00.000Z", started_at: "2026-09-12T09:00:00.000Z", setup: null });
  const store = memStore(old);
  const ref = { current: probe({ dnsError: "ETIMEOUT" }) };
  const log = newLog();
  const d = deps(store, ref, log);
  const a = await R.runSetupCheck("row-1", d);
  ref.current = probe({ pointed: true, http: HTTP_OLD_HOST });
  const b = await R.runSetupCheck("row-1", d);
  ref.current = LIVE();
  const c = await R.runSetupCheck("row-1", d);
  for (const out of [a, b, c]) { assert.equal(out.established, true); assert.equal(out.stored, false); }
  assert.equal(log.emails.length + log.owner.length, 0);
  assert.equal(store.writes, 0, "the existing subscriber's row is not changed");
  assert.equal(store.row.setup, null);
  assert.deepEqual(await R.tickHandStep(store, "row-1", "forms", true), { ok: false, reason: "established" });
  assert.equal(await R.checklistForView(old, { lang: "en" }), null, "no checklist on their page");
  const adminView = await R.checklistForView(old, { lang: "en", includeEstablished: true });
  assert.equal(adminView.applies, true, "the admin still sees it, read-only");
});

test("the cron pass skips established clients and finished setups; checks new, incomplete ones", async () => {
  const loaded = [];
  const store = memStore(onboarded({ id: "new-1" }));
  const spy = { ...store, load: async (id) => { loaded.push(id); return store.load(id); }, cas: store.cas, canWrite: store.canWrite };
  const out = await R.recheckHostingSetups({
    budgetMs: 5000,
    deps: deps(spy, { current: probe({ http: HTTP_OLD_HOST }) }, newLog()),
    listRows: async () => [
      { id: "old-1", setup: null, created_at: "2026-09-12T09:00:00Z", started_at: null, is_test: false },
      { id: "old-2", setup: null, created_at: null, started_at: null },
      { id: "done-1", setup: { completeAt: NOW }, created_at: "2026-09-25T09:00:00Z", started_at: null },
      { id: "new-1", setup: null, created_at: "2026-09-25T09:00:00Z", started_at: null },
      { id: "test-old", setup: null, created_at: "2026-09-12T09:00:00Z", started_at: null, is_test: true },
    ],
  });
  assert.equal(out.checked, 2);
  assert.deepEqual([...new Set(loaded)].sort(), ["new-1", "test-old"], "never old-1, old-2 or done-1");
});

test("runSetupCheck without the setup column: shows the checklist, stores nothing, sends nothing", async () => {
  const store = memStore(onboarded(), { writable: false });
  const log = newLog();
  const out = await R.runSetupCheck("row-1", deps(store, { current: LIVE() }, log));
  assert.equal(out.stored, false);
  assert.equal(out.checklist.liveVerified, true);
  assert.equal(log.emails.length + log.owner.length, 0);
  assert.equal(store.writes, 0);
});

test("a TEST row — even one created before the cutover — runs inside the test context", async () => {
  const store = memStore(onboarded({ is_test: true, created_at: "2026-09-12T09:00:00.000Z", setup: { baselineAt: NOW, checkedAt: NOW } }));
  const log = newLog();
  await R.runSetupCheck("row-1", deps(store, { current: probe({ pointed: true, http: HTTP_OLD_HOST }) }, log));
  assert.equal(log.emails.length, 1);
  assert.equal(log.emails[0].test, true, "sendEmail reroutes to FOUNDER_EMAIL with [TEST]");
  assert.equal(log.owner[0].test, true);
  const live = memStore(onboarded({ setup: { baselineAt: NOW, checkedAt: NOW } }));
  const log2 = newLog();
  await R.runSetupCheck("row-1", deps(live, { current: probe({ pointed: true, http: HTTP_OLD_HOST }) }, log2));
  assert.equal(log2.emails[0].test, false);
});

test("the retry after a lost race uses the RELOADED row's context", async () => {
  const store = memStore(onboarded({ setup: { baselineAt: NOW, checkedAt: NOW } }));
  const realCas = store.cas.bind(store);
  let first = true;
  store.cas = async (id, prevRev, next) => {
    if (first) {
      first = false;
      // Someone changes the client's address between our read and our write.
      await realCas(id, prevRev, { ...store.row.setup, rev: (prevRev ?? 0) + 1 });
      store.row.site_url = "https://moved.com";
      return false;
    }
    return realCas(id, prevRev, next);
  };
  const log = newLog();
  const out = await R.runSetupCheck("row-1", deps(store, { current: probe({ pointed: true, http: HTTP_OLD_HOST }) }, log));
  assert.equal(out.checklist.host, "moved.com", "recomputed for the reloaded row");
  assert.equal(log.emails.length, 0, "the probe was about the old address, so nothing is claimed for the new one");
});

test("the founder's tick: 'on our hosting' needs the Vercel project; complete recomputed; untick reopens", async () => {
  const noProject = memStore(row({ notes: DETAILS }));
  assert.deepEqual(await R.tickHandStep(noProject, "row-1", "onboard", true), { ok: false, reason: "needs-vercel-project" });
  assert.equal(noProject.writes, 0);

  const store = memStore(onboarded({ setup: { rev: 4, probe: LIVE(), checkedAt: NOW } }));
  const t1 = await R.tickHandStep(store, "row-1", "forms", true, new Date(NOW));
  assert.equal(t1.ok, true);
  assert.equal(store.row.setup.rev, 5);
  assert.ok(store.row.setup.completeAt);
  await R.tickHandStep(store, "row-1", "forms", false, new Date(NOW));
  assert.equal(store.row.setup.hand.forms, undefined);
  assert.equal(store.row.setup.completeAt, undefined);
  assert.deepEqual(await R.tickHandStep(memStore(row(), { writable: false }), "row-1", "forms", true), { ok: false, reason: "no-column" });
});

test("the tick endpoint takes only real booleans", () => {
  const route = src("src/app/api/admin/hosting/[id]/setup/route.ts");
  assert.match(route, /typeof body\?\.done !== "boolean"/);
  assert.doesNotMatch(route, /body\?\.done !== false/, "the old 'anything but false is true' parse is gone");
});

test("page views: established -> no checklist; a stale check re-measures only if the limiter allows", async () => {
  let asked = 0;
  const fresh = onboarded({ setup: { probe: { ...probe({ http: HTTP_OLD_HOST }), at: new Date().toISOString() } } });
  await R.checklistForView(fresh, { lang: "en", allowProbe: async () => { asked += 1; return false; } });
  assert.equal(asked, 0, "a fresh stored check is served as is");
  const stale = onboarded({ setup: { probe: { ...probe({ http: HTTP_OLD_HOST }), at: "2026-09-01T00:00:00.000Z" } } });
  const view = await R.checklistForView(stale, { lang: "en", allowProbe: async () => { asked += 1; return false; } });
  assert.equal(asked, 1, "the limiter was asked");
  assert.equal(view.checkedAt, "2026-09-01T00:00:00.000Z", "refused: the stored check is served");
  assert.match(src("src/app/hosting/account/page.tsx"), /allowProbe: async \(\) => !\(await rateLimited\(`setup-check:\$\{setupSub\}`, 4, 600\)\)/, "the same limiter as Check again");
});

test("contextFor: the address given, else the reference's, else a business name that is a domain", async () => {
  assert.equal(R.contextFor(row({ site_url: "https://www.acme.com/" })).host, "acme.com");
  assert.equal(R.contextFor(row()).host, "walk-s3-test.example.com");
  assert.equal(R.contextFor(row({ business: "Acme Dental Ltd" })).host, null);
  const DOM = await import("../src/lib/domainSales.ts");
  const notes = DOM.writeDomainRecord(DETAILS, { domain: "acme.com", status: "bought", retailUsd: 27.9 });
  assert.equal(R.contextFor(row({ site_url: "https://acme.com", notes })).domainOurs, true);
  const pending = DOM.writeDomainRecord(DETAILS, { domain: "acme.com", status: "pending", retailUsd: 27.9 });
  assert.equal(R.contextFor(row({ site_url: "https://acme.com", notes: pending })).domainOurs, false);
});

/* ── The emails and the owner notice ───────────────────────────────────── */

test("milestone emails: measured fact, what is left, portal link, reference — EN and FR, escaped", () => {
  const list = S.computeChecklist(onboarded(), ctx(), probe({ pointed: true }));
  const en = E.setupMilestoneEmail({ milestone: "dns", lang: "en", host: "acme.com", business: "Acme <b>", reference: "SV-2THRYC", portalUrl: "https://servolia.com/hosting/account?t=abc", checkedAt: NOW, checklist: list });
  assert.match(en.html, /acme\.com<\/strong> answered from our servers/);
  assert.match(en.html, /SV-2THRYC/);
  assert.match(en.html, /Follow your setup/);
  assert.match(en.html, /hosting\/account\?t=abc/);
  assert.match(en.html, /Acme &lt;b&gt;/);
  const fr = E.setupMilestoneEmail({ milestone: "live", lang: "fr", host: "acme.com", business: "Acme", reference: null, portalUrl: "https://x", checkedAt: NOW, checklist: list });
  assert.match(fr.subject, /^Votre site est en ligne sur l'hébergement Servolia — acme\.com$/);
});

test("the owner notice goes through a shim with alerts-fix's notifyOwner signature", async () => {
  const shim = await import("../src/lib/notifyOwnerShim.ts");
  assert.equal(typeof shim.notifyOwner, "function");
  assert.match(src("src/lib/hostingSetupRun.ts"), /import \{ notifyOwner, type OwnerNotice \} from "@\/lib\/notifyOwnerShim"/);
  assert.doesNotMatch(src("src/lib/hostingSetupRun.ts"), /notifyOwnerLocal/);
});
