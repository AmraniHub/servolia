/**
 * The test-mode cleanup, run from the admin button (2026-09-25).
 *
 *   node --import ./tests/register.mjs --test tests/test-cleanup.test.mjs
 *
 * The owner's laptop has no service key, so the cleanup runs on the server:
 * POST /api/admin/test-mode/cleanup, over src/lib/testCleanup.ts (the same
 * module scripts/test-mode-cleanup.mjs uses — its own CLI tests stay in
 * tests/test-mode.test.mjs). Driven here against a FAKE Supabase: a small
 * PostgREST over HTTP holding real and test rows side by side, which applies
 * the filters it is sent (or, on purpose, ignores them) so every test can ask
 * the only question that matters: are the real rows still there, unchanged?
 *
 * The route is called for real, inside the request scope Next gives it, so
 * isAdminAuthed() reads a genuine admin cookie through cookies().
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

// Next's own server sets this global before any request; its work store needs it.
globalThis.AsyncLocalStorage ??= (await import("node:async_hooks")).AsyncLocalStorage;
const { NextRequest } = await import("next/server");
const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external.js");
const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external.js");
const { createAdminSession } = await import("../src/lib/auth.ts");
const TC = await import("../src/lib/testCleanup.ts");
const { POST } = await import("../src/app/api/admin/test-mode/cleanup/route.ts");

/* ── A fake Supabase (PostgREST) ─────────────────────────────────────────── */

const DB = { tables: {}, requests: [], ignoreTagOnGet: false, ignoreTagOnDelete: false };

/** PostgREST filters this cleanup sends: col=eq.v, col=in.(a,b). */
function matches(row, filters) {
  return filters.every(([col, op, val]) => {
    if (op === "eq") return String(row[col]) === val;
    if (op === "in") return val.split(",").includes(String(row[col]));
    throw new Error(`fake PostgREST: unsupported op ${op}`);
  });
}

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    const u = new URL(req.url, "http://x");
    const table = u.pathname.replace("/rest/v1/", "");
    DB.requests.push({ method: req.method, table, query: decodeURIComponent(u.search), body });
    const rows = (DB.tables[table] ??= []);
    let filters = [];
    for (const [k, v] of u.searchParams) {
      if (k === "select" || k === "order") continue;
      const m = /^(eq|in)\.\(?(.*?)\)?$/.exec(v);
      filters.push([k, m[1], m[2]]);
    }
    if ((req.method === "GET" && DB.ignoreTagOnGet) || (req.method === "DELETE" && DB.ignoreTagOnDelete)) {
      filters = filters.filter(([k]) => k !== "is_test");
    }
    const hit = rows.filter((r) => matches(r, filters));
    res.setHeader("content-type", "application/json");
    if (req.method === "DELETE") {
      DB.tables[table] = rows.filter((r) => !hit.includes(r));
      return res.end(JSON.stringify(hit));
    }
    if (req.method === "PATCH") {
      const patch = JSON.parse(body);
      for (const r of hit) Object.assign(r, patch);
      return res.end(JSON.stringify(hit));
    }
    res.end(JSON.stringify(hit));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-fake";
test.after(() => server.close());

const rest = TC.restClient(process.env.NEXT_PUBLIC_SUPABASE_URL, "k");
const clone = (x) => JSON.parse(JSON.stringify(x));
const writes = () => DB.requests.filter((q) => q.method !== "GET");

