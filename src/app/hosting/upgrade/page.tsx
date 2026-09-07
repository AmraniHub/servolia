import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { readUpgradeToken, buildUpgradeQuote } from "@/lib/upgrade";
import UpgradeConfirm from "@/components/UpgradeConfirm";
import UpgradeRequest from "@/components/UpgradeRequest";

export const metadata: Metadata = {
  title: "Switch to yearly",
  robots: { index: false, follow: false },
};

const T = {
  en: {
    heading: "Pay yearly, save",
    forLabel: "For",
    today: "You pay today",
    todayNote: (m: number) =>
      `The days you have already paid for this month are credited, so you are not charged twice. Your usual $${m} monthly charge stops.`,
    todayUnknown:
      "The exact amount is calculated when you confirm, with the days you have already paid for this month credited against it.",
    thenLabel: "Then",
    perYear: "a year, from",
    compare: (m: number, y: number, s: number) =>
      `$${m} a month is $${m * 12} over a year. Yearly is $${y} — you keep $${s}.`,
    noChange: "Nothing about the service changes. Same site, same support, cancel any time.",
    askTitle: "Switch to yearly",
    askBody:
      "Paying for the year costs less than paying month to month. Send yourself the link and it shows you the exact amount before anything is charged.",
    problems: {
      "already-annual": {
        title: "You're already on yearly",
        body: "Nothing to do, and nothing has been charged. Your next payment is a year from when you switched.",
      },
      "not-active": {
        title: "This subscription isn't active",
        body: "It may have been cancelled or the last payment may not have gone through. Reply to your last email from us and we'll sort it out.",
      },
      "not-found": {
        title: "We couldn't find this subscription",
        body: "The link may belong to an account that has since changed. Reply to your last email from us and we'll sort it out.",
      },
      "unknown-plan": {
        title: "Something is off on our side",
        body: "This plan isn't one we can switch automatically. Reply to your last email from us and we'll do it by hand.",
      },
      "no-stripe": {
        title: "Payments are briefly unavailable",
        body: "Nothing is wrong with your account. Try the link again in a few minutes.",
      },
    } as Record<string, { title: string; body: string }>,
  },
  fr: {
    heading: "Payez à l'année, économisez",
    forLabel: "Pour",
    today: "Vous payez aujourd'hui",
    todayNote: (m: number) =>
      `Les jours déjà réglés ce mois-ci sont crédités, vous ne payez donc pas deux fois. Votre prélèvement mensuel de ${m} $ s'arrête.`,
    todayUnknown:
      "Le montant exact est calculé au moment où vous confirmez, les jours déjà réglés ce mois-ci étant déduits.",
    thenLabel: "Ensuite",
    perYear: "par an, à partir du",
    compare: (m: number, y: number, s: number) =>
      `${m} $ par mois font ${m * 12} $ sur l'année. En annuel c'est ${y} $ — vous gardez ${s} $.`,
    noChange: "Rien ne change côté service. Même site, même accompagnement, résiliable à tout moment.",
    askTitle: "Passer à l'année",
    askBody:
      "Payer à l'année coûte moins cher que mois par mois. Envoyez-vous le lien : il affiche le montant exact avant tout prélèvement.",
    problems: {
      "already-annual": {
        title: "Vous êtes déjà en annuel",
        body: "Rien à faire, et rien n'a été débité. Votre prochain paiement tombe un an après votre passage à l'annuel.",
      },
      "not-active": {
        title: "Cet abonnement n'est pas actif",
        body: "Il a peut-être été résilié, ou le dernier paiement n'est pas passé. Répondez à notre dernier email et on s'en occupe.",
      },
      "not-found": {
        title: "Abonnement introuvable",
        body: "Ce lien correspond peut-être à un compte qui a changé depuis. Répondez à notre dernier email et on s'en occupe.",
      },
      "unknown-plan": {
        title: "Un souci de notre côté",
        body: "Cette formule ne peut pas être basculée automatiquement. Répondez à notre dernier email et on le fait à la main.",
      },
      "no-stripe": {
        title: "Paiement momentanément indisponible",
        body: "Rien d'anormal sur votre compte. Réessayez le lien dans quelques minutes.",
      },
    } as Record<string, { title: string; body: string }>,
  },
};

