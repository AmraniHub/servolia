import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { runAsTest, testColumnReady } from "@/lib/testContext";
import { accountLinkFor, setupLinkFor, referenceFor, subscriptionContext } from "@/lib/upgrade";
import { clientRefFor, refKeyForEmail, knownSiteUrl } from "@/lib/clientRefs";
import { readDomainRecord } from "@/lib/domainSales";
import { HOSTING_TIERS } from "@/lib/hosting";
import {
  computeChecklist, planTransition, checklistApplies,
  type Checklist, type HandStep, type Lang, type Milestone, type Probe, type SetupContext, type SetupRow, type SetupState,
} from "@/lib/hostingSetup";
import { probeHost, hostFrom } from "@/lib/hostingSetupProbe";
import { setupMilestoneEmail, ownerSetupEmail } from "@/lib/hostingSetupEmails";

/**
 * THE SETUP TRACKER'S MOVING PARTS: storage, the check, the milestone emails.
 *
 * One function, runSetupCheck(), is what the cron, the client's "Check again"
 * and the founder's "Run checks now" all call — so a milestone reached by any
 * of them is announced exactly once, by whichever got there first.
 *
 * STORAGE is hosting_clients.setup (jsonb, supabase/2026-09-25-hosting-setup.sql).
 * Until that SQL has run, everything still COMPUTES (the portal shows a live
 * checklist) but nothing is stored and nothing is emailed: a milestone email
 * with nowhere to record that it went would go again on the next run.
 *
 * EVERY WRITE IS A COMPARE-AND-SWAP on setup.rev. A cron run that read the
 * row before the founder ticked a step cannot write its older copy over the
 * tick; it loses, reloads and tries once more. The milestone stamps ride in
 * the same write, so of two checks racing to the same milestone only the one
 * whose write lands sends the email.
 */

/* ── Is the column there yet? ───────────────────────────────────────────── */

let ready: { value: boolean; at: number } | null = null;

export async function setupColumnReady(db: unknown): Promise<boolean> {
  if (ready?.value) return true;
  if (ready && Date.now() - ready.at < 60_000) return false;
  const { error } = await (db as { from(t: string): { select(c: string): { limit(n: number): PromiseLike<{ error: unknown }> } } })
    .from("hosting_clients").select("setup").limit(1);
  ready = { value: !error, at: Date.now() };
  return ready.value;
}

/** Tests only. */
export function __setSetupColumnReadyForTests(v: boolean | null): void {
  ready = v === null ? null : { value: v, at: Date.now() };
}

const BASE_COLS = "id, plan, status, email, business, site_url, repo, vercel_project, notes, started_at, created_at, subscription_id";

async function columns(db: unknown): Promise<{ cols: string; hasSetup: boolean }> {
  const hasSetup = await setupColumnReady(db);
  const hasTest = await testColumnReady(db);
  return { cols: `${BASE_COLS}${hasSetup ? ", setup" : ""}${hasTest ? ", is_test" : ""}`, hasSetup };
}

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

/** One hosting row, by id or by subscription, with whatever columns exist. */
export async function loadSetupRow(db: Db, by: { id: string } | { subscriptionId: string }): Promise<SetupRow | null> {
  const { cols } = await columns(db);
  const q = db.from("hosting_clients").select(cols);
  const { data, error } = "id" in by
    ? await q.eq("id", by.id).maybeSingle()
    : await q.eq("subscription_id", by.subscriptionId).maybeSingle();
  if (error) {
    console.error("[hosting-setup] row read failed:", error.message);
    return null;
  }
  return (data as unknown as SetupRow | null) ?? null;
}

/* ── The store ─────────────────────────────────────────────────────────── */

export interface SetupStore {
  load(id: string): Promise<SetupRow | null>;
  /** Write `next` only if the stored state is still at `prevRev`. True when it was written. */
  cas(id: string, prevRev: number | undefined, next: SetupState): Promise<boolean>;
  /** False until supabase/2026-09-25-hosting-setup.sql has run. */
  canWrite(): Promise<boolean>;
}

export function supabaseStore(db: Db): SetupStore {
  return {
    load: (id) => loadSetupRow(db, { id }),
    canWrite: () => setupColumnReady(db),
    async cas(id, prevRev, next) {
      const base = db.from("hosting_clients").update({ setup: next }).eq("id", id);
      const guarded = prevRev === undefined ? base.is("setup->>rev", null) : base.eq("setup->>rev", String(prevRev));
      const { data, error } = await guarded.select("id");
      if (error) {
        console.error("[hosting-setup] write failed:", error.message);
        return false;
      }
      return Array.isArray(data) && data.length === 1;
    },
  };
}

