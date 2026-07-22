import type { Metadata } from "next";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import CarePlansSection from "@/components/CarePlansSection";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import Guarantee from "@/components/Guarantee";
import { CheckCircle, ArrowRight, Shield, Clock, Globe, Bot, Building2, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Tarifs — Servolia",
  description:
    "Prix fixes pour sites IA, systèmes de réservation et gestion de clients. Aucune surprise. Acompte de 50 %, solde à la livraison.",
  alternates: {
    canonical: "https://servolia.com/fr/tarifs",
    languages: {
      "en-US": "https://servolia.com/pricing",
      "fr-FR": "https://servolia.com/fr/tarifs",
      "x-default": "https://servolia.com/pricing",
    },
  },
};

const tiers = [
  {
    plan: "starter",
    name: "Système Site Web",
    price: "290 €",
    deposit: "145 €",
    delivery: "3 jours",
    forWho: "Pour les entreprises qui ont besoin d'une présence en ligne professionnelle et fiable",
    desc: "Un site orienté conversion qui inspire confiance et transforme les visiteurs en demandes.",
    icon: <Globe className="w-5 h-5" />,
    color: "from-[#36671E] to-[#143424]",
    popular: false,
    features: [
      "Site professionnel 5 pages",
      "Boutons réservation & contact",
      "Design mobile-first",
      "Pages RGPD incluses",
      "Google Analytics 4",
      "SSL & hébergement rapide",
      "2 séries de révisions",
    ],
  },
  {
    plan: "growth",
    name: "Système de Réservation",
    price: "590 €",
    deposit: "295 €",
    delivery: "5 jours",
    forWho: "Pour les entreprises qui veulent des demandes et des rendez-vous réservés automatiquement",
    desc: "Réceptionniste IA + site + suivi complet. Votre entreprise travaille pour vous 24h/24.",
    icon: <Bot className="w-5 h-5" />,
    color: "from-[#295115] to-[#6B8439]",
    popular: true,
    features: [
      "Site professionnel 10 pages",
      "Chatbot réceptionniste IA (24h/24)",
      "Capture de leads + notification email",
      "Parcours de réservation",
      "Synchronisation CRM",
      "Meta Pixel + CAPI",
      "Google Analytics 4",
      "Pages RGPD conformes",
      "3 séries de révisions",
    ],
  },
  {
    plan: "pro",
    name: "Système Client",
    price: "990 €",
    deposit: "495 €",
    delivery: "7 jours",
    forWho: "Pour les entreprises qui veulent suivi complet, tableau de bord et automatisations",
    desc: "Système de leads IA complet : tableau de bord, pipeline, automatisations, rapports mensuels.",
    icon: <Building2 className="w-5 h-5" />,
    color: "from-[#36671E] to-[#6B8439]",
    popular: false,
    features: [
      "Tout le Système de Réservation",
      "Tableau de bord de gestion",
      "Pipeline de leads avec statuts",
      "Notes & historique clients",
      "Notifications automatiques",
      "Notification WhatsApp",
      "Rapport analytique mensuel",
      "Révisions illimitées (1er mois)",
    ],
  },
];

export default function FrenchPricingPage() {
  return (
    <main className="flex flex-col bg-white">
      <FrenchNav enHref="/pricing" />

      {/* Hero */}
      <section className="bg-[#FAFAF7] pt-28 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Tarifs</p>
          <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] mb-4 leading-tight">
            Prix fixe. Périmètre défini.{" "}
            <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">Livré en 7 jours.</span>
          </h1>
          <p className="text-[#52525B] text-lg max-w-2xl mx-auto mb-6">
            Le prix est convenu par écrit avant de commencer. Acompte de 50 % via Stripe, solde à la livraison. Si un seul client récupéré par mois couvre le système, le calcul est vite fait.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#52525B]">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#36671E]" /> Livraison en 7 jours ou 10 % remboursés/jour</span>
            <span className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-[#36671E]" /> Prix fixe par écrit</span>
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#36671E]" /> Paiement sécurisé Stripe</span>
          </div>
        </div>
      </section>

      {/* Systems */}
      <section className="py-12 lg:py-16 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((t, i) => (
              <div key={i} className={`bg-white rounded-2xl border-2 p-7 relative flex flex-col ${
                t.popular ? "border-[#36671E] shadow-2xl shadow-[#ABDF90]/12" : "border-[#E8E6E0]"
              }`}>
                {t.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-xs font-black whitespace-nowrap">
                    OFFRE PRINCIPALE
                  </div>
                )}
                <div className="mb-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center text-[#FAFAF7] mb-3 shadow-md`}>
                    {t.icon}
                  </div>
                  <h2 className="text-xl font-black text-[#080E1C] mb-1">{t.name}</h2>
                  <p className="text-xs font-semibold text-[#36671E] mb-3">{t.forWho}</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-black text-[#080E1C]">{t.price}</span>
                    <span className="text-xs text-[#71717A]">HT</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-xs font-semibold text-[#059669]">Livré en {t.delivery}</span>
                  </div>
                  <p className="text-sm text-[#52525B]">{t.desc}</p>
                </div>
                <ul className="flex flex-col gap-2 mb-6 flex-1">
                  {t.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#36671E] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <CheckoutButton
                  plan={t.plan}
                  lang="fr"
                  label={`Payer l'acompte de ${t.deposit} →`}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
                    t.popular
                      ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90"
                      : "border border-[#E8E6E0] text-[#080E1C] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}
                />
                <p className="text-center text-[10px] text-[#A1A1AA] mt-2">Solde de {t.deposit} à la livraison · Stripe sécurisé</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[#71717A] mt-8">
            Vous hésitez ? Commencez par l&apos;
            <Link href="/fr/audit" className="font-bold text-[#36671E] hover:underline">audit gratuit</Link>
            {" "}— nous vous recommandons le bon système, sans engagement.
          </p>
        </div>
      </section>

      {/* Care plans (all-in, mensuel/annuel — 1 mois offert) */}
      <CarePlansSection lang="fr" />

      {/* Guarantee */}
      <section className="py-14 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#D6E2CF] bg-white p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#36671E] flex items-center justify-center mx-auto mb-5">
              <Shield className="w-6 h-6 text-[#FAFAF7]" />
            </div>
            <h2 className="text-2xl font-black text-[#18181B] mb-3">La garantie de livraison Servolia</h2>
            <p className="text-[#52525B] text-sm leading-relaxed max-w-xl mx-auto">
              Si nous manquons la date de livraison convenue par notre faute, vous récupérez{" "}
              <strong className="text-[#18181B]">10 % de votre paiement par jour de retard</strong> — automatiquement.
              Prix fixe par écrit avant tout paiement. Tous les fichiers vous appartiennent au paiement final.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-[#18181B] mb-4">
            Pas sûr du bon système ? <span className="gradient-text">L&apos;audit décide pour vous.</span>
          </h2>
          <p className="text-[#52525B] mb-6">
            Gratuit, livré en 24h, sans appel : nous analysons votre site et vous recommandons exactement ce qu&apos;il vous faut — rien de plus.
          </p>
          <Link href="/fr/audit"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90">
            Recevoir mon audit gratuit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Guarantee lang="fr" />

      <StickyMobileCTA label="Recevoir mon audit gratuit" sub="Gratuit · Livré en 24h · Sans appel" href="/fr/audit" />
      <FrenchFooter />
    </main>
  );
}
