"use client";

import { useState } from "react";
import { CheckCircle, MessageSquare, Star, Mail } from "lucide-react";
import CheckoutButton from "@/components/CheckoutButton";
import { PLANS, PLAN_ORDER, POPULAR_PLAN_KEY, ADDONS, SETUP_PLAN } from "@/lib/pricing";

/**
 * The subscription section — the actual product, on every marketing page.
 *
 * Post-2026-07-28 model: one installation fee, then a monthly plan tiered by
 * included AI conversations. Annual is presented as the default because it
 * brings a year of cash up front and locks twelve months against churn.
 * (File name kept as CarePlansSection so every existing import keeps working;
 * "Care" is no longer a plan name.)
 */

type Billing = "monthly" | "annual";

const ADDON_ICON: Record<string, typeof Mail> = {
  email: Mail, sms: MessageSquare, reviews: Star,
};

const T = {
  en: {
    eyebrow: "Plans — all-in-one",
    title: "One vendor for your entire online presence",
    sub: "Domain, hosting, professional email, your 24/7 AI receptionist and your reporting — one monthly plan. Nothing to juggle, nothing to install.",
    monthly: "Monthly", annual: "Annual", twoFree: "2 months free",
    perMo: "/mo", perYr: "/yr",
    effMo: (n: number) => `≈ €${n}/mo · 2 months free`,
    setupLine: `+ €${SETUP_PLAN.totalEur} installation, once — waived on annual`,
    setupLineAnnual: "Installation included — you're paying yearly",
    subscribe: "Get started →", popular: "MOST CHOSEN",
    convo: (n: number) => `${n} AI conversations / month`,
    convoNote: "Go over and we simply move you up a plan — never a surprise bill.",
    foot: "Secure payment via Stripe · cancel anytime with 30 days notice · annual plans renew yearly",
    addonsTitle: "Optional extras",
    perMailbox: "/mailbox", perMoShort: "/mo",
    includedFrom: (p: string) => `Included from ${p}`,
    plans: {
      essentiel: {
        tag: "Everything you need to stop losing enquiries.",
        inc: [
          "Professional multi-page site",
          "24/7 AI receptionist, trained on your services",
          "Instant lead alerts — email + one-tap WhatsApp reply",
          "Client portal with every enquiry",
          "Hosting, domain, SSL and pro email included",
        ],
      },
      croissance: {
        tag: "Turn those enquiries into booked appointments.",
        inc: [
          "Everything in Essentiel, plus:",
          "Lead pipeline with statuses and private notes",
          "Monthly results report (enquiries, bookings, after-hours)",
          "Google reviews automation",
          "SMS / WhatsApp appointment reminders",
          "Visitor analytics — see what actually brings patients",
        ],
      },
      performance: {
        tag: "For clinics running ads and multiple practitioners.",
        inc: [
          "Everything in Croissance, plus:",
          "Multi-practitioner / multi-site",
          "Ads closed loop — every euro tracked to a booking",
          "Custom AI training on your own protocols",
          "Priority support + quarterly strategy call",
        ],
      },
    } as Record<string, { tag: string; inc: string[] }>,
  },
  fr: {
    eyebrow: "Formules — tout-en-un",
    title: "Un seul prestataire pour toute votre présence en ligne",
    sub: "Nom de domaine, hébergement, email professionnel, votre assistante IA 24 h/24 et vos rapports — un seul abonnement mensuel. Rien à gérer, rien à installer.",
    monthly: "Mensuel", annual: "Annuel", twoFree: "2 mois offerts",
    perMo: "/mois", perYr: "/an",
    effMo: (n: number) => `≈ ${n} €/mois · 2 mois offerts`,
    setupLine: `+ ${SETUP_PLAN.totalEur} € de mise en place, une seule fois — offerte en annuel`,
    setupLineAnnual: "Mise en place offerte — vous payez à l'année",
    subscribe: "Démarrer →", popular: "LE PLUS CHOISI",
    convo: (n: number) => `${n} conversations IA / mois`,
    convoNote: "Si vous dépassez, on vous fait simplement passer à la formule au-dessus — jamais de facture surprise.",
    foot: "Paiement sécurisé via Stripe · résiliable à tout moment (préavis 30 jours) · les formules annuelles se renouvellent chaque année",
    addonsTitle: "Options",
    perMailbox: "/boîte", perMoShort: "/mois",
    includedFrom: (p: string) => `Inclus à partir de ${p}`,
    plans: {
      essentiel: {
        tag: "L'essentiel pour ne plus perdre une seule demande.",
        inc: [
          "Site professionnel multi-pages",
          "Assistante IA 24 h/24, formée sur vos prestations",
          "Alerte immédiate — email + réponse WhatsApp en un clic",
          "Espace client avec toutes vos demandes",
          "Hébergement, nom de domaine, SSL et email pro inclus",
        ],
      },
      croissance: {
        tag: "Transformez ces demandes en rendez-vous.",
        inc: [
          "Tout Essentiel, plus :",
          "Pipeline de demandes avec statuts et notes privées",
          "Rapport mensuel de résultats (demandes, RDV, hors horaires)",
          "Automatisation des avis Google",
          "Rappels de rendez-vous SMS / WhatsApp",
          "Statistiques de visite — voyez ce qui amène vraiment des patients",
        ],
      },
      performance: {
        tag: "Pour les cabinets qui font de la publicité et travaillent à plusieurs.",
        inc: [
          "Tout Croissance, plus :",
          "Multi-praticiens / multi-sites",
          "Boucle publicitaire — chaque euro suivi jusqu'au rendez-vous",
          "IA entraînée sur vos propres protocoles",
          "Support prioritaire + point stratégique trimestriel",
        ],
      },
    } as Record<string, { tag: string; inc: string[] }>,
  },
};

