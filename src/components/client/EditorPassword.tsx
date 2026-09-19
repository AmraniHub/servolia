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

/* ONE PASSWORD, TWO DOORS — and the copy has to say so.
 *
 * This is the same credential as the sign-in on this page: clientAreaAuth's
 * identify() checks it with the very same passwordMatchesFor(). Calling it
 * only "your editor password" made a client changing it think they were
 * changing something smaller than they were, and gave a client with no editor
 * a card that appeared to be about nothing they had.
 *
 * So which doors it opens is said plainly, and a client whose pages we edit
 * for them is told about the one door they actually use. */
const T = {
  en: {
    title: "Your password",
    bodyBoth: "One password opens this page and your website editor. It changes straight away, and the old one stops working everywhere.",
    bodySignIn: "The password you use to sign in to this page. It changes straight away, and the old one stops working.",
    doneBoth: "Saved. Use this one next time you sign in or open your editor — the old one no longer works.",
    doneSignIn: "Saved. Use this one next time you sign in — the old one no longer works.",
    label: "New password",
    hint: "At least 10 characters. A short sentence you will remember works better than something clever.",
    show: "Show",
    hide: "Hide",
    save: "Save my new password",
    saving: "Saving…",
    dropped: "The connection dropped. Nothing was changed.",
  },
  fr: {
    title: "Votre mot de passe",
    bodyBoth: "Un seul mot de passe ouvre cette page et l'éditeur de votre site. Il prend effet immédiatement, et l'ancien cesse de fonctionner partout.",
    bodySignIn: "Le mot de passe qui vous sert à vous connecter à cette page. Il prend effet immédiatement, et l'ancien cesse de fonctionner.",
    doneBoth: "Enregistré. Utilisez celui-ci pour vous connecter ou ouvrir votre éditeur — l'ancien ne fonctionne plus.",
    doneSignIn: "Enregistré. Utilisez celui-ci la prochaine fois que vous vous connectez — l'ancien ne fonctionne plus.",
    label: "Nouveau mot de passe",
    hint: "10 caractères minimum. Une petite phrase dont vous vous souvenez vaut mieux qu'un mot compliqué.",
    show: "Afficher",
    hide: "Masquer",
    save: "Enregistrer le mot de passe",
    saving: "Enregistrement…",
    dropped: "La connexion a été interrompue. Rien n'a été modifié.",
  },
};

/* `sample` renders the card on the example page with nothing wired up, so a
   prospect can see what a client gets without a real account existing. */
export default function EditorPassword(
  { token, lang, sample = false, withEditor = true }:
    { token: string; lang: "en" | "fr"; sample?: boolean; withEditor?: boolean },
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
      setMsg({ good: true, text: withEditor ? t.doneBoth : t.doneSignIn });
    } catch {
      setMsg({ good: false, text: t.dropped });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5">
      <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-3">{t.title}</p>
      <p className="text-[14px] text-[#52525B] leading-relaxed mb-4">{withEditor ? t.bodyBoth : t.bodySignIn}</p>
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
