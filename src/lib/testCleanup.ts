/**
 * REMOVE WHAT FOUNDER TEST MODE LEFT BEHIND — AND NOTHING ELSE.
 *
 * Founder test mode (src/lib/testMode.ts) lets the admin buy any product on
 * the live site with a Stripe TEST card; every row those purchases write is
 * tagged is_test = true (supabase/2026-09-24-test-mode.sql): clients, builds,
 * hosting_clients (with every `servolia-…:` marker on its notes — one-off
 * orders, domain, fulfilment records) and leads (including the "one-off"
 * leads a test purchase with no hosting row writes). This module finds those
 * rows and deletes them once a walk-through is done.
 *
 * Used by BOTH doors, so they cannot drift:
 *   - scripts/test-mode-cleanup.mjs — the CLI (needs the service key locally);
 *   - POST /api/admin/test-mode/cleanup — the button at /admin/settings,
 *     which runs it on the server, where the key already lives.
 * No imports on purpose: the CLI loads this file with plain `node` (type
 * stripping), and it talks to Supabase over PostgREST so the exact filters
 * it sends are the ones written here, readable and testable.
 *
 * THE RULE IT IS BUILT AROUND: a real client's row is never touched.
 *   - Rows are selected ONLY by `is_test = true`. Never by email, name, date
 *     or anything else.
 *   - Every selected row is checked again here: if any one of them does not
 *     read is_test === true, the whole run is refused and nothing is deleted.
 *   - The DELETE itself carries `is_test=eq.true` next to the ids, so even a
 *     wrong id could not delete a real row; the rows the database reports as
 *     deleted are checked the same way.
 *   - A REAL row (clients/builds) that points at a test row would have its
 *     link cleared by the database's ON DELETE SET NULL — a change to a real
 *     row. That is refused too; nothing is deleted until it is unlinked.
 *   - Planning never deletes. Applying re-plans from scratch (every row
 *     re-read and re-checked) and, from the button, only proceeds when the
 *     fresh selection is exactly the list the admin was shown.
 *
 * What the database does by itself when these rows go (the foreign keys in
 * supabase/schema.sql), reported in the plan so nothing is a surprise:
 *   - scope_acceptances and lead_activities of a test lead: deleted (cascade)
 *   - custom_requests on a test build: deleted (cascade)
 *   - client_sites on a test build that is NOT a paid receptionist (e.g. the
 *     draft site generated for a test plan): KEPT, build_id set to null by
 *     the database. Remove it by hand at /admin/sites if you want it gone.
 *
 * What this module reverts itself, before deleting (reported in the plan):
 *   - a receptionist trial row (client_sites) that a test purchase marked
 *     paid — found ONLY by pointing at a test build. Test mode only ever
 *     links the founder's own trial, and this puts it back exactly as a
 *     running trial reads:
 *       config.receptionist.paidAt / plan / paying   removed
 *       config.status, status (column)               "draft"
 *       build_id (column)                            null
 *     Its trial dates, address, owner and requests are left untouched. The
 *     PATCH is filtered on the same build_id, so it can match nothing else.
 *
 * Never touches Stripe (its TEST-mode customers and subscriptions stay: clear
 * them in the Stripe dashboard in test mode) or Vercel.
 */

/** The tagged tables, in the order they are deleted (clients point at builds). */
export const TEST_TABLES = ["clients", "builds", "hosting_clients", "leads"] as const;
export type TestTable = (typeof TEST_TABLES)[number];

export type RestInit = { method?: string; headers?: Record<string, string>; body?: string };
/** One PostgREST call: `path` is everything after /rest/v1/. Resolves to the
 *  parsed JSON body; throws `"<status> <message>"` on an HTTP error. */
export type Rest = (path: string, init?: RestInit) => Promise<unknown>;

/** PostgREST over fetch, with the service key. Retries a network drop (this
 *  is also what the CLI runs over a flaky link), never an HTTP answer. */
