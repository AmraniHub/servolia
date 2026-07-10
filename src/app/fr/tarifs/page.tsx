import type { Metadata } from "next";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import StickyMobileCTA from "@/components/StickyMobileCTA";
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
    price: "490 €",
    deposit: "245 €",
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
    price: "990 €",
    deposit: "495 €",
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
    price: "1 900 €",
    deposit: "950 €",
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

const carePlans = [
  {
    plan: "care",
    name: "Care",
    price: "69 €",
    desc: "Pour ceux qui veulent un système surveillé et à jour.",
    features: ["Surveillance de disponibilité", "Modifications de contenu (1h/mois)", "Mises à jour de sécurité", "Support par email"],
    popular: false,
  },
  {
    plan: "care_growth",
    name: "Growth",
    price: "149 €",
    desc: "Pour ceux qui veulent une IA réentraînée et des améliorations chaque mois.",
    features: ["Tout Care", "Réentraînement du chatbot", "Rapport analytique mensuel", "2h d'améliorations/mois"],
    popular: true,
  },
  {
    plan: "care_scale",
    name: "Scale",
    price: "299 €",
    desc: "Pour ceux qui traitent Servolia comme leur système d'acquisition complet.",
    features: ["Tout Growth", "Améliorations A/B testées", "Évolutions CRM & workflows", "Appel stratégique mensuel"],
    popular: false,
  },
];

export default function FrenchPricingPage() {
  return (
    <main className="flex flex-col bg-white">
      {/* Minimal French header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF7]/85 backdrop-blur-xl border-b border-[#E8E6E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/fr" className="flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/fr/dentistes" className="hidden sm:block text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors">
              Dentistes
            </Link>
            <Link href="/fr/audit" className="px-4 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] transition-colors">
              Audit gratuit →
            </Link>
          </div>
        </div>
      </nav>

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

      {/* Care plans */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-2">Forfaits mensuels</p>
            <h2 className="text-3xl font-black text-[#080E1C] mb-3">Votre système s&apos;améliore chaque mois</h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">
              Bien moins cher qu&apos;un salarié à temps partiel — et concentré sur une seule chose : plus de clients réservés. Résiliable à tout moment avec 30 jours de préavis.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {carePlans.map((p, i) => (
              <div key={i} className={`relative rounded-2xl p-7 border-2 flex flex-col ${
                p.popular ? "border-[#36671E] bg-[#FAFAF7]" : "border-[#E8E6E0] bg-white"
              }`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#36671E] text-[#FAFAF7] text-[10px] font-black whitespace-nowrap">
                    LE PLUS CHOISI
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-black text-[#18181B] mb-1">{p.name}</h3>
                  <div className="flex items-baseline gap-0.5 mb-2">
                    <span className="text-4xl font-black text-[#18181B]">{p.price}</span>
                    <span className="text-[#71717A] text-sm">/mois</span>
                  </div>
                  <p className="text-[#71717A] text-sm">{p.desc}</p>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm text-[#18181B]">
                      <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <CheckoutButton
                  plan={p.plan}
                  endpoint="/api/checkout-subscription"
                  label="S'abonner →"
                  className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
                    p.popular
                      ? "bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115]"
                      : "border border-[#E8E6E0] text-[#18181B] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}
                />
              </div>
            ))}
          </div>
          <p className="text-center text-[#A1A1AA] text-xs mt-6">
            Facturation mensuelle via Stripe · Résiliation à tout moment (préavis 30 jours)
          </p>
        </div>
      </section>

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

      <StickyMobileCTA label="Recevoir mon audit gratuit" sub="Gratuit · Livré en 24h · Sans appel" href="/fr/audit" />

      <footer className="bg-[#FAFAF7] border-t border-[#E8E6E0] py-8 text-center text-xs text-[#71717A]">
        © {new Date().getFullYear()} Servolia ·{" "}
        <a href="mailto:hello@servolia.com" className="hover:text-[#36671E]">hello@servolia.com</a> ·{" "}
        <Link href="/legal/privacy" className="hover:text-[#36671E]">Confidentialité</Link>
      </footer>
    </main>
  );
}
