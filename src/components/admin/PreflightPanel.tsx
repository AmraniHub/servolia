"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle, Loader2, RefreshCw, Rocket } from "lucide-react";

/**
 * The one screen to read before turning ads on.
 *
 * Every row behind this is a LIVE provider call, not an env-var presence check
 * — because the two failures that cost the most money both read green on a
 * presence check: an Anthropic key that is set but out of credit, and a Stripe
 * account with live keys that cannot charge because KYC never finished.
 */

type Status = "ready" | "warn" | "blocked";

type Check = {
  id: string;
  label: string;
  status: Status;
  detail: string;
  fix?: string;
  blocksAds: boolean;
};

type Result = {
  checkedAt: string;
  canRunAds: boolean;
  blockerCount: number;
  checks: Check[];
};

const ICON: Record<Status, React.ReactNode> = {
  ready: <CheckCircle2 className="w-4 h-4 text-[#36671E]" />,
  warn: <AlertCircle className="w-4 h-4 text-[#B45309]" />,
  blocked: <XCircle className="w-4 h-4 text-[#B91C1C]" />,
};

const ROW: Record<Status, string> = {
  ready: "border-[#E8E6E0] bg-white",
  warn: "border-[#D97706]/30 bg-[#FEF3C7]",
  blocked: "border-[#B91C1C]/25 bg-[#FEE2E2]",
};

export default function PreflightPanel() {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/preflight");
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Pre-flight failed");
      else setData(json);
    } catch {
      setError("Could not reach the pre-flight endpoint");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-[#71717A] max-w-lg">
          Live calls to Anthropic, Stripe, Resend and Supabase — not a check that the env vars exist. The two failures
          that cost the most money look fine on a presence check.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E6E0] bg-white text-xs font-bold text-[#3F3F46] hover:border-[#36671E] transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Re-run
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/20 text-[#DC2626] text-sm mb-4">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="p-8 rounded-xl bg-white border border-[#E8E6E0] text-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#36671E] mx-auto mb-2" />
          <p className="text-sm text-[#71717A]">Calling each provider…</p>
        </div>
      )}

      {data && (
        <>
          <div
            className={`flex items-start gap-3 p-5 rounded-xl border mb-5 ${
              data.canRunAds ? "bg-[#EEF5EA] border-[#36671E]/25" : "bg-[#FEE2E2] border-[#B91C1C]/25"
            }`}
          >
            <Rocket className={`w-5 h-5 mt-0.5 shrink-0 ${data.canRunAds ? "text-[#36671E]" : "text-[#B91C1C]"}`} />
            <div>
              <p className={`text-sm font-black ${data.canRunAds ? "text-[#295115]" : "text-[#B91C1C]"}`}>
                {data.canRunAds
                  ? "Clear to run ads."
                  : `${data.blockerCount} blocker${data.blockerCount === 1 ? "" : "s"} — do not spend on traffic yet.`}
              </p>
              <p className={`text-xs mt-0.5 ${data.canRunAds ? "text-[#295115]" : "text-[#7F1D1D]"}`}>
                {data.canRunAds
                  ? "Money can be collected, and a client who pays receives what was sold."
                  : "Traffic today either cannot convert, or converts into a client who gets less than they paid for."}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {data.checks.map((c) => (
              <div key={c.id} className={`rounded-xl border p-4 ${ROW[c.status]}`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {ICON[c.status]}
                  <span className="text-sm font-black text-[#18181B]">{c.label}</span>
                  {c.blocksAds && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#B91C1C] text-white">
                      BLOCKS ADS
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#3F3F46] leading-relaxed">{c.detail}</p>
                {c.fix && <p className="text-xs text-[#52525B] mt-1.5 font-semibold">→ {c.fix}</p>}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-[#A1A1AA] mt-4">
            Checked {new Date(data.checkedAt).toLocaleString()}. Anthropic is billed a single token per run.
          </p>
        </>
      )}
    </>
  );
}