/**
 * Change the stored state with `fn`, retrying on a lost race. `fn` returns
 * null to write nothing.
 */
export async function mutateState(
  store: SetupStore,
  id: string,
  fn: (state: SetupState, row: SetupRow) => SetupState | null,
): Promise<{ ok: true; row: SetupRow } | { ok: false; reason: "no-column" | "not-found" | "busy" | "unchanged" }> {
  if (!(await store.canWrite())) return { ok: false, reason: "no-column" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await store.load(id);
    if (!row) return { ok: false, reason: "not-found" };
    const state = row.setup ?? {};
    const next = fn(structuredClone(state), row);
    if (!next) return { ok: false, reason: "unchanged" };
    next.rev = (state.rev ?? 0) + 1;
    if (await store.cas(id, state.rev, next)) return { ok: true, row: { ...row, setup: next } };
  }
  return { ok: false, reason: "busy" };
}

/* ── What we know about the client beyond the row ──────────────────────── */

/**
 * The host to check: the address they gave us, else the one their reference
 * carries, else their business name when it is itself a domain (a self-serve
 * buyer who typed "walk-s3-test.example.com" as their business).
 */
export function contextFor(row: SetupRow, setupHref: string | null = null): SetupContext {
  const refKey = refKeyForEmail(row.email);
  const ref = clientRefFor(refKey);
  const business = String(row.business ?? "");
  const host =
    hostFrom(row.site_url) ??
    hostFrom(knownSiteUrl(refKey)) ??
    (business.includes(".") && !/\s/.test(business.trim()) ? hostFrom(business) : null);
  const bought = readDomainRecord(row.notes);
  return {
    knownClient: Boolean(ref),
    knownRepo: Boolean(ref?.repo),
    host,
    domainOurs: Boolean(bought && bought.status === "bought" && host && hostFrom(bought.domain) === host),
    setupHref,
  };
}

/** The checklist from what is stored (no network). */
export function storedChecklist(row: SetupRow, lang: Lang = "en", setupHref: string | null = null): Checklist {
  return computeChecklist(row, contextFor(row, setupHref), row.setup?.probe ?? null, lang);
}

/**
 * The checklist for a page. Uses the stored check while it is under five
 * minutes old; otherwise runs the checks now, capped at seven seconds so a
 * dead host cannot hold the page. NOT stored and never emails: a page view is
 * not a check anyone asked for. "Check again" and the cron do that.
 */
export async function checklistForView(
  row: SetupRow,
  opts: { lang: Lang; setupHref?: string | null; probeIfStale?: boolean; now?: Date },
): Promise<Checklist | null> {
  if (!checklistApplies(row.plan)) return null;
  const ctx = contextFor(row, opts.setupHref ?? null);
  const now = opts.now ?? new Date();
  const stored = row.setup?.probe ?? null;
  let probe: Probe | null = stored;
  const fresh = Boolean(stored && stored.host === ctx.host && now.getTime() - Date.parse(stored.at) < 5 * 60_000);
  if (opts.probeIfStale && ctx.host && !fresh && !row.setup?.completeAt) {
    /* A page view does not store what it measured, so without this a client
       pressing refresh would re-probe their domain on every load. One
       measurement per host per minute per instance is plenty for a page. */
    const memo = viewProbes.get(ctx.host);
    if (memo && now.getTime() - memo.at < 60_000) {
      probe = memo.probe;
    } else {
      const cap = new Promise<Probe | null>((r) => setTimeout(() => r(stored), 7000));
      probe = await Promise.race([probeHost({ host: ctx.host, vercelProject: row.vercel_project }, now).catch(() => stored), cap]);
      if (probe && probe !== stored) {
        if (viewProbes.size > 500) viewProbes.clear();
        viewProbes.set(ctx.host, { probe, at: now.getTime() });
      }
    }
  }
  return computeChecklist(row, ctx, probe, opts.lang);
}

const viewProbes = new Map<string, { probe: Probe; at: number }>();

/* ── The founder, told once ────────────────────────────────────────────── */

export function ownerAlertAddress(): string {
  return process.env.OWNER_ALERT_EMAIL?.trim() || "hello@servolia.com";
}

/**
 * Telegram (plain) + an email to OWNER_ALERT_EMAIL.
 *
 * TODO(sv-alerts): switch to the shared notifyOwner helper once that branch
 * lands; this local sender exists so this feature does not depend on it.
 */
