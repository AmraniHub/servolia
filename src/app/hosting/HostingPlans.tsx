"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const INCLUDED = [
  "Hosting on a global CDN, with SSL",
  "Domain renewal and DNS managed",
  "Contact and quote forms kept connected",
  "Tracking and analytics kept connected",
  "Uptime watched — you hear it from us first",
];

export default function HostingPlans({ refCode }: { refCode: string }) {
  const [billing, setBilling] = useState<"annual" | "monthly">("annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hosting-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No amount is sent: the price is read on the server, so it cannot be
        // edited in the browser.
        body: JSON.stringify({ plan: "hosting", billing, ref: refCode }),
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

  return (
    <div className="max-w-lg mx-auto">
      {/* billing toggle */}
      <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-[#F4F4F5] mb-6">
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

      <div className="border border-[#E4E4E7] rounded-2xl p-7 bg-white">
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-4xl font-black text-[#18181B]">${annual ? 96 : 8}</span>
          <span className="text-[#71717A] font-medium">/ {annual ? "year" : "month"}</span>
        </div>
        <p className="text-sm text-[#71717A] mb-6">
          {annual ? "Billed once a year. Cancel anytime." : "Billed monthly. Cancel anytime."}
        </p>

        <ul className="space-y-2.5 mb-7">
          {INCLUDED.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm text-[#3F3F46]">
              <Check className="w-4 h-4 text-[#16A34A] mt-0.5 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={pay}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A] disabled:opacity-60 transition"
        >
          {loading ? "Redirecting to Stripe…" : `Pay $${annual ? 96 : 8} — start hosting`}
        </button>

        {error ? <p className="mt-3 text-sm text-[#B91C1C] text-center">{error}</p> : null}

        <p className="mt-4 text-xs text-[#A1A1AA] text-center">
          Secure payment by Stripe. Card details never touch our servers.
        </p>
      </div>

      <p className="mt-5 text-xs text-[#A1A1AA] text-center leading-relaxed">
        Content changes and new pages are quoted separately.
      </p>
    </div>
  );
}
