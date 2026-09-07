"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

const T = {
  en: {
    label: "The email address you pay with",
    placeholder: "your@email.com",
    send: "Email me the link",
    sending: "Sending…",
    /* Says the same thing whatever we found. The server deliberately gives one
       answer for a client, a non-client and a typo, so this must not imply
       that a link is definitely on its way to a real subscription. */
    sent: "If that address is on a monthly plan with us, the link is in your inbox now. It shows the exact amount before anything is charged.",
    bad: "That doesn't look like an email address.",
    generic: "That didn't send. Try again in a moment.",
  },
  fr: {
    label: "L'adresse email avec laquelle vous payez",
    placeholder: "votre@email.com",
    send: "M'envoyer le lien",
    sending: "Envoi…",
    sent: "Si cette adresse correspond à un abonnement mensuel chez nous, le lien est dans votre boîte mail. Il affiche le montant exact avant tout prélèvement.",
    bad: "Cela ne ressemble pas à une adresse email.",
    generic: "L'envoi a échoué. Réessayez dans un instant.",
  },
};

export default function UpgradeRequest({ lang = "en" }: { lang?: "en" | "fr" }) {
  const t = T[lang];
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "working" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!/.+@.+\..+/.test(email.trim())) {
      setError(t.bad);
      return;
    }
    setState("working");
    setError(null);
    try {
      const res = await fetch("/api/hosting-upgrade/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      setState("sent");
    } catch {
      setError(t.generic);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-[#E8E6E0] bg-white p-6 text-center">
        <Mail className="w-8 h-8 mx-auto mb-3 text-[#36671E]" />
        <p className="text-sm text-[#52525B] leading-relaxed">{t.sent}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white p-6">
      <label htmlFor="up-email" className="block text-[11px] font-black text-[#8A8A80] uppercase tracking-widest mb-2">
        {t.label}
      </label>
      <input
        id="up-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        placeholder={t.placeholder}
        className="w-full h-11 px-3 mb-3 text-sm border border-[#E8E6E0] rounded-lg bg-white focus:outline-none focus:border-[#36671E]"
      />
      <button
        onClick={send}
        disabled={state === "working"}
        className="w-full h-11 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A] disabled:opacity-60 transition"
      >
        {state === "working" ? t.sending : t.send}
      </button>
      {error ? <p className="mt-3 text-sm text-[#B91C1C] text-center">{error}</p> : null}
    </div>
  );
}
