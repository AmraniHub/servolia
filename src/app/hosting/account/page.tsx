import type { Metadata } from "next";
import Link from "next/link";
import { Check, ExternalLink, FileText, ArrowUpRight } from "lucide-react";
import { readUpgradeToken, subscriptionContext } from "@/lib/upgrade";
import { productCopy, CLIENT_PRODUCTS } from "@/lib/hosting";

export const metadata: Metadata = {
  title: "Your service",
  robots: { index: false, follow: false },
};

/**
 * THE CLIENT'S OWN PAGE, IN OUR NAME.
 *
 * Stripe's billing portal answers "what am I paying and how do I stop". That
 * is a billing question. A client deciding whether they are dealing with a
 * real company is asking a different one — what am I getting, from whom, and
 * until when — and being handed straight to a Stripe screen answers it with
 * somebody else's brand.
 *
 * So this is the front door and Stripe is a room inside it.
 *
 * Every figure comes from STRIPE, live, not from our database and not from
 * arithmetic. The renewal date in particular is read off the subscription item
 * rather than computed from the purchase date, because a client who has
 * changed plan, been credited, or had a failed payment retried has a real date
 * that our maths would not reproduce. On the one page whose job is to be
 * trusted, a plausible-looking wrong date costs more than no date.
 *
 * Reached by the same signed link as the rest: no password, no account to
 * create, delivered only to the address on the subscription.
 */

const T = {
  en: {
    heading: "Your service",
    forLabel: "Site",
    statusActive: "Active",
    statusPastDue: "Payment due",
    statusEnding: "Ends at the end of this period",
    statusOther: "Inactive",
    plan: "Plan",
    renews: "Renews",
    renewsNever: "—",
    endsOn: "Runs until",
    included: "What this covers",
    manage: "Manage billing & invoices",
    manageNote: "Change your card, download invoices, or cancel — no need to ask us.",
    terms: "What you get, in full",
    upgrade: "Pay yearly and save",
    provider: "Provided by Servolia LLC · Wyoming, USA",
    help: "Questions? Reply to any email from us.",
    problem: {
      title: "This link has expired",
      body: "Service links do not last forever. Reply to any email from us and we will send a fresh one.",
    },
  },
  fr: {
    heading: "Votre service",
    forLabel: "Site",
    statusActive: "Actif",
    statusPastDue: "Paiement en attente",
    statusEnding: "Se termine à la fin de la période",
    statusOther: "Inactif",
    plan: "Formule",
    renews: "Renouvellement",
    renewsNever: "—",
    endsOn: "Actif jusqu'au",
    included: "Ce que cela comprend",
    manage: "Facturation et factures",
    manageNote: "Changez de carte, téléchargez vos factures ou résiliez — sans nous contacter.",
    terms: "Le détail de la prestation",
    upgrade: "Passer à l'année et économiser",
    provider: "Fourni par Servolia LLC · Wyoming, USA",
    help: "Une question ? Répondez à n'importe lequel de nos emails.",
    problem: {
      title: "Ce lien a expiré",
      body: "Les liens de service ne durent pas indéfiniment. Répondez à l'un de nos emails et nous vous en envoyons un nouveau.",
    },
  },
};