export async function notifyOwnerLocal(subject: string, lines: string[]): Promise<void> {
  await sendTelegramMessage([subject, "", ...lines].join("\n"), undefined, { plain: true }).catch(() => null);
  const mail = ownerSetupEmail({ subject, lines });
  await sendEmail(ownerAlertAddress(), mail.subject, mail.html).catch(() => false);
}

/* ── The check ─────────────────────────────────────────────────────────── */

export interface RunDeps {
  store: SetupStore;
  probe: (target: { host: string; vercelProject: string | null }, now: Date) => Promise<Probe>;
  sendEmail: (to: string, subject: string, html: string) => Promise<boolean>;
  notifyOwner: (subject: string, lines: string[]) => Promise<void>;
  accountLink: (subscriptionId: string) => Promise<string | null>;
  setupLink: (subscriptionId: string) => Promise<string | null>;
  langOf: (row: SetupRow) => Promise<Lang>;
  now: () => Date;
}

/** The client's language: their reference's, else what they bought in. */
async function langOfRow(row: SetupRow): Promise<Lang> {
  const ref = clientRefFor(refKeyForEmail(row.email));
  if (ref?.lang) return ref.lang;
  if (row.subscription_id) {
    const ctx = await subscriptionContext(row.subscription_id).catch(() => null);
    if (ctx?.lang) return ctx.lang;
  }
  return "en";
}

export function defaultDeps(db: Db): RunDeps {
  return {
    store: supabaseStore(db),
    probe: (t, now) => probeHost(t, now),
    sendEmail: (to, s, h) => sendEmail(to, s, h),
    notifyOwner: notifyOwnerLocal,
    accountLink: (sub) => accountLinkFor(sub).catch(() => null),
    setupLink: (sub) => setupLinkFor(sub).catch(() => null),
    langOf: langOfRow,
    now: () => new Date(),
  };
}

export type RunResult =
  | { ok: true; checklist: Checklist; sent: Milestone[]; notified: Milestone[]; stored: boolean }
  | { ok: false; reason: "not-found" | "not-hosting" | "busy" };

/**
 * Run every live check for one hosting row, store what was found, and send
 * the milestone emails it earned. Test rows run the same code inside the test
 * context, so their emails reach the founder marked [TEST].
 */
export async function runSetupCheck(rowId: string, deps: RunDeps, viewLang: Lang = "en"): Promise<RunResult> {
  const first = await deps.store.load(rowId);
  if (!first) return { ok: false, reason: "not-found" };
  if (!checklistApplies(first.plan)) return { ok: false, reason: "not-hosting" };

  return runAsTest(first.is_test === true, async (): Promise<RunResult> => {
    const now = deps.now();
    const nowIso = now.toISOString();
    const setupHref = first.subscription_id ? await deps.setupLink(first.subscription_id) : null;
    const ctx = contextFor(first, setupHref);
    const probe = ctx.host ? await deps.probe({ host: ctx.host, vercelProject: first.vercel_project }, now) : null;

    if (!(await deps.store.canWrite())) {
      return { ok: true, checklist: computeChecklist(first, ctx, probe, viewLang), sent: [], notified: [], stored: false };
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const row = attempt === 0 ? first : await deps.store.load(rowId);
      if (!row) return { ok: false, reason: "not-found" };
      const state = row.setup ?? {};
      const list = computeChecklist(row, ctx, probe, "en");
      const tr = planTransition(state, list, nowIso);
      if (probe) tr.next.probe = probe; else delete tr.next.probe;
      /* The stamps are written BEFORE anything is sent: a crash after this
         line costs an email, never a second one. */
      if (!(await deps.store.cas(rowId, state.rev, tr.next))) continue;

      const stored: SetupRow = { ...row, setup: tr.next };
      const reference = row.subscription_id ? referenceFor(row.subscription_id) : null;
      const host = ctx.host ?? "";
      const sentTo: Partial<Record<Milestone, boolean | null>> = {};
      if (tr.send.length) {
        const lang = await deps.langOf(row);
        const portalUrl = row.subscription_id ? await deps.accountLink(row.subscription_id) : null;
        const clientList = computeChecklist(stored, ctx, probe, lang);
        for (const m of tr.send) {
          if (!row.email) { sentTo[m] = null; continue; }
          const mail = setupMilestoneEmail({
            milestone: m, lang, host, business: row.business ?? "", reference, portalUrl, checkedAt: nowIso, checklist: clientList,
          });
          sentTo[m] = await deps.sendEmail(row.email, mail.subject, mail.html).catch(() => false);
        }
      }
      for (const m of tr.notify) {
        const who = row.business || row.email || "a hosting client";
        const emailed = sentTo[m] === true ? `Client emailed (${row.email}).` : sentTo[m] === false ? `Client email to ${row.email} FAILED - tell them yourself.` : "No client address on file - tell them yourself.";
        const left = list.steps.filter((s) => s.state !== "done").map((s) => s.title);
        await deps.notifyOwner(
          m === "live" ? `Hosting LIVE - ${who}` : `Hosting: domain now points to us - ${who}`,
          [
            m === "live" ? `https://${host} answered 200 from Vercel (checked ${nowIso}).` : `${host} answers from Vercel (checked ${nowIso}).`,
            reference ? `Ref ${reference}` : "",
            emailed,
            left.length ? `Still open: ${left.join(", ")}` : "Every setup step is done.",
            `https://servolia.com/admin/hosting/${row.id}`,
          ].filter(Boolean),
        );
      }
      return {
        ok: true,
        checklist: viewLang === "en" ? list : computeChecklist(stored, ctx, probe, viewLang),
        sent: tr.send,
        notified: tr.notify,
        stored: true,
      };
    }
    return { ok: false, reason: "busy" };
  });
}

