"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "We built your assistant" — the one button that sends it.
 *
 * It exists because the endpoint is admin-only, and an admin-only endpoint
 * cannot be driven by a curl command pasted into a terminal. It also prints
 * exactly what came back: an earlier version of this route answered the same
 * "ok" to everything, and two invites that were never sent read as two
 * successes.
 */
export default function AssistantInvite({
  refKey,
  business,
  email,
  invitedAt,
}: {
  refKey: string;
  business: string;
  email: string;
  /** ISO of a previous send, from the row's notes. Null = never sent. */
  invitedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/assistant-invite?ref=${encodeURIComponent(refKey)}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.status === "sent") {
        setMsg({ ok: true, text: `Sent to ${data.to} (${String(data.lang).toUpperCase()}) — "${data.subject}"` });
      } else if (res.ok && data.status === "already-sent") {
        setMsg({ ok: true, text: `Already sent on ${new Date(data.at).toLocaleString()}. Nothing sent again.` });
      } else {
        setMsg({ ok: false, text: data.detail || data.error || `HTTP ${res.status}` });
      }
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "failed" });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="mt-3">
      {invitedAt && !msg ? (
        <p className="text-sm text-[#52525B]">
          Invite sent <strong>{new Date(invitedAt).toLocaleString()}</strong>. It goes once per client.
        </p>
      ) : null}

      {!invitedAt && !confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="h-9 px-4 rounded-lg text-sm font-bold bg-[#18181B] text-white hover:bg-[#27272A]"
        >
          Send the assistant invite…
        </button>
      ) : null}

      {confirming ? (
        /* It reaches a real client under Servolia's name and cannot be
           unsent, so the address is shown before the click that sends it. */
        <div className="rounded-lg border border-[#E8E6E0] bg-[#FAFAF7] p-3">
          <p className="text-sm text-[#18181B]">
            Email <strong>{business}</strong> at <strong>{email}</strong> — &ldquo;we built your assistant&rdquo;, with links to
            try it, edit it, start the 7-day trial, and pay.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={send}
              disabled={busy}
              className="h-9 px-4 rounded-lg text-sm font-bold bg-[#36671E] text-white hover:bg-[#295115] disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send it now"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="h-9 px-4 rounded-lg text-sm font-bold border border-[#E2E6DD] bg-white text-[#3F3F46] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {msg ? (
        <p className={`mt-2 text-sm font-medium ${msg.ok ? "text-[#36671E]" : "text-[#B45309]"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
