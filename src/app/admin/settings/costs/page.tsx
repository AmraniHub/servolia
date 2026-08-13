import { TrendingUp, Gift } from "lucide-react";
import { costBreakdown } from "../_data";

export const dynamic = "force-dynamic";

export default function CostsSettings() {
  const { fixed, usage, free, fixedActiveTotal, hasEstimates } = costBreakdown();

  return (
    <>
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden mb-3">
        <div className="px-5 py-4 bg-[#EEF5EA] border-b border-[#D6E2CF] flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest">Fixed monthly overhead</p>
            <p className="text-[11px] text-[#295115] mt-0.5">Sum of active flat-fee services below{hasEstimates ? " — some are plan-tier estimates, confirm in each dashboard" : ""}.</p>
          </div>
          <p className="text-2xl font-black text-[#18181B]">≈€{fixedActiveTotal.toLocaleString()}<span className="text-sm font-bold text-[#71717A]">/mo</span></p>
        </div>

        {/* Fixed */}
        {fixed.map((c) => (
          <div key={c.key} className={`px-5 py-3.5 border-b border-[#F5F4EF] flex items-center justify-between gap-4 ${!c.active ? "opacity-50" : ""}`}>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                {c.label}
                {c.isEstimate && c.active && <span className="text-[10px] font-bold text-[#D97706] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">ESTIMATE</span>}
                {!c.active && <span className="text-[10px] font-bold text-[#A1A1AA] uppercase">not active</span>}
              </p>
              <p className="text-xs text-[#71717A] mt-0.5">{c.note}</p>
              {c.dashboardHint && <p className="text-[10px] text-[#A1A1AA] mt-1 font-mono">{c.dashboardHint}</p>}
            </div>
            <p className="text-sm font-black text-[#18181B] whitespace-nowrap">€{c.monthlyEur}<span className="text-[#A1A1AA] font-semibold">/mo</span></p>
          </div>
        ))}

        {/* Usage-based */}
        <div className="px-5 py-2.5 bg-[#FAFAF7] border-y border-[#F5F4EF] flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-[#D97706]" />
          <p className="text-[11px] font-black text-[#92400E] uppercase tracking-widest">Usage-based — scales with volume, not summed above</p>
        </div>
        {usage.map((c) => (
          <div key={c.key} className={`px-5 py-3.5 border-b border-[#F5F4EF] flex items-start justify-between gap-4 ${!c.active ? "opacity-50" : ""}`}>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#18181B]">
                {c.label}
                {!c.active && <span className="ml-2 text-[10px] font-bold text-[#A1A1AA] uppercase">not active</span>}
              </p>
              <p className="text-xs text-[#71717A] mt-0.5">{c.note}</p>
              {c.dashboardHint && <p className="text-[10px] text-[#A1A1AA] mt-1 font-mono">{c.dashboardHint}</p>}
            </div>
          </div>
        ))}

        {/* Free */}
        <div className="px-5 py-2.5 bg-[#FAFAF7] border-y border-[#F5F4EF] flex items-center gap-2">
          <Gift className="w-3.5 h-3.5 text-[#36671E]" />
          <p className="text-[11px] font-black text-[#36671E] uppercase tracking-widest">Free</p>
        </div>
        {free.map((c) => (
          <div key={c.key} className={`px-5 py-3 border-b border-[#F5F4EF] last:border-0 flex items-center justify-between gap-4 ${!c.active ? "opacity-50" : ""}`}>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#18181B]">
                {c.label}
                {!c.active && <span className="ml-2 text-[10px] font-bold text-[#A1A1AA] uppercase">not active</span>}
              </p>
              <p className="text-xs text-[#71717A] mt-0.5">{c.note}</p>
            </div>
            <span className="text-xs font-black text-[#36671E]">€0</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#A1A1AA]">
        Estimates only — plan tiers marked <span className="font-bold text-[#D97706]">ESTIMATE</span> assume typical usage and are not pulled from your real bill. Confirm against each dashboard before treating this as accounting.
      </p>
    </>
  );
}
