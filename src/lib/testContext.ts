/**
 * FOUNDER TEST MODE — the part every module may import.
 *
 * Test mode (src/lib/testMode.ts) lets the logged-in admin buy any product on
 * the LIVE site with a Stripe TEST card. Everything such a purchase writes is
 * tagged `is_test`, kept out of every number, and never reaches the real
 * world (no domain bought, no client repository committed to, no Meta
 * conversion). This file holds the two pieces that deep helpers need without
 * pulling in Stripe, Next or node:crypto — it is imported by modules that
 * also end up in client bundles (conversationCap via PortalDashboard), so it
 * has NO imports at all.
 *
 * 1. THE CONTEXT. While the Stripe webhook handles a test-mode event it runs
 *    inside `runAsTest(...)`. Any code below it — the Telegram helper, Meta
 *    CAPI, the Vercel registrar, the GitHub writers, the receptionist
 *    purchase — asks `inTestContext()` and behaves accordingly, so the mode
 *    does not have to be threaded through twenty signatures by hand. Outside
 *    that call (every live event, every normal request) the answer is false
 *    and nothing changes.
 *
 * 2. THE EXCLUSION. `excludeTest(...)` adds `is_test is not true` to a query:
 *    NULL and false rows — every row that existed before test mode — are
 *    counted exactly as before. And it tolerates the column not existing yet
 *    (the SQL is run by hand, supabase/2026-09-24-test-mode.sql): the filter
 *    is dropped and the query runs as it always did. Until that SQL is run no
 *    test row can exist, because the webhook refuses test events without it.
 */

type Store = { test: boolean };
interface Als<T> {
  run<R>(store: T, fn: () => R): R;
  getStore(): T | undefined;
}

let als: Als<Store> | null | undefined;

/* Loaded at run time, not imported: a static `node:async_hooks` import would
   break the client bundles this file is reachable from. On the server (Node
   22+, Vercel) getBuiltinModule is always there; in a browser there is no
   test context and inTestContext() is simply false. */
function storage(): Als<Store> | null {
  if (als !== undefined) return als;
  try {
    const p = typeof process !== "undefined" ? (process as unknown as { getBuiltinModule?: (id: string) => unknown }) : null;
    const mod = p?.getBuiltinModule?.("node:async_hooks") as { AsyncLocalStorage: new () => Als<Store> } | undefined;
    als = mod ? new mod.AsyncLocalStorage() : null;
  } catch {
    als = null;
  }
  return als;
}

/** Run `fn` with test mode on (test=true) or explicitly off. */
export function runAsTest<R>(test: boolean, fn: () => R): R {
  const s = storage();
  if (!s) {
    // No context available means test work cannot be marked as such. Never
    // run test work unmarked: refuse rather than write untagged rows.
    if (test) throw new Error("test mode needs AsyncLocalStorage (node:async_hooks)");
    return fn();
  }
  return s.run({ test }, fn);
}

/** True only inside runAsTest(true, ...). */
export function inTestContext(): boolean {
  return storage()?.getStore()?.test === true;
}

/** Spread into an insert: `{ ...row, ...testTag() }`. Empty — the row
 *  exactly as before — outside test mode. */
export function testTag(): { is_test?: true } {
  return inTestContext() ? { is_test: true } : {};
}

export const TEST_PREFIX = "TEST — ";

/** The founder's alerts still arrive during a test, marked so they cannot
 *  be mistaken for money. */
export function testPrefixed(text: string): string {
  return inTestContext() && !text.startsWith(TEST_PREFIX) ? `${TEST_PREFIX}${text}` : text;
}

/* ── Is the is_test column there yet? ──────────────────────────────────
 *
 * Asked ONCE per process with a cheap `select is_test limit 1` on each tagged
 * table, never by parsing a query's error: a head/count query (count:
 * "exact", head: true) fails with an EMPTY message, so an error-parsing
 * fallback read "not the column", returned the error, and every admin count
 * showed 0 before the SQL was run. A yes is kept for the life of the
 * process; a no is asked again after a minute, so running the SQL takes
 * effect without a redeploy. */

