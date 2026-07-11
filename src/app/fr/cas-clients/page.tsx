import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import Link from "next/link";
import { ArrowRight, Clock, CheckCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exemples de déploiements — Ce qu'un système Servolia est conçu pour livrer",
  description:
    "Scénarios de déploiement illustratifs : comment les cabinets dentaires, cliniques esthétiques et entreprises de services utilisent les systèmes IA Servolia pour capter et réserver plus de clients.",
  alternates: {
    canonical: "https://servolia.com/fr/cas-clients",
    languages: {
      "en-US": "https://servolia.com/case-studies",
      "fr-FR": "https://servolia.com/fr/cas-clients",
      "x-default": "https://servolia.com/case-studies",
    },
  },
};

const cases = [
  {
    id: "scenario-dentaire",
    badge: "Cabinet dentaire · Europe de l'Ouest",
    name: "Scénario cabinet dentaire",
    system: "Système de Réservation IA",
    plan: "Forfait Growth (99 €/mois)",
    timeline: "Construction en 5 jours · conçu pour des résultats dès la semaine 1",
    headline: "Transformer les demandes hors horaires en rendez-vous réservés.",
    challenge:
      "Un cabinet type est complet en journée mais perd les patients qui appellent après la fermeture. Sans réservation en ligne, chaque appel manqué peut partir chez un confrère — et le secrétariat passe des heures chaque jour à gérer les rendez-vous par téléphone au lieu de s'occuper des patients.",
    solution: [
      "Site 10 pages reconstruit pour la conversion, avec signaux de confiance et galerie avant/après",
      "Réceptionniste IA formée sur la liste des soins, les tarifs et les règles de réservation",
      "Réservation en ligne intégrée au site — les patients réservent seuls, 24h/24",
      "Confirmation, rappel (48h avant) et relance automatiques (récupération des absences)",
      "Google Analytics 4 + Pixel Meta installés pour le suivi publicitaire futur",
    ],
    results: [
      { metric: "+400 %", label: "Objectif : réservations en ligne" },
      { metric: "24h/24", label: "Couverture hors horaires" },
      { metric: "Heures", label: "Gagnées chaque semaine" },
      { metric: "100 %", label: "Demandes enregistrées au CRM" },
    ],
    capability:
      "Avec l'IA qui gère les demandes après 18h, les patients réservent, reçoivent une confirmation et un rappel automatiquement — l'agenda se remplit sans travail téléphonique manuel.",
    color: "from-[#36671E] to-[#295115]",
    lightColor: "bg-[#EEF5EA]",
    borderColor: "border-[#36671E]/20",
  },
  {
    id: "scenario-esthetique",
    badge: "Clinique esthétique · Europe",
    name: "Scénario clinique esthétique",
    system: "Système Client IA",
    plan: "Forfait Scale (199 €/mois)",
    timeline: "Construction en 7 jours · conçu pour une première réservation en semaine 1",
    headline: "Convertir l'intérêt Instagram qui ne menait nulle part.",
    challenge:
      "Une clinique avec quelques milliers d'abonnés Instagram reçoit un flux régulier de messages privés sur les consultations Botox et acide hyaluronique, mais aucun système pour les convertir. Les clientes potentielles écrivent, attendent une réponse trop lente, et réservent chez un concurrent — la demande est forte mais le chiffre stagne.",
    solution: [
      "Site complet avec pages par traitement (Botox, fillers, laser, soins de la peau)",
      "Réceptionniste IA formée sur les traitements, prix et protocoles de consultation",
      "Lien Instagram en bio → capture de lead → réservation automatique",
      "Tableau de bord CRM montrant chaque demande, sa source et son statut",
      "Relance automatique à 48h pour les demandes non réservées",
      "Rapport mensuel : leads, réservations, attribution du chiffre d'affaires",
    ],
    results: [
      { metric: "×4", label: "Objectif : réservations/semaine" },
      { metric: "Majorité", label: "Demandes gérées par l'IA" },
      { metric: "Semaine 1", label: "Première réservation visée" },
      { metric: "1 vue", label: "Chaque lead, source & statut" },
    ],
    capability:
      "Au lieu de messages privés que personne n'arrive à suivre, chaque demande entre dans un seul système et est relancée automatiquement — l'intérêt devient des consultations réservées.",
    color: "from-[#295115] to-[#6B8439]",
    lightColor: "bg-[#EEF5EA]",
    borderColor: "border-[#6BA52A]/20",
  },
  {
    id: "scenario-services",
    badge: "CVC / services à domicile · États-Unis",
    name: "Scénario services à domicile",
    system: "Système de Réservation IA",
    plan: "Forfait Growth (199 $/mois)",
    timeline: "Construction en 4 jours · conçu pour des demandes de devis en semaine 1",
    headline: "Remplacer le bouche-à-oreille seul par un moteur de leads 24h/24.",
    challenge:
      "Une entreprise de chauffage-climatisation prospère fonctionne entièrement au bouche-à-oreille, sans site ni présence en ligne. Le gérant passe plus de 10 heures par semaine au téléphone à qualifier les demandes, planifier les devis et relancer ceux qui ne répondent plus.",
    solution: [
      "Site professionnel construit pour le marché local (zones d'intervention, certifications)",
      "Réceptionniste IA qui qualifie les demandes 24h/24 (besoin, urgence, adresse, budget)",
      "Demande de devis en ligne avec notification instantanée sur le téléphone du gérant",
      "Intégration de la fiche Google Business et référencement local",
      "Suivi Google Analytics 4 — quels quartiers génèrent le plus de demandes",
    ],
    results: [
      { metric: "10h/sem", label: "Objectif : temps admin gagné" },
      { metric: "24h/24", label: "Qualification des demandes" },
      { metric: "Instantané", label: "Alertes leads sur téléphone" },
      { metric: "100 %", label: "Demandes capturées & scorées" },
    ],
    capability:
      "L'IA qualifie les demandes en continu : le gérant ne parle qu'aux personnes déjà sérieuses — et plus aucune demande ne se perd dans la messagerie vocale.",
    color: "from-[#059669] to-[#10B981]",
    lightColor: "bg-[#ECFDF5]",
    borderColor: "border-[#10B981]/20",
  },
];

