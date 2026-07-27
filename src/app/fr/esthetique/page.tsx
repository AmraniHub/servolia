import type { Metadata } from "next";
import Link from "next/link";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import Guarantee from "@/components/Guarantee";
import { CheckCircle, ArrowRight, Bot, Calendar, BarChart3, Globe, Clock, Lock, TrendingUp, Sparkles } from "lucide-react";
import ValueStack from "@/components/ValueStack";
import { PAY_PER_BOOKING } from "@/lib/pricing";

/**
 * FR aesthetic-clinic funnel — the beachhead-rung-2 page, mirroring the depth
 * of /fr/dentistes. Aesthetic is the ONLY niche where pay-per-booking may be
 * offered (payPerBookingEligible), so this page leads with that offer — the
 * strongest close for a skeptical clinic owner.
 */

export const metadata: Metadata = {
  title: "Site + assistante IA pour cliniques esthétiques — Servolia",
  description:
    "Vos demandes Instagram et WhatsApp restent sans réponse quand la clinique tourne à plein. Assistante IA, réservation en ligne et suivi — livré en 7 jours. Option paiement au résultat.",
  alternates: {
    canonical: "https://servolia.com/fr/esthetique",
    languages: {
      "en-US": "https://servolia.com/niches/aesthetic-clinics",
      "fr-FR": "https://servolia.com/fr/esthetique",
      "x-default": "https://servolia.com/niches/aesthetic-clinics",
    },
  },
};

const pain = [
  "Les demandes Instagram et WhatsApp restent sans réponse pendant les soins",
  "Les clientes se renseignent le soir — et réservent chez la concurrente qui répond",
  "Aucun filtre : les curieuses occupent votre équipe autant que les clientes prêtes",
  "Vous ignorez quelle publicité ou quel post amène réellement des rendez-vous",
  "Pas de relance : une demande sans réponse sous 24h est une cliente perdue",
];

const gains = [
  "L'assistante IA répond à chaque demande en secondes — soirs et week-ends compris",
  "Elle qualifie chaque cliente (soin recherché, budget, urgence) avant de proposer un créneau",
  "Réservation en ligne intégrée à votre site, confirmation automatique",
  "Suivi complet : Instagram, Google, direct — vous voyez ce qui remplit l'agenda",
  "Chaque contact est enregistré — plus aucune demande ne s'évapore",
];

const packages = [
  {
    name: "Clinique Essentielle",
    price: "290 €",
    delivery: "3 jours",
    features: [
      "Site clinique 5 pages",
      "Formulaire de demande de RDV",
      "Google Analytics 4",
      "Pages RGPD conformes",
      "Optimisé mobile",
      "Conseils fiche Google Business",
    ],
    cta: "Choisir Essentielle",
    popular: false,
  },
  {
    name: "Système IA Clinique",
    price: "590 €",
    delivery: "5 jours",
    features: [
      "Site 10 pages",
      "Assistante IA de qualification",
      "Parcours de réservation en ligne",
      "Capture des demandes clientes",
      "Notification email à la clinique",
      "Google Analytics 4",
      "Pages RGPD conformes",
      "Synchronisation CRM",
    ],
    cta: "Choisir Système IA",
    popular: true,
  },
  {
    name: "Clinique Pro Complète",
    price: "990 €",
    delivery: "7 jours",
    features: [
      "Tout le Système IA",
      "Tableau de bord clientes",
      "Pipeline de rendez-vous",
      "Emails de rappel automatiques",
      "Notification WhatsApp",
      "Rapport analytique mensuel",
      "Pages A/B testées",
    ],
    cta: "Choisir Pro",
    popular: false,
  },
];

