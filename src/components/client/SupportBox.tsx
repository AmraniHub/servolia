"use client";

import { useState } from "react";

/**
 * ASKING SERVOLIA FOR SOMETHING, FROM INSIDE THE PANEL.
 *
 * Every other card here ends in "tell us and we will sort it" — and until now
 * there was nowhere to tell us. A client had to leave, find an old email, and
 * remember which address it came from, which is exactly the friction that
 * turns a small request into no request and a quiet client into a lapsed one.
 *
 * It arrives on Telegram with the client already identified, so nobody has to
 * work out who wrote. The client is told what happens next and by when,
 * because "thanks, we'll be in touch" is how someone ends up asking twice.
 */

const T = {
  en: {
    title: "Ask us for anything",
    body: "Changes to your pages, a new photo, a question about your bill — write it here and it reaches us straight away.",
    placeholder: "What do you need?",
    send: "Send this to Servolia",
    sending: "Sending…",
    done: "We have it. We answer within one working day, to the email on your account.",
    failed: "That did not send. Email hello@servolia.com and we will pick it up there.",
    tooShort: "Tell us a little more so we can actually help.",
    orEmail: "Or email us directly:",
  },
  fr: {
    title: "Demandez-nous ce que vous voulez",
    body: "Une modification, une nouvelle photo, une question sur votre facture — écrivez-la ici et elle nous parvient immédiatement.",
    placeholder: "De quoi avez-vous besoin ?",
    send: "Envoyer à Servolia",
    sending: "Envoi…",
    done: "Bien reçu. Nous répondons sous un jour ouvré, à l'adresse de votre compte.",
    failed: "L'envoi n'a pas abouti. Écrivez à hello@servolia.com, nous le traiterons là.",
    tooShort: "Donnez-nous un peu plus de détails pour que nous puissions aider.",
    orEmail: "Ou écrivez-nous directement :",
  },
};

export default function SupportBox({
  token,
  lang,
  sample = false,
}: {
  token: string;
  lang: "en" | "fr";
  sample?: boolean;
}) {
  const t = T[lang];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sample) return;
    if (text.trim().length < 10) {
      setMsg({ good: false, text: t.tooShort });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/client-area?do=support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, message: text }),
      });
      const d = await r.json();
      if (!d.ok) {
        setMsg({ good: false, text: d.error || t.failed });
        return;
      }
      setText("");
      setMsg({ good: true, text: t.done });
    } catch {
      setMsg({ good: false, text: t.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7">
      <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-2">{t.title}</p>
      <p className="text-[14px] text-[#52525B] leading-relaxed mb-4">{t.body}</p>
      <form onSubmit={submit}>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.placeholder}
          maxLength={2000}
          disabled={sample}
          className="w-full px-3 py-2 rounded-lg border border-[#E2E6DD] bg-white text-[15px] leading-relaxed"
        />
        <button
          type="submit"
          disabled={sample || busy || text.trim().length < 10}
          className="mt-3 h-11 px-5 rounded-lg bg-[#36671E] text-white text-[14px] font-bold disabled:opacity-40"
        >
          {busy ? t.sending : t.send}
        </button>
      </form>
      {msg ? (
        <p className={`mt-3 text-[13.5px] leading-relaxed ${msg.good ? "text-[#36671E]" : "text-[#B45309]"}`}>
          {msg.text}
        </p>
      ) : null}
      <p className="mt-4 pt-4 border-t border-[#F0EFEA] text-[13px] text-[#8A8A80]">
        {t.orEmail}{" "}
        <a href="mailto:hello@servolia.com" className="font-bold text-[#36671E] hover:underline">
          hello@servolia.com
        </a>
      </p>
    </div>
  );
}