/** A database with real clients' rows and a founder test walk-through mixed together. */
function seed() {
  DB.requests = [];
  DB.ignoreTagOnGet = false;
  DB.ignoreTagOnDelete = false;
  DB.tables = {
    clients: [
      { id: "c-real", business: "Cabinet Réel", status: "active", lead_id: "l-real", build_id: "b-real", is_test: false, notes: "servolia-topup: +200 | month: 2026-09 | session: cs_live_1" },
      { id: "c-null", business: "Cabinet Ancien", status: "active", is_test: null },
      { id: "c-test", business: "Me TEST", status: "active", build_id: "b-test", lead_id: "l-test", is_test: true, created_at: "2026-09-24T10:00:00Z" },
    ],
    builds: [
      { id: "b-real", business: "Cabinet Réel", status: "live", lead_id: "l-real", is_test: false },
      { id: "b-test", business: "Me TEST", status: "intake", lead_id: "l-test", is_test: true, created_at: "2026-09-24T10:00:00Z" },
    ],
    hosting_clients: [
      { id: "h-real", business: "Clinique Réelle", status: "active", is_test: false, notes: "servolia-oneoff: seo_multilingual | session: cs_live_9" },
      { id: "h-test", business: "Me TEST hosting", status: "active", is_test: true, created_at: "2026-09-24T11:00:00Z",
        notes: "free text\nservolia-oneoff: seo_multilingual | paid: 2026-09-24 | due: 2026-10-01 | session: cs_test_1\nservolia-domain: example-test.com | status: failed" },
    ],
    leads: [
      { id: "l-real", business: "Real prospect", stage: "qualified", is_test: false },
      { id: "l-test", business: "Me TEST", stage: "deposit_paid", is_test: true, created_at: "2026-09-24T09:00:00Z" },
      { id: "l-oneoff", business: "Me TEST site", stage: "one_off", source: "one-off", is_test: true, created_at: "2026-09-24T12:00:00Z",
        raw_data: { type: "oneoff", service: "seo_multilingual", session: "cs_test_2", paidAt: "2026-09-24", dueAt: "2026-10-01" } },
    ],
    scope_acceptances: [{ id: "sa1", lead_id: "l-test" }, { id: "sa-real", lead_id: "l-real" }],
    lead_activities: [{ id: "la1", lead_id: "l-test" }, { id: "la2", lead_id: "l-test" }],
    custom_requests: [{ id: "cr1", build_id: "b-test", title: "x" }],
    client_sites: [
      { id: "s-trial", slug: "cabinet-me", status: "published", build_id: "b-test",
        config: { status: "published", receptionist: { email: "me@x", until: "2026-10-01", paidAt: "2026-09-24", plan: "essentiel", paying: "sub|t" } } },
      { id: "s-draft", slug: "draft-me", status: "draft", build_id: "b-test", config: { status: "draft" } },
      { id: "s-real", slug: "cabinet-reel", status: "published", build_id: "b-real",
        config: { status: "published", receptionist: { paidAt: "2026-01-01", plan: "essentiel" } } },
    ],
  };
}
const REAL = () => ({
  clients: DB.tables.clients.filter((r) => r.is_test !== true),
  builds: DB.tables.builds.filter((r) => r.is_test !== true),
  hosting_clients: DB.tables.hosting_clients.filter((r) => r.is_test !== true),
  leads: DB.tables.leads.filter((r) => r.is_test !== true),
  realSite: DB.tables.client_sites.find((s) => s.id === "s-real"),
});

/* ── Calling the real route, as Next would ───────────────────────────────── */

const ADMIN = await createAdminSession();

