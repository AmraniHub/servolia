import { supabaseAdmin } from "@/lib/supabase";
import { loadProgressFacts, buildProgress, type BuildLike } from "@/lib/buildProgress";
import { localDateKey, toLocalDay, daysUntil, relativeDays, monthGrid, refundRiskEur } from "@/lib/dates";

// Re-exported so existing pages can keep importing them from here.
export { localDateKey, toLocalDay, daysUntil, relativeDays, monthGrid, refundRiskEur };

/**
 * DEADLINES — every dated commitment across the business on one calendar.
 *
 * Servolia's version of a deadline board has a twist a generic one doesn't:
 * the CGV promise a 10% refund per day of late delivery (capped at 50%), so a
 * slipping build has a EURO COST. This module computes that, which turns the
 * calendar from "things to remember" into "money at risk today".
 *
 * DATE-KEY RULE (learned the hard way): never build a day key with
 * `date.toISOString().slice(0,10)`. toISOString() converts to UTC, so a Date
 * at LOCAL midnight in any timezone east of UTC rolls back to the previous
 * day — every event then renders one cell early. In Paris (UTC+2) a deadline
 * of 6 Aug lands on the 5th. Always use localDateKey().
 */

export type DeadlineKind = "build" | "late" | "call" | "suspend" | "sla" | "scope";

export interface DeadlineEvent {
  /** Local YYYY-MM-DD — the calendar's grouping key. */
  date: string;
  kind: DeadlineKind;
  label: string;
  sub: string;
  href: string;
  /** Euros at risk if this is a late build (refund guarantee), else 0. */
  atRiskEur?: number;
}

interface BuildRow { id: string; business: string; plan_name: string | null; plan: string; deadline: string | null; status: string; total_price: number }
interface BookingRow { id: string; name: string; business: string | null; slot_start: string; status: string }
interface ClientRow { id: string; business: string; email: string | null; suspend_at: string | null; payment_status: string | null }
interface LeadRow { id: string; business: string | null; email: string | null; stage: string; last_contacted_at: string | null; created_at: string }
interface ScopeRow { id: string; business_name: string; created_at: string; accepted_at: string | null; token: string }

/** SLA: a lead with no contact for this many days is going cold. */
const LEAD_SLA_DAYS = 2;
/** A scope sent and unsigned after this many days needs a chase. */
const SCOPE_CHASE_DAYS = 3;

