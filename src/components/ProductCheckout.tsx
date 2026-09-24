"use client";

import { useState } from "react";
import { Check, ShieldCheck, Lock } from "lucide-react";
import { usd } from "@/lib/hosting";

/**
 * Every visible string, in both languages.
 *
 * Kept as one object rather than inline ternaries so a missing translation is
 * a compile error, and so the two versions can be read side by side — a French
 * page with one English button on it is worse than an English page.
 */
const T = {
  en: {
    whichSite: "Which website is this for?",
    sitePlaceholder: "yourdomain.com",
    emailPlaceholder: "your@email.com",
    whyAsking: "So we can match the payment to your site.",
    forLabel: "For",
    accountUnder: "Account and invoices:",
    yearly: "Yearly",
    monthly: "Monthly",
    perYear: "/ year",
    perMonth: "/ month",
    billedAnnually: "Billed once a year. Cancel anytime.",
    billedMonthly: "Billed monthly. Cancel anytime.",
    save: (n: number) => `Save $${usd(n)}.`,
    setupOnce: (n: number) => `+ $${usd(n)} once — mailbox set up`,
    redirecting: "Redirecting to Stripe…",
    pay: (n: number) => `Pay $${usd(n)} — get started`,
    once: "once",
    billedOnce: "One payment. Nothing renews, nothing to cancel.",
    payOnce: (n: number) => `Pay $${usd(n)} once`,
    nothingRecurring: "Nothing recurring",
    needSite: "Enter your website to continue",
    secured: "Secured by Stripe",
    cancelAnytime: "Cancel anytime",
    cardNote: "Card details are handled by Stripe and never reach our servers.",
    genericError: "Something went wrong",
    startError: "Could not start checkout",
  },
  fr: {
    whichSite: "Pour quel site web ?",
    sitePlaceholder: "votredomaine.com",
    emailPlaceholder: "votre@email.com",
    whyAsking: "Pour rattacher le paiement à votre site.",
    forLabel: "Pour",
    accountUnder: "Compte et factures :",
    yearly: "Annuel",
    monthly: "Mensuel",
    perYear: "/ an",
    perMonth: "/ mois",
    billedAnnually: "Facturé une fois par an. Résiliable à tout moment.",
    billedMonthly: "Facturé chaque mois. Résiliable à tout moment.",
    save: (n: number) => `Économisez ${usd(n)} $.`,
    setupOnce: (n: number) => `+ ${usd(n)} $ une fois — boîte email mise en place`,
    redirecting: "Redirection vers Stripe…",
    pay: (n: number) => `Payer ${usd(n)} $ — activer`,
    once: "une seule fois",
    billedOnce: "Un seul paiement. Rien ne se renouvelle, rien à résilier.",
    payOnce: (n: number) => `Payer ${usd(n)} $ une seule fois`,
    nothingRecurring: "Rien de récurrent",
    needSite: "Indiquez votre site pour continuer",
    secured: "Sécurisé par Stripe",
    cancelAnytime: "Résiliable à tout moment",
    cardNote:
      "Vos coordonnées bancaires sont traitées par Stripe et n'atteignent jamais nos serveurs.",
    genericError: "Une erreur est survenue",
    startError: "Impossible de démarrer le paiement",
  },
} as const;

