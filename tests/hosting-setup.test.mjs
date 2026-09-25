/**
 * The hosting setup tracker (src/lib/hostingSetup.ts, hostingSetupRun.ts,
 * hostingSetupProbe.ts, hostingSetupEmails.ts).
 *
 *   node --import ./tests/register.mjs --test tests/hosting-setup.test.mjs
 *
 * No network and no database: the checklist is pure, the probe's judgement is
 * pure over DNS answers, and the runner takes its store, probe and senders as
 * arguments — so every state, and the "email once" rule under races, is
 * walked here with fakes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const S = await import("../src/lib/hostingSetup.ts");
const P = await import("../src/lib/hostingSetupProbe.ts");
const R = await import("../src/lib/hostingSetupRun.ts");
const E = await import("../src/lib/hostingSetupEmails.ts");
const TC = await import("../src/lib/testContext.ts");

const NOW = "2026-09-25T10:00:00.000Z";

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
    started_at: "2026-09-24T09:00:00.000Z",
    created_at: "2026-09-24T09:00:00.000Z",
    subscription_id: "sub_test_2THRYC",
    is_test: false,
    setup: null,
    ...over,
  };
}

const ctx = (over = {}) => ({ knownClient: false, knownRepo: false, host: "acme.com", domainOurs: false, setupHref: "/hosting/setup?t=x", ...over });

function probe({ pointed = false, tls = null, http = null, host = "acme.com", viaNs = false } = {}) {
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
    },
    tls,
    http,
  };
}
const TLS_OK = { ok: true, validTo: "2026-12-20T00:00:00.000Z", issuer: "Let's Encrypt" };
const HTTP_OK = { status: 200, servedByUs: true, attached: true, finalHost: "acme.com" };
const DETAILS = "Platform: wordpress\nRegistrar: OVH\nSubmitted 2026-09-24";

const states = (list) => Object.fromEntries(list.steps.map((s) => [s.id, s.state]));

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
  assert.equal(list.complete, false);
});

test("details received: read from the stamp or from the notes line, and onboarding is OURS with the promised timeframe", () => {
  for (const r of [row({ notes: DETAILS }), row({ setup: { rev: 1, detailsAt: "2026-09-24T12:00:00.000Z" } })]) {
    // A probe that HAS records: they must still not be shown before onboarding.
    const list = S.computeChecklist(r, ctx(), probe());
    const onboard = list.steps.find((s) => s.id === "onboard");
    assert.equal(states(list).details, "done");
    assert.equal(onboard.state, "doing");
    assert.equal(onboard.kind, "hand");
    assert.match(onboard.promise, /within one working day/, "the timeframe SetupForm already promises");
    assert.ok(onboard.startedAt, "the date it started");
    assert.equal(states(list).dns, "waiting", "never ask for DNS before the site is on our servers");
    assert.deepEqual(list.records, [], "no records shown while DNS is not the current step");
  }
  assert.equal(S.submittedFromNotes(DETAILS), "2026-09-24T00:00:00.000Z");
  assert.equal(S.submittedFromNotes("Submitted 2026-09-24"), null, "the date alone is not the form");
});

test("a client we already host needs no form: details and onboard are done from their reference / repo", () => {
  const list = S.computeChecklist(row({ repo: "AmraniHub/x" }), ctx({ knownClient: true, knownRepo: true }), null);
  assert.equal(states(list).details, "done");
  assert.match(list.steps[1].detail, /already host/);
  assert.equal(states(list).onboard, "done");
  assert.equal(list.current, "dns");
});

test("DNS not pointed: Essential clients add the records; Complete says either of us; our own DNS needs nothing", () => {
  const onboarded = { vercel_project: "acme-site", notes: DETAILS };
  const lite = S.computeChecklist(row({ ...onboarded, plan: "hosting_lite" }), ctx(), probe());
  assert.equal(states(lite).dns, "action");
  assert.equal(lite.recordsBy, "client");
  assert.equal(lite.records.length, 2, "the exact records, while DNS is the step in front of them");
  assert.deepEqual(lite.records.map((r) => `${r.type} ${r.name} ${r.value}`), ["A @ 76.76.21.21", "CNAME www cname.vercel-dns.com"]);

  const complete = S.computeChecklist(row(onboarded), ctx(), probe());
  assert.equal(states(complete).dns, "doing");
  assert.equal(complete.recordsBy, "either");
  assert.match(complete.steps.find((s) => s.id === "dns").detail, /or add the records below yourself/);

  const ours = S.computeChecklist(row(onboarded), ctx({ domainOurs: true }), probe());
  assert.equal(ours.recordsBy, "none");
  assert.deepEqual(ours.records, []);
});

test("a domain already on Vercel before we set anything up is NOT 'pointed to us'", () => {
  const list = S.computeChecklist(row({ notes: DETAILS }), ctx(), probe({ pointed: true, tls: TLS_OK, http: HTTP_OK }));
  assert.equal(states(list).onboard, "doing");
  assert.equal(states(list).dns, "waiting");
  assert.equal(states(list).live, "waiting");
  assert.equal(list.liveVerified, false);
});

test("pointed, certificate pending: DNS done, https is ours to wait on", () => {
  const list = S.computeChecklist(row({ vercel_project: "p", notes: DETAILS }), ctx(), probe({ pointed: true }));
  assert.equal(states(list).dns, "done");
  assert.equal(states(list).https, "doing");
  assert.equal(states(list).live, "waiting");
});

test("live only on 200 + Vercel headers + the recorded project + their own host", () => {
  const base = row({ vercel_project: "p", notes: DETAILS });
  const ok = S.computeChecklist(base, ctx(), probe({ pointed: true, tls: TLS_OK, http: HTTP_OK }));
  assert.equal(states(ok).live, "done");
  assert.equal(ok.liveVerified, true);
  assert.equal(states(ok).forms, "doing", "forms start once the site is live");
  assert.equal(ok.steps.find((s) => s.id === "forms").title, "Contact forms and tracking tested");
  assert.equal(ok.complete, false, "a HAND step is still open");

  const cases = [
    [{ ...HTTP_OK, status: 404 }, /HTTP 404/],
    [{ ...HTTP_OK, servedByUs: false }, /another host/],
    [{ ...HTTP_OK, attached: false }, /another host/],
    [{ ...HTTP_OK, finalHost: "acme.myshopify.com" }, /another host/],
    [{ status: null, servedByUs: false, attached: null, finalHost: null, error: "ETIMEDOUT" }, /did not answer/],
  ];
  for (const [http, why] of cases) {
    const list = S.computeChecklist(base, ctx(), probe({ pointed: true, tls: TLS_OK, http }));
    assert.equal(states(list).live, "doing", JSON.stringify(http));
    assert.equal(list.liveVerified, false);
    assert.match(list.steps.find((s) => s.id === "live").detail, why);
  }
  const unknownProject = S.computeChecklist(base, ctx(), probe({ pointed: true, tls: TLS_OK, http: { ...HTTP_OK, attached: null } }));
  assert.equal(unknownProject.liveVerified, true, "API not asked (null) falls back to Vercel's own headers");
});

test("the founder's ticks finish it; Business also needs the mailbox; Essential has no tracking line", () => {
  const live = probe({ pointed: true, tls: TLS_OK, http: HTTP_OK });
  const ticked = { rev: 3, hand: { forms: "2026-09-25T11:00:00.000Z" } };
  const complete = S.computeChecklist(row({ vercel_project: "p", notes: DETAILS, setup: ticked }), ctx(), live);
  assert.equal(complete.complete, true);
  assert.equal(complete.done, 7);
  assert.equal(complete.current, null);

  const biz = S.computeChecklist(row({ plan: "hosting_business", vercel_project: "p", notes: DETAILS, setup: ticked }), ctx(), live);
  assert.equal(biz.total, 8);
  assert.equal(states(biz).mailbox, "doing");
  assert.equal(biz.complete, false);
  const bizDone = S.computeChecklist(row({ plan: "hosting_business", vercel_project: "p", notes: DETAILS, setup: { hand: { ...ticked.hand, mailbox: NOW } } }), ctx(), live);
  assert.equal(bizDone.complete, true);

  const lite = S.computeChecklist(row({ plan: "hosting_lite", vercel_project: "p", notes: DETAILS }), ctx(), live);
  assert.equal(lite.steps.find((s) => s.id === "forms").title, "Contact forms tested");
});

test("not a hosting tier: no checklist; a probe of another host proves nothing; French copy", () => {
  assert.equal(S.computeChecklist(row({ plan: "chatbot" }), ctx(), null).applies, false);
  const other = S.computeChecklist(row({ vercel_project: "p", notes: DETAILS }), ctx(), probe({ pointed: true, tls: TLS_OK, http: HTTP_OK, host: "old-address.com" }));
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
  // Every state short of live, with the address answering 200 from the OLD host:
  const base = row({ vercel_project: "p", notes: DETAILS });
  for (const p of [null, probe(), probe({ pointed: true }), probe({ pointed: true, tls: TLS_OK, http: { ...HTTP_OK, servedByUs: false } })]) {
    const list = S.computeChecklist(base, ctx(), p);
    assert.doesNotMatch(S.noticedQuiet({ lang: "en", checklist: list, health: up }), /online/i);
    assert.equal(S.siteTile({ lang: "en", checklist: list, health: up }).value, "Setting up");
  }
  const live = S.computeChecklist(base, ctx(), probe({ pointed: true, tls: TLS_OK, http: HTTP_OK }));
  assert.match(S.noticedQuiet({ lang: "en", checklist: live, health: up }), /online — it answered when this page loaded/);
  assert.equal(S.siteTile({ lang: "en", checklist: live, health: up }).value, "Online");
  // Live once, but not answering on this load: says what was measured.
  assert.match(S.noticedQuiet({ lang: "en", checklist: live, health: { up: false, status: 503 } }), /did not answer properly.*HTTP 503/);
  assert.doesNotMatch(S.noticedQuiet({ lang: "en", checklist: live, health: { up: null, status: null } }), /online/i);
  // An add-on client (no checklist): online only on a live answer.
  assert.match(S.noticedQuiet({ lang: "en", checklist: null, health: up }), /online/);
  assert.doesNotMatch(S.noticedQuiet({ lang: "en", checklist: null, health: { up: null, status: null } }), /online/i);
});

test("the old unmeasured sentence is gone from the recommendations copy", async () => {
  const REC = await import("../src/lib/recommendations.ts");
  for (const lang of ["en", "fr"]) assert.doesNotMatch(REC.recommendationCopy(lang).quiet, /online|en ligne|up to date|à jour/i);
});

/* ── The probe's judgement ─────────────────────────────────────────────── */

