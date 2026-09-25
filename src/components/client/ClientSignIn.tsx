"use client";

import { useState } from "react";

/**
 * A hosting client signing in to their own service page.
 *
 * Until now this page opened only from a signed link in an email — fine the
 * day it arrives, useless four months later when someone wants to check their
 * renewal date and ends up asking us instead. Which is the exact outcome a
 * self-service page exists to prevent.
 *
 * The password is the one they already use for their page editor. A client
 * given two passwords for the two screens we built them keeps neither.
 */

const T = {
  en: {
    title: "Your service",
    body: "Sign in to see your plan, your website's files, and your editor password.",
    email: "Your email or website address",
    password: "Password",
    hint: "The same password you use to edit your website.",
    submit: "Sign in",
    busy: "Checking…",
    expired: "That link has expired — signing in works just as well.",
    dropped: "The connection dropped. Try again.",
    noPassword: "No password yet? Reply to any email from us and we will set one up.",
    linkTitle: "No password? Get your link by email",
    linkBody: "Enter the address you paid with. If it has a Servolia hosting plan, we email the link to your service page there.",
    linkSubmit: "Email me my link",
    linkBusy: "Sending…",
    linkSent: "If that address has a Servolia hosting plan, the link is on its way. Check your inbox (and spam) in a minute.",
    linkInvalid: "That does not look like an email address.",
    linkTooMany: "Too many requests from here. Try again in an hour.",
  },
  fr: {
    title: "Votre service",
    body: "Connectez-vous pour voir votre formule, les fichiers de votre site et votre mot de passe d'éditeur.",
    email: "Votre email ou adresse de site",
    password: "Mot de passe",
    hint: "Le même mot de passe que pour modifier votre site.",
    submit: "Se connecter",
    busy: "Vérification…",
    expired: "Ce lien a expiré — la connexion fonctionne tout aussi bien.",
    dropped: "La connexion a été interrompue. Réessayez.",
    noPassword: "Pas encore de mot de passe ? Répondez à l'un de nos emails et nous vous en créons un.",
    linkTitle: "Pas de mot de passe ? Recevez votre lien par email",
    linkBody: "Indiquez l'adresse avec laquelle vous avez payé. Si elle a une formule d'hébergement Servolia, nous y envoyons le lien vers votre page de service.",
    linkSubmit: "M'envoyer mon lien",
    linkBusy: "Envoi…",
    linkSent: "Si cette adresse a une formule d'hébergement Servolia, le lien est en route. Regardez votre boîte (et les spams) d'ici une minute.",
    linkInvalid: "Cette adresse email ne semble pas valide.",
    linkTooMany: "Trop de demandes depuis cette connexion. Réessayez dans une heure.",
  },
};

export default function ClientSignIn({ lang, hadToken }: { lang: "en" | "fr"; hadToken: boolean }) {
  const t = T[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/client-area?do=signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || t.dropped);
        return;
      }
      // Reload rather than route: the page is a server component and reads the
      // new cookie only on a fresh request.
      window.location.href = "/hosting/account";
    } catch {
      setError(t.dropped);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7">
      <h1 className="text-xl font-black text-[#18181B] mb-1">{t.title}</h1>
      <p className="text-[14px] text-[#52525B] leading-relaxed mb-5">{t.body}</p>
      {hadToken ? (
        <p className="mb-4 rounded-xl border border-[#F5E3B3] bg-[#FEF7E7] px-4 py-3 text-[13px] text-[#92700E]">
          {t.expired}
        </p>
      ) : null}
      <form onSubmit={submit}>
        <label className="block text-[13px] font-bold text-[#18181B] mb-1.5" htmlFor="client-email">{t.email}</label>
        <input
          id="client-email" type="text" inputMode="email" value={email} autoComplete="username" required
          placeholder="you@example.com  ·  yoursite.com"
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-11 px-3 rounded-lg border border-[#E2E6DD] bg-white text-[15px] mb-3"
        />
        <label className="block text-[13px] font-bold text-[#18181B] mb-1.5" htmlFor="client-password">{t.password}</label>
        <input
          id="client-password" type="password" value={password} autoComplete="current-password" required
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-11 px-3 rounded-lg border border-[#E2E6DD] bg-white text-[15px]"
        />
        <p className="mt-1.5 mb-4 text-[12.5px] text-[#8A8A80]">{t.hint}</p>
        <button
          type="submit" disabled={busy || !email || !password}
          className="w-full h-11 rounded-lg bg-[#36671E] text-white font-bold disabled:opacity-40"
        >
          {busy ? t.busy : t.submit}
        </button>
      </form>
      {error ? <p className="mt-3 text-[13.5px] text-[#B45309]">{error}</p> : null}
      <p className="mt-4 text-[12.5px] text-[#8A8A80] leading-relaxed">{t.noPassword}</p>
      <EmailMyLink lang={lang} />
    </div>
  );
}

/**
 * The way back in for a client with no password: the signed link, emailed to
 * the address on their plan. The answer on screen is the same whether or not
 * the address is a client (see /api/hosting-account/link).
 */
function EmailMyLink({ lang }: { lang: "en" | "fr" }) {
  const t = T[lang];
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/hosting-account/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.status === 429) setMsg({ ok: false, text: t.linkTooMany });
      else if (r.status === 400) setMsg({ ok: false, text: t.linkInvalid });
      else if (r.ok) setMsg({ ok: true, text: t.linkSent });
      else setMsg({ ok: false, text: t.dropped });
    } catch {
      setMsg({ ok: false, text: t.dropped });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-5 pt-5 border-t border-[#F0EFEA]" data-testid="email-my-link">
      <p className="text-[13.5px] font-bold text-[#18181B] mb-1">{t.linkTitle}</p>
      <p className="text-[12.5px] text-[#71717A] leading-relaxed mb-3">{t.linkBody}</p>
      <div className="flex gap-2">
        <input
          type="email" value={email} required autoComplete="email" placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)}
          aria-label={t.linkTitle}
          className="min-w-0 flex-1 h-10 px-3 rounded-lg border border-[#E2E6DD] bg-white text-[14px]"
        />
        <button type="submit" disabled={busy || !email} className="h-10 px-4 rounded-lg border border-[#36671E] text-[#36671E] text-[13px] font-bold disabled:opacity-40 shrink-0">
          {busy ? t.linkBusy : t.linkSubmit}
        </button>
      </div>
      {msg ? <p className={`mt-2 text-[12.5px] ${msg.ok ? "text-[#36671E]" : "text-[#B45309]"}`}>{msg.text}</p> : null}
    </form>
  );
}