export default function ProductCheckout({
  planKey,
  monthlyUsd,
  annualUsd,
  setupUsd = 0,
  oneOffUsd = 0,
  includes,
  refCode,
  siteLabel,
  maskedEmail = "",
  defaultBilling = "annual",
  lang = "en",
  initialSite = "",
}: {
  planKey: string;
  monthlyUsd: number;
  annualUsd: number;
  /** A one-time charge on the first payment (Business: mailbox setup). */
  setupUsd?: number;
  /**
   * Bought once (multilingual search). When set it is the ONLY price: no
   * yearly/monthly toggle, no setup line, and "once" instead of "/ year".
   * Leaving it out once showed "$450 / year" on a page Stripe then charged
   * $145 for — the server reads hostingAmountCents, which puts the one-off
   * first, so the page has to as well.
   */
  oneOffUsd?: number;
  includes: string[];
  refCode: string;
  siteLabel: string;
  /** Masked form of the agreed account address, e.g. "sa****77@hotmail.com". */
  maskedEmail?: string;
  /** Which term the link opens on, so a client agreed on monthly is not
   *  shown the annual price first. */
  defaultBilling?: "annual" | "monthly";
  lang?: "en" | "fr";
  /** Pre-fills the identify-yourself site field — the /assistant page already
   *  asked which website this is for, and asking twice loses buyers. */
  initialSite?: string;
}) {
  const t = T[lang];
  const [billing, setBilling] = useState<"annual" | "monthly">(defaultBilling);
  // When the link carries no recognised client, the buyer identifies
  // themselves before paying -- otherwise an anonymous payment arrives with
  // nothing to attach it to, and they have paid for something unnamed.
  const [site, setSite] = useState(initialSite);
  const [email, setEmail] = useState("");
  const known = Boolean(siteLabel);
  const identified = known || (site.trim().length > 3 && /.+@.+\..+/.test(email));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hosting-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only a plan key and a period. No amount: a price posted from the
        // browser is a price the buyer can edit in devtools.
        body: JSON.stringify({
          plan: planKey,
          billing,
          ref: refCode,
          business: siteLabel || site.trim(),
          email: email.trim(),
          // Only used when the ref is unknown — a known client's own language
          // wins server-side, so a forwarded link cannot change it.
          lang,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || t.startError);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
      setLoading(false);
    }
  }

  const oneOff = oneOffUsd > 0;
  const annual = billing === "annual";
  // Same order as hostingAmountCents on the server: a one-off wins outright.
  const amount = oneOff ? oneOffUsd : annual ? annualUsd : monthlyUsd;
  // A one-off carries no setup line — the server gates it to hosting tiers.
  const extra = oneOff ? 0 : setupUsd;
  // Only claim a saving when the annual price is actually below 12 months.
  const saving = monthlyUsd * 12 - annualUsd;

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {known ? (
          <div className="px-7 pt-6 pb-5 border-b border-[#F0EFEA] bg-[#FAFAF7]">
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">{t.forLabel}</p>
            <p className="text-[15px] font-bold text-[#18181B]">{siteLabel}</p>
            {/* The client asked for the account to be under one named company
                address. Showing it here is how they confirm that BEFORE the
                field is locked on Stripe's page. Masked, because the ref is
                guessable and this page is otherwise open. */}
            {maskedEmail ? (
              <p className="mt-2 text-[12px] text-[#71717A]">
                {t.accountUnder} <span className="font-semibold text-[#52525B]">{maskedEmail}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="px-7 pt-6 pb-5 border-b border-[#F0EFEA] bg-[#FAFAF7]">
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-2">
              {t.whichSite}
            </p>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder={t.sitePlaceholder}
              className="w-full h-10 px-3 mb-2 text-sm border border-[#E8E6E0] rounded-lg bg-white focus:outline-none focus:border-[#36671E]"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder={t.emailPlaceholder}
              className="w-full h-10 px-3 text-sm border border-[#E8E6E0] rounded-lg bg-white focus:outline-none focus:border-[#36671E]"
            />
            <p className="mt-2 text-[11px] text-[#8A8A80]">
              {t.whyAsking}
            </p>
          </div>
        )}

        <div className="px-7 pt-6">
          {/* No period to choose for a one-off: a toggle there would offer a
              "monthly" the server never charges. */}
          {oneOff ? null : (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4F4F0] mb-6">
              {(["annual", "monthly"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`flex-1 h-9 rounded-lg text-sm font-bold transition ${
                    billing === b ? "bg-white text-[#18181B] shadow-sm" : "text-[#71717A] hover:text-[#18181B]"
                  }`}
                >
                  {b === "annual" ? t.yearly : t.monthly}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-baseline gap-1.5">
            <span className="text-[44px] leading-none font-black text-[#18181B] tracking-tight">${usd(amount)}</span>
            <span className="text-[#71717A] font-medium">{oneOff ? t.once : annual ? t.perYear : t.perMonth}</span>
          </div>
          <p className={`text-sm text-[#71717A] mt-2 ${extra ? "mb-1" : "mb-6"}`}>
            {oneOff ? t.billedOnce : annual ? t.billedAnnually : t.billedMonthly}
            {!oneOff && annual && saving > 0 ? (
              <span className="ml-1.5 font-semibold text-[#36671E]">{t.save(saving)}</span>
            ) : null}
          </p>
          {extra ? <p className="text-sm text-[#71717A] mb-6">{t.setupOnce(extra)}</p> : null}

          <ul className="space-y-2.5 mb-7">
            {includes.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-[#3F3F46]">
                <Check className="w-4 h-4 text-[#36671E] mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-7 pb-7">
          <button
            onClick={pay}
            disabled={loading || !identified}
            className="w-full h-12 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A] disabled:opacity-60 transition"
          >
            {loading
              ? t.redirecting
              : identified
                ? oneOff ? t.payOnce(amount) : t.pay(amount + extra)
                : t.needSite}
          </button>

          {error ? <p className="mt-3 text-sm text-[#B91C1C] text-center">{error}</p> : null}

          <div className="mt-5 flex items-center justify-center gap-5 text-[11px] text-[#8A8A80]">
            <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t.secured}</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {oneOff ? t.nothingRecurring : t.cancelAnytime}</span>
          </div>
          <p className="mt-2.5 text-[11px] text-[#A8A8A0] text-center">
            {t.cardNote}
          </p>
        </div>
      </div>
    </div>
  );
}
