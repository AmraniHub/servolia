import { supabaseAdmin } from "@/lib/supabase";
import type { ClientSiteConfig } from "@/lib/clientSites";

/**
 * IS THIS ASSISTANT PAID FOR?
 *
 * The switch is the hosting_clients row, not a flag on the config. That is
 * deliberate: the row already moves with Stripe — active on payment, past_due
 * on a failed charge, suspended when the grace period runs out, churned on
 * cancellation — through code that has been exercised by real clients. A
 * separate "assistant enabled" flag would have needed every one of those
 * transitions written a second time, and the first one somebody forgot would
 * be a client paying for an assistant that had gone quiet.
 *
 * So:
 *   - a config with features.chat === false is off, always (admin kill switch)
 *   - a demo is on (it is the pitch)
 *   - a Servolia-built site is on — its own billing gates the whole site
 *   - an assistant-only config is on while a chatbot subscription under its
 *     billing email is active or inside the dunning grace period
 *
 * past_due counts as on: Stripe retries a declined card for days, and cutting
 * the assistant off on the first failed retry would punish a client whose
 * card simply expired. The dunning cron ends the grace period; that is where
 * it stops.
 */
export async function assistantEnabled(config: ClientSiteConfig): Promise<boolean> {
  if (config.features?.chat === false) return false;
  if (config.isDemo) return true;
  if (!config.assistantOnly) return true;
  // A practice's own receptionist follows the EUR plans, never the hosting table.
  if (config.receptionist) return receptionistOn(config);

  return hasAssistantSubscription(config.hostingEmail);
}

/**
 * The receptionist from the public trial (receptionistTrial.ts): on while its
 * week runs, and after that only while the EUR subscription it became is paid
 * for — read off the clients row on the build the payment created, the same
 * row the meter and the invoices use. A cancellation sets that row `churned`;
 * a failed card sets `payment_status` past_due and a `suspend_at` (the Stripe
 * webhook), and the receptionist keeps answering until that date — the same
 * grace every EUR client gets — then goes quiet with no extra write.
 *
 * The phase test is inlined rather than imported: receptionistTrial.ts
 * imports this module. Keep the two in step.
 */
export async function receptionistOn(config: ClientSiteConfig, now = Date.now()): Promise<boolean> {
  const r = config.receptionist;
  if (!r) return false;
  if (r.started && r.until && Date.parse(r.until) > now) return true;
  if (!r.paidAt || !config.buildId) return false;
  const db = supabaseAdmin();
  if (!db) return false;
  const { data } = await db
    .from("clients")
    .select("id, payment_status, suspend_at")
    .eq("build_id", config.buildId)
    .in("status", ["active", "past_due"]);
  return (data ?? []).some((c) => {
    const row = c as { payment_status?: string | null; suspend_at?: string | null };
    const lapsed = String(row.payment_status ?? "").startsWith("past_due") && row.suspend_at && Date.parse(row.suspend_at) <= now;
    return !lapsed;
  });
}

/**
 * A chatbot row that switches the assistant on: paid (active, or past_due
 * inside the dunning grace), or a TRIAL still inside its seven days — the
 * trial's end date lives in the row's notes (see assistantTrial.ts), so an
 * ended trial that the cron has not yet marked is already off here.
 */
async function switchedOn(email?: string | null): Promise<boolean> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  const db = supabaseAdmin();
  if (!db) return false;
  const { data } = await db
    .from("hosting_clients")
    .select("status, notes")
    .eq("plan", "chatbot")
    .ilike("email", e)
    .in("status", ["active", "past_due", "trial"]);
  const now = Date.now();
  return (data ?? []).some((r) => r.status !== "trial" || trialStillRunning(r.notes, now));
}

/* Inlined rather than imported from assistantTrial.ts, which imports this
   module: the marker format is the one place both must agree. */
function trialStillRunning(notes: string | null | undefined, now: number): boolean {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith("servolia-trial:"));
  const until = line?.match(/until:\s*(\S+)/)?.[1];
  return Boolean(until && Date.parse(until) > now);
}

