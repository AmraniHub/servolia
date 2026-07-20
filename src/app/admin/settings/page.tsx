import { isSupabaseConfigured } from "@/lib/supabase";
import { INTEGRATIONS, ROADMAP, STATUS_META, type IntegrationCategory, type RoadmapStatus } from "@/lib/roadmap";
import { CheckCircle2, AlertCircle, CreditCard, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: IntegrationCategory[] = ["Core", "Payments", "AI", "Email & alerts", "Growth & ads", "Add-on providers"];
const STATUS_SORT: Record<RoadmapStatus, number> = { blocked: 0, in_progress: 1, todo: 2, done: 3 };

export default function SettingsPage() {
  // Server-side only — we surface whether each secret is SET, never its value.
  const checked = INTEGRATIONS.map((i) => ({ ...i, ok: i.envVars.every((v) => !!process.env[v]?.trim()) }));
  const requiredMissing = checked.filter((c) => c.required && !c.ok);

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  const stripeMode = stripeKey.startsWith("sk_live_") ? "live" : stripeKey.startsWith("sk_test_") ? "test" : stripeKey ? "unknown" : "missing";

  const roadmap = [...ROADMAP].filter((r) => r.status !== "done")
    .sort((a, b) => a.priority - b.priority || STATUS_SORT[a.status] - STATUS_SORT[b.status]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Settings & what&apos;s left</h1>
      <p className="text-sm text-[#71717A] mb-6">Setup status, secrets, and the live roadmap.</p>

      {/* Top alerts */}
      <div className="space-y-3 mb-8">
        {stripeMode !== "live" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FEE2E2] border border-[#B91C1C]/25">
            <CreditCard className="w-5 h-5 text-[#B91C1C] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-black text-[#B91C1C]">Stripe is in {stripeMode.toUpperCase()} mode</p>
              <p className="text-xs text-[#7F1D1D] mt-0.5">No real money is collected until a <code className="font-mono">sk_live_…</code> key is set in Vercel. Everything else (checkout, Care, add-ons) already works.</p>
            </div>
          </div>
        )}
        {requiredMissing.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FEF3C7] border border-[#D97706]/30">
            <AlertCircle className="w-5 h-5 text-[#92400E] mt-0.5 shrink-0" />
            <p className="text-sm text-[#92400E]"><strong>{requiredMissing.length} required integration{requiredMissing.length > 1 ? "s" : ""} missing:</strong> {requiredMissing.map((c) => c.label).join(", ")}.</p>
          </div>
        )}
      </div>

      {/* Integrations by category */}
      <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-3">Integrations & secrets</h2>
      <div className="space-y-5 mb-10">
        {CATEGORY_ORDER.map((cat) => {
          const items = checked.filter((c) => c.category === cat);
          if (!items.length) return null;
          const setCount = items.filter((i) => i.ok).length;
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
                      {c.label.startsWith("Stripe secret") && stripeMode !== "missing" && (
                        <span className={`ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-full ${stripeMode === "live" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>{stripeMode.toUpperCase()}</span>
                      )}
                    </p>
                    <p className="text-xs text-[#71717A] mt-0.5 font-mono">{c.envVars.join(" · ")}{c.note ? ` — ${c.note}` : ""}</p>
                  </div>
                  {c.ok ? (
                    <span className="flex items-center gap-1.5 text-[#36671E] text-xs font-bold whitespace-nowrap"><CheckCircle2 className="w-4 h-4" /> SET</span>
                  ) : (
                    <span className={`flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${c.required ? "text-[#B91C1C]" : "text-[#A1A1AA]"}`}><AlertCircle className="w-4 h-4" /> {c.required ? "MISSING" : "not set"}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Roadmap — what's left */}
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-[#36671E]" />
        <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest">What&apos;s left to build ({roadmap.length})</h2>
      </div>
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden mb-10">
        {roadmap.map((r, i) => {
          const st = STATUS_META[r.status];
          return (
            <div key={i} className="px-5 py-4 border-b border-[#F5F4EF] last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    <span className="text-[10px] font-black text-[#A1A1AA]">P{r.priority}</span>
                    <span className="text-sm font-bold text-[#18181B]">{r.title}</span>
                  </div>
                  {r.detail && <p className="text-xs text-[#71717A] mt-1.5 leading-relaxed">{r.detail}</p>}
                  {r.needs && <p className="text-xs text-[#92400E] mt-1">Needs: {r.needs}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Database + setup help */}
      <div className="p-5 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20 mb-6">
        <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-2">Database status</p>
        <p className="text-sm text-[#18181B]">
          {isSupabaseConfigured() ? "✓ Supabase is connected. CRM is fully operational." : "⚠ Supabase not configured — leads still hit Telegram + Sheets but can't be tracked here."}
        </p>
      </div>

      <details className="bg-white border border-[#E8E6E0] rounded-2xl">
        <summary className="px-5 py-4 cursor-pointer text-sm font-black text-[#18181B]">Where to set secrets</summary>
        <div className="px-5 pb-5 text-sm text-[#52525B] space-y-2">
          <p>Set every secret at <strong className="text-[#18181B]">vercel.com → your project → Settings → Environment Variables</strong>, then redeploy.</p>
          <p>Stripe live keys: dashboard.stripe.com → toggle off &quot;Test mode&quot; → Developers → API keys → copy <code className="bg-[#FAFAF7] px-1.5 py-0.5 rounded">sk_live_…</code>.</p>
          <p>The full strategy + env-var list lives in <code className="bg-[#FAFAF7] px-1.5 py-0.5 rounded">docs/BUSINESS-MODEL.md</code>.</p>
        </div>
      </details>
    </div>
  );
}
