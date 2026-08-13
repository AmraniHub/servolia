import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AlertCircle, CreditCard, Database, ShieldCheck, Plug, Wallet, ListChecks, ArrowRight } from "lucide-react";
import { costBreakdown, integrationStatus, openRoadmap, stripeMode } from "./_data";

export const dynamic = "force-dynamic";

/**
 * Settings overview — what needs a decision, and where the rest lives.
 *
 * Everything that used to be stacked on one page now has its own route. This
 * page keeps only the things you'd want to see the moment you land: the two
 * alerts that mean money isn't moving, whether the database is connected, and
 * a way into each section with the number that says whether it's worth opening.
 */
export default function SettingsOverview() {
  const { requiredMissing, unsetCount } = integrationStatus();
  const roadmap = openRoadmap();
  const stripe = stripeMode();
  const { fixedActiveTotal } = costBreakdown();

  const sections = [
    {
      href: "/admin/settings/security",
      icon: ShieldCheck,
      label: "Security",
      desc: "Two-factor, recovery codes, how the admin door is locked.",
      stat: null as string | null,
    },
    {
      href: "/admin/settings/integrations",
      icon: Plug,
      label: "Integrations & secrets",
      desc: "Which env vars are set, and where to set them.",
      stat: requiredMissing.length > 0 ? `${requiredMissing.length} required missing` : `${unsetCount} optional not set`,
    },
    {
      href: "/admin/settings/costs",
      icon: Wallet,
      label: "Costs & subscriptions",
      desc: "Fixed overhead, usage-based services, and what's free.",
      stat: `≈€${fixedActiveTotal.toLocaleString()}/mo fixed`,
    },
    {
      href: "/admin/settings/roadmap",
      icon: ListChecks,
      label: "What's left to build",
      desc: "The live roadmap — blocked, in progress, and queued.",
      stat: `${roadmap.length} open`,
    },
  ];

  return (
    <>
      {/* Alerts that mean money isn't moving */}
      <div className="space-y-3 mb-8">
        {stripe !== "live" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FEE2E2] border border-[#B91C1C]/25">
            <CreditCard className="w-5 h-5 text-[#B91C1C] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-black text-[#B91C1C]">
                {stripe === "missing" ? "Stripe key is not set" : `Stripe is in ${stripe.toUpperCase()} mode`}
              </p>
              <p className="text-xs text-[#7F1D1D] mt-0.5">No real money is collected until a <code className="font-mono">sk_live_…</code> key is set in Vercel. Everything else (checkout, subscriptions, add-ons) already works.</p>
            </div>
          </div>
        )}
        {requiredMissing.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FEF3C7] border border-[#D97706]/30">
            <AlertCircle className="w-5 h-5 text-[#92400E] mt-0.5 shrink-0" />
            <p className="text-sm text-[#92400E]">
              <strong>{requiredMissing.length} required integration{requiredMissing.length > 1 ? "s" : ""} missing:</strong>{" "}
              {requiredMissing.map((c) => c.label).join(", ")}.{" "}
              <Link href="/admin/settings/integrations" className="underline font-bold">Fix in Integrations</Link>
            </p>
          </div>
        )}
        {stripe === "live" && requiredMissing.length === 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20">
            <ShieldCheck className="w-5 h-5 text-[#36671E] mt-0.5 shrink-0" />
            <p className="text-sm text-[#295115]"><strong>Nothing blocking.</strong> Stripe is live and every required secret is set.</p>
          </div>
        )}
      </div>

      {/* Database */}
      <div className="flex items-start gap-3 p-5 rounded-xl bg-white border border-[#E8E6E0] mb-8">
        <Database className="w-5 h-5 text-[#36671E] mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-1">Database status</p>
          <p className="text-sm text-[#18181B]">
            {isSupabaseConfigured()
              ? "Supabase is connected. CRM is fully operational."
              : "Supabase not configured — leads still hit Telegram + Sheets but can't be tracked here."}
          </p>
        </div>
      </div>

      {/* Where the rest lives */}
      <div className="grid sm:grid-cols-2 gap-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group p-5 rounded-xl bg-white border border-[#E8E6E0] hover:border-[#36671E] transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4 text-[#36671E]" />
                <span className="text-sm font-black text-[#18181B]">{s.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#A1A1AA] ml-auto group-hover:text-[#36671E] transition-colors" />
              </div>
              <p className="text-xs text-[#71717A] leading-relaxed">{s.desc}</p>
              {s.stat && <p className="text-xs font-bold text-[#52525B] mt-2">{s.stat}</p>}
            </Link>
          );
        })}
      </div>
    </>
  );
}
