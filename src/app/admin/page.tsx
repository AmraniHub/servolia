import Link from "next/link";
import { supabaseAdmin, type Lead, type Build, type CrmKpis } from "@/lib/supabase";
import { ArrowRight, Users, Hammer, UserCircle, TrendingUp, Sparkles, Plus, CreditCard, MessageSquare, Clock, CheckCircle, Coins, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "new",          label: "New",          color: "#2563EB" },
  { key: "audit_sent",   label: "Audit sent",   color: "#D97706" },
  { key: "qualified",    label: "Qualified",    color: "#8B5CF6" },
  { key: "deposit_paid", label: "Deposit paid", color: "#36671E" },
  { key: "live",         label: "Live",         color: "#059669" },
] as const;

async function fetchKpis(): Promise<CrmKpis> {
  const db = supabaseAdmin();
  if (!db) return { leads_30d: 0, leads_7d: 0, awaiting_response: 0, qualified: 0, active_builds: 0, live_clients: 0, mrr: 0, deposits_30d: 0 };
  const { data } = await db.from("crm_kpis").select("*").single();
  return (data as CrmKpis) ?? { leads_30d: 0, leads_7d: 0, awaiting_response: 0, qualified: 0, active_builds: 0, live_clients: 0, mrr: 0, deposits_30d: 0 };
}

async function fetchRecentLeads(): Promise<Lead[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db.from("leads").select("*").order("created_at", { ascending: false }).limit(8);
  return (data as Lead[]) ?? [];
}

async function fetchRecentPayments(): Promise<Build[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db.from("builds").select("*")
    .gt("deposit_paid", 0).order("created_at", { ascending: false }).limit(6);
  return (data as Build[]) ?? [];
}

interface ChatSummary { id: string; updated_at: string; message_count: number; qualified: boolean; email_captured?: string | null; visitor_business?: string | null; }
async function fetchRecentChats(): Promise<ChatSummary[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db.from("chat_sessions")
    .select("id, updated_at, message_count, qualified, email_captured, visitor_business")
    .order("updated_at", { ascending: false }).limit(5);
  return (data as ChatSummary[]) ?? [];
}

async function fetchStageCounts(): Promise<Record<string, number>> {
  const db = supabaseAdmin();
  if (!db) return {};
  const counts: Record<string, number> = {};
  for (const s of STAGES) {
    const { count } = await db.from("leads").select("*", { count: "exact", head: true }).eq("stage", s.key);
    counts[s.key] = count ?? 0;
  }
  return counts;
}

