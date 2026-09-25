import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { runAsTest, testColumnReady } from "@/lib/testContext";
import { accountLinkFor, setupLinkFor, referenceFor, subscriptionContext } from "@/lib/upgrade";
import { clientRefFor, refKeyForEmail, knownSiteUrl } from "@/lib/clientRefs";
import { readDomainRecord } from "@/lib/domainSales";
import { HOSTING_TIERS } from "@/lib/hosting";
import {
  computeChecklist, planTransition, checklistApplies, isEstablished, isMeasured, settleClaim,
  type Checklist, type HandStep, type Lang, type Milestone, type Probe, type SetupContext, type SetupRow, type SetupState,
} from "@/lib/hostingSetup";
import { probeHost, hostFrom } from "@/lib/hostingSetupProbe";
import { setupMilestoneEmail } from "@/lib/hostingSetupEmails";
import { notifyOwner, bounded, type OwnerNotice } from "@/lib/notify";

/**
 * THE SETUP TRACKER'S MOVING PARTS: storage, the check, the milestone emails.
 *
 * One function, runSetupCheck(), is what the cron, the client's "Check again"
 * and the founder's "Run checks now" all call — so a milestone reached by any
 * of them is announced exactly once, by whichever got there first.
 *
 * ESTABLISHED CLIENTS ARE NEVER WRITTEN TO (isEstablished: a real row created
 * before SETUP_TRACKER_SINCE). For them a check only computes and returns;
 * nothing is stored, emailed or announced, and the cron does not pick them up.
 *
 * STORAGE is hosting_clients.setup (jsonb, supabase/2026-09-25-hosting-setup.sql).
 * Until that SQL has run, everything still COMPUTES but nothing is stored and
 * nothing is emailed: an email with nowhere to record that it went would go
 * again on the next run.
 *
 * EVERY WRITE IS A COMPARE-AND-SWAP on setup.rev. A cron run that read the row
 * before the founder ticked a step cannot write its older copy over the tick.
 * A milestone email is CLAIMED in the same write, sent, and only then stamped
 * with the send time (or "failed", to retry) — so a stamp never says "sent"
 * for an email that did not go.
 *
 * EVERY SEND IS AWAITED AND BOUNDED (src/lib/notify.ts bounded, 5 s): on
 * Vercel a request still in flight when the function returns can die with
 * it, and a hung Resend or Telegram must not hold the cron's minute. A send
 * that hangs past the cap counts as not sent: its claim is settled "failed"
 * and retried at the next check.
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

async function columns(db: unknown): Promise<string> {
  const hasSetup = await setupColumnReady(db);
  const hasTest = await testColumnReady(db);
  return `${BASE_COLS}${hasSetup ? ", setup" : ""}${hasTest ? ", is_test" : ""}`;
}

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

/** One hosting row, by id or by subscription, with whatever columns exist. */
export async function loadSetupRow(db: Db, by: { id: string } | { subscriptionId: string }): Promise<SetupRow | null> {
  const q = db.from("hosting_clients").select(await columns(db));
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

type MutateFail = "no-column" | "not-found" | "busy" | "unchanged" | "established";

/**
 * Change the stored state with `fn`, retrying on a lost race. `fn` returns
 * null to write nothing. Never writes an established client's row.
 */
export async function mutateState(
  store: SetupStore,
  id: string,
  fn: (state: SetupState, row: SetupRow) => SetupState | null,
): Promise<{ ok: true; row: SetupRow } | { ok: false; reason: MutateFail }> {
  if (!(await store.canWrite())) return { ok: false, reason: "no-column" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await store.load(id);
    if (!row) return { ok: false, reason: "not-found" };
    if (isEstablished(row)) return { ok: false, reason: "established" };
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

const viewProbes = new Map<string, { probe: Probe; at: number }>();

/**
 * The checklist for a page.
 *
 * Null for an ESTABLISHED client unless `includeEstablished` (the admin's
 * read-only view): their page shows their plan and measured status only.
 *
 * Uses the stored check while it is under five minutes old. Otherwise it may
 * run the checks now — only if `allowProbe()` agrees (the portal passes the
 * same per-subscription limiter as "Check again"), at most once a minute per
 * host per instance, capped at seven seconds. Never stored and never emails:
 * a page view is not a check anyone asked for.
 */
export async function checklistForView(
  row: SetupRow,
  opts: { lang: Lang; setupHref?: string | null; allowProbe?: () => Promise<boolean>; includeEstablished?: boolean; now?: Date },
): Promise<Checklist | null> {
  if (!checklistApplies(row.plan)) return null;
  const established = isEstablished(row);
  if (established && !opts.includeEstablished) return null;
  const ctx = contextFor(row, opts.setupHref ?? null);
  const now = opts.now ?? new Date();
  const stored = row.setup?.probe ?? null;
  let probe: Probe | null = stored;
  const fresh = Boolean(stored && stored.host === ctx.host && now.getTime() - Date.parse(stored.at) < 5 * 60_000);
  if (!established && opts.allowProbe && ctx.host && !fresh && !row.setup?.completeAt) {
    const memo = viewProbes.get(ctx.host);
    if (memo && now.getTime() - memo.at < 60_000) {
      probe = memo.probe;
    } else if (await opts.allowProbe()) {
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

/* ── The check ─────────────────────────────────────────────────────────── */

export interface RunDeps {
  store: SetupStore;
  probe: (target: { host: string; vercelProject: string | null }, now: Date) => Promise<Probe>;
  sendEmail: (to: string, subject: string, html: string) => Promise<boolean>;
  notifyOwner: (n: OwnerNotice) => Promise<unknown>;
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
    notifyOwner,
    accountLink: (sub) => accountLinkFor(sub).catch(() => null),
    setupLink: (sub) => setupLinkFor(sub).catch(() => null),
    langOf: langOfRow,
    now: () => new Date(),
  };
}

export type RunResult =
  | { ok: true; checklist: Checklist; sent: Milestone[]; notified: Milestone[]; stored: boolean; established: boolean }
  | { ok: false; reason: "not-found" | "not-hosting" | "busy" };

/**
 * Run every live check for one hosting row, store what was found, and send
 * the milestone emails it earned. Test rows run the same code inside the test
 * context, so their emails reach the founder marked [TEST]. Established rows
 * are measured and returned, and nothing else.
 */
export async function runSetupCheck(rowId: string, deps: RunDeps, viewLang: Lang = "en"): Promise<RunResult> {
  const first = await deps.store.load(rowId);
  if (!first) return { ok: false, reason: "not-found" };
  if (!checklistApplies(first.plan)) return { ok: false, reason: "not-hosting" };

  return runAsTest(first.is_test === true, async (): Promise<RunResult> => {
    const now = deps.now();
    const nowIso = now.toISOString();
    const ctxOf = async (r: SetupRow) => contextFor(r, r.subscription_id ? await deps.setupLink(r.subscription_id) : null);
    let ctx = await ctxOf(first);
    const probe = ctx.host ? await deps.probe({ host: ctx.host, vercelProject: first.vercel_project }, now) : null;

    const established = isEstablished(first);
    if (established || !(await deps.store.canWrite())) {
      return { ok: true, checklist: computeChecklist(first, ctx, probe, viewLang), sent: [], notified: [], stored: false, established };
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const row = attempt === 0 ? first : await deps.store.load(rowId);
      if (!row) return { ok: false, reason: "not-found" };
      if (attempt > 0) ctx = await ctxOf(row); // the reloaded row's own address, links and flags
      const state = row.setup ?? {};
      const list = computeChecklist(row, ctx, probe, "en");
      const tr = planTransition(state, list, nowIso, isMeasured(probe));
      if (probe) tr.next.probe = probe; else delete tr.next.probe;
      /* The CLAIMS ride in this write. Only the check whose write lands holds
         them, so of several racing checks one sends. */
      if (!(await deps.store.cas(rowId, state.rev, tr.next))) continue;

      const stored: SetupRow = { ...row, setup: tr.next };
      const reference = row.subscription_id ? referenceFor(row.subscription_id) : null;
      const host = ctx.host ?? "";
      const outcome: Partial<Record<Milestone, boolean | null>> = {};
      if (tr.send.length) {
        const lang = await deps.langOf(row);
        const portalUrl = row.subscription_id ? await deps.accountLink(row.subscription_id) : null;
        const clientList = computeChecklist(stored, ctx, probe, lang);
        for (const m of tr.send) {
          let sent: boolean | null = null;
          if (row.email) {
            const mail = setupMilestoneEmail({
              milestone: m, lang, host, business: row.business ?? "", reference, portalUrl, checkedAt: nowIso, checklist: clientList,
            });
            const to = row.email;
            sent = (await bounded("setup milestone email", () => deps.sendEmail(to, mail.subject, mail.html))) === true;
          }
          outcome[m] = sent;
          /* Settled only now that the send has resolved, and only if our
             claim is still the one on the row. */
          const claim = tr.claims[m]!;
          await mutateState(deps.store, rowId, (s) => {
            if (s.mail?.[m] !== claim) return null;
            return { ...s, mail: { ...s.mail, [m]: settleClaim(claim, sent, deps.now().toISOString()) } };
          });
        }
      }
      for (const m of tr.notify) {
        const who = row.business || row.email || "a hosting client";
        const left = list.steps.filter((s) => s.state !== "done").map((s) => s.title);
        await bounded("setup owner notice", () => deps.notifyOwner({
          subject: m === "live" ? `Hosting LIVE - ${who}` : `Hosting: domain now points to us - ${who}`,
          lines: [
            m === "live" ? `https://${host} answered 200 from our Vercel project (checked ${nowIso}).` : `${host} answers from Vercel (checked ${nowIso}).`,
            reference ? `Ref ${reference}` : null,
            outcome[m] === true ? `Client emailed (${row.email}).`
              : outcome[m] === false ? `Client email to ${row.email} FAILED - retried at the next checks; tell them yourself if it keeps failing.`
              : "No client address on file - tell them yourself.",
            left.length ? `Still open: ${left.join(", ")}` : "Every setup step is done.",
          ],
          link: `https://servolia.com/admin/hosting/${row.id}`,
        }));
      }
      return {
        ok: true,
        checklist: viewLang === "en" ? list : computeChecklist(stored, ctx, probe, viewLang),
        sent: tr.send.filter((m) => outcome[m] === true),
        notified: tr.notify,
        stored: true,
        established: false,
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
): Promise<{ ok: true; row: SetupRow } | { ok: false; reason: MutateFail | "needs-vercel-project" }> {
  if (step === "onboard" && done) {
    const row = await store.load(id);
    if (!row) return { ok: false, reason: "not-found" };
    // "On our hosting" is checked against the recorded Vercel project, so it
    // cannot be ticked before there is one to check against.
    if (!row.vercel_project) return { ok: false, reason: "needs-vercel-project" };
  }
  return mutateState(store, id, (state, row) => {
    if (step === "onboard" && done && !row.vercel_project) return null;
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

/** The setup form arrived. Called by /api/hosting-setup. Never throws; never touches an established client. */
export async function recordDetailsReceived(subscriptionId: string, now = new Date()): Promise<boolean> {
  try {
    const db = supabaseAdmin();
    if (!db || !(await setupColumnReady(db))) return false;
    const row = await loadSetupRow(db, { subscriptionId });
    if (!row || isEstablished(row)) return false;
    const out = await mutateState(supabaseStore(db), row.id, (s) => (s.detailsAt ? null : { ...s, detailsAt: now.toISOString() }));
    return out.ok;
  } catch {
    return false;
  }
}

/* ── The cron's pass ───────────────────────────────────────────────────── */

/**
 * Re-check every NEW hosting client whose setup is not complete, oldest check
 * first, a few at a time, inside a time budget (the domain-live cron gives it
 * what is left of its minute). Established clients are never picked up.
 */
type CronRow = { id: string; setup: SetupState | null; created_at: string | null; started_at: string | null; is_test?: boolean | null };

async function listCronRows(db: Db): Promise<CronRow[] | string> {
  const hasTest = await testColumnReady(db);
  const { data, error } = await db.from("hosting_clients")
    .select(`id, setup, created_at, started_at${hasTest ? ", is_test" : ""}`)
    .in("plan", [...HOSTING_TIERS])
    .in("status", ["active", "past_due"])
    .not("subscription_id", "is", null);
  return error ? error.message : ((data ?? []) as unknown as CronRow[]);
}

export async function recheckHostingSetups(opts: { budgetMs: number; deps?: RunDeps; listRows?: () => Promise<CronRow[]> }): Promise<{
  checked: number; sent: string[]; errors: string[]; skipped?: string;
}> {
  const sent: string[] = [];
  const errors: string[] = [];
  const db = supabaseAdmin();
  const deps = opts.deps ?? (db ? defaultDeps(db) : null);
  if (!deps) return { checked: 0, sent, errors: ["no-db"] };
  if (!(await deps.store.canWrite())) return { checked: 0, sent, errors, skipped: "setup column missing - run supabase/2026-09-25-hosting-setup.sql" };
  const until = Date.now() + opts.budgetMs;

  const listed = opts.listRows ? await opts.listRows() : db ? await listCronRows(db) : "no-db";
  if (typeof listed === "string") return { checked: 0, sent, errors: [listed] };

  // Established clients are never picked up: their rows are not the tracker's.
  const pending = listed
    .filter((r) => !isEstablished(r) && !r.setup?.completeAt)
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
