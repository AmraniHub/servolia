import { supabaseAdmin } from "@/lib/supabase";

/**
 * Compact, live snapshot of the whole business for the admin copilot.
 * Everything the founder might ask about — KPIs, pipeline, bookings, unread
 * messages, prospects — condensed into a small text block the model reasons over.
 * Read-only.
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
${clientList}`;
}
