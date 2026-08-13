import { CheckCircle2, AlertCircle } from "lucide-react";
import { type IntegrationCategory } from "@/lib/roadmap";
import { integrationStatus, stripeMode } from "../_data";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: IntegrationCategory[] = ["Core", "Payments", "AI", "Email & alerts", "Growth & ads", "Add-on providers"];

export default function IntegrationsSettings() {
  const { checked } = integrationStatus();
  const stripe = stripeMode();

  return (
    <>
      <div className="space-y-5 mb-8">
        {CATEGORY_ORDER.map((cat) => {
          const items = checked.filter((c) => c.category === cat);
          if (!items.length) return null;
          const setCount = items.filter((i) => i.ok || i.activeByDefault).length;
          return (
            <div key={cat} className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-[#FAFAF7] border-b border-[#F5F4EF] flex items-center justify-between">
                <span className="text-xs font-black text-[#18181B] uppercase tracking-widest">{cat}</span>
                <span className="text-[11px] text-[#71717A] font-semibold">{setCount}/{items.length} set</span>
              </div>
              {items.map((c) => (
                <div key={c.label} className="px-5 py-3.5 border-b border-[#F5F4EF] last:border-0 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#18181B]">
                      {c.label}
                      {!c.required && <span className="ml-2 text-[10px] font-bold text-[#A1A1AA] uppercase">optional</span>}
                      {c.label.startsWith("Stripe secret") && stripe !== "missing" && (
                        <span className={`ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-full ${stripe === "live" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>{stripe.toUpperCase()}</span>
                      )}
                    </p>
                    <p className="text-xs text-[#71717A] mt-0.5 font-mono">{c.envVars.join(" · ")}{c.note ? ` — ${c.note}` : ""}</p>
                  </div>
                  {c.ok ? (
                    <span className="flex items-center gap-1.5 text-[#36671E] text-xs font-bold whitespace-nowrap"><CheckCircle2 className="w-4 h-4" /> SET</span>
                  ) : c.activeByDefault ? (
                    // Works from a hardcoded default — showing "not set" here
                    // would invent a chore that does not exist.
                    <span className="flex items-center gap-1.5 text-[#36671E] text-xs font-bold whitespace-nowrap"><CheckCircle2 className="w-4 h-4" /> ACTIVE</span>
                  ) : (
                    <span className={`flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${c.required ? "text-[#B91C1C]" : "text-[#A1A1AA]"}`}><AlertCircle className="w-4 h-4" /> {c.required ? "MISSING" : "not set"}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <details className="bg-white border border-[#E8E6E0] rounded-2xl">
        <summary className="px-5 py-4 cursor-pointer text-sm font-black text-[#18181B]">Where to set secrets</summary>
        <div className="px-5 pb-5 text-sm text-[#52525B] space-y-2">
          <p>Set every secret at <strong className="text-[#18181B]">vercel.com → your project → Settings → Environment Variables</strong>, then redeploy.</p>
          <p>Stripe live keys: dashboard.stripe.com → toggle off &quot;Test mode&quot; → Developers → API keys → copy <code className="bg-[#FAFAF7] px-1.5 py-0.5 rounded">sk_live_…</code>.</p>
          <p>The full strategy + env-var list lives in <code className="bg-[#FAFAF7] px-1.5 py-0.5 rounded">docs/BUSINESS-MODEL.md</code>.</p>
        </div>
      </details>
    </>
  );
}