function Shell({ lang, children }: { lang: "en" | "fr"; children: React.ReactNode }) {
  const t = T[lang];
  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-lg mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>
      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-lg mx-auto">{children}</div>
      </div>
      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">{t.provider}</p>
        </div>
      </footer>
    </main>
  );
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; demo?: string; lang?: string }>;
}) {
  const { t: token = "", demo = "", lang: demoLang = "" } = await searchParams;

  /* ?demo=1 — the page with INVENTED data, so it can be looked at before any
   * client exists and shown to a prospect without opening someone's account.
   *
   * Safe to leave reachable: it reads nothing. Every value below is written
   * here, no token is accepted, and no subscription is fetched — so there is
   * no real client whose details it could show by mistake. It is also banner-
   * marked and noindex, because a sample that can be mistaken for a live
   * account is worse than no sample.
   */
  const isDemo = demo === "1";
  const ctx = isDemo
    ? {
        plan: CLIENT_PRODUCTS.hosting,
        lang: (demoLang === "fr" ? "fr" : "en") as "en" | "fr",
        ref: "goodscochina",
        siteLabel: "goodscochina.com",
        interval: "year" as const,
        status: "active",
        /* A FIXED date, not now-plus-a-year. Reading the clock during render
           is impure and the lint rule is right to refuse it; a sample also
           reads better when it does not quietly change every day. */
        renewsAt: "2027-09-09T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        amountCents: CLIENT_PRODUCTS.hosting.annualUsd * 100,
      }
    : token
      ? await (async () => {
          const id = await readUpgradeToken(token);
          return id ? await subscriptionContext(id) : null;
        })()
      : null;

  if (!ctx) {
    const t = T.en;
    return (
      <Shell lang="en">
        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
          <h1 className="text-xl font-black text-[#18181B] mb-2">{t.problem.title}</h1>
          <p className="text-sm text-[#52525B] leading-relaxed">{t.problem.body}</p>
        </div>
      </Shell>
    );
  }

  const t = T[ctx.lang];
  const fr = ctx.lang === "fr";
  const copy = productCopy(ctx.plan, ctx.lang);

  const money = (n: number) => (fr ? `${n} $` : `$${n}`);
  const amount = ctx.amountCents !== null ? Math.round(ctx.amountCents / 100) : null;
  const per = ctx.interval === "year" ? (fr ? "an" : "year") : (fr ? "mois" : "month");
  const date = ctx.renewsAt
    ? new Date(ctx.renewsAt).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      })
    : null;

  /* Three states worth distinguishing. "Cancelled but still running" is the
     one people get wrong: showing Active is a lie, showing Inactive frightens
     someone whose site is still perfectly up. */
  const ending = ctx.cancelAtPeriodEnd;
  const active = ctx.status === "active" || ctx.status === "trialing";
  const pastDue = ctx.status === "past_due" || ctx.status === "unpaid";
  const label = ending ? t.statusEnding : pastDue ? t.statusPastDue : active ? t.statusActive : t.statusOther;
  const tone = ending
    ? "bg-[#FEF7E7] text-[#92700E] border-[#F5E3B3]"
    : pastDue
      ? "bg-[#FDECEC] text-[#B91C1C] border-[#F5C6C6]"
      : active
        ? "bg-[#F3F9EE] text-[#36671E] border-[#CBE3BC]"
        : "bg-[#F4F4F0] text-[#71717A] border-[#E8E6E0]";

  // Only where the year genuinely beats twelve months, and only when monthly.
  const saving = Math.round(ctx.plan.monthlyUsd * 12 - ctx.plan.annualUsd);
  const showUpgrade = ctx.interval === "month" && saving > 0 && active && !ending;

  return (
    <Shell lang={ctx.lang}>
      {isDemo ? (
        <div className="mb-6 rounded-xl border border-[#F5E3B3] bg-[#FEF7E7] px-4 py-3 text-[13px] text-[#92700E]">
          <strong className="font-bold">Example page.</strong> Sample figures, not a real account.
        </div>
      ) : null}
      <h1 className="text-3xl font-black text-[#18181B] tracking-tight mb-7">{t.heading}</h1>

      <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden mb-5">
        <div className="px-7 py-6 border-b border-[#F0EFEA] bg-[#FAFAF7] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">{t.forLabel}</p>
            <p className="text-[17px] font-bold text-[#18181B] truncate">{ctx.siteLabel || copy.heading}</p>
          </div>
          <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${tone}`}>{label}</span>
        </div>

        <dl className="px-7 py-6 space-y-4 text-[15px]">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[#71717A]">{t.plan}</dt>
            <dd className="font-bold text-[#18181B] text-right">
              {copy.heading}
              {amount !== null ? <> · {money(amount)} / {per}</> : null}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[#71717A]">{ending ? t.endsOn : t.renews}</dt>
            <dd className="font-bold text-[#18181B] tabular-nums">{date ?? t.renewsNever}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5">
        <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-4">{t.included}</p>
        <ul className="space-y-2.5">
          {copy.includes.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[15px] text-[#3F3F46]">
              <Check className="w-4 h-4 text-[#36671E] mt-1 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {showUpgrade ? (
        <Link
          href={`/hosting/upgrade?t=${encodeURIComponent(token)}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#CBE3BC] bg-[#F7FBF4] px-6 py-5 mb-5 hover:bg-[#F3F9EE] transition"
        >
          <span className="font-bold text-[#18181B]">{t.upgrade} {money(saving)}</span>
          <ArrowUpRight className="w-4 h-4 text-[#36671E] shrink-0" />
        </Link>
      ) : null}

      <a
        href={`/api/billing-portal?t=${encodeURIComponent(token)}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8E6E0] bg-white px-6 py-5 mb-3 hover:border-[#CBC9C2] transition"
      >
        <span>
          <span className="block font-bold text-[#18181B]">{t.manage}</span>
          <span className="block text-[13px] text-[#71717A] mt-0.5">{t.manageNote}</span>
        </span>
        <ExternalLink className="w-4 h-4 text-[#A8A8A0] shrink-0" />
      </a>

      <Link
        href="/hosting/terms"
        className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8E6E0] bg-white px-6 py-5 hover:border-[#CBC9C2] transition"
      >
        <span className="font-bold text-[#18181B]">{t.terms}</span>
        <FileText className="w-4 h-4 text-[#A8A8A0] shrink-0" />
      </Link>

      <p className="mt-8 text-center text-[13px] text-[#8A8A80]">{t.help}</p>
    </Shell>
  );
}
