"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";

type EmailSignupProps = {
  language?: "en" | "fr";
  source: "footer" | "exit-popup";
  compact?: boolean;
};

export default function EmailSignup({ language = "en", source, compact = false }: EmailSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const isFrench = language === "fr";

  const copy = isFrench
    ? { title: "Recevez nos idées de croissance", description: "Conseils IA et offres réservées, 1 à 2 fois par mois.", placeholder: "vous@entreprise.com", submit: "S’inscrire", success: "Vous êtes inscrit(e).", error: "Impossible de vous inscrire. Réessayez.", consent: "Vous pouvez vous désinscrire à tout moment." }
    : { title: "Get practical growth ideas", description: "AI growth tips and occasional offers, 1–2 times a month.", placeholder: "you@business.com", submit: "Subscribe", success: "You’re on the list.", error: "We couldn’t subscribe you. Please try again.", consent: "Unsubscribe anytime." };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, language, consent: true }),
      });
      if (!response.ok) throw new Error("Subscription failed");
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={compact ? "" : "rounded-xl border border-[#36671E]/20 bg-[#EEF5EA]/50 p-4"}>
      <div className="flex items-start gap-2">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#36671E]" />
        <div>
          <p className="text-sm font-bold text-[#18181B]">{copy.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#52525B]">{copy.description}</p>
        </div>
      </div>
      {/*
        Always stacked, never side-by-side: this form only ever renders inside
        a narrow footer column (~200px), not a full-width section. A row
        layout at "sm:" reacts to VIEWPORT width, not this container's actual
        width, so on any normal desktop screen it used to squeeze the input
        and button into that ~200px together — the input rendered wide enough
        to show only "you@" of the placeholder before the button ate the rest.
      */}
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.placeholder}
          aria-label={copy.placeholder}
          className="w-full min-w-0 rounded-lg border border-[#D4D2CC] bg-white px-3 py-2 text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:border-[#36671E] focus:outline-none"
        />
        <button type="submit" disabled={status === "loading"} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#36671E] px-3 py-2 text-sm font-bold text-[#FAFAF7] transition-colors hover:bg-[#295115] disabled:opacity-50">
          {status === "loading" ? "…" : <>{copy.submit} <ArrowRight className="h-3.5 w-3.5" /></>}
        </button>
      </form>
      <p aria-live="polite" className={`mt-2 text-[11px] ${status === "error" ? "text-[#B91C1C]" : status === "success" ? "text-[#166534]" : "text-[#71717A]"}`}>
        {status === "success" ? copy.success : status === "error" ? copy.error : copy.consent}
      </p>
    </div>
  );
}