test("DNS judgement: every Vercel address we measured counts, anything else does not", () => {
  const exp = P.expectedRecords("acme.com", null);
  assert.deepEqual(exp.map((e) => `${e.type} ${e.name} ${e.host} ${e.value}`), ["A @ acme.com 76.76.21.21", "CNAME www www.acme.com cname.vercel-dns.com"]);
  const answers = (a, www) => ({ ns: [], a: { "acme.com": a, "www.acme.com": www.a ?? [] }, cname: { "acme.com": [], "www.acme.com": www.c ?? [] }, vercelIps: ["66.33.60.67"] });
  assert.equal(P.judgeDns(exp, answers(["216.150.1.65"], { c: ["cname.vercel-dns.com"] })).pointed, true);
  assert.equal(P.judgeDns(exp, answers(["76.76.21.21"], { a: ["216.150.16.129"] })).pointed, true, "www as A records on Vercel");
  assert.equal(P.judgeDns(exp, answers(["66.33.60.67"], { c: ["abc.vercel-dns-017.com"] })).pointed, true, "today's cname.vercel-dns.com answer");
  assert.equal(P.judgeDns(exp, answers(["76.76.21.21", "93.184.215.14"], { c: ["cname.vercel-dns.com"] })).pointed, false, "one stray A record splits traffic");
  assert.equal(P.judgeDns(exp, answers(["76.76.21.21"], {})).pointed, false, "www must answer too");
  assert.equal(P.judgeDns(exp, answers([], {})).pointed, false);
  const nsd = P.judgeDns(exp, { ...answers(["216.150.1.1"], { a: ["216.150.1.1"] }), ns: ["ns1.vercel-dns.com", "ns2.vercel-dns.com"] });
  assert.equal(nsd.viaNameservers, true);

  const sub = P.expectedRecords("walk-s3-test.example.com", null);
  assert.deepEqual(sub.map((e) => `${e.type} ${e.name} ${e.value}`), ["CNAME walk-s3-test cname.vercel-dns.com"]);
  assert.equal(P.registrableOf("shop.cabinet.co.uk"), "cabinet.co.uk");
  assert.equal(P.hostFrom("https://www.Acme.com/contact"), "acme.com");
  assert.equal(P.hostFrom("10.0.0.1"), null, "never a private address");
  assert.equal(P.hostFrom("localhost"), null);
});

