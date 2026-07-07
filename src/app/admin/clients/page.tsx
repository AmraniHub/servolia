import { supabaseAdmin } from "@/lib/supabase";
import { UserCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const db = supabaseAdmin();
  const { data: clients } = db
    ? await db.from("clients").select("*").order("created_at", { ascending: false })
    : { data: [] };

  const mrr = (clients ?? []).filter(c => c.status === "active").reduce((s, c) => s + Number(c.monthly_amount), 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#18181B] mb-1">Clients</h1>
          <p className="text-sm text-[#71717A]">{(clients?.length ?? 0)} clients · MRR €{mrr.toLocaleString()}</p>
        </div>
      </div>

      {(clients?.length ?? 0) === 0 ? (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-12 text-center">
          <UserCircle className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
          <p className="text-sm text-[#71717A]">No active clients yet. After delivery and care plan activation, clients appear here.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FAFAF7] border-b border-[#E8E6E0]">
              <tr className="text-left text-[10px] font-black text-[#71717A] uppercase tracking-widest">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Monthly</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Since</th>
              </tr>
            </thead>
            <tbody>
              {clients?.map(c => (
                <tr key={c.id} className="border-b border-[#F5F4EF] last:border-0 hover:bg-[#FAFAF7]">
                  <td className="px-4 py-3 font-semibold text-[#18181B]">{c.business}</td>
                  <td className="px-4 py-3 text-[#52525B]">{c.plan}</td>
                  <td className="px-4 py-3 font-bold text-[#36671E]">€{Number(c.monthly_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      c.status === "active" ? "bg-[#D1FAE5] text-[#065F46]" :
                      c.status === "paused" ? "bg-[#FEF3C7] text-[#92400E]" :
                      "bg-[#FEE2E2] text-[#991B1B]"
                    }`}>{c.status.toUpperCase()}</span>
                  </td>
                  <td className="px-4 py-3 text-[#71717A] text-xs">{new Date(c.started_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
