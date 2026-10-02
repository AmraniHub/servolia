"use client";

import { useState } from "react";
import { Check, Lock } from "lucide-react";

const T = {
  en: {
    cta: (n: number) => `Switch to yearly — pay $${n} today`,
    ctaNoAmount: "Switch to yearly",
    working: "Switching…",
    doneTitle: "You're on yearly",
    doneBody:
      "The monthly charge has stopped and your confirmation is on its way by email.",
    secured: "Charged securely by Stripe, on the card already on file",
    confirmPayment: "Confirm the payment with my bank",
    errors: {
      "already-annual": "You're already on the yearly plan — nothing was charged.",
      "invalid-link": "This link is no longer valid. Ask us for a fresh one and it takes a second.",
      "not-active": "This subscription isn't active, so it can't be switched. Reply to your last email and we'll sort it.",
      "not-found": "We couldn't find this subscription. Reply to your last email and we'll sort it.",
      "unknown-plan": "Something is off with this plan on our side. Reply to your last email and we'll sort it.",
      "no-stripe": "Payments are briefly unavailable. Try again in a few minutes.",
      "payment-failed": "Your card was declined, so nothing changed: you're still on the monthly plan and nothing was charged. Update your card from your billing page, then try again.",
      "needs-authentication": "Your bank needs to confirm this payment. Open the payment page below and confirm it with your bank within 23 hours: the switch happens the moment it is confirmed. Until then nothing has changed and nothing has been charged.",
      error: "Something went wrong on our side. Nothing changed and nothing was charged — we've been told and will get back to you.",
      generic: "That didn't go through, and nothing was charged. Try again in a moment.",
    } as Record<string, string>,
  },
  fr: {
    cta: (n: number) => `Passer à l'année — payer ${n} $ aujourd'hui`,
    ctaNoAmount: "Passer à l'année",
    working: "En cours…",
    doneTitle: "Vous êtes en annuel",
    doneBody:
      "Le prélèvement mensuel est arrêté et votre confirmation arrive par email.",
    secured: "Débité en toute sécurité par Stripe, sur la carte déjà enregistrée",
    confirmPayment: "Confirmer le paiement auprès de ma banque",
    errors: {
      "already-annual": "Vous êtes déjà en annuel — rien n'a été débité.",
      "invalid-link": "Ce lien n'est plus valable. Demandez-nous-en un nouveau, c'est immédiat.",
      "not-active": "Cet abonnement n'est pas actif, le changement est impossible. Répondez à votre dernier email et on s'en occupe.",
      "not-found": "Abonnement introuvable. Répondez à votre dernier email et on s'en occupe.",
      "unknown-plan": "Il y a un souci de notre côté sur cette formule. Répondez à votre dernier email et on s'en occupe.",
      "no-stripe": "Le paiement est momentanément indisponible. Réessayez dans quelques minutes.",
      "payment-failed": "Votre carte a été refusée, donc rien n'a changé : vous restez en mensuel et rien n'a été débité. Mettez votre carte à jour depuis votre page de facturation, puis réessayez.",
      "needs-authentication": "Votre banque doit confirmer ce paiement. Ouvrez la page de paiement ci-dessous et confirmez-le auprès de votre banque sous 23 heures : le passage à l'année se fait dès la confirmation. D'ici là, rien n'a changé et rien n'a été débité.",
      error: "Un problème est survenu de notre côté. Rien n'a changé et rien n'a été débité — nous sommes prévenus et revenons vers vous.",
      generic: "Cela n'a pas abouti, et rien n'a été débité. Réessayez dans un instant.",
    } as Record<string, string>,
  },
};

export default function UpgradeConfirm({
  token,
  dueTodayUsd,
  lang = "en",
}: {
  token: string;
  /** Null when Stripe's preview was unavailable — the button then names no
   *  figure rather than one we are not sure of. */
  dueTodayUsd: number | null;
  lang?: "en" | "fr";
}) {
  const t = T[lang];
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  // 3-D Secure: Stripe's invoice page where the client confirms with their bank.
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  async function go() {
    setState("working");
    setError(null);
    setAuthUrl(null);
    try {
      const res = await fetch("/api/hosting-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setState("done");
        return;
      }
      const data = await res.json().catch(() => ({}));
      // 409 is "already yearly", which is a fine place to end up: show it as
      // the finished state, not as a failure.
      if (res.status === 409) {
        setState("done");
        setError(t.errors["already-annual"]);
        return;
      }
      setError(t.errors[data?.error] ?? t.errors.generic);
      if (data?.error === "needs-authentication" && typeof data.url === "string" && data.url.startsWith("https://")) setAuthUrl(data.url);
      setState("idle");
    } catch {
      setError(t.errors.generic);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[#CBE3BC] bg-[#F3F9EE] p-6 text-center">
        <Check className="w-9 h-9 mx-auto mb-3 text-[#36671E]" strokeWidth={2.5} />
        <p className="font-bold text-[#18181B] mb-1">{t.doneTitle}</p>
        <p className="text-sm text-[#52525B] leading-relaxed">{error ?? t.doneBody}</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={state === "working"}
        className="w-full h-12 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A] disabled:opacity-60 transition"
      >
        {state === "working"
          ? t.working
          : dueTodayUsd !== null
            ? t.cta(Math.round(dueTodayUsd))
            : t.ctaNoAmount}
      </button>
      {error ? <p className="mt-3 text-sm text-[#B91C1C] text-center">{error}</p> : null}
      {authUrl ? (
        <a href={authUrl} className="mt-3 flex items-center justify-center w-full h-11 rounded-xl border border-[#18181B] text-[#18181B] font-bold hover:bg-[#F4F4F2] transition">
          {t.confirmPayment}
        </a>
      ) : null}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#8A8A80]">
        <Lock className="w-3.5 h-3.5" /> {t.secured}
      </p>
    </div>
  );
}