export function restClient(urlBase: string, key: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Rest {
  const base = urlBase.trim().replace(/\/$/, "");
  return async (path, init = {}) => {
    let last: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetchImpl(`${base}/rest/v1/${path}`, {
          ...init,
          headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
        });
        const text = await res.text();
        let body: unknown = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = text; }
        if (!res.ok) {
          const msg = (body as { message?: string } | null)?.message ?? text;
          throw new Error(`${res.status} ${msg}`);
        }
        return body;
      } catch (e) {
        last = e;
        if (/^\d{3} /.test(String((e as Error).message))) break; // an answer, not a network drop
      }
    }
    throw last;
  };
}

export type RefusalReason = "no-column" | "not-test" | "bad-id" | "real-link" | "changed" | "alarm";

/** A run that stopped on purpose. Every reason except "alarm" means NOTHING
 *  was changed; "alarm" is raised after a delete answered with a row that is
 *  not a test row, which the filter makes impossible, and says so loudly. */
export class CleanupRefused extends Error {
  reason: RefusalReason;
  constructor(reason: RefusalReason, message: string) {
    super(message);
    this.name = "CleanupRefused";
    this.reason = reason;
  }
}

type Row = { id: string; is_test?: unknown; [k: string]: unknown };
type Site = { id: string; slug?: string | null; status?: string | null; build_id?: string | null; config?: Record<string, unknown> | null };

/** One row that would go, as the admin reads it. */
export interface CleanupItem {
  table: TestTable;
  id: string;
  /** Business, address or name; for a one-off lead, the order it records. */
  label: string;
  /** status or stage. */
  state: string;
  createdAt: string;
  /** What goes WITH this row: its `servolia-…:` notes markers (one-off
   *  orders, domain, fulfilment, top-up records). */
  carries: string[];
}
export interface CleanupCascade { table: string; with: TestTable; count: number | null }
export interface CleanupRevert { id: string; slug: string; buildId: string; paidAt: string; plan: string | null; status: string }
export interface CleanupKeptSite { id: string; slug: string; status: string }

export interface CleanupPlan {
  selected: Record<TestTable, Row[]>;
  items: CleanupItem[];
  cascades: CleanupCascade[];
  reverts: CleanupRevert[];
  kept: CleanupKeptSite[];
  /** Sorted `table:id`, the identity of this selection. */
  keys: string[];
  total: number;
  /** The raw trial rows the reverts are computed from. */
  revertRows: Site[];
}

export interface CleanupResult {
  deleted: Record<TestTable, number>;
  requested: Record<TestTable, number>;
  reverted: { id: string; slug: string; ok: boolean }[];
}

/** A PostgREST id list. Ids are checked before they get here (safeId). */
const inList = (list: string[]) => `in.(${list.join(",")})`;
/** A uuid or similar; anything that could bend an `in.(…)` filter is refused. */
const safeId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

const MARKER_LINE = /^servolia-[a-z-]+:/;

function markersOf(notes: unknown): string[] {
  if (typeof notes !== "string") return [];
  return notes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => MARKER_LINE.test(l))
    .map((l) => (l.length > 140 ? `${l.slice(0, 139)}…` : l));
}

function labelOf(table: TestTable, r: Row): string {
  const name = str(r.business) || str(r.email) || str(r.name) || "(no name)";
  const raw = r.raw_data as { type?: unknown; service?: unknown; paidAt?: unknown; session?: unknown } | null | undefined;
  if (table === "leads" && raw && raw.type === "oneoff") {
    return `${name} — one-off order ${str(raw.service) || "?"}, paid ${str(raw.paidAt) || "?"} (${str(raw.session) || "no session"})`;
  }
  return name;
}

/**
 * Read every test row, check each one, and work out everything a delete
 * would do. Changes nothing. Throws CleanupRefused when it must not proceed.
 */