/** Everything dated, in one list. Server-only (uses the service-role client). */
export async function collectDeadlines(): Promise<DeadlineEvent[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const out: DeadlineEvent[] = [];

  const [builds, bookings, clients, leads, scopes] = await Promise.all([
    db.from("builds").select("id, business, plan_name, plan, deadline, status, total_price").not("deadline", "is", null),
    db.from("bookings").select("id, name, business, slot_start, status"),
    db.from("clients").select("id, business, email, suspend_at, payment_status"),
    db.from("leads").select("id, business, email, stage, last_contacted_at, created_at"),
    db.from("scope_acceptances").select("id, business_name, created_at, accepted_at, token"),
  ]);

  // 1. BUILD DELIVERY DEADLINES — the money-critical ones.
  // Reuses the same derivation as /admin/builds so the two pages can never
  // disagree about what's at risk (and so client-caused delay is excluded).
  const buildRows = (builds.data ?? []) as BuildRow[];
  const facts = await loadProgressFacts(buildRows as unknown as BuildLike[]);
  for (const b of buildRows) {
    if (!b.deadline || b.status === "delivered" || b.status === "live") continue;
    const p = buildProgress(b as unknown as BuildLike, facts);
    const late = daysUntil(b.deadline) < 0;
    const detail = p.waitingOnClient
      ? `waiting on client · ${p.current?.label.toLowerCase() ?? "them"}`
      : p.current?.label.toLowerCase() ?? b.status;
    out.push({
      date: localDateKey(toLocalDay(b.deadline)),
      kind: late ? "late" : "build",
      label: `${b.business} — delivery due`,
      sub: p.atRiskEur > 0
        ? `${b.plan_name ?? b.plan} · ${detail} · €${p.atRiskEur.toLocaleString()} refund risk`
        : `${b.plan_name ?? b.plan} · ${detail}`,
      href: `/admin/builds/${b.id}`,
      atRiskEur: p.atRiskEur,
    });
  }

  // 2. DISCOVERY CALLS — real appointments.
  for (const bk of ((bookings.data ?? []) as BookingRow[])) {
    if (bk.status === "cancelled" || bk.status === "completed") continue;
    const when = new Date(bk.slot_start);
    out.push({
      date: localDateKey(toLocalDay(bk.slot_start)),
      kind: "call",
      label: `Call — ${bk.name}`,
      sub: `${when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}${bk.business ? ` · ${bk.business}` : ""}`,
      href: "/admin/bookings",
    });
  }

  // 3. DUNNING SUSPENSIONS — the day a client's site goes dark.
  for (const c of ((clients.data ?? []) as ClientRow[])) {
    if (!c.suspend_at || c.payment_status === "ok" || !c.payment_status) continue;
    out.push({
      date: localDateKey(toLocalDay(c.suspend_at)),
      kind: "suspend",
      label: `${c.business} — site suspends`,
      sub: `Unpaid invoice · ${c.email ?? "no email"}`,
      href: "/admin/clients",
    });
  }

  // 4. LEAD SLA — a deal going cold has a due date: last contact + 2 days.
  for (const l of ((leads.data ?? []) as LeadRow[])) {
    if (["deposit_paid", "live", "lost"].includes(l.stage)) continue;
    const ref = l.last_contacted_at ?? l.created_at;
    const due = toLocalDay(ref);
    due.setDate(due.getDate() + LEAD_SLA_DAYS);
    out.push({
      date: localDateKey(due),
      kind: "sla",
      label: `Follow up ${l.business || l.email || "lead"}`,
      sub: `${l.stage.replace(/_/g, " ")} · ${l.last_contacted_at ? "last contacted" : "created"} ${relativeDays(ref)}`,
      href: `/admin/leads/${l.id}`,
    });
  }

  // 5. SCOPES SENT BUT UNSIGNED — deals stalling before the deposit.
  for (const s of ((scopes.data ?? []) as ScopeRow[])) {
    if (s.accepted_at) continue;
    const due = toLocalDay(s.created_at);
    due.setDate(due.getDate() + SCOPE_CHASE_DAYS);
    out.push({
      date: localDateKey(due),
      kind: "scope",
      label: `Chase scope — ${s.business_name}`,
      sub: `Sent ${relativeDays(s.created_at)}, still unsigned`,
      href: "/admin/pipeline",
    });
  }

  return out;
}

/**
 * Presentation for each kind — one place, so calendar and agenda always agree.
 * `chip` holds LITERAL Tailwind classes on purpose: they must appear verbatim
 * in source for Tailwind to generate them, and the admin dark theme overrides
 * these exact class names. Inline style objects would stay light in dark mode.
 */
export const KIND_META: Record<DeadlineKind, { label: string; icon: string; chip: string; dot: string }> = {
  late:    { label: "Overdue",        icon: "🔥", chip: "bg-[#FEE2E2] text-[#B91C1C]", dot: "bg-[#B91C1C]" },
  build:   { label: "Delivery due",   icon: "🏗️", chip: "bg-[#DBEAFE] text-[#1D4ED8]", dot: "bg-[#1D4ED8]" },
  call:    { label: "Discovery call", icon: "📞", chip: "bg-[#EDE9FE] text-[#5B21B6]", dot: "bg-[#5B21B6]" },
  suspend: { label: "Suspension",     icon: "⛔", chip: "bg-[#FEE2E2] text-[#B91C1C]", dot: "bg-[#B91C1C]" },
  sla:     { label: "Lead follow-up", icon: "📩", chip: "bg-[#FEF3C7] text-[#92400E]", dot: "bg-[#92400E]" },
  scope:   { label: "Scope to chase", icon: "📄", chip: "bg-[#DCFCE7] text-[#166534]", dot: "bg-[#166534]" },
};