export default function FrenchCaseStudiesPage() {
  return (
    <>
      <FrenchNav enHref="/case-studies" />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-[#FAFAF7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Exemples de déploiements</p>
            <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] leading-tight mb-5">
              Ce qu&apos;un système Servolia{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">
                est conçu pour faire.
              </span>
            </h1>
            <p className="text-[#52525B] text-lg max-w-2xl mx-auto mb-4">
              Les scénarios ci-dessous montrent comment chaque système Servolia fonctionne pour une entreprise de services type — le problème, ce que nous construisons, et les résultats visés.
            </p>
            <p className="text-xs text-[#A1A1AA] max-w-xl mx-auto mb-10">
              Scénarios illustratifs basés sur des références typiques du secteur. Les objectifs affichés sont des cibles de conception, pas des résultats garantis — les résultats individuels varient. Des études de cas clients nommées seront publiées au fur et à mesure.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { n: "7 jours", label: "Du démarrage à la mise en ligne" },
                { n: "50 %", label: "Acompte pour démarrer" },
                { n: "10 %", label: "Remboursés par jour de retard" },
                { n: "100 %", label: "Propriété au paiement final" },
              ].map((s, i) => (
                <div key={i} className="p-4 rounded-2xl bg-[#F5F4EF] border border-[#D4D2CC] text-center">
                  <p className="text-2xl font-black text-[#18181B] mb-1">{s.n}</p>
                  <p className="text-xs text-[#71717A]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SCENARIOS */}
        <div className="bg-[#FAFAF7]">
          {cases.map((c, idx) => (
            <section key={c.id} id={c.id} className={`py-20 lg:py-28 ${idx % 2 === 0 ? "bg-[#FAFAF7]" : "bg-white"}`}>
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-10">
                  <span className="inline-block text-xs font-bold text-[#71717A] uppercase tracking-widest bg-white border border-[#E8E6E0] px-3 py-1 rounded-full mb-4">{c.badge}</span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#080E1C] leading-tight mb-3 max-w-3xl">
                    {c.headline}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${c.color} text-[#FAFAF7]`}>{c.system}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-[#71717A] bg-white border border-[#E8E6E0]">{c.plan}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-[#71717A] bg-white border border-[#E8E6E0] flex items-center gap-1"><Clock className="w-3 h-3" />{c.timeline}</span>
                  </div>
                </div>

                <div className="grid lg:grid-cols-5 gap-8">
                  <div className="lg:col-span-3 space-y-6">
                    <div className="p-6 rounded-2xl bg-white border border-[#E8E6E0]">
                      <h3 className="text-sm font-black text-[#080E1C] uppercase tracking-wide mb-3">Le défi</h3>
                      <p className="text-[#71717A] text-sm leading-relaxed">{c.challenge}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white border border-[#E8E6E0]">
                      <h3 className="text-sm font-black text-[#080E1C] uppercase tracking-wide mb-3">Ce que nous construisons</h3>
                      <ul className="space-y-2.5">
                        {c.solution.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#71717A]">
                            <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0 mt-0.5" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={`p-6 rounded-2xl border-2 ${c.borderColor} ${c.lightColor}`}>
                      <h3 className="text-sm font-black text-[#080E1C] uppercase tracking-wide mb-3">En pratique</h3>
                      <p className="text-[#080E1C] text-sm leading-relaxed">{c.capability}</p>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="p-6 rounded-2xl bg-[#FAFAF7]">
                      <h3 className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-5">Conçu pour livrer</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {c.results.map((r, i) => (
                          <div key={i} className="text-center p-4 rounded-xl bg-[#F5F4EF] border border-[#D4D2CC]">
                            <p className={`text-2xl font-black bg-gradient-to-r ${c.color} bg-clip-text text-transparent`}>{r.metric}</p>
                            <p className="text-xs text-[#71717A] mt-1 leading-tight">{r.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-[#E8E6E0]">
                      <p className="text-xs text-[#71717A] mb-1">Système utilisé</p>
                      <p className="font-black text-[#080E1C] text-sm mb-0.5">{c.system}</p>
                      <p className="text-xs text-[#71717A]">{c.plan}</p>
                    </div>
                    <Link href="/fr/audit"
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity">
                      Obtenir des résultats comme ça <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* CTA */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">À votre tour</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Vous voulez des résultats comme ceux-là ?
            </h2>
            <p className="text-[#52525B] mb-8 max-w-xl mx-auto">
              Commencez par un audit gratuit. Nous enregistrons une vidéo de 5 minutes de votre présence en ligne actuelle et vous montrons exactement quoi corriger — sans frais, sans engagement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/fr/audit"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Recevoir mon audit gratuit <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/fr/tarifs"
                className="px-8 py-4 rounded-xl border border-[#A1A1AA] text-[#18181B] font-semibold hover:bg-[#F5F4EF] transition-colors">
                Voir les tarifs
              </Link>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-5">Audit livré sous 24h · Sans appel · Sans carte bancaire</p>
          </div>
        </section>
      </main>
      <FrenchFooter />
    </>
  );
}
