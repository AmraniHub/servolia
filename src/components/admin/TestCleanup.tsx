"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { CleanupPlanView } from "@/lib/testCleanup";

/**
 * "Find test records" → the exact list → "Remove these N" → confirm.
 *
 * Runs the founder test-mode cleanup on the server (POST
 * /api/admin/test-mode/cleanup, src/lib/testCleanup.ts) — no service key on
 * this machine. The confirm is an inline second click, NOT window.confirm():
 * the in-app browser answers every confirm() with "no", silently. Removing
 * sends back the list shown here; the server refuses if what it finds now is
 * not exactly that list.
 */
type Result = { total: number; deleted: Record<string, number>; reverted: { slug: string; ok: boolean }[] };

export default function TestCleanup() {
  const [plan, setPlan] = useState<CleanupPlanView | null>(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Result | null>(null);

  const post = async (body: object) => {
    const res = await fetch("/api/admin/test-mode/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (!res?.ok) throw new Error(json?.error ?? "No answer from the server — try again.");
    return json;
  };

  const find = async () => {
    setBusy(true);
    setError(null);
    setArmed(false);
    setDone(null);
    try {
      setPlan(await post({ apply: false }));
    } catch (e) {
      setPlan(null);
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!plan) return;
    if (!armed) return setArmed(true);
    setBusy(true);
    setError(null);
    try {
      setDone(await post({ apply: true, expect: plan.keys }));
      setPlan(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setArmed(false);
    setBusy(false);
  };

  return (
    <div className="flex items-start gap-3 p-5 rounded-xl border mb-8 bg-white border-[#E8E6E0]">
      <Trash2 className="w-5 h-5 mt-0.5 shrink-0 text-[#36671E]" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-widest mb-1 text-[#36671E]">Test records</p>
        <p className="text-sm text-[#18181B]">
          Remove what test purchases left behind: only rows tagged TEST, nothing else. Stripe&apos;s test-mode customers stay (clear them in the Stripe dashboard, in test mode).
        </p>

        {plan && plan.total === 0 && <p className="text-sm font-bold text-[#36671E] mt-3">No test records. Nothing to remove.</p>}

        {plan && plan.total > 0 && (
          <div className="mt-3 text-sm text-[#18181B]">
            <p className="font-bold mb-1.5">{plan.total} test record{plan.total === 1 ? "" : "s"} found:</p>
            <ul className="space-y-1.5">
              {plan.items.map((i) => (
                <li key={`${i.table}:${i.id}`} className="leading-snug">
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#92400E] text-white mr-1.5">{i.table}</span>
                  <span className="font-semibold">{i.label}</span>
                  {i.state && <span className="text-[#71717A]"> · {i.state}</span>}
                  <span className="text-[#71717A]"> · {i.createdAt.slice(0, 10)}</span>
                  {i.carries.map((m) => (
                    <span key={m} className="block text-xs text-[#71717A] pl-3 break-all">with it: {m}</span>
                  ))}
                </li>
              ))}
            </ul>
            {plan.cascades.some((c) => c.count) && (
              <p className="text-xs text-[#71717A] mt-2">
                The database also removes with them: {plan.cascades.filter((c) => c.count).map((c) => `${c.count} ${c.table}`).join(", ")}.
              </p>
            )}
            {plan.reverts.map((r) => (
              <p key={r.id} className="text-xs text-[#92400E] mt-1">
                Reverted, not deleted: receptionist trial {r.slug} goes back to a running trial (paid {r.paidAt} removed, status {r.status} → draft).
              </p>
            ))}
            {plan.kept.length > 0 && (
              <p className="text-xs text-[#71717A] mt-1">
                Kept (unlinked by the database): {plan.kept.map((s) => `${s.slug} (${s.status})`).join(", ")}. Remove at /admin/sites if you want them gone.
              </p>
            )}
          </div>
        )}

        {done && (
          <p className="text-sm font-bold text-[#36671E] mt-3">
            Removed {done.total} test record{done.total === 1 ? "" : "s"}
            {Object.entries(done.deleted).filter(([, n]) => n).length > 0 && ` (${Object.entries(done.deleted).filter(([, n]) => n).map(([t, n]) => `${n} ${t}`).join(", ")})`}.
            {done.reverted.map((r) => ` Trial ${r.slug}: ${r.ok ? "reverted" : "NOT reverted — check it at /admin/sites"}.`).join("")}
          </p>
        )}
        {error && <p className="text-xs font-bold text-[#B91C1C] mt-2">{error}</p>}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <button
          onClick={find}
          disabled={busy}
          className="px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 bg-[#36671E] text-white"
        >
          {plan ? "Look again" : "Find test records"}
        </button>
        {plan && plan.total > 0 && (
          <>
            <button
              onClick={remove}
              disabled={busy}
              className={`px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 text-white ${armed ? "bg-[#B91C1C]" : "bg-[#92400E]"}`}
            >
              {armed ? `Yes, delete ${plan.total} for good` : `Remove these ${plan.total}`}
            </button>
            {armed && (
              <button onClick={() => setArmed(false)} disabled={busy} className="text-xs font-bold text-[#71717A] underline">
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
