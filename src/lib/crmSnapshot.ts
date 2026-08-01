import { supabaseAdmin } from "@/lib/supabase";
import { loadEconomics, offerChecks } from "@/lib/economics";
import { getCapacity } from "@/lib/capacity";
import { scanAllSites, monthKey } from "@/lib/zeroMiss";
import { ROADMAP } from "@/lib/roadmap";

/**
 * Compact, live snapshot of the whole business for the admin copilot.
 *
 * Linda can only reason about what is in here, so this block is the real
 * boundary on how useful she is. It carries four things beyond the CRM
 * numbers, because those are what turn "here are your stats" into advice:
 *
 *   UNIT ECONOMICS — the 30-day payback ceiling and margin, so she can answer
 *     "can I afford to spend on this?" with a number instead of an opinion.
 *   DELIVERY CAPACITY — how many builds she may commit you to this week.
 *   GUARANTEE STATE — any Zero-Miss breach is money owed, so it outranks
 *     everything else she might raise.
 *   THE OPEN BOARD — the priority-1 roadmap items, so her "what next" matches
 *     the founder's actual blockers rather than inventing new work.
 *
 * Everything is read-only and every figure carries its confidence, so she can
 * say "not measurable yet" instead of treating a zero as a finding.
 */
export async function buildCrmSnapshot(): Promise<string> {
  const db = supabaseAdmin();
  if (!db) return "The database is not connected, so live business data is unavailable.";

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 864e5));

  const [
    kpis, leadsRecent, pipeline, bookingsUpcoming, unreadMsgs, prospects, activeClients, liveSites,
  ] = await Promise.all([
    db.from("crm_kpis").select("*").maybeSingle(),
    db.from("leads").select("business, niche, stage, source, created_at").order("created_at", { ascending: false }).limit(8),
    db.from("leads").select("stage").gte("created_at", daysAgo(90)),
    db.from("bookings").select("name, business, slot_start").eq("status", "confirmed").gte("slot_start", iso(now)).order("slot_start").limit(6),
    db.from("client_messages").select("email").eq("sender", "client").eq("read_by_admin", false),
    db.from("prospects").select("status"),
    db.from("clients").select("business, plan, monthly_amount, status").eq("status", "active"),
    db.from("client_sites").select("slug").eq("status", "published"),
  ]);

  const k = (kpis.data ?? {}) as Record<string, number>;
  const count = <T extends { [key: string]: unknown }>(rows: T[] | null, key: keyof T) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) { const v = String(r[key] ?? "unknown"); m[v] = (m[v] ?? 0) + 1; }
    return m;
  };

  const pipelineCounts = count(pipeline.data as { stage: string }[] | null, "stage");
  const prospectCounts = count(prospects.data as { status: string }[] | null, "status");

  const fmtMap = (m: Record<string, number>) => Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(", ") || "none";

  const recentLeads = (leadsRecent.data ?? []).map((l: { business: string; niche: string; stage: string; created_at: string }) =>
    `- ${l.business ?? "?"} (${l.niche ?? "?"}) · ${l.stage} · ${new Date(l.created_at).toLocaleDateString("en-GB")}`).join("\n") || "none yet";

  const upcoming = (bookingsUpcoming.data ?? []).map((b: { name: string; business: string; slot_start: string }) =>
    `- ${b.name}${b.business ? ` (${b.business})` : ""} · ${new Date(b.slot_start).toLocaleString("en-GB", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} Paris`).join("\n") || "none scheduled";

  // The four things that turn stats into advice. All independently failsafe:
  // each returns a defined shape rather than throwing, so a snapshot never
  // breaks because one source is unavailable.
  const [econ, capacity, guarantee] = await Promise.all([
    loadEconomics(),
    getCapacity(),
    scanAllSites(monthKey(now)),
  ]);
  const breached = guarantee.filter((g) => g.misses.length > 0);
  const failingChecks = offerChecks(econ).filter((c) => c.pass === false);
  const openP1 = ROADMAP
    .filter((r) => r.priority === 1 && r.status !== "done")
    .map((r) => `- [${r.status}] ${r.title}${r.needs ? ` — needs: ${r.needs}` : ""}`)
    .join("\n") || "none";

  const fig = (label: string, mtr: { value: number | null; confidence: string }, unit = "EUR") =>
    `- ${label}: ${mtr.value == null ? "not measurable yet" : unit === "EUR" ? `EUR ${mtr.value.toLocaleString()}` : `${mtr.value}${unit}`} (${mtr.confidence})`;

  const clients = (activeClients.data ?? []) as { business: string; plan: string; monthly_amount: number }[];
  const clientList = clients.map((c) => `- ${c.business} · ${c.plan} · €${Number(c.monthly_amount)}/mo`).join("\n") || "none yet";
  const unreadCount = (unreadMsgs.data ?? []).length;

  return `LIVE BUSINESS SNAPSHOT (generated ${now.toLocaleString("en-GB", { timeZone: "Europe/Paris" })} Paris)

KPIs:
- Leads last 30 days: ${k.leads_30d ?? 0} (last 7 days: ${k.leads_7d ?? 0})
- Awaiting response (audit sent): ${k.awaiting_response ?? 0}
- Qualified leads: ${k.qualified ?? 0}
- Active builds (building/review): ${k.active_builds ?? 0}
- Live paying clients: ${k.live_clients ?? 0}
- MRR: €${Number(k.mrr ?? 0).toLocaleString()}
- Deposits collected last 30 days: €${Number(k.deposits_30d ?? 0).toLocaleString()}
- Published client sites: ${(liveSites.data ?? []).length}
- Unread client messages: ${unreadCount}

Lead pipeline (last 90 days) by stage: ${fmtMap(pipelineCounts)}
Prospect pipeline by stage: ${fmtMap(prospectCounts)}

Most recent leads:
${recentLeads}

Upcoming discovery calls:
${upcoming}

Active subscriptions:
${clientList}

UNIT ECONOMICS (every figure tagged measured/assumed — never treat "assumed" as fact):
${fig("MRR", econ.mrr)}
${fig("ARPU", econ.arpu)}
${fig("Fixed monthly costs", econ.fixedCosts)}
${fig("Gross margin", econ.grossMarginPct, "%")}
${fig("Clients to break even", econ.breakEvenClients, "")}
${fig("LTV per client", econ.ltv)}
- MAX SPEND TO ACQUIRE ONE CLIENT (30-day payback ceiling): EUR ${econ.maxCacFor30DayPayback.value?.toLocaleString() ?? "?"} — EUR ${econ.day0Cash} of it is collected on day 0 as the installation. Advise spending BELOW this; above it, each new client worsens cash.
- Offer weak levers: ${failingChecks.length ? failingChecks.map((c) => c.name).join(", ") : "none"}

DELIVERY CAPACITY THIS WEEK:
- ${capacity.capacity} installations/week is the honest ceiling (one person, written 7-day deadline).${capacity.inFlight != null ? ` ${capacity.inFlight} in flight, ${capacity.slotsLeft} slot(s) left.` : " Live count unavailable."}${capacity.full ? " THE WEEK IS FULL — do not promise a start before next week." : ""}

ZERO-MISS GUARANTEE (${monthKey(now)}):
${breached.length
  ? `BREACHED for ${breached.length} site(s): ${breached.map((g) => `${g.siteSlug} (${g.misses.length} miss)`).join(", ")}. Per CGV 4 bis each is owed this month's plan fee. This outranks everything else.`
  : "No breach detected this month."}

OPEN PRIORITY-1 BOARD (from roadmap.ts — the founder's real blockers):
${openP1}`;
}
