/**
 * THE ON-SITE TRIAL — the client's real assistant, on the client's real
 * website, for seven days, started by the client's own click.
 *
 * The showroom (the try page) lets a hosting client meet the assistant
 * Servolia built for them. This is the second door: it goes on THEIR site,
 * answers THEIR visitors, and rings THEIR phone when it takes an enquiry —
 * which is the only demo that sells: "it answered three people while you
 * slept" is a sentence no film can say.
 *
 * THREE DECISIONS, each one argued and each one his:
 *
 *  1. CONSENT, NOT SURPRISE. The trial begins with the client's click on a
 *     link only they hold (their signed hosting token). A script Servolia
 *     dropped onto a client's production site uninvited, that then spoke to
 *     their customers, would be the fastest way to lose the client — and
 *     the click itself is the commitment signal that predicts a sale.
 *  2. SEVEN DAYS (his call, 2026-09-17). Long enough for a low-traffic site
 *     to see a real enquiry; short enough that "your week is up" arrives
 *     while the memory of the first one is fresh.
 *  3. THE ROW IS THE SWITCH, SAME AS PAYMENT. A trial is a hosting_clients
 *     row with plan=chatbot and status=trial, carrying its end date in
 *     `notes` in the same marker style fulfilment.ts uses — no migration.
 *     assistantEnabled() reads it like any other row, so the widget turns
 *     on the moment the row exists and off the moment the cron ends it,
 *     with NO uninstall: the tag stays in their pages drawing nothing (the
 *     same 1 KB script every lapsed client keeps), and when they pay, the
 *     webhook COMPLETES this very row (email + plan + no subscription — its
 *     existing pre-created-row path) and the tag is already in place.
 *     Nothing is installed twice, nothing is removed, and the trial cannot
 *     be silently re-armed by a second click: a running trial is returned,
 *     an ended one is ended.
 *
 * monthly_usd is written as 0 for the trial row: it is not revenue, and a
 * page that sums the column must not count a week's gift as income.
 */
import { supabaseAdmin } from "@/lib/supabase";
import { clientRefFor } from "@/lib/clientRefs";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { installAssistantTag } from "@/lib/assistantInstall";
import { conversationCount } from "@/lib/assistantAccess";
import { HOSTING_TIERS } from "@/lib/hosting";
import { excludeTest } from "@/lib/testContext";

export const TRIAL_DAYS = 7;

/**
 * How many days before the end the nudge goes out — day 5 of 7.
 *
 * It was deliberately absent at first: a deadline warning invites an early
 * no, while feeling the assistant go quiet makes the case by itself. He
 * asked for it on 2026-09-17, and the way to have both is to make the nudge
 * about what it DID rather than about the date — and to say something else
 * entirely when it has done nothing (see assistantTrialNudgeEmail).
 */
export const NUDGE_BEFORE_DAYS = 2;

const MARKER = "servolia-trial:";

export interface TrialRecord {
  /** ISO — when the assistant goes quiet again unless paid for. */
  until: string;
  started: string;
  /** ISO of the day-5 nudge, once it has gone. Absent means not yet. */
  nudged?: string;
}

export function readTrial(notes: string | null | undefined): TrialRecord | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(MARKER));
  if (!line) return null;
  const kv: Record<string, string> = {};
  for (const p of line.slice(MARKER.length).split(" | ")) {
    const i = p.indexOf(":");
    if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  if (!kv.until) return null;
  return { until: kv.until, started: kv.started ?? "", ...(kv.nudged ? { nudged: kv.nudged } : {}) };
}

export function writeTrial(notes: string | null | undefined, rec: TrialRecord): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(MARKER) && l.trim() !== "");
  /* `until` stays FIRST: assistantAccess.ts carries a two-line copy of this
     parse (it cannot import this module, which imports it) and reads the end
     date with a regex. Appending fields is safe; reordering is not. */
  const line = `${MARKER} until: ${rec.until} | started: ${rec.started}${rec.nudged ? ` | nudged: ${rec.nudged}` : ""}`;
  return [...kept, line].join("\n");
}

/**
 * Is this trial in its nudge window — inside the last two days, not over,
 * and not nudged already? Pure, so the decision can be tested without a
 * database; the cron does the sending.
 */
export function trialNudgeDue(notes: string | null | undefined, now: number): boolean {
  const rec = readTrial(notes);
  if (!rec || rec.nudged) return false;
  const until = Date.parse(rec.until);
  if (!Number.isFinite(until) || now >= until) return false;      // over: the expiry pass owns it
  return now >= until - NUDGE_BEFORE_DAYS * 86_400_000;
}

