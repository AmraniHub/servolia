"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Buttons for the one domain a client bought through Servolia. Each one is a
 * real API call with a real consequence (a purchase, a DNS change), so each
 * reports exactly what came back rather than a generic "done".
 */
export default function DomainActions({
  id,
  status,
  hasOrder,
  attached,
  vercelProject,
}: {
  id: string;
  status: "bought" | "pending" | "failed";
  hasOrder: boolean;
  attached: string | null;
  vercelProject: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: "buy" | "attach" | "status") {
    setBusy(action); setMsg(null);
    try {
      const res = await fetch(`/api/admin/hosting/${id}/domain`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (action === "status" && data.ok) {
        const o = data.order;
        setMsg({ ok: o.status === "completed", text: `Order ${o.orderId}: ${o.status}${o.domains?.[0]?.status ? ` · ${o.domains[0].domainName} ${o.domains[0].status}` : ""}${o.error?.code ? ` · ${o.error.code}` : ""}` });
        return;
      }
      if (!res.ok || !data.ok) {
        const why = data.outcome ? `${data.outcome.reason}${data.outcome.detail ? ` — ${data.outcome.detail}` : ""}` : (data.detail || data.error || data.hint || "failed");
        setMsg({ ok: false, text: why });
      } else {
        setMsg({ ok: true, text: action === "buy" ? `Bought — order ${data.record.orderId}` : `Attached to ${data.record.attached}` });
      }
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "failed" });
    } finally {
      setBusy(null);
    }
  }

  const btn = "h-9 px-4 rounded-lg text-sm font-bold disabled:opacity-50";
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "bought" ? (
          <button onClick={() => run("buy")} disabled={busy !== null} className={`${btn} bg-[#18181B] text-white hover:bg-[#27272A]`}>
            {busy === "buy" ? "Buying…" : "Buy on Vercel now"}
          </button>
        ) : null}
        {status === "bought" && !attached ? (
          <button onClick={() => run("attach")} disabled={busy !== null || !vercelProject}
                  title={vercelProject ? "" : "Record the Vercel project first"}
                  className={`${btn} bg-[#36671E] text-white hover:bg-[#295115]`}>
            {busy === "attach" ? "Attaching…" : vercelProject ? `Attach to ${vercelProject}` : "Attach (needs a Vercel project)"}
          </button>
        ) : null}
        {hasOrder ? (
          <button onClick={() => run("status")} disabled={busy !== null} className={`${btn} border border-[#E4E4E7] text-[#52525B] hover:text-[#18181B]`}>
            {busy === "status" ? "Checking…" : "Check order"}
          </button>
        ) : null}
      </div>
      {msg ? (
        <p className={`text-sm rounded-lg p-2.5 ${msg.ok ? "bg-[#F3F9EE] text-[#36671E]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
