import { loadEconomics, offerChecks, type Metric, type Confidence } from "@/lib/economics";
import { SETUP_PLAN, PLANS } from "@/lib/pricing";
import { Calculator, TrendingUp, Check, X, HelpCircle, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Unit economics — the money model and the offer, scored from real rows.
 *
 * Deliberately refuses to flatter: every figure is tagged measured / assumed /
 * unknown, and a zero from "no clients yet" is rendered as missing data rather
 * than as a finding. The point of the page is to tell you when you may scale
 * spend, not to look busy.
 */

const CONF: Record<Confidence, { label: string; cls: string }> = {
  measured: { label: "measured", cls: "bg-[#D1FAE5] text-[#065F46]" },
  assumed: { label: "assumed", cls: "bg-[#FEF3C7] text-[#92400E]" },
  unknown: { label: "no data", cls: "bg-[#F5F4EF] text-[#71717A]" },
};

function Figure({ label, metric, unit = "€" }: { label: string; metric: Metric; unit?: string }) {
  const c = CONF[metric.confidence];
  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[11px] font-black text-[#71717A] uppercase tracking-widest">{label}</p>
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${c.cls}`}>
          {c.label}
        </span>
      </div>
      <p className="text-2xl font-black text-[#18181B] tabular-nums">
        {metric.value == null ? "—" : unit === "€" ? `€${metric.value.toLocaleString()}` : `${metric.value}${unit}`}
      </p>
      <p className="text-[11px] text-[#71717A] leading-relaxed mt-1.5">{metric.basis}</p>
    </div>
  );
}

export default async function EconomicsPage() {
  const e = await loadEconomics();
  const checks = offerChecks(e);
  const failing = checks.filter((c) => c.pass === false);
  const firstYear = SETUP_PLAN.totalEur + PLANS.croissance.monthlyEur * 12;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-5 h-5 text-[#36671E]" />
        <h1 className="text-2xl font-black text-[#18181B]">Unit economics</h1>
      </div>
      <p className="text-sm text-[#71717A] mb-6">
        The money model and the offer, scored from your own rows. Every figure says whether it&apos;s measured,
        assumed, or missing — a zero from &quot;no clients yet&quot; is not a finding.
      </p>

      {/* The scaling gate — the one decision this page exists to inform */}
      <div className="rounded-2xl border-2 border-[#36671E] bg-[#0A1F14] p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-[#BEF264]" />
          <p className="text-[11px] font-black text-[#BEF264] uppercase tracking-widest">
            The 30-day payback gate
          </p>
        </div>
        <p className="text-3xl font-black text-[#FAFAF7] mb-2 tabular-nums">
          €{e.maxCacFor30DayPayback.value?.toLocaleString() ?? "—"}
          <span className="text-sm font-bold text-[#ABDF90]/70 ml-2">max cost to acquire a client</span>
        </p>
        <p className="text-sm text-[#FAFAF7]/80 leading-relaxed mb-3">
          Spend less than this to win a client and you are repaid inside 30 days, so growth funds itself.
          Spend more and every new client makes the cash position worse, however good the ROAS looks.
        </p>
        <p className="text-xs text-[#ABDF90]">
          Servolia&apos;s edge: €{e.day0Cash} of that lands on <strong>day 0</strong> as the installation — before a
          single subscription payment. {e.maxCacFor30DayPayback.basis}
        </p>
      </div>

      {/* Money model */}
      <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-3">Money model</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <Figure label="MRR" metric={e.mrr} />
        <Figure label="ARPU" metric={e.arpu} />
        <Figure label="Fixed monthly costs" metric={e.fixedCosts} />
        <Figure label="Gross margin" metric={e.grossMarginPct} unit="%" />
        <Figure label="Clients to break even" metric={e.breakEvenClients} unit="" />
        <Figure label="LTV per client" metric={e.ltv} />
      </div>

      {e.activeClients === 0 && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 mb-8 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#92400E] mt-0.5 shrink-0" />
          <p className="text-sm text-[#92400E] leading-relaxed">
            No active clients, so margin, ARPU and retention cannot be measured — the figures above marked
            &quot;assumed&quot; use the anchor tier (€{PLANS.croissance.monthlyEur}) and a stated {" "}
            {12}-month retention default. They become real the moment the first client subscribes.
          </p>
        </div>
      )}

      {/* Value equation */}
      <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-1 mt-8">Value equation</h2>
      <p className="text-xs text-[#71717A] mb-3">
        Value = (Dream Outcome × Perceived Likelihood) ÷ (Time Delay × Effort). The two denominators are the
        rarest competitive advantage — they&apos;re also the two you can measure.
      </p>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
          <p className="text-[11px] font-black text-[#71717A] uppercase tracking-widest mb-1">Dream outcome</p>
          <p className="text-sm text-[#3F3F46] leading-relaxed">
            Stop losing after-hours patients. Quantified against the client&apos;s own numbers in the audit and the
            ROI calculator — never a figure Servolia claims to have produced.
          </p>
        </div>
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[11px] font-black text-[#71717A] uppercase tracking-widest">Perceived likelihood</p>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
              e.proof.deliveredClients > 0 || e.proof.publishedCaseStudies > 0 ? CONF.measured.cls : "bg-[#FEE2E2] text-[#991B1B]"
            }`}>
              {e.proof.deliveredClients > 0 || e.proof.publishedCaseStudies > 0 ? "has proof" : "weak"}
            </span>
          </div>
          <p className="text-sm text-[#3F3F46] leading-relaxed">
            {e.proof.deliveredClients} client{e.proof.deliveredClients === 1 ? "" : "s"} ·{" "}
            {e.proof.publishedCaseStudies} published case stud{e.proof.publishedCaseStudies === 1 ? "y" : "ies"} ·
            three contractual guarantees. Until a real result exists, the live demos and the guarantees carry this lever alone.
          </p>
        </div>
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[11px] font-black text-[#71717A] uppercase tracking-widest">Time delay</p>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${CONF[e.deliveryDays.confidence].cls}`}>
              {CONF[e.deliveryDays.confidence].label}
            </span>
          </div>
          <p className="text-2xl font-black text-[#18181B] tabular-nums">
            {e.deliveryDays.value == null ? SETUP_PLAN.delivery : `${e.deliveryDays.value} days`}
          </p>
          <p className="text-[11px] text-[#71717A] mt-1.5">
            {e.deliveryDays.value == null ? `Promised: ${SETUP_PLAN.delivery}. ${e.deliveryDays.basis}` : e.deliveryDays.basis}
          </p>
        </div>
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
          <p className="text-[11px] font-black text-[#71717A] uppercase tracking-widest mb-1">Effort &amp; sacrifice</p>
          <p className="text-2xl font-black text-[#18181B]">~10 min</p>
          <p className="text-[11px] text-[#71717A] mt-1.5">
            One intake form, no calls, no meetings. Driving this toward zero is the hardest advantage to copy —
            it&apos;s why the sales call was removed rather than optimised.
          </p>
        </div>
      </div>

      {/* Offer strength */}
      <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-1 mt-8">
        Offer strength — {checks.filter((c) => c.pass === true).length}/{checks.length} passing
      </h2>
      <p className="text-xs text-[#71717A] mb-3">
        The 7-point validation checklist. {failing.length === 0
          ? "All settled by data or by the contract."
          : `${failing.length} weak lever — fix that before spending on traffic.`}
      </p>
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden mb-8">
        {checks.map((c, i) => (
          <div key={c.name} className={`flex items-start gap-3 px-5 py-4 ${i > 0 ? "border-t border-[#F5F4EF]" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              c.pass === true ? "bg-[#D1FAE5] text-[#065F46]" : c.pass === false ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#F5F4EF] text-[#71717A]"
            }`}>
              {c.pass === true ? <Check className="w-3 h-3" /> : c.pass === false ? <X className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
            </span>
            <div>
              <p className="text-sm font-black text-[#18181B]">{c.name}</p>
              <p className="text-sm text-[#52525B] leading-relaxed mt-0.5">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-[#A1A1AA] leading-relaxed">
        Reference: first-year value of one anchor-tier client is €{firstYear.toLocaleString()} (€{SETUP_PLAN.totalEur} installation
        + 12 × €{PLANS.croissance.monthlyEur}). Usage-based costs (AI inference, Stripe fees) are never included in margin —
        they would be a guess. See /admin/settings for the running cost breakdown.
      </p>
    </div>
  );
}
