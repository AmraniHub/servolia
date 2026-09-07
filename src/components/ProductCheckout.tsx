"use client";

import { useState } from "react";
import { Check, ShieldCheck, Lock } from "lucide-react";

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
    yearly: "Yearly",
    monthly: "Monthly",
    perYear: "/ year",
    perMonth: "/ month",
    billedAnnually: "Billed once a year. Cancel anytime.",
    billedMonthly: "Billed monthly. Cancel anytime.",
    save: (n: number) => `Save $${n}.`,
    redirecting: "Redirecting to Stripe…",
    pay: (n: number) => `Pay $${n} — get started`,
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
    yearly: "Annuel",
    monthly: "Mensuel",
    perYear: "/ an",
    perMonth: "/ mois",
    billedAnnually: "Facturé une fois par an. Résiliable à tout moment.",
    billedMonthly: "Facturé chaque mois. Résiliable à tout moment.",
    save: (n: number) => `Économisez ${n} $.`,
    redirecting: "Redirection vers Stripe…",
    pay: (n: number) => `Payer ${n} $ — activer`,
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
  includes,
  refCode,
  siteLabel,
  defaultBilling = "annual",
  lang = "en",
}: {
  planKey: string;
  monthlyUsd: number;
  annualUsd: number;
  includes: string[];
  refCode: string;
  siteLabel: string;
  /** Which term the link opens on, so a client agreed on monthly is not
   *  shown the annual price first. */
  defaultBilling?: "annual" | "monthly";
  lang?: "en" | "fr";
}) {
  const t = T[lang];
  const [billing, setBilling] = useState<"annual" | "monthly">(defaultBilling);
  // When the link carries no recognised client, the buyer identifies
  // themselves before paying -- otherwise an anonymous payment arrives with
  // nothing to attach it to, and they have paid for something unnamed.
  const [site, setSite] = useState("");
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

  const annual = billing === "annual";
  const amount = annual ? annualUsd : monthlyUsd;
  // Only claim a saving when the annual price is actually below 12 months.
  const saving = Math.round(monthlyUsd * 12 - annualUsd);

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {known ? (
          <div className="px-7 pt-6 pb-5 border-b border-[#F0EFEA] bg-[#FAFAF7]">
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">{t.forLabel}</p>
            <p className="text-[15px] font-bold text-[#18181B]">{siteLabel}</p>
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

          <div className="flex items-baseline gap-1.5">
            <span className="text-[44px] leading-none font-black text-[#18181B] tracking-tight">${amount}</span>
            <span className="text-[#71717A] font-medium">{annual ? t.perYear : t.perMonth}</span>
          </div>
          <p className="text-sm text-[#71717A] mt-2 mb-6">
            {annual ? t.billedAnnually : t.billedMonthly}
            {annual && saving > 0 ? (
              <span className="ml-1.5 font-semibold text-[#36671E]">{t.save(saving)}</span>
            ) : null}
          </p>

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
                ? t.pay(amount)
                : t.needSite}
          </button>

          {error ? <p className="mt-3 text-sm text-[#B91C1C] text-center">{error}</p> : null}

          <div className="mt-5 flex items-center justify-center gap-5 text-[11px] text-[#8A8A80]">
            <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t.secured}</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {t.cancelAnytime}</span>
          </div>
          <p className="mt-2.5 text-[11px] text-[#A8A8A0] text-center">
            {t.cardNote}
          </p>
        </div>
      </div>
    </div>
  );
}