export default async function AdminDashboard() {
  const [kpis, recent, stageCounts, payments, chats] = await Promise.all([
    fetchKpis(), fetchRecentLeads(), fetchStageCounts(), fetchRecentPayments(), fetchRecentChats(),
  ]);
  const supabaseConfigured = !!supabaseAdmin();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Dashboard</h1>
          <p className="text-sm text-[#71717A] mt-1">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · Last 30 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/leads/new"
            className="px-3 py-2.5 rounded-lg border border-[#E8E6E0] bg-white text-[#18181B] text-sm font-semibold hover:bg-[#F5F4EF] flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New lead
          </Link>
          <Link href="/admin/leads"
            className="px-4 py-2.5 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] transition-colors flex items-center gap-2">
            All leads <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {!supabaseConfigured && (
        <div className="mb-6 p-4 rounded-xl bg-[#FEF3C7] border border-[#D97706]/30 text-[#92400E] text-sm">
          <strong>Supabase not connected.</strong> Set <code className="px-1 rounded bg-[#FDE68A]">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="px-1 rounded bg-[#FDE68A]">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel env vars, then run <code className="px-1 rounded bg-[#FDE68A]">supabase/schema.sql</code> in your Supabase SQL editor.
        </div>
      )}

      {/* KPI ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="New leads (30d)" value={kpis.leads_30d} sub={`${kpis.leads_7d} in last 7 days`} icon={<Users className="w-4 h-4" />} />
        <KpiCard label="Active builds" value={kpis.active_builds} sub="In progress now" icon={<Hammer className="w-4 h-4" />} />
        <KpiCard label="Live clients" value={kpis.live_clients} sub="Active subscriptions" icon={<UserCircle className="w-4 h-4" />} />
        <KpiCard label="MRR" value={`€${Number(kpis.mrr).toLocaleString()}`} sub={`€${(Number(kpis.mrr) * 12).toLocaleString()} ARR`} icon={<TrendingUp className="w-4 h-4" />} accent />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <KpiCard label="Awaiting response" value={kpis.awaiting_response} sub="Audits sent, no reply yet" icon={<Clock className="w-4 h-4" />} />
        <KpiCard label="Qualified leads" value={kpis.qualified} sub="Ready to convert" icon={<CheckCircle className="w-4 h-4" />} />
        <KpiCard label="Deposits (30d)" value={`€${Number(kpis.deposits_30d).toLocaleString()}`} sub="Collected this month" icon={<Coins className="w-4 h-4" />} />
        <KpiCard label="Pipeline value" value={`€${recent.reduce((s, l) => s + Number(l.value_estimate ?? 0), 0).toLocaleString()}`} sub="From recent open leads" icon={<Layers className="w-4 h-4" />} />
      </div>

      {/* Pipeline columns + recent leads */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Pipeline */}
        <div className="lg:col-span-2">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-base font-black text-[#18181B]">Pipeline</h2>
            <Link href="/admin/pipeline" className="text-xs text-[#36671E] hover:underline">Open board →</Link>
          </div>

          {/* Funnel distribution bar */}
          <FunnelBar stages={STAGES} counts={stageCounts} />

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            {STAGES.map((s) => (
              <Link key={s.key} href={`/admin/leads?stage=${s.key}`}
                className="p-4 rounded-xl bg-white border border-[#E8E6E0] hover:border-[#36671E]/40 hover:shadow-card transition-all duration-200 block">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs font-semibold text-[#71717A]">{s.label}</span>
                </div>
                <p className="text-2xl font-black text-[#18181B] tabular-nums">{stageCounts[s.key] ?? 0}</p>
              </Link>
            ))}
          </div>

          {/* Recent payments */}
          <div className="mt-6">
            <div className="flex items-end justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#36671E]" />
                <h2 className="text-base font-black text-[#18181B]">Recent payments</h2>
              </div>
              <Link href="/admin/builds" className="text-xs text-[#36671E] hover:underline">All builds →</Link>
            </div>
            <div className="bg-white border border-[#E8E6E0] rounded-xl overflow-hidden">
              {payments.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#A1A1AA]">
                  No payments yet. When a client pays a deposit via Stripe, it appears here automatically.
                </div>
              ) : (
                payments.map(p => (
                  <Link key={p.id} href={`/admin/builds/${p.id}`}
                    className="flex items-center justify-between gap-3 p-4 border-b border-[#E8E6E0] last:border-0 hover:bg-[#F5F4EF] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#18181B] truncate">{p.business}</p>
                      <p className="text-xs text-[#71717A] truncate">{p.plan_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-black text-[#36671E] whitespace-nowrap">
                      €{Number(p.deposit_paid).toLocaleString()}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* AI insight */}
          <div className="mt-6 p-5 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#36671E]" />
              <p className="text-xs font-black text-[#36671E] uppercase tracking-widest">Insight</p>
            </div>
            <p className="text-sm text-[#18181B] leading-relaxed">
              {kpis.awaiting_response > 5
                ? `You have ${kpis.awaiting_response} leads awaiting response. Sending follow-ups today could recover 20–30% of them.`
                : kpis.leads_7d === 0
                ? "No new leads this week. Time to send cold emails or run a small ad test."
                : kpis.live_clients > 0
                ? `${kpis.live_clients} clients live. Average MRR per client: €${kpis.live_clients > 0 ? Math.round(kpis.mrr / kpis.live_clients) : 0}.`
                : "Pipeline is calm. Use this time to publish a case study or send 10 cold emails."}
            </p>
          </div>
        </div>

        {/* Recent leads + chat */}
        <div className="space-y-6">
          {/* Recent chats */}
          {chats.length > 0 && (
            <div>
              <div className="flex items-end justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#36671E]" />
                  <h2 className="text-base font-black text-[#18181B]">Recent chats</h2>
                </div>
                <Link href="/admin/chat" className="text-xs text-[#36671E] hover:underline">All →</Link>
              </div>
              <div className="bg-white border border-[#E8E6E0] rounded-xl overflow-hidden">
                {chats.map(c => (
                  <Link key={c.id} href={`/admin/chat/${c.id}`}
                    className="block p-3 border-b border-[#E8E6E0] last:border-0 hover:bg-[#F5F4EF] transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#18181B] truncate flex-1">
                        {c.visitor_business || c.email_captured || "Anonymous"}
                      </p>
                      {c.qualified && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#EEF5EA] text-[#36671E]">QUALIFIED</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#71717A] mt-0.5">{c.message_count} msgs · {new Date(c.updated_at).toLocaleString()}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

        <div>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-base font-black text-[#18181B]">Recent leads</h2>
            <Link href="/admin/leads" className="text-xs text-[#36671E] hover:underline">All →</Link>
          </div>
          <div className="bg-white border border-[#E8E6E0] rounded-xl overflow-hidden">
            {recent.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-[#A1A1AA] mb-3">No leads yet</p>
                <Link href="/admin/leads/new" className="text-xs text-[#36671E] font-semibold hover:underline">+ Add one manually</Link>
              </div>
            ) : (
              recent.map((l) => (
                <Link key={l.id} href={`/admin/leads/${l.id}`}
                  className="block p-3.5 border-b border-[#E8E6E0] last:border-0 hover:bg-[#F5F4EF] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#18181B] truncate">{l.business || l.name || l.email || "Unnamed"}</p>
                      <p className="text-xs text-[#71717A] truncate">{l.niche ?? "—"} · {l.country ?? "?"}</p>
                    </div>
                    <StageChip stage={l.stage} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string; icon?: React.ReactNode; accent?: boolean;
}) {
  if (accent) {
    return (
      <div className="relative p-5 rounded-2xl bg-[#091C20] overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#36671E] opacity-60 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#ABDF90]">{label}</p>
            {icon && (
              <span className="w-8 h-8 rounded-lg bg-[#0CA6E9]/20 text-[#ABDF90] flex items-center justify-center">{icon}</span>
            )}
          </div>
          <p className="text-3xl font-black text-[#FAFAF7] tabular-nums">{value}</p>
          {sub && <p className="text-xs mt-1.5 text-[#ABDF90]/70">{sub}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="group p-5 rounded-2xl border border-[#E8E6E0] bg-white hover:border-[#36671E]/30 hover:shadow-card transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#71717A]">{label}</p>
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-[#F0EFEA] text-[#36671E] flex items-center justify-center group-hover:bg-[#EEF5EA] transition-colors">{icon}</span>
        )}
      </div>
      <p className="text-3xl font-black text-[#18181B] tabular-nums">{value}</p>
      {sub && <p className="text-xs mt-1.5 text-[#A1A1AA]">{sub}</p>}
    </div>
  );
}

function FunnelBar({ stages, counts }: {
  stages: readonly { key: string; label: string; color: string }[];
  counts: Record<string, number>;
}) {
  const total = stages.reduce((s, st) => s + (counts[st.key] ?? 0), 0);
  if (total === 0) {
    return (
      <div className="h-3 rounded-full bg-[#F0EFEA] overflow-hidden" aria-hidden />
    );
  }
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-[#F0EFEA]">
        {stages.map((s) => {
          const pct = ((counts[s.key] ?? 0) / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${counts[s.key]} (${pct.toFixed(0)}%)`}
              style={{ width: `${pct}%`, background: s.color }}
              className="h-full transition-all"
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] text-[#A1A1AA]">{total} leads in pipeline</p>
        <p className="text-[11px] text-[#A1A1AA]">
          {counts["live"] ?? 0} won · {total > 0 ? Math.round(((counts["live"] ?? 0) / total) * 100) : 0}% conversion
        </p>
      </div>
    </div>
  );
}

function StageChip({ stage }: { stage: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    new:          { bg: "#DBEAFE", fg: "#1D4ED8", label: "NEW" },
    audit_sent:   { bg: "#FEF3C7", fg: "#92400E", label: "AUDIT" },
    qualified:    { bg: "#EDE9FE", fg: "#5B21B6", label: "QUALIFIED" },
    deposit_paid: { bg: "#EEF5EA", fg: "#36671E", label: "PAID" },
    live:         { bg: "#D1FAE5", fg: "#065F46", label: "LIVE" },
    lost:         { bg: "#FEE2E2", fg: "#991B1B", label: "LOST" },
  };
  const s = map[stage] ?? map.new;
  return (
    <span className="text-[9px] font-black px-2 py-1 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}
