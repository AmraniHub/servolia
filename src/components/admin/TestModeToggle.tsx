"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical } from "lucide-react";

/**
 * "Test mode: ON until 18:40" — founder test mode for THIS browser
 * (src/lib/testMode.ts). The server renders the current state; this only
 * flips it through /api/admin/test-mode and refreshes the page.
 */
export default function TestModeToggle({ until, available }: { until: string | null; available: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = until !== null;

  const flip = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/test-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: !on }),
    }).catch(() => null);
    if (!res?.ok) setError("Could not switch test mode — try again.");
    setBusy(false);
    router.refresh();
  };

  const time = until ? new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className={`flex items-start gap-3 p-5 rounded-xl border mb-8 ${on ? "bg-[#FEF3C7] border-[#D97706]/40" : "bg-white border-[#E8E6E0]"}`}>
      <FlaskConical className={`w-5 h-5 mt-0.5 shrink-0 ${on ? "text-[#92400E]" : "text-[#36671E]"}`} />
      <div className="flex-1">
        <p className={`text-xs font-black uppercase tracking-widest mb-1 ${on ? "text-[#92400E]" : "text-[#36671E]"}`}>
          {on ? `Test mode: ON until ${time}` : "Test mode: off"}
        </p>
        <p className="text-sm text-[#18181B]">
          {on
            ? "Purchases on this browser use Stripe test mode (card 4242 4242 4242 4242). Everything they create is tagged TEST and kept out of every number."
            : "Walk any product exactly as a client does, on the live site, with a Stripe test card. Only this browser, for 8 hours."}
        </p>
        {!available && (
          <p className="text-xs font-bold text-[#B91C1C] mt-1.5">
            STRIPE_TEST_SECRET_KEY is not set (or is not an sk_test_ key): with test mode on, every checkout will refuse rather than charge live.
          </p>
        )}
        {error && <p className="text-xs font-bold text-[#B91C1C] mt-1.5">{error}</p>}
      </div>
      <button
        onClick={flip}
        disabled={busy}
        className={`px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 ${on ? "bg-[#92400E] text-white" : "bg-[#36671E] text-white"}`}
      >
        {on ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