async function call(body, { admin = ADMIN, origin = "https://servolia.com", site = "same-origin", type = "application/json" } = {}) {
  const headers = { host: "servolia.com" };
  if (type) headers["content-type"] = type;
  if (origin) headers.origin = origin;
  if (site) headers["sec-fetch-site"] = site;
  if (admin) headers.cookie = `servolia_admin=${admin}`;
  const req = new NextRequest("https://servolia.com/api/admin/test-mode/cleanup", {
    method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await workAsyncStorage.run({ route: "/api/admin/test-mode/cleanup" }, () =>
    workUnitAsyncStorage.run({ type: "private-cache", cookies: req.cookies }, () => POST(req)));
  return { status: res.status, json: await res.json() };
}

/* ══ 1. The dry run ═════════════════════════════════════════════════════════ */

test("dry run: selects ONLY by is_test=eq.true, lists every test row readably, changes nothing", async () => {
  seed();
  const before = clone(DB.tables);
  const r = await call({ apply: false });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.applied, false);
  const onTagged = DB.requests.filter((q) => q.method === "GET" && ["clients", "builds", "hosting_clients", "leads"].includes(q.table));
  const selects = onTagged.filter((q) => q.query.includes("select=*"));
  assert.deepEqual(selects.map((q) => q.table), ["clients", "builds", "hosting_clients", "leads"]);
  for (const q of selects) assert.equal(q.query, "?is_test=eq.true&select=*&order=created_at.asc", "selected by something other than the tag");
  // The only other reads of those tables: the real-row link guard (reads, never a selection to delete).
  assert.deepEqual(onTagged.filter((q) => !selects.includes(q)).map((q) => `${q.table}${q.query}`), [
    "builds?lead_id=in.(l-test,l-oneoff)&select=id,is_test,lead_id",
    "clients?lead_id=in.(l-test,l-oneoff)&select=id,is_test,lead_id",
    "clients?build_id=in.(b-test)&select=id,is_test,build_id",
  ]);
  assert.equal(writes().length, 0, "a dry run wrote something");
  assert.deepEqual(DB.tables, before);

  assert.deepEqual(r.json.keys, ["builds:b-test", "clients:c-test", "hosting_clients:h-test", "leads:l-oneoff", "leads:l-test"]);
  assert.equal(r.json.total, 5);
  const byId = Object.fromEntries(r.json.items.map((i) => [i.id, i]));
  assert.equal(byId["c-test"].label, "Me TEST");
  assert.equal(byId["l-oneoff"].label, "Me TEST site — one-off order seo_multilingual, paid 2026-09-24 (cs_test_2)");
  assert.deepEqual(byId["h-test"].carries, [
    "servolia-oneoff: seo_multilingual | paid: 2026-09-24 | due: 2026-10-01 | session: cs_test_1",
    "servolia-domain: example-test.com | status: failed",
  ], "the test hosting row's markers are shown as going with it");
  assert.ok(!JSON.stringify(r.json).includes("cs_live"), "a real row's notes leaked into the list");
  assert.deepEqual(r.json.cascades, [
    { table: "scope_acceptances", with: "leads", count: 1 },
    { table: "lead_activities", with: "leads", count: 2 },
    { table: "custom_requests", with: "builds", count: 1 },
  ]);
  assert.deepEqual(r.json.reverts, [{ id: "s-trial", slug: "cabinet-me", buildId: "b-test", paidAt: "2026-09-24", plan: "essentiel", status: "published" }]);
  assert.deepEqual(r.json.kept, [{ id: "s-draft", slug: "draft-me", status: "draft" }]);
});

/* ══ 2. Real rows mixed into the results ════════════════════════════════════ */

test("REFUSED when the database hands back real rows with the test ones: nothing deleted, nothing patched", async () => {
  seed();
  DB.ignoreTagOnGet = true; // a broken filter: real and test rows mixed in the results
  const before = clone(DB.tables);
  for (const body of [{ apply: false }, { apply: true, expect: ["clients:c-test"] }]) {
    const r = await call(body);
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.equal(r.json.reason, "not-test");
    assert.match(r.json.error, /REFUSED: clients returned 2 row\(s\) whose is_test is not true \(c-real, c-null\)\. Nothing was deleted\./);
  }
  assert.equal(writes().length, 0);
  assert.deepEqual(DB.tables, before, "the database changed");
});

test("apply: deletes the test rows only — every real row, including is_test null, is byte-for-byte untouched", async () => {
  seed();
  const real = clone(REAL());
  const shown = await call({ apply: false });
  const r = await call({ apply: true, expect: shown.json.keys });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.applied, true);
  assert.deepEqual(r.json.deleted, { clients: 1, builds: 1, hosting_clients: 1, leads: 2 });
  assert.deepEqual(r.json.requested, { clients: 1, builds: 1, hosting_clients: 1, leads: 2 });
  assert.equal(r.json.total, 5);
  assert.deepEqual(r.json.reverted, [{ id: "s-trial", slug: "cabinet-me", ok: true }]);

  assert.deepEqual(REAL(), real, "a real row was changed or deleted");
  for (const t of ["clients", "builds", "hosting_clients", "leads"]) {
    assert.equal(DB.tables[t].filter((x) => x.is_test === true).length, 0, `${t}: a test row survived`);
  }
  const dels = writes().filter((q) => q.method === "DELETE");
  assert.deepEqual(dels.map((d) => d.table), ["clients", "builds", "hosting_clients", "leads"], "clients go before the builds they point at");
  for (const d of dels) assert.match(d.query, /^\?id=in\.\([A-Za-z0-9_,-]+\)&is_test=eq\.true$/, "a DELETE without the tag");
  const patch = writes().find((q) => q.method === "PATCH");
  assert.equal(patch.table, "client_sites");
  assert.equal(patch.query, "?id=eq.s-trial&build_id=eq.b-test");
  assert.deepEqual(DB.tables.client_sites.find((s) => s.id === "s-trial").config.receptionist, { email: "me@x", until: "2026-10-01" });
  assert.deepEqual(writes().map((q) => q.method), ["PATCH", "DELETE", "DELETE", "DELETE", "DELETE"], "the trial is reverted before its build goes");
});