/** A trial row that is still inside its window. */
export function trialRunning(row: { status?: string | null; notes?: string | null }, now = Date.now()): boolean {
  if (row.status !== "trial") return false;
  const rec = readTrial(row.notes);
  return Boolean(rec && Date.parse(rec.until) > now);
}

export type TrialStart =
  | { ok: true; until: string; already: boolean; installed: boolean | null; installDetail?: string; siteUrl: string; business: string; email: string; lang: "en" | "fr" }
  | { ok: false; reason: "unknown-client" | "no-brief" | "not-hosting-client" | "already-paid" | "ended" | "no-db" };

/**
 * Start (or report) the trial for a known client reference.
 *
 * Preconditions, each a refusal rather than a guess: the ref is a client we
 * know with an address on file; Servolia has built their assistant (a brief
 * in code); they are a hosting client (an active tier row — the trial is a
 * hosting customer's perk, not a public giveaway); and they do not already
 * pay for the assistant.
 */
export async function startAssistantTrial(ref: string): Promise<TrialStart> {
  const key = ref.trim().toLowerCase();
  const client = clientRefFor(key);
  if (!client?.email) return { ok: false, reason: "unknown-client" };
  const brief = ASSISTANT_SITES[key];
  if (!brief) return { ok: false, reason: "no-brief" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "no-db" };

  // `is_test is not true`: founder test rows are never a client's hosting.
  const { data: rows } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, plan, status, notes")
    .ilike("email", client.email!) // narrowed above; lost inside the closure
    .in("status", ["active", "past_due", "trial", "trial_ended"])));
  const all = rows ?? [];
  const hosting = all.some((r) => HOSTING_TIERS.includes(String(r.plan).toLowerCase()) && (r.status === "active" || r.status === "past_due"));
  if (!hosting) return { ok: false, reason: "not-hosting-client" };
  const chatbot = all.filter((r) => String(r.plan).toLowerCase() === "chatbot");
  if (chatbot.some((r) => r.status === "active" || r.status === "past_due")) return { ok: false, reason: "already-paid" };

  const siteUrl = `https://${client.label}`;
  const lang = client.lang ?? "en";
  const base = { siteUrl, business: brief.businessName, email: client.email, lang } as const;

  const running = chatbot.find((r) => trialRunning(r));
  if (running) {
    return { ok: true, until: readTrial(running.notes)!.until, already: true, installed: null, ...base };
  }
  // One trial per client, ever. A second week is a discount nobody asked for.
  if (chatbot.some((r) => r.status === "trial_ended" || r.status === "trial")) return { ok: false, reason: "ended" };

  const started = new Date();
  const until = new Date(started.getTime() + TRIAL_DAYS * 86_400_000).toISOString();
  const { error } = await db.from("hosting_clients").insert({
    business: brief.businessName,
    email: client.email,
    site_url: siteUrl,
    repo: client.repo ?? null,
    branch: client.branch ?? "main",
    site_root: client.siteRoot ?? null,
    plan: "chatbot",
    monthly_usd: 0,
    billing_period: "monthly",
    status: "trial",
    subscription_id: null,
    notes: writeTrial(null, { until, started: started.toISOString() }),
  });
  if (error) {
    console.error("[assistant-trial] row insert failed:", error.message);
    return { ok: false, reason: "no-db" };
  }

  /* The row is the switch, so the widget is live from this line on; now
     put the tag where the switch can reach it. A failed install leaves a
     running trial with no tag — reported, not hidden, so the line can be
     added by hand (the settings page shows it). */
  let installed: boolean | null = null;
  let installDetail: string | undefined;
  if (client.repo && !client.gateWidget) {
    const out = await installAssistantTag(
      { repo: client.repo, branch: client.branch ?? "main", siteRoot: client.siteRoot ?? null },
      key,
      brief.widgetPosition ?? "right",
    );
    installed = out.ok;
    installDetail = out.ok ? `${out.changed} page(s)` : `${out.reason}${"detail" in out && out.detail ? `: ${out.detail}` : ""}`;
  }

  return { ok: true, until, already: false, installed, installDetail, ...base };
}

export type TrialState =
  | { state: "none" }
  | { state: "running"; until: string }
  | { state: "ended" }
  | { state: "paid" };

