"use client";

import { useState } from "react";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { usd } from "@/lib/hosting";

/**
 * TWO TIERS, SIDE BY SIDE, ONE BILLING TOGGLE.
 *
 * Separate from ProductCheckout, which sells one product to a client who has
 * already agreed a plan. This is for the client who has not: the whole job is
 * making the difference between the tiers legible in a glance, which a page
 * showing one plan at a time cannot do however many times you send it.
 *
 * The site and email are still collected here when the link carries no
 * recognised client, for the same reason as the single-plan page: an anonymous
 * payment arrives with nothing to attach it to, and the buyer has paid for
 * something unnamed. One form serves both cards — asking twice for the same
 * two facts, once per column, is how a chooser starts feeling like a form.
 */

const T = {
  en: {
    yearly: "Yearly", monthly: "Monthly",
    perYear: "/ year", perMonth: "/ month",
    save: (n: number) => `Save $${usd(n)} a year`,
    yourSite: "Which website is this for?",
    sitePlaceholder: "yourdomain.com",
    emailPlaceholder: "your@email.com",
    whyAsking: "Your account, invoices and sign-in link all use this address.",
    forLabel: "For",
    plus: "Everything in Essential, plus:",
    choose: (n: number) => `Choose — $${usd(n)}`,
    needDetails: "Enter your website and email above",
    working: "Redirecting to Stripe…",
    secured: "Secured by Stripe",
    cancelAnytime: "Cancel anytime",
    cardNote: "Card details are handled by Stripe and never reach our servers.",
    genericError: "Something went wrong",
    startError: "Could not start checkout",
    popular: "Most chosen",
  },
  fr: {
    yearly: "Annuel", monthly: "Mensuel",
    perYear: "/ an", perMonth: "/ mois",
    save: (n: number) => `Économisez ${usd(n)} $ par an`,
    yourSite: "Pour quel site web ?",
    sitePlaceholder: "votredomaine.com",
    emailPlaceholder: "votre@email.com",
    whyAsking: "Votre compte, vos factures et votre lien de connexion utilisent cette adresse.",
    forLabel: "Pour",
    plus: "Tout l'Essentiel, plus :",
    choose: (n: number) => `Choisir — ${usd(n)} $`,
    needDetails: "Indiquez votre site et votre email ci-dessus",
    working: "Redirection vers Stripe…",
    secured: "Sécurisé par Stripe",
    cancelAnytime: "Résiliable à tout moment",
    cardNote:
      "Vos coordonnées bancaires sont traitées par Stripe et n'atteignent jamais nos serveurs.",
    genericError: "Une erreur est survenue",
    startError: "Impossible de démarrer le paiement",
    popular: "Le plus choisi",
  },
};

export interface Tier {
  planKey: string;
  tier: string;
  heading: string;
  blurb: string;
  monthlyUsd: number;
  annualUsd: number;
  includes: string[];
  /** Lines this tier adds over the cheaper one, for the upper card. */
  extra?: string[];
}