export default function FrenchAestheticPage() {
  return (
    <main className="flex flex-col bg-white">
      {/* Minimal French header — landing page, keep exits low */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF7]/85 backdrop-blur-xl border-b border-[#E8E6E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/fr" className="flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
          <Link
            href="/fr/audit"
            className="px-4 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] transition-colors"
          >
            Audit gratuit →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#FAFAF7] pt-28 pb-16 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#EEF5EA] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#36671E]/30 bg-[#EEF5EA] text-sm text-[#36671E]">
              ✨ <span className="font-semibold">Conçu pour les cliniques esthétiques et médi-spas</span>
            </div>
          </div>
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-black text-[#18181B] leading-tight mb-5">
            Chaque demande sans réponse est un soin{" "}
            <span className="gradient-text">réservé chez la concurrente.</span>
          </h1>
          <p className="text-center text-lg text-[#52525B] max-w-2xl mx-auto mb-6">
            Vos clientes écrivent sur Instagram à 21h, demandent un prix sur WhatsApp entre deux soins, remplissent un formulaire qui reste sans réponse. Servolia installe sur votre site une assistante IA qui répond, qualifie et réserve — en 7 jours.
          </p>
          {/* Missed-revenue math */}
          <div className="max-w-xl mx-auto mb-8 p-4 rounded-2xl bg-white border border-[#D6E2CF] text-center">
            <p className="text-sm text-[#52525B]">
              Une clinique qui manque seulement <strong className="text-[#18181B]">8 demandes par mois</strong>, à{" "}
              <strong className="text-[#18181B]">500 € par cure</strong>, laisse partir
            </p>
            <p className="text-3xl font-black text-[#36671E] mt-1">~4 000 € / mois</p>
            <p className="text-[10px] text-[#A1A1AA] mt-1">Estimation illustrative — votre audit gratuit utilise les chiffres réels de votre clinique.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link href="/fr/audit" className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-base hover:opacity-90 flex items-center gap-2">
              Recevoir mon audit gratuit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/fr/tarifs" className="text-[#52525B] hover:text-[#18181B] text-sm font-semibold transition-colors">
              Voir les tarifs →
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#52525B]">
            <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#059669]" /> Conçu pour plus de rendez-vous</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#36671E]" /> Livraison en 7 jours</div>
            <div className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#36671E]" /> Prix fixe par écrit</div>
          </div>
        </div>
      </section>

      {/* Pay-per-booking — the offer only this niche gets */}
      <section className="py-14 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border-2 border-[#36671E] bg-[#FAFAF7] p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -top-3.5 left-6 px-4 py-1 rounded-full bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-xs font-black">
              PAIEMENT AU RÉSULTAT
            </div>
            <div className="flex items-start gap-4 mt-2">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#36671E] to-[#143424] flex items-center justify-center text-[#FAFAF7] shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-[#18181B] mb-2">
                  {PAY_PER_BOOKING.setupEur} € de mise en place, puis {PAY_PER_BOOKING.perBookingEur} € par consultation honorée. C&apos;est tout.
                </h2>
                <p className="text-[#52525B] text-sm leading-relaxed mb-4">
                  Réservé aux cliniques esthétiques et médi-spas : au lieu d&apos;un abonnement fixe, vous ne payez que
                  lorsque l&apos;assistante remplit réellement votre agenda. Une consultation honorée = {PAY_PER_BOOKING.perBookingEur} €.
                  Pas de rendez-vous ce mois-ci ? Facture à zéro. Nos intérêts sont alignés sur votre remplissage — par construction.
                </p>
                <ul className="flex flex-col gap-2 mb-5">
                  {[
                    "Facturé chaque début de mois, uniquement sur les rendez-vous du mois écoulé",
                    "Les no-shows sont déduits — vous ne payez que les consultations honorées",
                    "Sans engagement de durée : vous repassez sur une formule fixe quand vous voulez",
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />{t}
                    </li>
                  ))}
                </ul>
                <Link href="/fr/audit"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-sm hover:opacity-90">
                  Demander cette formule <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain / Gain */}
      <section className="py-16 lg:py-20 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-red-100">
              <p className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">Sans Servolia</p>
              <ul className="flex flex-col gap-3">
                {pain.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#71717A]">
                    <span className="text-red-400 flex-shrink-0 font-bold">✗</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#059669]/20">
              <p className="text-xs font-black text-[#059669] uppercase tracking-widest mb-4">Avec Servolia</p>
              <ul className="flex flex-col gap-3">
                {gains.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#374151]">
                    <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-2">Ce que nous construisons</p>
            <h2 className="text-3xl font-black text-[#080E1C]">Tout ce dont votre clinique a besoin</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <Globe className="w-5 h-5" />, title: "Site premium", desc: "Rapide, mobile-first, conforme RGPD — à la hauteur de l'image de votre clinique.", color: "from-[#36671E] to-[#143424]" },
              { icon: <Bot className="w-5 h-5" />, title: "Assistante IA", desc: "Formée sur vos soins et votre grille tarifaire. Qualifie chaque demande, en français et en anglais, 24h/24.", color: "from-[#295115] to-[#6B8439]" },
              { icon: <Calendar className="w-5 h-5" />, title: "Réservation en ligne", desc: "Demandes de rendez-vous en ligne avec confirmation automatique par email.", color: "from-[#059669] to-[#10B981]" },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Suivi des demandes", desc: "Instagram, Google, direct — vous savez exactement d'où vient chaque cliente.", color: "from-[#F59E0B] to-[#EF4444]" },
            ].map((item, i) => (
              <div key={i} className="border border-[#E8E6E0] rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-[#FAFAF7] mb-3`}>
                  {item.icon}
                </div>
                <h3 className="font-black text-[#080E1C] text-sm mb-1.5">{item.title}</h3>
                <p className="text-[#71717A] text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What it's built to do */}
      <section className="py-12 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-4">Conçu pour un objectif</p>
          <blockquote className="text-lg text-[#18181B] font-medium leading-relaxed mb-3">
            Une clinique type équipée du Système IA est conçue pour capter les demandes du soir et du week-end qui partaient à la concurrence — l&apos;assistante qualifie, propose un créneau et enregistre chaque contact, automatiquement.
          </blockquote>
          <p className="text-xs text-[#A1A1AA]">Objectif illustratif basé sur des références typiques de cliniques esthétiques. Les résultats réels varient.</p>
        </div>
      </section>

      {/* Packages */}
      <section className="py-16 lg:py-20 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-2">Formules Clinique</p>
            <h2 className="text-3xl font-black text-[#080E1C] mb-3">Ou choisissez une formule fixe</h2>
            <p className="text-[#71717A]">Prix HT. Acompte de 50 % · Solde à la livraison.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((p, i) => (
              <div key={i} className={`bg-white rounded-2xl border-2 p-6 relative ${p.popular ? "border-[#36671E] shadow-2xl shadow-[#ABDF90]/15" : "border-[#E8E6E0]"}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-xs font-black whitespace-nowrap">
                    RECOMMANDÉ
                  </div>
                )}
                <h3 className="text-lg font-black text-[#080E1C] mb-1">{p.name}</h3>
                <div className="text-3xl font-black text-[#080E1C] mb-1">{p.price}</div>
                <div className="flex items-center gap-1.5 mb-4">
                  <Clock className="w-3.5 h-3.5 text-[#059669]" />
                  <span className="text-xs font-semibold text-[#059669]">Livré en {p.delivery}</span>
                </div>
                <ul className="flex flex-col gap-2 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/fr/audit"
                  className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                    p.popular
                      ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90"
                      : "border border-[#E8E6E0] text-[#080E1C] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}>
                  {p.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-[#18181B] mb-4">
            Prête à remplir votre <span className="gradient-text">agenda de soins ?</span>
          </h2>
          <p className="text-[#52525B] mb-6">
            Recevez un audit gratuit de votre clinique. Nous vous montrons exactement où partent vos demandes et comment les récupérer en 7 jours.
          </p>
          <Link href="/fr/audit"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90">
            Recevoir mon audit gratuit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <StickyMobileCTA label="Recevoir mon audit gratuit" sub="Gratuit · Livré en 24h · Sans appel" href="/fr/audit" />

      <ValueStack lang="fr" niche="aesthetic" />
      <Guarantee lang="fr" />

      <footer className="bg-[#FAFAF7] border-t border-[#E8E6E0] py-8 text-center text-xs text-[#71717A]">
        <p className="mb-3">
          Voir aussi Servolia{" "}
          <Link href="/fr/villes" className="hover:text-[#36671E] underline">dans votre ville</Link>{" "}
          et pour les cliniques{" "}
          <Link href="/fr/pays/suisse" className="hover:text-[#36671E] underline">suisses</Link>,{" "}
          <Link href="/fr/pays/belgique" className="hover:text-[#36671E] underline">belges</Link> et{" "}
          <Link href="/fr/pays/luxembourg" className="hover:text-[#36671E] underline">luxembourgeoises</Link>.
        </p>
        © {new Date().getFullYear()} Servolia ·{" "}
        <a href="mailto:hello@servolia.com" className="hover:text-[#36671E]">hello@servolia.com</a> ·{" "}
        <Link href="/legal/privacy" className="hover:text-[#36671E]">Confidentialité</Link>
      </footer>
    </main>
  );
}
