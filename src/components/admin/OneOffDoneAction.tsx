"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Mark a paid one-off order delivered from /admin/today
 * (src/lib/oneOffOrders.ts). Asks once: it takes the promise off the list.
 */
export default function OneOffDoneAction({ where, id, session }: { where: "hosting" | "lead"; id: string; session: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function done() {
    if (!window.confirm("Delivered, and the client told by email? This takes it off Today.")) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/oneoff-done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ where, id, session }),
    });
    setBusy(false);
    if (res.ok) { router.refresh(); return; }
    setError("Failed — try again.");
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button type="button" disabled={busy} onClick={done}
        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#E8E6E0] bg-white text-[#52525B] hover:border-[#36671E] hover:text-[#36671E] disabled:opacity-50">
        Done
      </button>
      {error ? <span className="text-[11px] text-[#B91C1C]" role="alert">{error}</span> : null}
    </div>
  );
}
