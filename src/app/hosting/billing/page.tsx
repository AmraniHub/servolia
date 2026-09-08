import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { PORTAL_LOGIN_URL } from "@/lib/clientPortal";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

/**
 * Where the billing portal sends people — on the way back out, and when the
 * link could not be used.
 *
 * It takes no email address of its own. A box here would be a way to test
 * whether a given business is a client, and would put a cancel button behind
 * nothing more than knowing an address. When a link has expired it hands the
 * client to STRIPE'S login page instead: Stripe collects the address, answers
 * identically whether or not it belongs to a customer, and emails a way in
 * only if it does. Same guarantee, and none of it is ours to get wrong.
 */
const T = {
  en: {
    done: {
      title: "Billing updated",
      body: "Anything you changed is saved with Stripe and already in effect. Your service was not interrupted.",
    },
    "invalid-link": {
      title: "This link has expired",
      body: "Billing links do not last forever. Sign in with the email address you pay with and you will be straight back in.",
    },
    unavailable: {
      title: "Billing is briefly unavailable",
      body: "Nothing is wrong with your account and nothing has changed. Try again in a few minutes, or sign in with the email address you pay with.",
    },
    signIn: "Sign in with your billing email",
    signInNote: "We will email you a secure link. No password.",
    back: "Back to Servolia",
  },
  fr: {
    done: {
      title: "Facturation mise à jour",
      body: "Vos modifications sont enregistrées chez Stripe et déjà actives. Votre service n'a pas été interrompu.",
    },
    "invalid-link": {
      title: "Ce lien a expiré",
      body: "Les liens de facturation ne durent pas indéfiniment. Connectez-vous avec l'adresse email avec laquelle vous payez et vous y serez de nouveau.",
    },
    unavailable: {
      title: "Facturation momentanément indisponible",
      body: "Rien d'anormal sur votre compte et rien n'a changé. Réessayez dans quelques minutes, ou connectez-vous avec l'adresse email avec laquelle vous payez.",
    },
    signIn: "Se connecter avec mon email de facturation",
    signInNote: "Nous vous envoyons un lien sécurisé par email. Sans mot de passe.",
    back: "Retour sur Servolia",
  },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; done?: string; lang?: string }>;
}) {
  const { problem = "", done = "", lang = "" } = await searchParams;

  /* Language: the parameter first, then the browser.
   *
   * Every portal session this codebase creates passes a return_url carrying
   * ?lang=, so those always land correct. The exception is Stripe's no-code
   * portal link, which sends everyone to the ONE default URL configured in the
   * dashboard — a single string that cannot carry a per-client language. Left
   * at the parameter alone, a French client returning through that route would
   * read English.
   *
   * Falling back to Accept-Language means the configured default needs no
   * language in it and never needs revisiting: one URL, right for both.
   */
  const fr =
    lang === "fr" ||
    (lang === "" && /(^|,)\s*fr\b/i.test((await headers()).get("accept-language") ?? ""));
  const t = T[fr ? "fr" : "en"];

  /* Success is the DEFAULT, and a problem has to be named explicitly.
   *
   * The reverse — treating anything without ?done=1 as a failure — meant the
   * bare URL said "this link has expired" to someone who had just finished
   * updating their card perfectly well. That matters because this address is
   * pasted into a Stripe dashboard field by hand: if the query string is ever
   * dropped, trimmed, or simply typed without it, the client is told their
   * link is broken at the exact moment it worked. Only our own redirect sets
   * `problem`, and it always sets it, so nothing real is lost by defaulting
   * the other way.
   */
  void done;
  const ok = !problem;
  const copy = ok ? t.done : (t[problem as "invalid-link" | "unavailable"] ?? t["invalid-link"]);

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-md mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-20">
        <div className="max-w-md mx-auto text-center">
          {ok ? (
            <CheckCircle2 className="w-14 h-14 text-[#16A34A] mx-auto mb-5" />
          ) : (
            <AlertCircle className="w-14 h-14 text-[#A8A8A0] mx-auto mb-5" />
          )}
          <h1 className="text-2xl font-black text-[#18181B] mb-3">{copy.title}</h1>
          <p className="text-[#52525B] leading-relaxed mb-8">{copy.body}</p>
          {/* On a failure this is the way back in, so it leads. On success the
              client has just come from the portal and does not need sending
              there again. */}
          {ok ? (
            <Link
              href="/"
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A]"
            >
              {t.back}
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <a
                href={PORTAL_LOGIN_URL}
                className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A]"
              >
                {t.signIn}
              </a>
              <p className="text-xs text-[#8A8A80]">{t.signInNote}</p>
              <Link href="/" className="text-sm text-[#71717A] hover:text-[#18181B] underline underline-offset-4">
                {t.back}
              </Link>
            </div>
          )}
        </div>
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-md mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">
            {fr ? "Facturé par " : "Billed by "}
            <span className="font-bold text-[#52525B]">Servolia</span>
            {fr ? " · Paiement traité par Stripe" : " · Payments processed by Stripe"}
          </p>
        </div>
      </footer>
    </main>
  );
}