test("a real client/build linked to a test row is REFUSED: the database's set-null would change a real row", async () => {
  seed();
  DB.tables.builds.find((b) => b.id === "b-real").lead_id = "l-test";
  const before = clone(DB.tables);
  const r = await call({ apply: true, expect: ["builds:b-test", "clients:c-test", "hosting_clients:h-test", "leads:l-oneoff", "leads:l-test"] });
  assert.equal(r.status, 409);
  assert.equal(r.json.reason, "real-link");
  assert.match(r.json.error, /1 real builds row\(s\) \(b-real\) point at a test leads row through lead_id/);
  assert.equal(writes().length, 0);
  assert.deepEqual(DB.tables, before);
});

test("ALARM, loudly, if the database ever deletes a row that is not a selected test row", async () => {
  seed();
  const plan = await TC.planCleanup(rest);
  // A database that answers a DELETE with a real row (the filter makes this impossible).
  const liar = async (p, init) => {
    const rows = await rest(p, init);
    return init?.method === "DELETE" && p.startsWith("clients?") ? [...rows, { id: "c-real", is_test: false }] : rows;
  };
  await assert.rejects(TC.applyCleanup(liar, plan),
    (e) => e instanceof TC.CleanupRefused && e.reason === "alarm" && /^ALARM: clients deleted 1 row\(s\) that were not selected test rows: c-real$/.test(e.message));
  // And one that answers with a test row it was never asked for.
  seed();
  const plan2 = await TC.planCleanup(rest);
  const stray = async (p, init) => {
    const rows = await rest(p, init);
    return init?.method === "DELETE" && p.startsWith("leads?") ? [...rows, { id: "l-other", is_test: true }] : rows;
  };
  await assert.rejects(TC.applyCleanup(stray, plan2), (e) => e.reason === "alarm" && /l-other/.test(e.message));
});

/* ══ 3. Apply only what was shown ═══════════════════════════════════════════ */

test("apply refuses a list that changed since the dry run, and apply without the list", async () => {
  seed();
  const shown = await call({ apply: false });
  DB.tables.leads.push({ id: "l-new", business: "Another test", is_test: true });
  const before = clone(DB.tables);
  DB.requests = [];
  const r = await call({ apply: true, expect: shown.json.keys });
  assert.equal(r.status, 409);
  assert.equal(r.json.reason, "changed");
  assert.equal(writes().length, 0);
  assert.deepEqual(DB.tables, before);

  DB.requests = [];
  const bare = await call({ apply: true });
  assert.equal(bare.status, 400);
  assert.equal(DB.requests.length, 0, "apply without a list reached the database");
  assert.equal(TC.sameSelection({ keys: ["a:1"] }, "a:1"), false);
  assert.equal(TC.sameSelection({ keys: ["a:1", "b:2"] }, ["b:2", "a:1"]), true, "order does not matter");
});