export default function CarePlansSection({ lang = "en" }: { lang?: "en" | "fr" }) {
  const t = T[lang === "fr" ? "fr" : "en"];
  // MONTHLY is the default view. Annual is the better deal and better for cash
  // flow, but landing on a yearly figure makes the plan look several times more
  // expensive than it is at the exact moment a visitor is deciding whether to
  // keep reading. Show the monthly number first and let the toggle (which keeps
  // its "2 months free" badge) sell the upgrade.
  const [billing, setBilling] = useState<Billing>("monthly");
  const fr = lang === "fr";
  const price = (n: number) => (fr ? `${n.toLocaleString("fr-FR")} €` : `€${n.toLocaleString()}`);

  return (
    <section className="py-16 lg:py-20 bg-[#FAFAF7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">{t.eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] mb-3">{t.title}</h2>
          <p className="text-[#71717A] max-w-lg mx-auto text-sm">{t.sub}</p>
        </div>

        {/* Billing toggle — annual is pre-selected */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E8E6E0]">
            {(["monthly", "annual"] as Billing[]).map((b) => (
              <button key={b} onClick={() => setBilling(b)}
                aria-pressed={billing === b}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  billing === b ? "bg-[#36671E] text-[#FAFAF7]" : "text-[#71717A] hover:text-[#18181B]"
                }`}>
                {b === "monthly" ? t.monthly : t.annual}
                {b === "annual" && (
                  <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    billing === "annual" ? "bg-[#FAFAF7]/20 text-[#FAFAF7]" : "bg-[#EEF5EA] text-[#36671E]"
                  }`}>
                    {t.twoFree}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLAN_ORDER.map((key) => {
            const plan = PLANS[key];
            const copy = t.plans[key];
            const popular = key === POPULAR_PLAN_KEY;
            const effMonthly = Math.round(plan.annualEur / 12);
            return (
              <div key={key}
                className={`rounded-2xl p-6 border-2 relative flex flex-col ${
                  popular ? "border-[#36671E] bg-white shadow-lg shadow-[#ABDF90]/15" : "border-[#E8E6E0] bg-white"
                }`}>
                {popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-xs font-black whitespace-nowrap">
                    {t.popular}
                  </div>
                )}
                <h3 className="text-lg font-black text-[#18181B] mb-1">{fr ? plan.nameFr : plan.name}</h3>
                <div className="text-3xl font-black text-[#18181B]">
                  {price(billing === "annual" ? plan.annualEur : plan.monthlyEur)}
                  <span className="text-base font-bold text-[#71717A]">
                    {billing === "annual" ? t.perYr : t.perMo}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#36671E] h-4 mb-1">
                  {billing === "annual" ? t.effMo(effMonthly) : " "}
                </p>
                <p className="text-[11px] text-[#A1A1AA] mb-3">
                  {billing === "annual" ? t.setupLineAnnual : t.setupLine}
                </p>

                {/* The meter — what actually separates the tiers */}
                <div className="rounded-xl bg-[#EEF5EA] px-3 py-2 mb-4">
                  <p className="text-xs font-black text-[#36671E]">{t.convo(plan.conversations)}</p>
                </div>

                <p className="text-[#71717A] text-sm mb-5">{copy.tag}</p>
                <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                  {copy.inc.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#3F3F46]">
                      <CheckCircle className="w-4 h-4 text-[#36671E] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <CheckoutButton
                  plan={plan.key}
                  billing={billing}
                  lang={lang}
                  endpoint="/api/checkout-subscription"
                  label={t.subscribe}
                  className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
                    popular
                      ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90"
                      : "border border-[#E8E6E0] text-[#18181B] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}
                />
              </div>
            );
          })}
        </div>

        <p className="text-center text-[#52525B] text-xs mt-5">{t.convoNote}</p>
        <p className="text-center text-[#A1A1AA] text-xs mt-2">{t.foot}</p>

        {/* Optional extras — mostly upgrades for Essentiel clients */}
        <div className="mt-10">
          <p className="text-xs font-bold text-[#52525B] uppercase tracking-widest text-center mb-4">{t.addonsTitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(ADDONS).map((a) => {
              const Icon = ADDON_ICON[a.key] ?? Mail;
              const unit = a.per === "mailbox" ? t.perMailbox : t.perMoShort;
              const incFrom = a.includedFrom ? PLANS[a.includedFrom] : null;
              return (
                <div key={a.key} className="rounded-xl border border-[#E8E6E0] bg-white p-4">
                  <Icon className="w-4 h-4 text-[#36671E] mb-2" />
                  <p className="text-sm font-bold text-[#18181B] leading-snug">{fr ? a.nameFr : a.name}</p>
                  <p className="text-sm font-black text-[#18181B] mt-1">
                    {price(a.priceEur)}<span className="text-xs font-semibold text-[#71717A]">{unit}</span>
                  </p>
                  {incFrom && (
                    <p className="text-[10px] text-[#36671E] font-semibold mt-1">
                      {t.includedFrom(fr ? incFrom.nameFr : incFrom.name)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