test("a host that is not a public domain is never probed", async () => {
  const p = await P.probeHost({ host: "192.168.1.1", vercelProject: null }, new Date(NOW));
  assert.equal(p.dns.pointed, false);
  assert.equal(p.dns.error, "not-a-public-domain");
  assert.equal(p.tls, null);
  assert.equal(p.http, null);
});

/* ── Milestones: news only when it flips, once ─────────────────────────── */

test("first check of an already-live client is a silent baseline; a real flip sends once", () => {
  const liveRow = row({ vercel_project: "p", notes: DETAILS });
  const liveList = S.computeChecklist(liveRow, ctx(), probe({ pointed: true, tls: TLS_OK, http: HTTP_OK }));
  const first = S.planTransition(null, liveList, NOW);
  assert.deepEqual(first.send, [], "an existing client is never told news they have had for months");
  assert.deepEqual(first.notify, []);
  assert.match(first.next.mail.dns, /^baseline:/);
  assert.match(first.next.mail.live, /^baseline:/);
  assert.equal(first.next.rev, 1);

  const pending = S.computeChecklist(liveRow, ctx(), probe());
  const a = S.planTransition(null, pending, NOW);
  assert.deepEqual(a.send, []);
  const pointed = S.computeChecklist(liveRow, ctx(), probe({ pointed: true }));
  const b = S.planTransition(a.next, pointed, "2026-09-25T10:15:00.000Z");
  assert.deepEqual(b.send, ["dns"]);
  assert.deepEqual(b.notify, ["dns"]);
  const c = S.planTransition(b.next, pointed, "2026-09-25T10:30:00.000Z");
  assert.deepEqual(c.send, [], "same state again: nothing");
  const d = S.planTransition(c.next, liveList, "2026-09-25T10:45:00.000Z");
  assert.deepEqual(d.send, ["live"]);
  const e2 = S.planTransition(d.next, liveList, "2026-09-25T11:00:00.000Z");
  assert.deepEqual(e2.send, []);

  // DNS and live flipping in the same check: ONE email, the bigger one.
  const both = S.planTransition(a.next, liveList, "2026-09-25T10:15:00.000Z");
  assert.deepEqual(both.send, ["live"]);
  assert.match(both.next.mail.dns, /^covered:/);
  assert.deepEqual(both.notify, ["live"]);
});

