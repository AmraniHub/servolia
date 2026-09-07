"use client";

import { useState } from "react";
import { Check, ShieldCheck, Lock } from "lucide-react";

export default function ProductCheckout({
  planKey,
  monthlyUsd,
  annualUsd,
  includes,
  refCode,
  siteLabel,
  defaultBilling = "annual",
}: {
  planKey: string;
  monthlyUsd: number;
  annualUsd: number;
  includes: string[];
  refCode: string;
  siteLabel: string;
  /** Which term the link opens on, so a client agreed on monthly is not
   *  shown the annual price first. */
  defaultBilling?: "annual" | "monthly";
}) {
  const [billing, setBilling] = useState<"annual" | "monthly">(defaultBilling);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hosting-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only a plan key and a period. No amount: a price posted from the
        // browser is a price the buyer can edit in devtools.
        body: JSON.stringify({ plan: planKey, billing, ref: refCode, business: siteLabel }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || "Could not start checkout");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const annual = billing === "annual";
  const amount = annual ? annualUsd : monthlyUsd;
  // Only claim a saving when the annual price is actually below 12 months.
  const saving = Math.round(monthlyUsd * 12 - annualUsd);

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {siteLabel ? (
          <div className="px-7 pt-6 pb-5 border-b border-[#F0EFEA] bg-[#FAFAF7]">
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">For</p>
            <p className="text-[15px] font-bold text-[#18181B]">{siteLabel}</p>
          </div>
        ) : null}

        <div className="px-7 pt-6">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4F4F0] mb-6">
            {(["annual", "monthly"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`flex-1 h-9 rounded-lg text-sm font-bold transition ${
                  billing === b ? "bg-white text-[#18181B] shadow-sm" : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                {b === "annual" ? "Yearly" : "Monthly"}
              </button>
            ))}
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-[44px] leading-none font-black text-[#18181B] tracking-tight">${amount}</span>
            <span className="text-[#71717A] font-medium">/ {annual ? "year" : "month"}</span>
          </div>
          <p className="text-sm text-[#71717A] mt-2 mb-6">
            {annual ? "Billed once a year. Cancel anytime." : "Billed monthly. Cancel anytime."}
            {annual && saving > 0 ? (
              <span className="ml-1.5 font-semibold text-[#36671E]">Save ${saving}.</span>
            ) : null}
          </p>

          <ul className="space-y-2.5 mb-7">
            {includes.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-[#3F3F46]">
                <Check className="w-4 h-4 text-[#36671E] mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-7 pb-7">
          <button
            onClick={pay}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A] disabled:opacity-60 transition"
          >
            {loading ? "Redirecting to Stripe…" : `Pay $${amount} — get started`}
          </button>

          {error ? <p className="mt-3 text-sm text-[#B91C1C] text-center">{error}</p> : null}

          <div className="mt-5 flex items-center justify-center gap-5 text-[11px] text-[#8A8A80]">
            <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Secured by Stripe</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Cancel anytime</span>
          </div>
          <p className="mt-2.5 text-[11px] text-[#A8A8A0] text-center">
            Card details are handled by Stripe and never reach our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