function Shell({ lang, children }: { lang: "en" | "fr"; children: React.ReactNode }) {
  const fr = lang === "fr";
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
      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-md mx-auto">{children}</div>
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

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; lang?: string }>;
}) {
  const { t: token = "", lang: langParam = "" } = await searchParams;

  /* No token: the client has lost the email. Offer to send a fresh link
     rather than asking for anything that could act on its own. */
  if (!token) {
    const lang = langParam === "fr" ? "fr" : "en";
    const t = T[lang];
    return (
      <Shell lang={lang}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#18181B] tracking-tight mb-3">{t.askTitle}</h1>
          <p className="text-[#52525B] leading-relaxed">{t.askBody}</p>
        </div>
        <UpgradeRequest lang={lang} />
      </Shell>
    );
  }

  const subscriptionId = await readUpgradeToken(token);
  const result = subscriptionId
    ? await buildUpgradeQuote(subscriptionId)
    : ({ problem: "not-found" } as const);

  if ("problem" in result) {
    const lang = langParam === "fr" ? "fr" : "en";
    const t = T[lang];
    const p = t.problems[result.problem] ?? t.problems["not-found"];
    return (
      <Shell lang={lang}>
        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
          <h1 className="text-xl font-black text-[#18181B] mb-2">{p.title}</h1>
          <p className="text-sm text-[#52525B] leading-relaxed">{p.body}</p>
        </div>
      </Shell>
    );
  }

  const q = result.quote;
  const t = T[q.lang];
  const fr = q.lang === "fr";
  const money = (n: number) => (fr ? `${n} $` : `$${n}`);
  const renewal = new Date(q.nextRenewalIso).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

  return (
    <Shell lang={q.lang}>
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-[34px] font-black text-[#18181B] tracking-tight mb-3">
          {t.heading} {money(q.savingUsd)}
        </h1>
        <p className="text-[#52525B] leading-relaxed">
          {t.compare(q.monthlyUsd, q.annualUsd, q.savingUsd)}
        </p>
      </div>

      <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden mb-6">
        {q.siteLabel ? (
          <div className="px-7 pt-6 pb-5 border-b border-[#F0EFEA] bg-[#FAFAF7]">
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">{t.forLabel}</p>
            <p className="text-[15px] font-bold text-[#18181B]">{q.heading} · {q.siteLabel}</p>
          </div>
        ) : null}

        <div className="px-7 py-6">
          {/* The two figures that decide it: what leaves the account now, and
              what the next one is. Anything else is noise at this moment. */}
          <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-2">{t.today}</p>
          {q.dueTodayUsd !== null ? (
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-[44px] leading-none font-black text-[#18181B] tracking-tight">
                {money(Math.round(q.dueTodayUsd))}
              </span>
            </div>
          ) : (
            <p className="text-sm text-[#52525B] leading-relaxed mb-3">{t.todayUnknown}</p>
          )}
          <p className="text-sm text-[#71717A] leading-relaxed">{t.todayNote(q.monthlyUsd)}</p>

          <div className="flex items-center gap-2 mt-6 pt-5 border-t border-[#F0EFEA] text-sm text-[#52525B]">
            <span className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest">{t.thenLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#A8A8A0]" />
            <span><strong className="text-[#18181B]">{money(q.annualUsd)}</strong> {t.perYear} {renewal}</span>
          </div>
        </div>
      </div>

      <UpgradeConfirm token={token} dueTodayUsd={q.dueTodayUsd} lang={q.lang} />

      <p className="mt-6 text-center text-xs text-[#8A8A80] leading-relaxed">{t.noChange}</p>
    </Shell>
  );
}