/* ── The runner: stored, raced, test rows ──────────────────────────────── */

function memStore(initial, { writable = true } = {}) {
  let cur = structuredClone(initial);
  return {
    canWrite: async () => writable,
    load: async (id) => (id === cur.id ? structuredClone(cur) : null),
    async cas(id, prevRev, next) {
      await new Promise((r) => setImmediate(r));
      if (id !== cur.id || cur.setup?.rev !== prevRev) return false;
      cur = { ...cur, setup: structuredClone(next) };
      return true;
    },
    get row() { return cur; },
  };
}

function deps(store, probeRef, log) {
  return {
    store,
    probe: async () => probeRef.current,
    sendEmail: async (to, subject, html) => { log.emails.push({ to, subject, html, test: TC.inTestContext() }); return true; },
    notifyOwner: async (subject, lines) => { log.owner.push({ subject, lines, test: TC.inTestContext() }); },
    accountLink: async (sub) => `https://servolia.com/hosting/account?t=${sub}`,
    setupLink: async (sub) => `https://servolia.com/hosting/setup?t=${sub}`,
    langOf: async () => "en",
    now: () => new Date(NOW),
  };
}

test("runSetupCheck: stamps before sending, emails the client once per milestone, tells the founder once", async () => {
  const store = memStore(row({ site_url: "https://acme.com", vercel_project: "p", notes: DETAILS }));
  const ref = { current: probe() };
  const log = { emails: [], owner: [] };
  const d = deps(store, ref, log);

  const r1 = await R.runSetupCheck("row-1", d);
  assert.equal(r1.ok, true);
  assert.equal(r1.stored, true);
  assert.equal(log.emails.length, 0, "baseline: nothing pointed, nothing sent");

  ref.current = probe({ pointed: true });
  await R.runSetupCheck("row-1", d);
  assert.equal(log.emails.length, 1);
  assert.match(log.emails[0].subject, /^Your domain now points to us — acme\.com$/);
  assert.equal(log.emails[0].to, "buyer@walk.test");
  assert.match(log.emails[0].html, /hosting\/account\?t=sub_test_2THRYC/, "the portal link is in the milestone email");
  assert.equal(log.owner.length, 1);
  assert.match(log.owner[0].subject, /domain now points to us/);
  assert.ok(log.owner[0].lines.some((l) => l.includes("/admin/hosting/row-1")));
  assert.equal(store.row.setup.mail.dns.startsWith("2026-"), true, "the stamp is stored");

  await R.runSetupCheck("row-1", d);
  assert.equal(log.emails.length, 1, "run again: nothing new");

  // Three checks racing to the SAME milestone (cron + Check again + admin):
  ref.current = probe({ pointed: true, tls: TLS_OK, http: HTTP_OK });
  const raced = await Promise.all([R.runSetupCheck("row-1", d), R.runSetupCheck("row-1", d), R.runSetupCheck("row-1", d)]);
  const liveMails = log.emails.filter((m) => /is live on Servolia hosting/.test(m.subject));
  assert.equal(liveMails.length, 1, `exactly one live email out of ${raced.length} racing checks`);
  assert.equal(log.owner.filter((o) => /LIVE/.test(o.subject)).length, 1);
  assert.equal(store.row.setup.probe.http.status, 200, "the probe is stored for the pages to read");
});

