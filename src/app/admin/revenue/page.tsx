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
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#0CA6E9]" /> MRR</span>
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
                  <div className="flex-1 rounded-t-md bg-[#0CA6E9] transition-all relative group min-h-[2px]" style={{ height: `${Math.max(mrrH, 2)}%` }}>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#6B8439] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">€{b.mrr.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#71717A]">{b.label}</span>
              </div>
            );
          })}
        </div>
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

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-5 rounded-xl border ${accent ? "bg-[#EEF5EA] text-[#36671E] border-[#36671E]/30" : "bg-white border-[#E8E6E0]"}`}>
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${accent ? "text-[#36671E]/70" : "text-[#71717A]"}`}>{label}</p>
      <p className={`text-2xl font-black ${accent ? "text-[#FAFAF7]" : "text-[#18181B]"}`}>{value}</p>
    </div>
  );
}