export async function planCleanup(rest: Rest): Promise<CleanupPlan> {
  const selected = {} as Record<TestTable, Row[]>;
  for (const t of TEST_TABLES) {
    let rows: Row[];
    try {
      rows = ((await rest(`${t}?is_test=eq.true&select=*&order=created_at.asc`)) ?? []) as Row[];
    } catch (e) {
      const msg = String((e as Error).message);
      if (/is_test/.test(msg)) {
        throw new CleanupRefused("no-column", `Could not read ${t}: ${msg}. The is_test column does not exist yet: nothing can be a test row. Nothing to do.`);
      }
      throw new Error(`Could not read ${t}: ${msg}`);
    }
    if (!Array.isArray(rows)) throw new Error(`Could not read ${t}: not a list`);
    // THE REFUSAL: anything not explicitly is_test === true stops the run.
    const wrong = rows.filter((r) => r?.is_test !== true);
    if (wrong.length) {
      throw new CleanupRefused("not-test", `REFUSED: ${t} returned ${wrong.length} row(s) whose is_test is not true (${wrong.map((r) => str(r?.id)).join(", ")}). Nothing was deleted.`);
    }
    const badId = rows.filter((r) => !safeId(r.id));
    if (badId.length) {
      throw new CleanupRefused("bad-id", `REFUSED: ${t} returned ${badId.length} row(s) with an id this cannot filter on safely (${badId.map((r) => JSON.stringify(r.id)).join(", ")}). Nothing was deleted.`);
    }
    selected[t] = rows;
  }

  const ids = (t: TestTable) => selected[t].map((r) => r.id);
  const leadIds = ids("leads");
  const buildIds = ids("builds");

  // A REAL row pointing at a test row: the database would clear its link.
  // (clients has no lead_id: it links to a lead only through its build.)
  const links: [TestTable, string, string[], TestTable][] = [
    ["builds", "lead_id", leadIds, "leads"],
    ["clients", "build_id", buildIds, "builds"],
  ];
  for (const [table, col, target, targetTable] of links) {
    if (!target.length) continue;
    const pointing = ((await rest(`${table}?${col}=${inList(target)}&select=id,is_test,${col}`)) ?? []) as Row[];
    const real = pointing.filter((r) => r.is_test !== true);
    if (real.length) {
      throw new CleanupRefused("real-link", `REFUSED: ${real.length} real ${table} row(s) (${real.map((r) => str(r.id)).join(", ")}) point at a test ${targetTable} row through ${col}; deleting it would clear that link on a real row. Unlink it by hand first. Nothing was deleted.`);
    }
  }

  const count = async (path: string) => {
    try { return (((await rest(path)) ?? []) as unknown[]).length; } catch { return null; }
  };
  const cascades: CleanupCascade[] = [];
  if (leadIds.length) {
    cascades.push({ table: "scope_acceptances", with: "leads", count: await count(`scope_acceptances?lead_id=${inList(leadIds)}&select=id`) });
    cascades.push({ table: "lead_activities", with: "leads", count: await count(`lead_activities?lead_id=${inList(leadIds)}&select=id`) });
  }
  let revertRows: Site[] = [];
  let keptRows: Site[] = [];
  if (buildIds.length) {
    cascades.push({ table: "custom_requests", with: "builds", count: await count(`custom_requests?build_id=${inList(buildIds)}&select=id`) });
    // Not caught: a trial that should be reverted must never be missed silently.
    const sites = ((await rest(`client_sites?build_id=${inList(buildIds)}&select=id,slug,status,build_id,config`)) ?? []) as Site[];
    const onTestBuild = sites.filter((s) => typeof s.build_id === "string" && buildIds.includes(s.build_id));
    revertRows = onTestBuild.filter((s) => {
      const r = (s.config as { receptionist?: { paidAt?: unknown } } | null)?.receptionist;
      return Boolean(r?.paidAt);
    });
    const badSite = revertRows.filter((s) => !safeId(s.id));
    if (badSite.length) {
      throw new CleanupRefused("bad-id", `REFUSED: client_sites returned ${badSite.length} trial row(s) with an id this cannot filter on safely. Nothing was changed.`);
    }
    keptRows = onTestBuild.filter((s) => !revertRows.includes(s));
  }

  const items: CleanupItem[] = [];
  for (const t of TEST_TABLES) {
    for (const r of selected[t]) {
      items.push({
        table: t,
        id: r.id,
        label: labelOf(t, r),
        state: str(r.status ?? r.stage),
        createdAt: str(r.created_at).slice(0, 19),
        carries: markersOf(r.notes),
      });
    }
  }

  return {
    selected,
    items,
    cascades,
    reverts: revertRows.map((s) => {
      const r = (s.config as { receptionist: { paidAt: unknown; plan?: unknown } }).receptionist;
      return { id: s.id, slug: str(s.slug), buildId: str(s.build_id), paidAt: str(r.paidAt), plan: r.plan ? str(r.plan) : null, status: str(s.status) };
    }),
    kept: keptRows.map((s) => ({ id: str(s.id), slug: str(s.slug), status: str(s.status) })),
    keys: items.map((i) => `${i.table}:${i.id}`).sort(),
    total: items.length,
    revertRows,
  };
}