/** Read-only: where this client stands, for pages that must not start anything. */
export async function trialStateFor(ref: string): Promise<TrialState> {
  const client = clientRefFor(ref.trim().toLowerCase());
  const db = supabaseAdmin();
  if (!client?.email || !db) return { state: "none" };
  const { data } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("status, notes")
    .eq("plan", "chatbot")
    .ilike("email", client.email!)));
  const rows = data ?? [];
  if (rows.some((r) => r.status === "active" || r.status === "past_due")) return { state: "paid" };
  const running = rows.find((r) => trialRunning(r));
  if (running) return { state: "running", until: readTrial(running.notes)!.until };
  if (rows.some((r) => r.status === "trial" || r.status === "trial_ended")) return { state: "ended" };
  return { state: "none" };
}

export interface TrialEnded {
  ref: string;
  business: string;
  email: string;
  lang: "en" | "fr";
  conversations: number;
}

/** The client reference behind a billing address, for a client we build for. */
function refForEmail(email: string | null | undefined): string {
  const e = String(email ?? "").toLowerCase();
  if (!e) return "";
  return Object.keys(ASSISTANT_SITES).find((k) => clientRefFor(k)?.email?.toLowerCase() === e) ?? "";
}

export interface TrialNudge extends TrialEnded {
  until: string;
  siteLabel: string;
  /** Nobody has written to it yet — a different email entirely. */
  quiet: boolean;
}

/**
 * Two days before the end, tell them what it has done so far. Marks the row
 * BEFORE the caller sends, so a crash mid-send costs one email rather than
 * risking a second one — the same trade the dunning cron makes with
 * `past_due_final`.
 */
export async function nudgeAssistantTrials(now = Date.now()): Promise<{ nudged: TrialNudge[]; errors: string[] }> {
  const db = supabaseAdmin();
  const nudged: TrialNudge[] = [];
  const errors: string[] = [];
  if (!db) return { nudged, errors: ["no-db"] };

  const { data: rows } = await db
    .from("hosting_clients")
    .select("id, business, email, notes")
    .eq("plan", "chatbot")
    .eq("status", "trial");

  for (const r of rows ?? []) {
    if (!trialNudgeDue(r.notes, now)) continue;
    const rec = readTrial(r.notes)!;
    const marked = writeTrial(r.notes, { ...rec, nudged: new Date(now).toISOString() });
    const { error } = await db.from("hosting_clients").update({ notes: marked }).eq("id", r.id);
    if (error) { errors.push(`${r.business}: ${error.message}`); continue; }

    const ref = refForEmail(r.email);
    const conversations = ref ? await conversationCount(ref, TRIAL_DAYS) : 0;
    nudged.push({
      ref,
      business: r.business,
      email: r.email ?? "",
      lang: clientRefFor(ref)?.lang ?? "en",
      conversations,
      until: rec.until,
      siteLabel: clientRefFor(ref)?.label ?? r.business,
      quiet: conversations === 0,
    });
  }
  return { nudged, errors };
}

/**
 * End every trial whose week is over. Called by the daily cron. Idempotent:
 * a row is ended once, and the count it reports is the client's own week.
 */
export async function expireAssistantTrials(now = Date.now()): Promise<{ ended: TrialEnded[]; errors: string[] }> {
  const db = supabaseAdmin();
  const ended: TrialEnded[] = [];
  const errors: string[] = [];
  if (!db) return { ended, errors: ["no-db"] };

  const { data: rows } = await db
    .from("hosting_clients")
    .select("id, business, email, notes, status")
    .eq("plan", "chatbot")
    .eq("status", "trial");

  for (const r of rows ?? []) {
    const rec = readTrial(r.notes);
    if (!rec || Date.parse(rec.until) > now) continue;
    const { error } = await db.from("hosting_clients").update({ status: "trial_ended" }).eq("id", r.id);
    if (error) { errors.push(`${r.business}: ${error.message}`); continue; }
    // The ref is the slug for every client we build for; find it by address.
    const ref = Object.keys(ASSISTANT_SITES).find((k) => clientRefFor(k)?.email?.toLowerCase() === String(r.email ?? "").toLowerCase()) ?? "";
    const conversations = ref ? await conversationCount(ref, TRIAL_DAYS) : 0;
    ended.push({ ref, business: r.business, email: r.email ?? "", lang: clientRefFor(ref)?.lang ?? "en", conversations });
  }
  return { ended, errors };
}
