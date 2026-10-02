import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { stripeFor } from "@/lib/stripeMode";
import { excludeTest } from "@/lib/testContext";
import { Sends } from "@/lib/notify";
import { readAddons } from "@/lib/addonSubscriptions";
import { normalizeDomain } from "@/lib/domainSales";
import { HOSTING_TIERS } from "@/lib/hosting";
import { LIVE_SUB_STATUSES, LIVE_ROW_STATUSES } from "@/lib/stripeCustomer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * DAILY BILLING CHECK — what Stripe charges vs what Servolia records.
 * Daily, 06:30 UTC (vercel.json). Auth: Bearer CRON_SECRET. CHANGES NOTHING.
 *
 * For every Stripe customer on a live client row (clients, hosting_clients),
 * every live subscription (active, trialing, past_due, unpaid, incomplete) is
 * listed and compared with the subscriptions Servolia knows about — the rows'
 * subscription_id, and add-ons recorded on clients.notes
 * (src/lib/addonSubscriptions.ts). Flags:
 *
 *  - double:    an address with two live EUR plans (a duplicate, or a
 *               second practice — the alert asks the owner to check before
 *               refunding); or two hosting
 *               subscriptions for the same site (repository or domain).
 *               Grouped by ADDRESS, not by customer: before 2026-10-02 every
 *               checkout made a new Stripe customer, so a client billed
 *               twice usually sits on two customers.
 *  - untracked: a live subscription no row and no add-on record knows.
 *  - missing:   a row we treat as paying (active / past_due / paused /
 *               suspended) whose subscription Stripe is not billing.
 *
 * The owner gets one Telegram alert listing what is flagged; the JSON answer
 * carries the whole report. ?email= narrows it to one address. The founder's
 * test rows are never read. The pattern is Latitax's billing check, without
 * its apply mode: which of two subscriptions goes is a person's decision.
 */
type ClientRow = { id: string; email: string | null; business: string | null; plan: string | null; status: string | null; customer_id: string | null; subscription_id: string | null; notes: string | null };
type HostRow = { id: string; email: string | null; business: string | null; plan: string | null; status: string | null; customer_id: string | null; subscription_id: string | null; repo: string | null; site_url: string | null };
type Known = { kind: "plan" | "hosting" | "addon"; email: string; rowId: string; site?: string; tier?: boolean; label: string; rowLive: boolean };
type LiveSub = { id: string; customer: string; status: string; amount: number | null; currency: string | null };