/* ── The founder's ticks ───────────────────────────────────────────────── */

export async function tickHandStep(
  store: SetupStore,
  id: string,
  step: HandStep,
  done: boolean,
  now = new Date(),
): ReturnType<typeof mutateState> {
  return mutateState(store, id, (state, row) => {
    const hand = { ...(state.hand ?? {}) };
    if (done) hand[step] = hand[step] ?? now.toISOString();
    else delete hand[step];
    const next: SetupState = { ...state, hand };
    const list = computeChecklist({ ...row, setup: next }, contextFor(row), next.probe ?? null, "en");
    if (list.complete && !next.completeAt) next.completeAt = now.toISOString();
    if (!list.complete) delete next.completeAt;
    return next;
  });
}

/** The setup form arrived. Called by /api/hosting-setup. Never throws. */
export async function recordDetailsReceived(subscriptionId: string, now = new Date()): Promise<boolean> {
  try {
    const db = supabaseAdmin();
    if (!db || !(await setupColumnReady(db))) return false;
    const row = await loadSetupRow(db, { subscriptionId });
    if (!row) return false;
    const out = await mutateState(supabaseStore(db), row.id, (s) => (s.detailsAt ? null : { ...s, detailsAt: now.toISOString() }));
    return out.ok;
  } catch {
    return false;
  }
}

/* ── The cron's pass ───────────────────────────────────────────────────── */

/**
 * Re-check every hosting client whose setup is not complete, oldest check
 * first, a few at a time, inside a time budget (the domain-live cron gives it
 * what is left of its minute). What is not reached is checked next run.
 */
export async function recheckHostingSetups(opts: { budgetMs: number; deps?: RunDeps }): Promise<{
  checked: number; sent: string[]; errors: string[]; skipped?: string;
}> {
  const sent: string[] = [];
  const errors: string[] = [];
  const db = supabaseAdmin();
  if (!db) return { checked: 0, sent, errors: ["no-db"] };
  if (!(await setupColumnReady(db))) return { checked: 0, sent, errors, skipped: "setup column missing - run supabase/2026-09-25-hosting-setup.sql" };
  const deps = opts.deps ?? defaultDeps(db);
  const until = Date.now() + opts.budgetMs;

  const { data, error } = await db.from("hosting_clients")
    .select("id, setup")
    .in("plan", [...HOSTING_TIERS])
    .in("status", ["active", "past_due"])
    .not("subscription_id", "is", null);
  if (error) return { checked: 0, sent, errors: [error.message] };

  const pending = ((data ?? []) as { id: string; setup: SetupState | null }[])
    .filter((r) => !r.setup?.completeAt)
    .sort((a, b) => (a.setup?.checkedAt ?? "").localeCompare(b.setup?.checkedAt ?? ""));

  let checked = 0;
  for (let i = 0; i < pending.length; i += 4) {
    if (Date.now() > until) break;
    await Promise.all(pending.slice(i, i + 4).map(async (r) => {
      try {
        const out = await runSetupCheck(r.id, deps);
        checked += 1;
        if (out.ok) for (const m of out.sent) sent.push(`${r.id}:${m}`);
      } catch (e) {
        errors.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }));
  }
  return { checked, sent, errors };
}
