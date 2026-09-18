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
    email: "Your email",
    password: "Password",
    hint: "The same password you use to edit your website.",
    submit: "Sign in",
    busy: "Checking…",
    expired: "That link has expired — signing in works just as well.",
    dropped: "The connection dropped. Try again.",
    noPassword: "No password yet? Reply to any email from us and we will set one up.",
  },
  fr: {
    title: "Votre service",
    body: "Connectez-vous pour voir votre formule, les fichiers de votre site et votre mot de passe d'éditeur.",
    email: "Votre email",
    password: "Mot de passe",
    hint: "Le même mot de passe que pour modifier votre site.",
    submit: "Se connecter",
    busy: "Vérification…",
    expired: "Ce lien a expiré — la connexion fonctionne tout aussi bien.",
    dropped: "La connexion a été interrompue. Réessayez.",
    noPassword: "Pas encore de mot de passe ? Répondez à l'un de nos emails et nous vous en créons un.",
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
          id="client-email" type="email" value={email} autoComplete="email" required
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
    </div>
  );
}
