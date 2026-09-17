"use client";

import { useState } from "react";

/**
 * The one click that starts the on-site trial. Posts the hosting token it
 * was given, then says what happened in the client's own language. It never
 * retries on its own: a second POST is harmless (a running trial is
 * returned, not restarted), but a button that fires twice reads as broken.
 */
export default function StartTrialButton({
  token,
  lang,
  siteLabel,
  demo = false,
}: {
  token: string;
  lang: "en" | "fr";
  siteLabel: string;
  /**
   * Walk-through mode: the button behaves exactly as a client's would and
   * starts NOTHING. It exists because the real one is signed per client, so
   * the only way to see this page as they see it would otherwise be to run a
   * real trial on a real client's live website.
   */
  demo?: boolean;
}) {
  const fr = lang === "fr";
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [until, setUntil] = useState<string>("");
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string>("");

  async function start() {
    setState("busy");
    if (demo) {
      // The same pause a real one takes, so the walk-through feels honest.
      await new Promise((r) => setTimeout(r, 700));
      setUntil(new Date(Date.now() + 7 * 86_400_000).toISOString());
      setInstalled(true);
      setState("done");
      return;
    }
    try {
      const r = await fetch("/api/assistant-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) {
        setUntil(j.until ?? "");
        setInstalled(j.installed ?? null);
        setState("done");
      } else {
        setReason(String(j?.reason ?? "error"));
        setState("error");
      }
    } catch {
      setReason("network");
      setState("error");
    }
  }

  if (state === "done") {
    const day = until ? new Date(until).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long" }) : "";
    return (
      <div className="rounded-2xl border border-[#CBE3BC] bg-[#F3F9EE] p-5" data-testid="trial-started">
        {demo ? (
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8A8A80] mb-2">
            {fr ? "Démonstration — rien n'a été lancé" : "Walk-through — nothing was started"}
          </p>
        ) : null}
        <p className="font-bold text-[#161A15]">
          {fr ? `Il est en ligne sur ${siteLabel}` : `It is live on ${siteLabel}`}
        </p>
        <p className="text-[14px] text-[#3F3F46] leading-relaxed mt-1">
          {installed === false
            ? (fr
                ? "L'essai a commencé, mais la ligne n'a pas pu être ajoutée à vos pages automatiquement — elle est sur votre page de réglages, prête à coller, et nous vous l'avons envoyée par email."
                : "The trial has started, but the line could not be added to your pages automatically — it is on your settings page, ready to paste, and we have emailed it to you.")
            : (fr
                ? `Jusqu'au ${day}. Chaque demande qu'il prend arrive sur votre téléphone. Ce jour-là il se retire de lui-même, sauf si vous le gardez — nous vous l'avons écrit par email.`
                : `Until ${day}. Every enquiry it takes reaches your phone. That day it steps back on its own unless you keep it — we have put this in writing by email.`)}
        </p>
        {demo ? null : (
          <a
            href={`https://${siteLabel}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center mt-3 text-[14px] font-bold text-[#36671E] hover:underline"
          >
            {fr ? "Voir mon site →" : "See my site →"}
          </a>
        )}
      </div>
    );
  }

  const reasons: Record<string, string> = fr
    ? {
        "already-paid": "Votre assistant est déjà actif — il n'y a rien à essayer.",
        ended: "Votre semaine d'essai a déjà eu lieu. Pour le remettre en ligne, activez-le.",
        "not-hosting-client": "L'essai est réservé aux sites hébergés chez Servolia.",
        "no-brief": "Votre assistant n'est pas encore construit — répondez à notre email et nous nous en occupons.",
        network: "La connexion a échoué. Réessayez dans un instant.",
      }
    : {
        "already-paid": "Your assistant is already active — there is nothing to try.",
        ended: "Your trial week has already happened. To put it back, turn it on.",
        "not-hosting-client": "The trial is for sites hosted with Servolia.",
        "no-brief": "Your assistant is not built yet — reply to our email and we will take care of it.",
        network: "The connection failed. Try again in a moment.",
      };

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={state === "busy"}
        data-testid="trial-start"
        className="inline-flex items-center justify-center h-12 px-7 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-[15px] font-bold hover:opacity-90 transition disabled:opacity-60"
      >
        {state === "busy"
          ? (fr ? "Activation…" : "Starting…")
          : (fr ? "Lancer mes 7 jours d'essai →" : "Start my 7-day trial →")}
      </button>
      {state === "error" ? (
        <p className="mt-3 text-[13.5px] text-[#B45309]" data-testid="trial-error">
          {reasons[reason] ?? (fr ? "Cela n'a pas fonctionné. Répondez à notre email et nous nous en occupons." : "That did not work. Reply to our email and we will take care of it.")}
        </p>
      ) : null}
    </div>
  );
}
