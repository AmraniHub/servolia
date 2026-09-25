"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, RefreshCw } from "lucide-react";
import type { Checklist } from "@/lib/hostingSetup";

/**
 * The client's setup checklist, as the founder sees it: the same steps the
 * client sees on /hosting/account, plus a tick box on each HAND step and a
 * button that runs the live checks now (the same code as the cron — a
 * milestone it reaches is emailed to the client once, from here).
 *
 * `stored` is false until supabase/2026-09-25-hosting-setup.sql has run: the
 * checklist still shows, but ticks cannot be saved and nothing is emailed.
 */
export default function HostingSetupTracker({
  id,
  initial,
  stored,
  mail,
}: {
  id: string;
  initial: Checklist;
  stored: boolean;
  /** The milestone stamps, for the founder to see what the client was sent. */
  mail: Record<string, string>;
}) {
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/hosting/${id}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.hint || data.error || `HTTP ${res.status}`);
      setList(data.checklist as Checklist);
      const sent = Array.isArray(data.sent) && data.sent.length ? ` Emailed the client: ${data.sent.join(", ")}.` : "";
      setMsg({ ok: true, text: body.action === "check" ? `Checked.${sent}${data.stored === false ? " (Not stored: run the SQL.)" : ""}` : "Saved." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6 mb-6" data-testid="admin-setup-tracker">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-black text-[#18181B]">Setup checklist · {list.done} of {list.total}</h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            What the client sees on their service page. Auto steps are measured; HAND steps are yours to tick.
            {list.checkedAt ? ` Last check ${list.checkedAt.replace("T", " ").slice(0, 16)} UTC` : " Not checked yet."}
            {list.host ? ` · host ${list.host}` : " · no domain known yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => call({ action: "check" }, "check")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E4E4E7] text-sm font-semibold text-[#18181B] hover:bg-[#FAFAFA] disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy === "check" ? "animate-spin" : ""}`} /> Run checks now
        </button>
      </div>

      {!stored ? (
        <p className="mb-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#78350F]">
          Not stored yet: run <span className="font-mono">supabase/2026-09-25-hosting-setup.sql</span> in the Supabase SQL editor.
          Until then ticks cannot be saved and no milestone email is sent.
        </p>
      ) : null}

      <ul className="divide-y divide-[#F4F4F5]">
        {list.steps.map((s) => (
          <li key={s.id} className="py-3 flex gap-3">
            {s.state === "done" ? <CheckCircle2 className="w-5 h-5 text-[#36671E] shrink-0" />
              : s.state === "doing" ? <Clock className="w-5 h-5 text-[#B45309] shrink-0" />
              : <Circle className="w-5 h-5 text-[#D4D4D8] shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#18181B]">
                {s.title}
                <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-[#A1A1AA]">{s.kind === "hand" ? "HAND" : "AUTO"} · {s.state}</span>
              </p>
              <p className="text-xs text-[#52525B] mt-0.5 leading-relaxed">{s.detail}</p>
              {s.doneAt ? <p className="text-[11px] text-[#A1A1AA] mt-0.5">done {s.doneAt.slice(0, 16).replace("T", " ")}</p> : null}
              {s.startedAt ? <p className="text-[11px] text-[#A1A1AA] mt-0.5">started {s.startedAt.slice(0, 10)}{s.promise ? ` · promised: ${s.promise}` : ""}</p> : null}
            </div>
            {s.kind === "hand" ? (
              <button
                type="button"
                disabled={busy !== null || !stored}
                onClick={() => call({ action: "tick", step: s.id, done: s.state !== "done" }, s.id)}
                className={`h-8 px-3 rounded-lg text-xs font-bold border shrink-0 disabled:opacity-40 ${
                  s.state === "done" ? "border-[#E4E4E7] text-[#71717A]" : "border-[#36671E] bg-[#36671E] text-white"
                }`}
              >
                {s.state === "done" ? "Untick" : "Mark done"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {list.records.length ? (
        <p className="mt-3 text-xs text-[#52525B]">
          Records the client is shown: {list.records.map((r) => `${r.type} ${r.name} → ${r.value} (${r.ok ? "ok" : `now: ${r.found.join(", ") || "nothing"}`})`).join(" · ")}
        </p>
      ) : null}
      {Object.keys(mail).length ? (
        <p className="mt-2 text-[11px] text-[#A1A1AA]">
          Milestone emails: {Object.entries(mail).map(([k, v]) => `${k} ${v.startsWith("baseline:") ? "(already done at first check, not emailed)" : v.startsWith("covered:") ? "(covered by the live email)" : `sent ${v.slice(0, 16).replace("T", " ")}`}`).join(" · ")}
        </p>
      ) : null}
      {msg ? <p className={`mt-3 text-sm ${msg.ok ? "text-[#36671E]" : "text-[#B91C1C]"}`}>{msg.text}</p> : null}
    </div>
  );
}