const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const stripe = stripeFor(true); // live key only: test customers are not billed
  if (!db || !stripe) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  const only = lower(req.nextUrl.searchParams.get("email"));

  const [{ data: cRows, error: cErr }, { data: hRows, error: hErr }] = await Promise.all([
    excludeTest(db, (live) => live(db.from("clients").select("id, email, business, plan, status, customer_id, subscription_id, notes"))),
    excludeTest(db, (live) => live(db.from("hosting_clients").select("id, email, business, plan, status, customer_id, subscription_id, repo, site_url"))),
  ]);
  if (cErr || hErr) return NextResponse.json({ error: (cErr ?? hErr)?.message ?? "read failed" }, { status: 500 });
  const clients = ((cRows ?? []) as ClientRow[]).filter((r) => !only || lower(r.email) === only);
  const hosts = ((hRows ?? []) as HostRow[]).filter((r) => !only || lower(r.email) === only);

  /* What Servolia knows: subscription id -> who and what. */
  const known = new Map<string, Known>();
  const customers = new Map<string, string>(); // customer -> address
  for (const c of clients) {
    const live = LIVE_ROW_STATUSES.includes(lower(c.status));
    if (c.subscription_id) known.set(c.subscription_id, { kind: "plan", email: lower(c.email), rowId: c.id, label: c.business || c.email || c.id, rowLive: live });
    for (const a of readAddons(c.notes)) {
      known.set(a.subscription, { kind: "addon", email: lower(c.email), rowId: c.id, label: `${c.business || c.email || c.id} (add-on ${a.addon})`, rowLive: !a.cancelled });
    }
    if (c.customer_id && (live || c.subscription_id)) customers.set(c.customer_id, lower(c.email));
  }
  for (const h of hosts) {
    const live = LIVE_ROW_STATUSES.includes(lower(h.status));
    const site = lower(h.repo) || normalizeDomain(h.site_url) || `row:${h.id}`;
    if (h.subscription_id) known.set(h.subscription_id, { kind: "hosting", email: lower(h.email), rowId: h.id, site, tier: HOSTING_TIERS.includes(lower(h.plan)), label: `${h.business || h.email || h.id} (${h.plan ?? "hosting"})`, rowLive: live });
    if (h.customer_id && (live || h.subscription_id)) customers.set(h.customer_id, lower(h.email));
  }

  /* What Stripe charges. */
  const liveSubs = new Map<string, LiveSub>();
  const seenStatus = new Map<string, string>(); // every listed subscription, live or not
  const errors: string[] = [];
  for (const customer of customers.keys()) {
    try {
      const list = await stripe.subscriptions.list({ customer, status: "all", limit: 100 });
      for (const s of list.data as Stripe.Subscription[]) {
        seenStatus.set(s.id, s.status);
        if (!LIVE_SUB_STATUSES.has(s.status)) continue;
        const item = s.items?.data?.[0];
        liveSubs.set(s.id, {
          id: s.id, customer, status: s.status,
          amount: item?.price?.unit_amount != null ? (item.price.unit_amount * (item.quantity ?? 1)) / 100 : null,
          currency: item?.price?.currency ?? null,
        });
      }
    } catch (e) {
      errors.push(`${customer}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const unreadable = new Set(errors.map((e) => e.split(":")[0]));

  const flagged: string[] = [];
  const report: Record<string, unknown>[] = [];
  const fmt = (s: LiveSub) => `${s.id} ${s.amount ?? "?"} ${(s.currency ?? "").toUpperCase()} ${s.status}`;

  // untracked
  for (const s of liveSubs.values()) {
    if (known.has(s.id)) continue;
    const who = customers.get(s.customer) || s.customer;
    flagged.push(`• untracked: ${who} — Stripe bills ${fmt(s)}, which no client row or add-on record knows`);
    report.push({ flag: "untracked", email: who, customer: s.customer, subscription: s.id, status: s.status, amount: s.amount, currency: s.currency });
  }

  // double: EUR plans per address (recorded plans + untracked subs of that address)
  const plansByEmail = new Map<string, LiveSub[]>();
  for (const s of liveSubs.values()) {
    const k = known.get(s.id);
    const email = k?.email || customers.get(s.customer) || "";
    if (!email) continue;
    const isPlanLike = k ? k.kind === "plan" : (s.currency ?? "").toLowerCase() === "eur" && !hosts.some((h) => h.customer_id === s.customer);
    if (!isPlanLike) continue;
    plansByEmail.set(email, [...(plansByEmail.get(email) ?? []), s]);
  }
  for (const [email, subs] of plansByEmail) {
    if (subs.length < 2) continue;
    flagged.push(`• double: second plan for the same email — ${email} has ${subs.length} live plans (${subs.map(fmt).join(" + ")}). Second practice or duplicate? Check before refunding.`);
    report.push({ flag: "double", kind: "plan", email, subscriptions: subs.map((s) => s.id) });
  }
  // double: hosting per address + site + tier class
  const hostingBySite = new Map<string, LiveSub[]>();
  for (const s of liveSubs.values()) {
    const k = known.get(s.id);
    if (!k || k.kind !== "hosting" || !k.site || k.site.startsWith("row:")) continue;
    const key = `${k.email}|${k.site}|${k.tier ? "tier" : k.label}`;
    hostingBySite.set(key, [...(hostingBySite.get(key) ?? []), s]);
  }
  for (const [key, subs] of hostingBySite) {
    if (subs.length < 2) continue;
    const [email, site] = key.split("|");
    flagged.push(`• double: ${email} is billed ${subs.length} times for hosting ${site} (${subs.map(fmt).join(" + ")})`);
    report.push({ flag: "double", kind: "hosting", email, site, subscriptions: subs.map((s) => s.id) });
  }

  // missing: a row we treat as paying, whose subscription Stripe does not bill
  for (const [subId, k] of known) {
    if (!k.rowLive || k.kind === "addon" || liveSubs.has(subId)) continue;
    const row = k.kind === "plan" ? clients.find((c) => c.id === k.rowId) : hosts.find((h) => h.id === k.rowId);
    const customer = row?.customer_id ?? null;
    if (customer && unreadable.has(customer)) continue; // not read today: no verdict
    let status = seenStatus.get(subId) ?? "not found under its customer";
    if (!customer || !customers.has(customer)) {
      try {
        status = (await stripe.subscriptions.retrieve(subId)).status;
        if (LIVE_SUB_STATUSES.has(status)) continue;
      } catch { status = "not found in Stripe"; }
    }
    flagged.push(`• missing: ${k.label} — recorded as paying, but subscription ${subId} is ${status}`);
    report.push({ flag: "missing", kind: k.kind, row: k.rowId, email: k.email, subscription: subId, stripeStatus: status });
  }

  const sends = new Sends();
  if (flagged.length || errors.length) {
    sends.alert(
      `Billing check: ${flagged.length} ${flagged.length === 1 ? "thing needs" : "things need"} a look${errors.length ? ` (${errors.length} customer${errors.length === 1 ? "" : "s"} unreadable)` : ""}\n` +
      [...flagged, ...errors.map((e) => `• unreadable: ${e}`)].slice(0, 40).join("\n") +
      `\nNothing was changed. Double plan: ask the client — a second practice is legitimate; only a real duplicate is cancelled and refunded. Double hosting (same site): cancel the extra one. Untracked: find whose it is and record it, or cancel it. Missing: check the row's status and Stripe.\n` +
      `https://dashboard.stripe.com/subscriptions`,
    );
  }
  await sends.settled();
  return NextResponse.json({ checked: { customers: customers.size, subscriptions: liveSubs.size, known: known.size }, flagged: flagged.length, report, errors });
}
