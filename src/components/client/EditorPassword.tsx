"use client";

import { useState } from "react";

/**
 * A client choosing their own website-editor password.
 *
 * Until now we generated one and sent it, which is fine once and wrong
 * afterwards: a password the owner cannot change is not really theirs, and the
 * one we sent is written in whatever chat we sent it through, forever.
 *
 * Deliberately not asking for the current password. Someone opening this has
 * usually forgotten it — that is what brought them here — and the signed link
 * that opened this page already proves they hold the mailbox on the
 * subscription. Asking for the old one would refuse the only case that matters.
 */

const T = {
  en: {
    title: "Your website editor password",
    body: "Choose the password you use to edit your pages. It changes straight away, and the old one stops working.",
    label: "New password",
    hint: "At least 10 characters. A short sentence you will remember works better than something clever.",
    show: "Show",
    hide: "Hide",
    save: "Save my new password",
    saving: "Saving…",
    done: "Saved. Use this password next time you open your editor — the old one no longer works.",
    dropped: "The connection dropped. Nothing was changed.",
  },
  fr: {
    title: "Mot de passe de votre éditeur",
    body: "Choisissez le mot de passe qui vous sert à modifier vos pages. Il prend effet immédiatement, et l'ancien cesse de fonctionner.",
    label: "Nouveau mot de passe",
    hint: "10 caractères minimum. Une petite phrase dont vous vous souvenez vaut mieux qu'un mot compliqué.",
    show: "Afficher",
    hide: "Masquer",
    save: "Enregistrer le mot de passe",
    saving: "Enregistrement…",
    done: "Enregistré. Utilisez ce mot de passe la prochaine fois — l'ancien ne fonctionne plus.",
    dropped: "La connexion a été interrompue. Rien n'a été modifié.",
  },
};

/* `sample` renders the card on the example page with nothing wired up, so a
   prospect can see what a client gets without a real account existing. */
export default function EditorPassword(
  { token, lang, sample = false }: { token: string; lang: "en" | "fr"; sample?: boolean },
) {
  const t = T[lang];
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sample) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/client-area?do=set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, password }),
      });
      const d = await r.json();
      if (!d.ok) {
        setMsg({ good: false, text: d.error || t.dropped });
        return;
      }
      setPassword("");
      setShown(false);
      setMsg({ good: true, text: t.done });
    } catch {
      setMsg({ good: false, text: t.dropped });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5">
      <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-3">{t.title}</p>
      <p className="text-[14px] text-[#52525B] leading-relaxed mb-4">{t.body}</p>
      <form onSubmit={submit}>
        <label className="block text-[13px] font-bold text-[#18181B] mb-1.5" htmlFor="new-editor-password">
          {t.label}
        </label>
        <div className="relative">
          <input
            id="new-editor-password"
            type={shown ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={sample}
            className="w-full h-11 pl-3 pr-16 rounded-lg border border-[#E2E6DD] bg-white text-[15px] disabled:bg-[#FAFAF7]"
          />
          {/* Shown on request, because a password typed blind on a phone is
              the reason half of these get typed wrong twice. */}
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-[#36671E] px-2 py-1"
          >
            {shown ? t.hide : t.show}
          </button>
        </div>
        <p className="mt-1.5 text-[12.5px] text-[#8A8A80] leading-relaxed">{t.hint}</p>
        <button
          type="submit"
          disabled={sample || busy || password.length < 10}
          className="mt-4 w-full h-11 rounded-lg bg-[#36671E] text-white font-bold disabled:opacity-40"
        >
          {busy ? t.saving : t.save}
        </button>
      </form>
      {msg ? (
        <p className={`mt-3 text-[13.5px] leading-relaxed ${msg.good ? "text-[#36671E]" : "text-[#B45309]"}`}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
