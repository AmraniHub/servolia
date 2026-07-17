"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import CheckoutButton from "@/components/CheckoutButton";

export default function ScopeAcceptForm({
  token, planKey, leadId, planLabel,
}: { token: string; planKey: string; leadId: string | null; planLabel: string }) {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    if (!name.trim() || !agreed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/scope/${token}/accept`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong — try again."); return; }
      setAccepted(true);
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) {
    return (
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 text-center">
        <CheckCircle className="w-10 h-10 text-[#36671E] mx-auto mb-3" />
        <h2 className="text-lg font-black text-[#18181B] mb-1">Scope accepted</h2>
        <p className="text-sm text-[#71717A] mb-5">Thanks, {name.trim()}. Next: pay your 50% deposit to lock in your build slot.</p>
        <CheckoutButton
          plan={planKey}
          leadId={leadId ?? undefined}
          label={`Pay deposit — ${planLabel}`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-white font-black hover:opacity-90 transition-opacity disabled:opacity-60"
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
      <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-4">Accept this scope</h2>
      <label className="block text-xs font-bold text-[#71717A] uppercase tracking-widest mb-1.5">Your full name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe"
        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E6E0] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E] mb-4" />

      <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#36671E]" />
        <span className="text-sm text-[#52525B] leading-relaxed">
          I have read the scope above and agree to it on behalf of the business named. I understand the price, delivery deadline, and what's included/excluded as written.
        </span>
      </label>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <button onClick={accept} disabled={!name.trim() || !agreed || submitting}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-white font-black hover:opacity-90 transition-opacity disabled:opacity-40">
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</> : "Accept & continue"}
      </button>
      <p className="text-[11px] text-[#A1A1AA] mt-3 leading-relaxed">
        Your name, IP address, and the time of acceptance are recorded as a simple electronic signature confirming agreement to this scope.
      </p>
    </div>
  );
}
