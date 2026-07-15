import { supabaseAdmin } from "@/lib/supabase";
import { TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

interface Build {
  id: string;
  business: string;
  plan_name: string;
  deposit_paid: number;
  balance_due: number;
  created_at: string;
}

interface Client {
  id: string;
  business: string;
  monthly_amount: number;
  status: string;
  started_at: string;
  churned_at: string | null;
}

export default async function RevenuePage() {
  const db = supabaseAdmin();
  const [clients, builds] = await Promise.all([
    db ? db.from("clients").select("*") : Promise.resolve({ data: [] }),
    db ? db.from("builds").select("*").gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString()) : Promise.resolve({ data: [] }),
  ]);

  const allClients = (clients.data ?? []) as Client[];
  const activeClients = allClients.filter(c => c.status === "active");
  const allBuilds = (builds.data ?? []) as Build[];

  const mrr = activeClients.reduce((s, c) => s + Number(c.monthly_amount), 0);
  const arr = mrr * 12;
  const depositsTotal = allBuilds.reduce((s, b) => s + Number(b.deposit_paid ?? 0), 0);
  const balancesTotal = allBuilds.reduce((s, b) => s + Number(b.balance_due ?? 0), 0);

  // Build monthly buckets for the last 6 months
  const monthsBack = 6;
  const now = new Date();
  const buckets: { label: string; deposits: number; mrr: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = d.toLocaleString("en", { month: "short" });

    const monthDeposits = allBuilds
      .filter(b => {
        const t = new Date(b.created_at);
        return t >= d && t < next;
      })
      .reduce((s, b) => s + Number(b.deposit_paid ?? 0), 0);

    const monthClients = activeClients.filter(c => new Date(c.started_at) <= next);
    const monthMrr = monthClients.reduce((s, c) => s + Number(c.monthly_amount), 0);

    buckets.push({ label, deposits: monthDeposits, mrr: monthMrr });
  }

  const maxBar = Math.max(...buckets.map(b => Math.max(b.deposits, b.mrr)), 100);

  // ── Churn (logo + MRR), trailing 6 months ──────────────────────────────
  const churnMonths: { label: string; logoChurnPct: number; mrrChurnPct: number; churnedCount: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = monthStart.toLocaleString("en", { month: "short" });

    const activeAtStart = allClients.filter(c => {
      const started = new Date(c.started_at);
      const churned = c.churned_at ? new Date(c.churned_at) : null;
      return started < monthStart && (!churned || churned >= monthStart);
    });
    const churnedThisMonth = allClients.filter(c => {
      if (!c.churned_at) return false;
      const churned = new Date(c.churned_at);
      return churned >= monthStart && churned < monthEnd;
    });

    const startMrr = activeAtStart.reduce((s, c) => s + Number(c.monthly_amount), 0);
    const churnedMrr = churnedThisMonth.reduce((s, c) => s + Number(c.monthly_amount), 0);

    churnMonths.push({
      label,
      logoChurnPct: activeAtStart.length > 0 ? (churnedThisMonth.length / activeAtStart.length) * 100 : 0,
      mrrChurnPct: startMrr > 0 ? (churnedMrr / startMrr) * 100 : 0,
      churnedCount: churnedThisMonth.length,
    });
  }
  const avgLogoChurn = churnMonths.reduce((s, m) => s + m.logoChurnPct, 0) / (churnMonths.length || 1);
  const avgMrrChurn = churnMonths.reduce((s, m) => s + m.mrrChurnPct, 0) / (churnMonths.length || 1);
  const currentMonthChurn = churnMonths[churnMonths.length - 1];

  // ── Cohort retention: group by start month, % still active today ──────
  const cohortMap = new Map<string, { label: string; total: number; stillActive: number }>();
  for (const c of allClients) {
    const d = new Date(c.started_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en", { month: "short", year: "2-digit" });
    const entry = cohortMap.get(key) ?? { label, total: 0, stillActive: 0 };
    entry.total += 1;
    if (c.status === "active") entry.stillActive += 1;
    cohortMap.set(key, entry);
  }
  const cohorts = Array.from(cohortMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, retentionPct: v.total > 0 ? (v.stillActive / v.total) * 100 : 0 }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Revenue</h1>
      <p className="text-sm text-[#71717A] mb-6">EUR · {allClients.length} total clients · {activeClients.length} active</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card label="MRR" value={`€${mrr.toLocaleString()}`} accent />
        <Card label="ARR (projected)" value={`€${arr.toLocaleString()}`} />
        <Card label="Deposits collected (180d)" value={`€${depositsTotal.toLocaleString()}`} />
        <Card label="Balance due (180d)" value={`€${balancesTotal.toLocaleString()}`} />
      </div>

      {/* Chart */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-black text-[#18181B]">Monthly trend</h2>
            <p className="text-xs text-[#71717A]">Last 6 months</p>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#36671E]" /> Deposits</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#BEF264]" /> MRR</span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 h-44">
          {buckets.map((b, i) => {
            const depH = (b.deposits / maxBar) * 100;
            const mrrH = (b.mrr / maxBar) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full">
                <div className="w-full flex-1 flex items-end gap-1">
                  <div className="flex-1 rounded-t-md bg-[#36671E] transition-all relative group min-h-[2px]" style={{ height: `${Math.max(depH, 2)}%` }}>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#36671E] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">€{b.deposits.toLocaleString()}</span>
                  </div>
                  <div className="flex-1 rounded-t-md bg-[#BEF264] transition-all relative group min-h-[2px]" style={{ height: `${Math.max(mrrH, 2)}%` }}>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#6B8439] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">€{b.mrr.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#71717A]">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Churn — the number that actually sets a valuation multiple */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card label="Logo churn (this month)" value={`${currentMonthChurn.logoChurnPct.toFixed(1)}%`} sub={`${currentMonthChurn.churnedCount} client${currentMonthChurn.churnedCount === 1 ? "" : "s"} lost`} />
        <Card label="MRR churn (this month)" value={`${currentMonthChurn.mrrChurnPct.toFixed(1)}%`} />
        <Card label="Avg logo churn (6mo)" value={`${avgLogoChurn.toFixed(1)}%`} />
        <Card label="Avg MRR churn (6mo)" value={`${avgMrrChurn.toFixed(1)}%`} />
      </div>

      {/* Cohort retention */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-base font-black text-[#18181B]">Cohort retention</h2>
          <p className="text-xs text-[#71717A]">Clients grouped by the month they started — how many are still active today. This is the retention story a buyer looks for.</p>
        </div>
        {cohorts.length === 0 ? (
          <p className="text-sm text-[#A1A1AA] py-6 text-center">No clients yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black text-[#71717A] uppercase tracking-widest border-b border-[#F5F4EF]">
                  <th className="pb-2 pr-4">Cohort</th>
                  <th className="pb-2 pr-4">Started</th>
                  <th className="pb-2 pr-4">Still active</th>
                  <th className="pb-2">Retention</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((co) => (
                  <tr key={co.label} className="border-b border-[#F5F4EF] last:border-0">
                    <td className="py-2.5 pr-4 font-semibold text-[#18181B]">{co.label}</td>
                    <td className="py-2.5 pr-4 text-[#71717A]">{co.total}</td>
                    <td className="py-2.5 pr-4 text-[#71717A]">{co.stillActive}</td>
                    <td className="py-2.5">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${co.retentionPct >= 80 ? "bg-[#DCFCE7] text-[#166534]" : co.retentionPct >= 50 ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>
                        {co.retentionPct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest">Active subscriptions</h2>
            <span className="text-xs text-[#71717A]">€{mrr.toLocaleString()}/mo</span>
          </div>
          {activeClients.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] py-6 text-center">No active subscriptions yet.</p>
          ) : (
            <ul className="divide-y divide-[#F5F4EF]">
              {activeClients.map(c => (
                <li key={c.id} className="py-3 flex justify-between items-center">
                  <span className="text-sm text-[#18181B] font-semibold truncate flex-1">{c.business}</span>
                  <span className="text-sm text-[#36671E] font-bold whitespace-nowrap">€{Number(c.monthly_amount).toLocaleString()}/mo</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest">Recent deposits</h2>
            <TrendingUp className="w-4 h-4 text-[#36671E]" />
          </div>
          {allBuilds.filter(b => b.deposit_paid > 0).length === 0 ? (
            <p className="text-sm text-[#A1A1AA] py-6 text-center">No deposits yet.</p>
          ) : (
            <ul className="divide-y divide-[#F5F4EF]">
              {allBuilds.filter(b => b.deposit_paid > 0).slice(0, 8).map(b => (
                <li key={b.id} className="py-3 flex justify-between items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#18181B] font-semibold truncate">{b.business}</p>
                    <p className="text-xs text-[#71717A]">{b.plan_name} · {new Date(b.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm text-[#36671E] font-bold whitespace-nowrap">€{Number(b.deposit_paid).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`p-5 rounded-xl border ${accent ? "bg-[#EEF5EA] border-[#36671E]/30" : "bg-white border-[#E8E6E0]"}`}>
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${accent ? "text-[#36671E]/70" : "text-[#71717A]"}`}>{label}</p>
      <p className={`text-2xl font-black ${accent ? "text-[#36671E]" : "text-[#18181B]"}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#A1A1AA] mt-1">{sub}</p>}
    </div>
  );
}