test("runSetupCheck without the setup column: shows the checklist, stores nothing, sends nothing", async () => {
  const store = memStore(row({ site_url: "acme.com", vercel_project: "p", notes: DETAILS }), { writable: false });
  const log = { emails: [], owner: [] };
  const out = await R.runSetupCheck("row-1", deps(store, { current: probe({ pointed: true, tls: TLS_OK, http: HTTP_OK }) }, log));
  assert.equal(out.ok, true);
  assert.equal(out.stored, false);
  assert.equal(out.checklist.liveVerified, true);
  assert.equal(log.emails.length + log.owner.length, 0, "an email with nowhere to record it would go again next run");
  assert.equal(store.row.setup, null);
});

test("a TEST row runs the same code inside the test context (its email reaches the founder marked [TEST])", async () => {
  const store = memStore(row({ is_test: true, site_url: "acme.com", vercel_project: "p", notes: DETAILS, setup: { rev: 1, checkedAt: NOW } }));
  const log = { emails: [], owner: [] };
  await R.runSetupCheck("row-1", deps(store, { current: probe({ pointed: true }) }, log));
  assert.equal(log.emails.length, 1);
  assert.equal(log.emails[0].test, true, "sendEmail sees inTestContext() and reroutes to FOUNDER_EMAIL with [TEST]");
  assert.equal(log.owner[0].test, true);
  // And a live row is NOT in the test context.
  const live = memStore(row({ site_url: "acme.com", vercel_project: "p", notes: DETAILS, setup: { rev: 1, checkedAt: NOW } }));
  const log2 = { emails: [], owner: [] };
  await R.runSetupCheck("row-1", deps(live, { current: probe({ pointed: true }) }, log2));
  assert.equal(log2.emails[0].test, false);
});

