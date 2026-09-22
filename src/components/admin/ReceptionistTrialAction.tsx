"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * End or remove a public receptionist trial from /admin/today. Each asks
 * once before acting: ending a real practice's trial is visible to them.
 */
export default function ReceptionistTrialAction({ slug, ended }: { slug: string; ended: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(action: "end" | "remove") {
    const ask = action === "end"
      ? "End this trial now? The receptionist goes quiet on their site and no more trial emails are sent."
      : "Remove this receptionist entirely? This cannot be undone.";
    if (!window.confirm(ask)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/receptionist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, action }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { router.refresh(); return; }
    setError(json.result === "paid" ? "Paid — cancel it in Stripe instead." : "Failed — try again.");
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {!ended ? (
        <button type="button" disabled={busy} onClick={() => act("end")}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#E8E6E0] bg-white text-[#52525B] hover:border-[#B91C1C] hover:text-[#B91C1C] disabled:opacity-50">
          End
        </button>
      ) : null}
      <button type="button" disabled={busy} onClick={() => act("remove")}
        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#E8E6E0] bg-white text-[#52525B] hover:border-[#B91C1C] hover:text-[#B91C1C] disabled:opacity-50">
        Remove
      </button>
      {error ? <span className="text-[11px] text-[#B91C1C]" role="alert">{error}</span> : null}
    </div>
  );
}
