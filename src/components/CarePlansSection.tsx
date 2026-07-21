"use client";

import { useState } from "react";
import { CheckCircle, Globe, Mail, MessageSquare, Star } from "lucide-react";
import CheckoutButton from "@/components/CheckoutButton";
import { CARE_PLANS, ADDONS } from "@/lib/pricing";

type Billing = "monthly" | "annual";

const ADDON_ICON: Record<string, typeof Globe> = {
  domain: Globe, email: Mail, sms: MessageSquare, reviews: Star,
};

const T = {
  en: {
    eyebrow: "Care Plans — all-in-one",
    title: "One vendor for your entire digital presence",
    sub: "Domain, hosting, professional email, your AI receptionist and monthly reports — bundled into one monthly fee. No juggling suppliers.",
    monthly: "Monthly", annual: "Annual", oneFree: "1 month free",
    perMo: "/mo", perYr: "/yr", effMo: (n: number) => `≈ €${n}/mo · 1 month free`,
    subscribe: "Subscribe →", popular: "MOST POPULAR",
    foot: "All-in via Stripe · cancel anytime with 30 days notice · yearly plans renew annually",
    addonsTitle: "Optional add-ons",
    perMailbox: "/mailbox", perYrShort: "/yr", perMoShort: "/mo",
    plans: {
      care: { tag: "The essentials, done for you.", inc: ["Hosting + domain included", "24/7 AI receptionist", "Professional email @your-domain", "Backups & security updates", "Email support"] },
      care_growth: { tag: "More bookings, every month.", inc: ["Everything in Care, plus:", "Monthly results report (leads, bookings, ROI)", "AI retraining + optimisations", "SMS reminders included", "Pro email — up to 3 mailboxes"] },
      care_scale: { tag: "Growth on autopilot.", inc: ["Everything in Growth, plus:", "Ads loop (pixel + ROI tracking)", "A/B testing & conversion optimisation", "CRM & lead tracking", "Monthly strategy call"] },
    },
  },
  fr: {
    eyebrow: "Forfaits Care — tout-en-un",
    title: "Un seul prestataire pour tout votre digital",
    sub: "Nom de domaine, hébergement, email pro, votre réceptionniste IA et vos rapports mensuels — réunis dans un seul abonnement. Fini de jongler avec les fournisseurs.",
    monthly: "Mensuel", annual: "Annuel", oneFree: "1 mois offert",
    perMo: "/mois", perYr: "/an", effMo: (n: number) => `≈ €${n}/mois · 1 mois offert`,
    subscribe: "S'abonner →", popular: "LE PLUS CHOISI",
    foot: "Tout-en-un via Stripe · sans engagement (préavis 30 jours) · les forfaits annuels se renouvellent chaque année",
    addonsTitle: "Modules à la carte",
    perMailbox: "/boîte", perYrShort: "/an", perMoShort: "/mois",
    plans: {
      care: { tag: "L'essentiel, clé en main.", inc: ["Hébergement + nom de domaine inclus", "Réceptionniste IA 24/7", "Email professionnel @votre-domaine", "Sauvegardes & mises à jour de sécurité", "Support par email"] },
      care_growth: { tag: "Plus de rendez-vous, chaque mois.", inc: ["Tout Care, plus :", "Rapport mensuel de résultats (leads, RDV, ROI)", "Réentraînement de l'IA + optimisations", "Rappels SMS inclus", "Email pro — jusqu'à 3 boîtes"] },
      care_scale: { tag: "La croissance en pilote automatique.", inc: ["Tout Growth, plus :", "Boucle publicitaire (pixel + suivi ROI)", "A/B testing & optimisation de conversion", "CRM & suivi des leads", "Appel stratégique mensuel"] },
    },
  },
};

type PlanKey = "care" | "care_growth" | "care_scale";

const ORDER: Array<{ key: PlanKey; popular?: boolean }> = [
  { key: "care" },
  { key: "care_growth", popular: true },
  { key: "care_scale" },
];

export default function CarePlansSection({ lang = "en" }: { lang?: "en" | "fr" }) {
  const t = T[lang === "fr" ? "fr" : "en"];
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <section className="py-16 lg:py-20 bg-[#FAFAF7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <p className="text-sm font-bold text-[#10B981] uppercase tracking-widest mb-3">{t.eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl font-black text-[#080E1C] mb-3">{t.title}</h2>
          <p className="text-[#71717A] max-w-lg mx-auto text-sm">{t.sub}</p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E8E6E0]">
            {(["monthly", "annual"] as Billing[]).map((b) => (
              <button key={b} onClick={() => setBilling(b)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  billing === b ? "bg-[#10B981] text-[#18181B]" : "text-[#71717A] hover:text-[#080E1C]"
                }`}>
                {b === "monthly" ? t.monthly : t.annual}
                {b === "annual" && (
                  <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${billing === "annual" ? "bg-[#18181B]/15 text-[#18181B]" : "bg-[#10B981]/15 text-[#0F9D6B]"}`}>
                    {t.oneFree}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ORDER.map(({ key, popular }) => {
            const plan = CARE_PLANS[key];
            const copy = t.plans[key];
            const effMonthly = Math.round(plan.annualEur / 12);
            return (
              <div key={key} className={`rounded-2xl p-6 border-2 relative flex flex-col ${popular ? "border-[#10B981] bg-white shadow-lg shadow-emerald-500/8" : "border-[#E8E6E0] bg-white"}`}>
                {popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] text-[#18181B] text-xs font-black whitespace-nowrap">
                    {t.popular}
                  </div>
                )}
                <h3 className="text-lg font-black text-[#080E1C] mb-1">{plan.name}</h3>
                <div className="text-3xl font-black text-[#080E1C]">
                  €{billing === "annual" ? plan.annualEur : plan.monthlyEur}
                  <span className="text-base font-bold text-[#71717A]">{billing === "annual" ? t.perYr : t.perMo}</span>
                </div>
                <p className="text-xs font-semibold text-[#0F9D6B] h-4 mb-2">{billing === "annual" ? t.effMo(effMonthly) : " "}</p>
                <p className="text-[#71717A] text-sm mb-5">{copy.tag}</p>
                <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                  {copy.inc.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <CheckoutButton
                  plan={plan.key}
                  billing={billing}
                  endpoint="/api/checkout-subscription"
                  label={t.subscribe}
                  className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
                    popular
                      ? "bg-gradient-to-r from-[#10B981] to-[#34D399] text-[#18181B] hover:opacity-90"
                      : "border border-[#E8E6E0] text-[#080E1C] hover:border-[#10B981] hover:text-[#10B981]"
                  }`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-center text-[#52525B] text-xs mt-6">{t.foot}</p>

        {/* À-la-carte add-ons (resold infrastructure, managed) */}
        <div className="mt-10">
          <p className="text-xs font-bold text-[#52525B] uppercase tracking-widest text-center mb-4">{t.addonsTitle}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(ADDONS).map((a) => {
              const Icon = ADDON_ICON[a.key] ?? Globe;
              const unit = a.interval === "year" ? t.perYrShort : a.per === "mailbox" ? t.perMailbox : t.perMoShort;
              return (
                <div key={a.key} className="rounded-xl border border-[#E8E6E0] bg-white p-4">
                  <Icon className="w-4 h-4 text-[#10B981] mb-2" />
                  <p className="text-sm font-bold text-[#080E1C] leading-snug">{lang === "fr" ? a.nameFr : a.name}</p>
                  <p className="text-sm font-black text-[#080E1C] mt-1">€{a.priceEur}<span className="text-xs font-semibold text-[#71717A]">{unit}</span></p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