test("the walk's own row (example.com, no form) fails honestly and never emails", async () => {
  const store = memStore(row());
  const log = { emails: [], owner: [] };
  const out = await R.runSetupCheck("row-1", deps(store, { current: probe({ host: "walk-s3-test.example.com" }) }, log));
  assert.equal(out.checklist.current, "details");
  assert.equal(out.checklist.liveVerified, false);
  assert.equal(log.emails.length, 0);
});

test("the founder's tick: CAS-guarded, recomputes complete, untick reopens", async () => {
  const live = probe({ pointed: true, tls: TLS_OK, http: HTTP_OK });
  const store = memStore(row({ site_url: "acme.com", vercel_project: "p", notes: DETAILS, setup: { rev: 4, probe: live, checkedAt: NOW } }));
  const t1 = await R.tickHandStep(store, "row-1", "forms", true, new Date(NOW));
  assert.equal(t1.ok, true);
  assert.equal(store.row.setup.rev, 5);
  assert.ok(store.row.setup.hand.forms);
  assert.ok(store.row.setup.completeAt, "last hand step ticked: complete");
  await R.tickHandStep(store, "row-1", "forms", false, new Date(NOW));
  assert.equal(store.row.setup.hand.forms, undefined);
  assert.equal(store.row.setup.completeAt, undefined);
  const noCol = await R.tickHandStep(memStore(row(), { writable: false }), "row-1", "forms", true);
  assert.deepEqual(noCol, { ok: false, reason: "no-column" });
});

test("contextFor: the address given, else the reference's, else a business name that is a domain", async () => {
  assert.equal(R.contextFor(row({ site_url: "https://www.acme.com/" })).host, "acme.com");
  assert.equal(R.contextFor(row()).host, "walk-s3-test.example.com");
  assert.equal(R.contextFor(row({ business: "Acme Dental Ltd" })).host, null);
  const DOM = await import("../src/lib/domainSales.ts");
  const notes = DOM.writeDomainRecord(DETAILS, { domain: "acme.com", status: "bought", retailUsd: 27.9 });
  assert.equal(R.contextFor(row({ site_url: "https://acme.com", notes })).domainOurs, true, "bought through us: on our DNS");
  const pending = DOM.writeDomainRecord(DETAILS, { domain: "acme.com", status: "pending", retailUsd: 27.9 });
  assert.equal(R.contextFor(row({ site_url: "https://acme.com", notes: pending })).domainOurs, false, "not bought yet");
  assert.equal(R.contextFor(row({ site_url: "https://other.com", notes })).domainOurs, false, "a different domain");
});

/* ── The emails ────────────────────────────────────────────────────────── */

test("milestone emails: measured fact, what is left, portal link, reference — EN and FR, escaped", () => {
  const list = S.computeChecklist(row({ vercel_project: "p", notes: DETAILS }), ctx(), probe({ pointed: true }));
  const en = E.setupMilestoneEmail({ milestone: "dns", lang: "en", host: "acme.com", business: "Acme <b>", reference: "SV-2THRYC", portalUrl: "https://servolia.com/hosting/account?t=abc", checkedAt: NOW, checklist: list });
  assert.match(en.html, /acme\.com<\/strong> answered from our servers/);
  assert.match(en.html, /SV-2THRYC/);
  assert.match(en.html, /Follow your setup/);
  assert.match(en.html, /hosting\/account\?t=abc/);
  assert.match(en.html, /What is left/);
  assert.match(en.html, /Acme &lt;b&gt;/, "business names are escaped");
  const fr = E.setupMilestoneEmail({ milestone: "live", lang: "fr", host: "acme.com", business: "Acme", reference: null, portalUrl: "https://x", checkedAt: NOW, checklist: list });
  assert.match(fr.subject, /^Votre site est en ligne sur l'hébergement Servolia — acme\.com$/);
  assert.match(fr.html, /Suivre la mise en place/);
});
