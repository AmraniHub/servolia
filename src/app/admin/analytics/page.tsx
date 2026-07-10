import { supabaseAdmin } from "@/lib/supabase";
import { BarChart3, TrendingUp, Globe, Bot, Target, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

interface Lead {
  id: string; created_at: string; source: string; stage: string; niche: string | null;
  country: string | null; value_estimate: number; last_contacted_at: string | null;
}
interface ChatSession {
  id: string; created_at: string; qualified: boolean; message_count: number; lead_id: string | null;
}

const STAGES = ["new","audit_sent","qualified","deposit_paid","live","lost"] as const;
const STAGE_LABELS: Record<string,string> = {
  new: "New", audit_sent: "Audit sent", qualified: "Qualified",
  deposit_paid: "Paid", live: "Live", lost: "Lost",
};

export default async function AnalyticsPage() {
  const db = supabaseAdmin();
  const [leadsRes, chatRes] = await Promise.all([
    db ? db.from("leads").select("*").gte("created_at", new Date(Date.now() - 1000*60*60*24*90).toISOString()) : { data: [] },
    db ? db.from("chat_sessions").select("id, created_at, qualified, message_count, lead_id") : { data: [] },
  ]);
  const leads = (leadsRes.data ?? []) as Lead[];
  const sessions = (chatRes.data ?? []) as ChatSession[];

  // ── Source breakdown ───────────────────────────────────────────────
  const sourceCounts: Record<string, number> = {};
  leads.forEach(l => { sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1; });
  const sources = Object.entries(sourceCounts).sort((a,b) => b[1]-a[1]);
  const maxSource = Math.max(...sources.map(s => s[1]), 1);

  // ── Niche breakdown ────────────────────────────────────────────────
  const nicheCounts: Record<string, number> = {};
  leads.forEach(l => { const n = l.niche ?? "unknown"; nicheCounts[n] = (nicheCounts[n] ?? 0) + 1; });
  const niches = Object.entries(nicheCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const maxNiche = Math.max(...niches.map(n => n[1]), 1);

  // ── Country breakdown ──────────────────────────────────────────────
  const countryCounts: Record<string, number> = {};
  leads.forEach(l => { const c = l.country ?? "unknown"; countryCounts[c] = (countryCounts[c] ?? 0) + 1; });
  const countries = Object.entries(countryCounts).sort((a,b) => b[1]-a[1]).slice(0, 6);

  // ── Conversion funnel ──────────────────────────────────────────────
  const funnel = STAGES.map(s => ({ stage: s, count: leads.filter(l => l.stage === s).length }));
  const totalFunnel = leads.length;

  // ── Leads over time (last 12 weeks) ────────────────────────────────
  const weeks: { label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(Date.now() - (i+1)*7*86400000);
    const end = new Date(Date.now() - i*7*86400000);
    const count = leads.filter(l => {
      const t = new Date(l.created_at);
      return t >= start && t < end;
    }).length;
    weeks.push({ label: i === 0 ? "now" : `${i}w`, count });
  }
  const maxWeek = Math.max(...weeks.map(w => w.count), 1);

  // ── Chatbot performance ────────────────────────────────────────────
  const totalChats = sessions.length;
  const qualifiedChats = sessions.filter(s => s.qualified).length;
  const chatConvRate = totalChats > 0 ? Math.round((qualifiedChats / totalChats) * 100) : 0;
  const avgMessages = totalChats > 0 ? Math.round(sessions.reduce((s,c) => s + c.message_count, 0) / totalChats) : 0;

  // ── Response time SLA ──────────────────────────────────────────────
  const contacted = leads.filter(l => l.last_contacted_at);
  const avgResponseHours = contacted.length > 0
    ? contacted.reduce((s, l) => s + (new Date(l.last_contacted_at!).getTime() - new Date(l.created_at).getTime()) / 3600000, 0) / contacted.length
    : 0;

  // ── Pipeline value ─────────────────────────────────────────────────
  const openLeads = leads.filter(l => !["live","lost","deposit_paid"].includes(l.stage));
  const pipelineValue = openLeads.reduce((s,l) => s + Number(l.value_estimate ?? 0), 0);
  const wonValue = leads.filter(l => l.stage === "deposit_paid" || l.stage === "live")
    .reduce((s,l) => s + Number(l.value_estimate ?? 0), 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Analytics</h1>
      <p className="text-sm text-[#71717A] mb-6">Last 90 days · {leads.length} leads · {totalChats} chat sessions</p>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Pipeline value" value={`€${pipelineValue.toLocaleString()}`} sub={`${openLeads.length} open leads`} accent />
        <Kpi label="Won value" value={`€${wonValue.toLocaleString()}`} sub="Deposit paid + live" />
        <Kpi label="Avg response" value={avgResponseHours > 0 ? `${avgResponseHours.toFixed(1)}h` : "—"} sub="Lead → first contact" />
        <Kpi label="Chat → lead rate" value={`${chatConvRate}%`} sub={`${qualifiedChats} of ${totalChats}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">

        {/* Leads over time */}
        <Panel icon={<TrendingUp className="w-4 h-4" />} title="Leads per week" subtitle="Last 12 weeks">
          <div className="flex items-end justify-between gap-1 h-32 mt-2">
            {weeks.map((w, i) => {
              const h = (w.count / maxWeek) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[10px] font-bold text-[#36671E] opacity-0 group-hover:opacity-100 transition-opacity">{w.count}</span>
                  <div className="w-full rounded-t-md bg-gradient-to-t from-[#36671E] to-[#BEF264] transition-all min-h-[2px]"
                    style={{ height: `${Math.max(h, 2)}%` }} />
                  <span className="text-[9px] text-[#A1A1AA]">{w.label}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Conversion funnel */}
        <Panel icon={<Target className="w-4 h-4" />} title="Conversion funnel" subtitle={`${totalFunnel} leads total`}>
          <div className="space-y-2 mt-3">
            {funnel.map((f) => {
              const pct = totalFunnel > 0 ? Math.round((f.count / totalFunnel) * 100) : 0;
              return (
                <div key={f.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[#18181B]">{STAGE_LABELS[f.stage]}</span>
                    <span className="text-[#71717A]">{f.count} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F5F4EF] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#36671E] to-[#BEF264]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">

        {/* Lead sources */}
        <Panel icon={<BarChart3 className="w-4 h-4" />} title="Lead sources" subtitle="What's driving pipeline">
          {sources.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] py-6 text-center">No data yet.</p>
          ) : (
            <div className="space-y-2.5 mt-3">
              {sources.map(([src, count]) => (
                <div key={src}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[#18181B] capitalize">{src.replace(/-/g, " ")}</span>
                    <span className="text-[#71717A]">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F5F4EF]">
                    <div className="h-full rounded-full bg-[#36671E]" style={{ width: `${(count/maxSource)*100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Niches */}
        <Panel icon={<Zap className="w-4 h-4" />} title="Top niches" subtitle="Where demand is coming from">
          {niches.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] py-6 text-center">No data yet.</p>
          ) : (
            <div className="space-y-2.5 mt-3">
              {niches.map(([n, count]) => (
                <div key={n}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[#18181B] capitalize">{n.replace(/-/g, " ")}</span>
                    <span className="text-[#71717A]">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F5F4EF]">
                    <div className="h-full rounded-full bg-[#BEF264]" style={{ width: `${(count/maxNiche)*100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Geo */}
        <Panel icon={<Globe className="w-4 h-4" />} title="Top countries">
          {countries.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] py-6 text-center">No data yet.</p>
          ) : (
            <ul className="divide-y divide-[#F5F4EF] mt-2">
              {countries.map(([c, n]) => (
                <li key={c} className="py-2 flex items-center justify-between text-sm">
                  <span className="capitalize text-[#18181B] font-medium">{c}</span>
                  <span className="text-[#71717A] text-xs">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Chatbot stats */}
        <Panel icon={<Bot className="w-4 h-4" />} title="Chatbot health">
          <dl className="space-y-3 mt-2 text-sm">
            <Row label="Total sessions" value={totalChats} />
            <Row label="Qualified leads" value={qualifiedChats} accent />
            <Row label="Conversion rate" value={`${chatConvRate}%`} />
            <Row label="Avg messages" value={avgMessages} />
          </dl>
        </Panel>

        {/* Hot insights */}
        <Panel icon={<TrendingUp className="w-4 h-4" />} title="Insights">
          <div className="space-y-3 mt-2">
            {insights({ leads, sessions, sources, niches, avgResponseHours }).map((tip, i) => (
              <div key={i} className="p-3 rounded-lg bg-[#EEF5EA] border border-[#36671E]/15 text-xs text-[#18181B] leading-relaxed">
                {tip}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${accent ? "bg-[#EEF5EA] border-[#36671E]/30" : "bg-white border-[#E8E6E0]"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${accent ? "text-[#36671E]" : "text-[#71717A]"}`}>{label}</p>
      <p className={`text-xl font-black mt-1 ${accent ? "text-[#36671E]" : "text-[#18181B]"}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 ${accent ? "text-[#36671E]/70" : "text-[#A1A1AA]"}`}>{sub}</p>}
    </div>
  );
}

function Panel({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#36671E]">{icon}</span>
        <h2 className="text-sm font-black text-[#18181B]">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-[#A1A1AA] mb-2">{subtitle}</p>}
      {children}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-[#71717A]">{label}</dt>
      <dd className={`font-black ${accent ? "text-[#36671E]" : "text-[#18181B]"}`}>{value}</dd>
    </div>
  );
}

function insights(d: {
  leads: Lead[]; sessions: ChatSession[]; sources: [string,number][]; niches: [string,number][]; avgResponseHours: number;
}): string[] {
  const tips: string[] = [];
  if (d.leads.length === 0) {
    tips.push("No leads yet. Send 20 cold emails this week or run a small €50 Meta test.");
    return tips;
  }
  if (d.sources[0]) {
    tips.push(`Your top source is "${d.sources[0][0]}" (${d.sources[0][1]} leads). Double down here this week.`);
  }
  if (d.niches[0] && d.niches[0][1] >= 3) {
    tips.push(`"${d.niches[0][0]}" is your strongest niche. Build a dedicated landing page for it.`);
  }
  if (d.avgResponseHours > 24) {
    tips.push(`Avg response time is ${d.avgResponseHours.toFixed(1)}h. Leads contacted within 1h convert 7× better.`);
  } else if (d.avgResponseHours > 0 && d.avgResponseHours < 4) {
    tips.push(`Response time ${d.avgResponseHours.toFixed(1)}h is excellent — keep it under 4h.`);
  }
  if (d.sessions.length > 10 && d.sessions.filter(s => s.qualified).length / d.sessions.length < 0.1) {
    tips.push("Chatbot conversion is low. Consider tweaking the system prompt or asking for email earlier.");
  }
  if (tips.length === 0) tips.push("System is healthy. Focus on acquisition this week.");
  return tips;
}