/** Is this fresh plan exactly the selection the admin confirmed? */
export function sameSelection(plan: CleanupPlan, expect: unknown): boolean {
  if (!Array.isArray(expect) || !expect.every((k) => typeof k === "string")) return false;
  const want = [...(expect as string[])].sort();
  return want.length === plan.keys.length && want.every((k, i) => k === plan.keys[i]);
}

/**
 * Delete exactly the rows of `plan` (made by planCleanup just before): trial
 * rows reverted first (they are found through the builds about to go), then
 * each table by ids AND the tag. Every row the database reports as deleted is
 * checked to be a test row.
 */
export async function applyCleanup(rest: Rest, plan: CleanupPlan): Promise<CleanupResult> {
  const reverted: CleanupResult["reverted"] = [];
  for (const s of plan.revertRows) {
    const config = { ...(s.config ?? {}) } as Record<string, unknown>;
    const receptionist = { ...(config.receptionist as Record<string, unknown>) };
    delete receptionist.paidAt;
    delete receptionist.plan;
    delete receptionist.paying;
    const next = { ...config, status: "draft", receptionist };
    const done = await rest(`client_sites?id=eq.${s.id}&build_id=eq.${s.build_id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ config: next, status: "draft", build_id: null }),
    });
    reverted.push({ id: s.id, slug: str(s.slug), ok: Array.isArray(done) && done.length > 0 });
  }

  const deleted = {} as Record<TestTable, number>;
  const requested = {} as Record<TestTable, number>;
  for (const t of TEST_TABLES) {
    const list = plan.selected[t].map((r) => r.id);
    requested[t] = list.length;
    deleted[t] = 0;
    if (!list.length) continue;
    // Ids AND the tag: a row that is not a test row cannot match this filter.
    const gone = ((await rest(`${t}?id=${inList(list)}&is_test=eq.true`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    })) ?? []) as Row[];
    const wrong = gone.filter((r) => r?.is_test !== true || !list.includes(r.id));
    if (wrong.length) {
      // Cannot happen with the filter above; said loudly if it ever does.
      throw new CleanupRefused("alarm", `ALARM: ${t} deleted ${wrong.length} row(s) that were not selected test rows: ${wrong.map((r) => str(r?.id)).join(", ")}`);
    }
    deleted[t] = gone.length;
  }
  return { deleted, requested, reverted };
}

/** The plan as JSON for the admin page: no raw rows, nothing but what it shows. */
export function planView(plan: CleanupPlan) {
  return { total: plan.total, items: plan.items, cascades: plan.cascades, reverts: plan.reverts, kept: plan.kept, keys: plan.keys };
}
export type CleanupPlanView = ReturnType<typeof planView>;