/* ── THE SHOWROOM: an unpaid assistant may be tried, on our own pages only ──
 *
 * Servolia builds a hosting client's assistant BEFORE they buy it (the briefs
 * in assistantSites.ts), and a thing that is built should be tried, not
 * described. So the widget and the chat answer for an unpaid brief when, and
 * only when, the page asking is Servolia's own — the try page, the pay page.
 * On the client's website the same slug stays dark until it is paid for,
 * which is the whole "paid = on" contract.
 *
 * Three things keep it from becoming an open faucet on the model bill:
 *   - the page must be ours: origin, or the referer when a same-origin GET
 *     omits the origin header, must resolve to servolia.com, localhost or the
 *     host serving this very request (preview deployments);
 *   - the caller must ASK for a preview (?preview=1 / preview:true), so the
 *     preview answer lives under a different URL from the cached
 *     `{enabled:false}` the client's site sees — a CDN keyed by URL could
 *     otherwise hand a preview payload to the client's own visitors;
 *   - a soft daily budget per slug, on top of the per-IP limit: a shared try
 *     link is a public link.
 *
 * Preview conversations are NOT the product: nothing is persisted and nobody
 * is notified. The person typing is the owner, or a stranger with the link,
 * and neither should light up the client's phone.
 */

const OUR_HOSTS = new Set(["servolia.com", "www.servolia.com", "localhost", "127.0.0.1"]);

function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

/**
 * Is the page making this request one of ours?
 *
 * Three signals, any one enough:
 *   - `Sec-Fetch-Site: same-origin` — set by the browser itself on a fetch
 *     from a page on this very origin, and a forbidden header no page script
 *     can forge. THE ONE THAT WORKS IN PRODUCTION: the site's Referrer-Policy
 *     strips the Referer from the widget's same-origin GET, and browsers send
 *     no Origin on same-origin GETs, so the first deploy of the showroom
 *     answered `enabled:false` to the very page it was built for while every
 *     curl with a typed Referer passed. A client's website embedding the same
 *     script sends `cross-site`, which is exactly what must be refused.
 *   - an Origin or Referer on our hosts — POSTs carry Origin; older browsers
 *     and the local dev server carry Referer.
 *   - the host serving this request — a Vercel preview deployment trying
 *     itself.
 */
export function previewOrigin(headers: { get(name: string): string | null }): boolean {
  if ((headers.get("sec-fetch-site") ?? "").toLowerCase() === "same-origin") return true;
  const from = hostOf(headers.get("origin")) || hostOf(headers.get("referer"));
  if (!from) return false;
  if (OUR_HOSTS.has(from) || from.endsWith(".servolia.com")) return true;
  const self = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(":")[0].toLowerCase();
  return Boolean(self) && from === self;
}

/**
 * Per-slug daily preview budget. In-memory, so per serverless instance and
 * reset on cold start — a SOFT cap that turns a runaway link into a small
 * bill rather than a large one, not an accounting system. 80 messages a day
 * is forty short conversations; a genuine owner trying their assistant uses
 * five.
 */
const PREVIEW_DAILY = 80;
const previewCounts = new Map<string, { day: string; n: number }>();

export function previewBudgetOk(slug: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const cur = previewCounts.get(slug);
  if (!cur || cur.day !== day) {
    previewCounts.set(slug, { day, n: 1 });
    return true;
  }
  if (cur.n >= PREVIEW_DAILY) return false;
  cur.n += 1;
  return true;
}

/** A config that has something to preview: a real brief, not a demo, not switched off. */
export function previewable(config: ClientSiteConfig): boolean {
  return !config.isDemo && config.features?.chat !== false;
}

/**
 * Same question, from the billing side: does this hosting row pay for an
 * assistant? Used by the admin page and the account page to decide whether
 * to show assistant controls at all.
 */
export function isAssistantPlan(plan: string | null | undefined): boolean {
  return (plan ?? "").toLowerCase() === "chatbot";
}

/**
 * Does this billing address already pay for an assistant?
 *
 * The question behind Servolia's own upsell: a hosting client's active page
 * and service page recommend the assistant UNTIL this says yes, and must
 * fall silent the moment it does — recommending a thing someone already
 * pays for reads as a company that does not know its own customers.
 */
export async function hasAssistantSubscription(email?: string | null): Promise<boolean> {
  return switchedOn(email);
}

/**
 * How many conversations a slug had in the last N days. Lives here rather
 * than in the admin page because reading the clock inside a component's
 * render is impure, and the lint rule that says so is right.
 */
export async function conversationCount(slug: string, days = 30): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { count } = await db
    .from("chat_sessions")
    .select("id", { count: "exact", head: true })
    .eq("site_slug", slug)
    .gte("created_at", since);
  return count ?? 0;
}
