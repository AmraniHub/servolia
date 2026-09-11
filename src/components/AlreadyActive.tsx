"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";

/**
 * One button for a paying client who landed on their pay page again: send
 * the service-page link to the address on file. The address is shown masked
 * and never posted -- the server knows it from the ref.
 */
export default function AlreadyActive({
  refCode,
  maskedEmail,
  lang = "en",
}: {
  refCode: string;
  maskedEmail: string;
  lang?: "en" | "fr";
}) {
  const fr = lang === "fr";
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");

  async function send() {
    setState("busy");
    try {
      const res = await fetch("/api/hosting-account/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: refCode }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "sent") {
    return (
      <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#36671E]">
        <Check className="w-4 h-4" />
        {fr ? `Envoyé à ${maskedEmail}` : `Sent to ${maskedEmail}`}
      </p>
    );
  }
  return (
    <div>
      <button
        onClick={send}
        disabled={state === "busy"}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#18181B] text-white font-bold text-[14px] hover:bg-[#27272A] disabled:opacity-50 transition"
      >
        <Mail className="w-4 h-4" />
        {state === "busy"
          ? (fr ? "Envoi…" : "Sending…")
          : (fr ? `M'envoyer mon lien (${maskedEmail})` : `Email me my link (${maskedEmail})`)}
      </button>
      {state === "failed" ? (
        <p className="mt-2 text-sm text-[#B91C1C]">{fr ? "Impossible d'envoyer pour le moment — réessayez." : "Could not send right now — try again."}</p>
      ) : null}
    </div>
  );
}
