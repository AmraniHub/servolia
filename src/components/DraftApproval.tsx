"use client";

import { useState } from "react";

/**
 * C3 — her answer to her draft, on the draft itself: "put it online" or
 * "I'd like a change". Posts to /sites/<slug>/go, which her preview cookie
 * authorises (see that route). "Go" asks once before acting: it publishes a
 * site her patients will see.
 */
export default function DraftApproval({ slug, lang, token, hasDomain }: { slug: string; lang: "en" | "fr"; token?: string; hasDomain?: boolean }) {
  const fr = lang === "fr";
  const [mode, setMode] = useState<"idle" | "change" | "busy" | "live" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send(action: "go" | "change") {
    if (action === "go" && !window.confirm(fr
      ? "Mettre votre site en ligne maintenant ? Vos patients pourront le voir."
      : "Put your site online now? Your patients will be able to see it.")) return;
    setMode("busy");
    const res = await fetch(`/sites/${encodeURIComponent(slug)}/go`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, message, token }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) { setMode("error"); return; }
    if (action === "go") {
      setMode("live");
      // The same address now shows the published site, without the ribbon.
      setTimeout(() => window.location.reload(), 2500);
    } else {
      setMode("sent");
    }
  }

  const btn = "inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-bold transition disabled:opacity-50";

  if (mode === "live") {
    return (
      <p className="text-xs font-bold" role="status">
        {hasDomain
          ? (fr ? "C'est parti ✓ Votre site sera en ligne à votre adresse dès que ses réglages DNS répondent — un email vous le confirmera." : "Done ✓ Your site goes live at your address as soon as its DNS answers — an email will confirm it.")
          : (fr ? "C'est en ligne ✓ Un email de confirmation arrive." : "It's live ✓ A confirmation email is on its way.")}
      </p>
    );
  }
  if (mode === "sent") {
    return <p className="text-xs font-bold" role="status">{fr ? "Bien reçu ✓ Nous revenons vers vous rapidement." : "Received ✓ We'll get back to you shortly."}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2" data-testid="draft-approval">
      {mode === "change" ? (
        <div className="w-full max-w-lg flex flex-col sm:flex-row gap-2">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={1500}
            placeholder={fr ? "Ce que vous aimeriez changer (texte, photo, horaires…)" : "What you would like changed (text, photo, hours…)"}
            className="flex-1 rounded-lg px-3 py-2 text-xs text-[#18181B] bg-white" />
          <button type="button" className={`${btn} bg-white text-[#92400E]`} disabled={message.trim().length < 3} onClick={() => send("change")}>
            {fr ? "Envoyer" : "Send"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" className={`${btn} bg-white text-[#92400E]`} disabled={mode === "busy"} onClick={() => send("go")}>
            {mode === "busy" ? "…" : (fr ? "C'est bon, mettez-le en ligne" : "Looks good — put it online")}
          </button>
          <button type="button" className={`${btn} border border-white/70 text-white`} disabled={mode === "busy"} onClick={() => setMode("change")}>
            {fr ? "Je voudrais un changement" : "I'd like a change"}
          </button>
        </div>
      )}
      {mode === "error" ? (
        <p className="text-xs" role="alert">{fr ? "Ça n'a pas fonctionné — réessayez, ou répondez simplement à notre email." : "That didn't work — try again, or just reply to our email."}</p>
      ) : null}
    </div>
  );
}