const TAGGED = ["clients", "builds", "hosting_clients", "leads"] as const;
const RETRY_MS = 60_000;
let ready: { value: boolean; at: number } | null = null;
let probing: Promise<boolean> | null = null;

type ProbeDb = { from(t: string): { select(c: string): { limit(n: number): PromiseLike<{ error: unknown }> } } };

export async function testColumnReady(db: unknown): Promise<boolean> {
  if (ready?.value) return true;
  if (ready && Date.now() - ready.at < RETRY_MS) return false;
  if (!probing) {
    probing = Promise.all(TAGGED.map((t) => (db as ProbeDb).from(t).select("is_test").limit(1)))
      .then((rs) => rs.every((r) => !r.error), () => false)
      .then((ok) => {
        ready = { value: ok, at: Date.now() };
        probing = null;
        return ok;
      });
  }
  return probing;
}

/** Tests only: forget the cached answer. */
export function __resetTestColumnCacheForTests(): void {
  ready = null;
  probing = null;
}

type Filterable = { not(column: string, operator: string, value: unknown): unknown };

/**
 * Run a query with `is_test is not true` added (false AND null rows kept —
 * every row that existed before test mode), or exactly as it ran before
 * when the column does not exist yet.
 *
 *   const { data } = await excludeTest(db, (live) =>
 *     live(db.from("clients").select("id").eq("status", "active")));
 *
 * `keepTest: true` runs it unfiltered: only for a request from the founder's
 * own test-mode browser (src/lib/testMode.ts founderTestBrowser), so a test
 * buyer's portal still shows the test purchase to the founder and to nobody
 * else.
 *
 * `live` must wrap the builder BEFORE .single()/.maybeSingle(), which return
 * a builder that no longer takes filters.
 */
export async function excludeTest<R>(
  db: unknown,
  run: (live: <Q>(q: Q) => Q) => PromiseLike<R>,
  opts: { keepTest?: boolean } = {},
): Promise<R> {
  if (opts.keepTest || !(await testColumnReady(db))) return run(<Q,>(q: Q) => q);
  return run(<Q,>(q: Q) => (q as unknown as Filterable).not("is_test", "is", true) as Q);
}

/* ── The founder's own address ─────────────────────────────────────────
 * Where every email sent during a test goes instead of its recipient, and
 * the only trial owner a test purchase may mark paid. FOUNDER_EMAIL, else
 * EMAIL_REPLY_TO (the mailbox client replies already reach). Null when
 * neither is set: test emails are then refused, never sent to a client. */
export function founderEmail(): string | null {
  const raw = process.env.FOUNDER_EMAIL?.trim() || process.env.EMAIL_REPLY_TO?.trim() || "";
  const addr = (raw.match(/<([^>]+)>/)?.[1] ?? raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) ? addr : null;
}

export function isFounderEmail(email: string | null | undefined): boolean {
  const f = founderEmail();
  return Boolean(f && email && email.trim().toLowerCase() === f);
}

type Db = {
  from(table: string): {
    select(cols: string): { eq(col: string, v: string): { maybeSingle(): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }> } };
  };
};

type IdDb = {
  from(table: string): { select(cols: string): { eq(col: string, v: boolean): PromiseLike<{ data: unknown; error: unknown }> } };
};

/** The ids of every test row in a table — for rows in OTHER tables that
 *  only point at one (a draft site on a test build). Empty when the column
 *  does not exist yet, which is also when no test row can exist. */
export async function testIds(db: unknown, table: "clients" | "builds" | "hosting_clients" | "leads"): Promise<Set<string>> {
  const { data, error } = await (db as IdDb).from(table).select("id").eq("is_test", true);
  if (error || !Array.isArray(data)) return new Set();
  return new Set((data as { id: string }[]).map((r) => r.id));
}

/** Is this one row a test row? False when the column does not exist yet
 *  (then no test row can exist) or the row is not found. */
export async function isTestRow(db: unknown, table: "clients" | "builds" | "hosting_clients" | "leads", id: string): Promise<boolean> {
  if (!id) return false;
  const { data, error } = await (db as Db).from(table).select("is_test").eq("id", id).maybeSingle();
  if (error) return false;
  return (data as { is_test?: boolean | null } | null)?.is_test === true;
}