export default function PlanChooser({
  tiers,
  refCode,
  siteLabel,
  maskedEmail = "",
  lang = "en",
}: {
  tiers: [Tier, Tier];
  refCode: string;
  siteLabel: string;
  maskedEmail?: string;
  lang?: "en" | "fr";
}) {
  const t = T[lang];
  const [billing, setBilling] = useState<"annual" | "monthly">("annual");
  const [site, setSite] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const known = Boolean(siteLabel);
  const identified = known || (site.trim().length > 3 && /.+@.+\..+/.test(email));
  const annual = billing === "annual";

  async function pay(planKey: string) {
    setBusy(planKey);
    setError(null);
    try {
      const res = await fetch("/api/hosting-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A plan KEY, never a price. The server reads the figure.
        body: JSON.stringify({
          plan: planKey,
          billing,
          ref: refCode,
          business: siteLabel || site.trim(),
          email: email.trim(),
          lang,
        }),
      });
      const data = await res.json();
      // assign() rather than `location.href = ...`: identical navigation, but
      // the compiler's immutability rule rejects assigning to a value defined
      // outside the component.
      if (data.url) { window.location.assign(data.url); return; }
      throw new Error(data.error || t.startError);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Who this is for, or who we need it to be. */}
      <div className="rounded-2xl border border-[#E8E6E0] bg-white p-6 mb-6">
        {known ? (
          <>
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">{t.forLabel}</p>
            <p className="text-[15px] font-bold text-[#18181B]">{siteLabel}</p>
            {maskedEmail ? (
              <p className="mt-2 text-[12px] text-[#71717A]">{maskedEmail}</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-3">{t.yourSite}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={site}
                onChange={(e) => setSite(e.target.value)}
                placeholder={t.sitePlaceholder}
                className="h-11 px-3 text-sm border border-[#E8E6E0] rounded-lg bg-white focus:outline-none focus:border-[#36671E]"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={t.emailPlaceholder}
                className="h-11 px-3 text-sm border border-[#E8E6E0] rounded-lg bg-white focus:outline-none focus:border-[#36671E]"
              />
            </div>
            <p className="mt-2.5 text-[11px] text-[#8A8A80]">{t.whyAsking}</p>
          </>
        )}
      </div>

      {/* One toggle for both columns: two toggles invite comparing a monthly
          price against a yearly one without noticing. */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4F4F0] mb-6 max-w-xs mx-auto">
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

      <div className="grid md:grid-cols-2 gap-5">
        {tiers.map((p, i) => {
          const amount = annual ? p.annualUsd : p.monthlyUsd;
          const saving = p.monthlyUsd * 12 - p.annualUsd;
          const upper = i === 1;
          return (
            <div
              key={p.planKey}
              className={`rounded-2xl border bg-white overflow-hidden flex flex-col ${
                upper ? "border-[#36671E] shadow-[0_1px_3px_rgba(54,103,30,0.15)]" : "border-[#E8E6E0]"
              }`}
            >
              <div className="px-6 pt-6 pb-5 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[11px] font-black text-[#8A8A80] uppercase tracking-widest">{p.tier}</p>
                  {upper ? (
                    <span className="text-[10px] font-bold text-[#36671E] bg-[#F3F9EE] border border-[#CBE3BC] rounded-full px-2 py-0.5">
                      {t.popular}
                    </span>
                  ) : null}
                </div>
                <p className="text-[15px] text-[#52525B] leading-relaxed mb-5">{p.blurb}</p>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-[38px] leading-none font-black text-[#18181B] tracking-tight">
                    ${usd(amount)}
                  </span>
                  <span className="text-[#71717A] font-medium">{annual ? t.perYear : t.perMonth}</span>
                </div>
                {annual && saving > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-[#36671E]">{t.save(saving)}</p>
                ) : (
                  <p className="mt-2 text-sm text-[#71717A]">&nbsp;</p>
                )}

                <ul className="mt-6 space-y-2.5">
                  {(upper && p.extra ? p.extra : p.includes).map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[#3F3F46]">
                      <Check className="w-4 h-4 text-[#36671E] mt-0.5 shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {upper && p.extra ? (
                  <p className="mt-3 text-[12px] text-[#8A8A80]">{t.plus}</p>
                ) : null}
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => pay(p.planKey)}
                  disabled={!identified || busy !== null}
                  className={`w-full h-12 rounded-xl font-bold disabled:opacity-60 transition ${
                    upper
                      ? "bg-[#18181B] text-white hover:bg-[#27272A]"
                      : "bg-white text-[#18181B] border border-[#D8D6D0] hover:border-[#18181B]"
                  }`}
                >
                  {busy === p.planKey ? t.working : identified ? t.choose(amount) : t.needDetails}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className="mt-4 text-sm text-[#B91C1C] text-center">{error}</p> : null}

      <div className="mt-7 flex items-center justify-center gap-5 text-[11px] text-[#8A8A80]">
        <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t.secured}</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {t.cancelAnytime}</span>
      </div>
      <p className="mt-2.5 text-[11px] text-[#A8A8A0] text-center">{t.cardNote}</p>
    </div>
  );
}