test("nothing to clean: an empty dry run, and an empty apply that deletes nothing", async () => {
  seed();
  for (const t of ["clients", "builds", "hosting_clients", "leads"]) DB.tables[t] = DB.tables[t].filter((r) => r.is_test !== true);
  const shown = await call({ apply: false });
  assert.equal(shown.json.total, 0);
  const r = await call({ apply: true, expect: [] });
  assert.equal(r.status, 200);
  assert.equal(r.json.total, 0);
  assert.equal(writes().length, 0);
});

/* ══ 4. Who may call it ═════════════════════════════════════════════════════ */

test("no admin session, a forged one, another site, or not JSON: refused before the database is read", async () => {
  seed();
  const cases = [
    [{ admin: null }, 401],
    [{ admin: ADMIN.slice(0, -2) + (ADMIN.endsWith("AA") ? "BB" : "AA") }, 401],
    [{ origin: "https://evil.example", site: "cross-site" }, 403],
    [{ origin: "https://clinic.servolia.com", site: "same-site" }, 403],
    [{ origin: "https://evil.example", site: null }, 403],
    [{ type: "text/plain" }, 415],
  ];
  for (const [opts, status] of cases) {
    const r = await call({ apply: true, expect: [] }, opts);
    assert.equal(r.status, status, JSON.stringify(opts));
  }
  assert.equal(DB.requests.length, 0, "a refused request reached the database");
});

test("route source: same-origin, then admin, before anything else; never Stripe or Vercel", () => {
  const r = src("src/app/api/admin/test-mode/cleanup/route.ts");
  const at = ["sameOriginRequest(req.headers)", "isAdminAuthed()", "planCleanup(rest)", "applyCleanup(rest, plan)"].map((s) => r.indexOf(s));
  assert.ok(at.every((i) => i > 0) && at.every((i, n) => n === 0 || i > at[n - 1]), `order ${at}`);
  const lib = src("src/lib/testCleanup.ts");
  for (const f of [r, lib]) assert.doesNotMatch(f, /from "stripe"|stripeFor|@\/lib\/stripe|vercel\.com|@\/lib\/vercel/, "Stripe or Vercel reached from the cleanup");
  assert.doesNotMatch(lib, /^import /m, "the CLI loads this with plain node: it must stay import-free");
  // Its only network call is PostgREST on the Supabase URL it is given.
  assert.deepEqual(lib.match(/fetchImpl\(`[^`]*`/g), ["fetchImpl(`${base}/rest/v1/${path}`"]);
});

/* ══ 5. The button ══════════════════════════════════════════════════════════ */

test("the admin button: dry run first, an inline two-click confirm (never window.confirm), apply sends the list shown", () => {
  const ui = src("src/components/admin/TestCleanup.tsx");
  const code = ui.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /confirm\s*\(/, "the in-app browser answers confirm() with NO, silently");
  assert.match(ui, /fetch\("\/api\/admin\/test-mode\/cleanup"/);
  assert.match(ui, /body: JSON\.stringify\(body\)/);
  assert.match(ui, /await post\(\{ apply: false \}\)/);
  assert.match(ui, /await post\(\{ apply: true, expect: plan\.keys \}\)/);
  // Two clicks: the first only arms; the request is sent on the second.
  assert.match(ui, /if \(!armed\) return setArmed\(true\);\n\s+setBusy\(true\);/);
  assert.match(ui, /Find test records/);
  assert.match(ui, /Remove these \$\{plan\.total\}/);
  const page = src("src/app/admin/settings/page.tsx");
  assert.ok(page.indexOf("<TestCleanup") > page.indexOf("<TestModeToggle"), "the button sits under the Test mode card");
});
