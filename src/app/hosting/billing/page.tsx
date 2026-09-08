import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

/**
 * Where the billing portal sends people — on the way back out, and when the
 * link could not be used.
 *
 * Deliberately has no form and no way in. The route into billing is always a
 * signed link in an email to the address on the subscription; offering a box
 * here that took an email address would be a way to test whether a given
 * business is a client, and would put a cancel button behind nothing more than
 * knowing an address.
 */
const T = {
  en: {
    done: {
      title: "Billing updated",
      body: "Anything you changed is saved with Stripe and already in effect. Your service was not interrupted.",
    },
    "invalid-link": {
      title: "This link has expired",
      body: "Billing links are tied to your subscription and do not last forever. Reply to any email from us and we will send a fresh one — it takes a second.",
    },
    unavailable: {
      title: "Billing is briefly unavailable",
      body: "Nothing is wrong with your account and nothing has changed. Try the link again in a few minutes, or reply to any email from us.",
    },
    back: "Back to Servolia",
  },
  fr: {
    done: {
      title: "Facturation mise à jour",
      body: "Vos modifications sont enregistrées chez Stripe et déjà actives. Votre service n'a pas été interrompu.",
    },
    "invalid-link": {
      title: "Ce lien a expiré",
      body: "Les liens de facturation sont liés à votre abonnement et ne durent pas indéfiniment. Répondez à n'importe lequel de nos emails et nous vous en envoyons un nouveau — c'est immédiat.",
    },
    unavailable: {
      title: "Facturation momentanément indisponible",
      body: "Rien d'anormal sur votre compte et rien n'a changé. Réessayez le lien dans quelques minutes, ou répondez à l'un de nos emails.",
    },
    back: "Retour sur Servolia",
  },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; done?: string; lang?: string }>;
}) {
  const { problem = "", done = "", lang = "" } = await searchParams;
  const fr = lang === "fr";
  const t = T[fr ? "fr" : "en"];

  const ok = done === "1";
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
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A]"
          >
            {t.back}
          </Link>
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
