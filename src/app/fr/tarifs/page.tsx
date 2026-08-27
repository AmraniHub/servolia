import type { Metadata } from "next";
import Link from "next/link";
import CarePlansSection from "@/components/CarePlansSection";
import { SETUP_PLAN, PLANS } from "@/lib/pricing";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import Guarantee from "@/components/Guarantee";
import CapacityBadge from "@/components/CapacityBadge";
import { getCapacity } from "@/lib/capacity";
import { CheckCircle, ArrowRight, Shield, Clock, Globe, Bot, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Tarifs — Servolia",
  description:
    "Une mise en place à 490 €, puis 149 à 449 €/mois tout compris : site, assistante IA 24 h/24, hébergement, domaine et email pro. Deux mois offerts en annuel.",
  alternates: {
    canonical: "https://servolia.com/fr/tarifs",
    languages: {
      "en-US": "https://servolia.com/pricing",
      "fr-FR": "https://servolia.com/fr/tarifs",
      "x-default": "https://servolia.com/pricing",
    },
  },
};


const processus = [
  { num: "01", title: "Audit gratuit", desc: "Remplissez un formulaire de 5 questions. Vous recevez un audit PDF sous 24 h." },
  { num: "02", title: "Validation du périmètre", desc: "Nous rédigeons le périmètre complet par écrit. Vous relisez et validez." },
  { num: "03", title: "Mise en place 490 €", desc: "Réglez la mise en place via Stripe pour lancer la production — offerte si vous payez la première année." },
  { num: "04", title: "Nous construisons", desc: "7 jours de production. Vous recevez une vidéo Loom à chaque étape." },
  { num: "05", title: "Validation + mise en ligne", desc: "Vous validez et votre formule mensuelle démarre. Nous mettons en ligne et vous remettons tout." },
];

const faqs = [
  { q: "Comment se passe le paiement ?", a: "Une mise en place de 490 € via Stripe pour lancer le projet — offerte si vous réglez votre première année. Ensuite, uniquement votre formule mensuelle, résiliable avec 30 jours de préavis, sans pénalité." },
  { q: "Y a-t-il des frais cachés ?", a: "Jamais. Le prix annoncé est le prix payé. Les outils tiers (hébergement, domaine, frais Stripe) sont en supplément et annoncés dès le départ. Nos honoraires ne réservent aucune surprise." },
  { q: "Proposez-vous des remboursements ?", a: "Si nous manquons la date de livraison convenue, nous remboursons 10 % par jour de retard, jusqu'à 50 % de la mise en place. Si nous ne livrons pas du tout, remboursement intégral de la mise en place. Voir la politique complète dans les CGV." },
  { q: "L'assistante IA donne-t-elle des conseils médicaux ?", a: "Jamais. Elle répond sur vos horaires, vos prestations, vos tarifs et l'accès au cabinet, prend le message et vous alerte. Toute question clinique est renvoyée vers vous, et une urgence déclarée est signalée immédiatement avec la consigne d'appeler. Vous relisez et validez ce qu'elle sait dire avant la mise en ligne." },
  { q: "Puis-je changer de formule ?", a: "À tout moment, vers le haut comme vers le bas. Si vous dépassez vos conversations incluses, nous vous faisons simplement passer à la formule au-dessus — jamais de facture surprise." },
];

// La capacité est lue à chaque requête — la rareté affichée ne doit jamais
// être périmée.
export const dynamic = "force-dynamic";

export default async function FrenchPricingPage() {
  const capacity = await getCapacity();
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
            Le prix est convenu par écrit avant de commencer. Mise en place via Stripe, puis votre formule mensuelle. Si un seul client récupéré par mois couvre le système, le calcul est vite fait.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#52525B]">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#36671E]" /> Livraison en 7 jours ou 10 % remboursés/jour (jusqu'à 50 %)</span>
            <span className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-[#36671E]" /> Prix fixe par écrit</span>
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#36671E]" /> Paiement sécurisé Stripe</span>
          </div>
          <div className="mt-8 flex justify-center">
            <CapacityBadge state={capacity} lang="fr" />
          </div>
        </div>
      </section>

      {/* Systems */}
      <section className="py-12 lg:py-16 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Etape 1 — le seul cout unique */}
            <div className="bg-white rounded-2xl border-2 border-[#E8E6E0] p-7 flex flex-col">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#A1A1AA] mb-3">Étape 1 · une seule fois</p>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#36671E] to-[#143424] flex items-center justify-center text-[#FAFAF7] mb-3 shadow-md">
                <Globe className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-[#18181B] mb-1">{SETUP_PLAN.nameFr}</h2>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-black text-[#18181B]">{SETUP_PLAN.totalEur} €</span>
                <span className="text-xs text-[#71717A]">HT, une fois</span>
              </div>
              <div className="flex items-center gap-1.5 mb-4">
                <Clock className="w-3.5 h-3.5 text-[#059669]" />
                <span className="text-xs font-semibold text-[#059669]">En ligne en 7 jours</span>
              </div>
              <ul className="flex flex-col gap-2 mb-6 flex-1">
                {[
                  "Votre site, rédigé et construit pour votre cabinet",
                  "Votre assistante IA formée sur vos prestations",
                  "Nom de domaine, hébergement, SSL et email pro configurés",
                  "Pages RGPD et bandeau cookies inclus",
                  "Un tour de modifications avant la mise en ligne",
                ].map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-[#3F3F46]">
                    <CheckCircle className="w-4 h-4 text-[#36671E] flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              {/* Pas de bouton séparé : la mise en place est encaissée par le
                  paiement de la formule ci-dessous — un seul endroit pour payer,
                  aucun risque d'avoir réglé l'un sans l'autre. */}
              <div className="rounded-xl bg-[#EEF5EA] p-3">
                <p className="text-xs font-black text-[#36671E] mb-1">Offerte si vous démarrez sur une formule annuelle.</p>
                <p className="text-xs text-[#52525B]">En mensuel, elle est prélevée une seule fois avec votre premier paiement ci-dessous — rien à acheter séparément.</p>
              </div>
            </div>

            {/* Etape 2 — le produit */}
            <div className="bg-[#0A1F14] rounded-2xl border-2 border-[#36671E] p-7 flex flex-col relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#36671E] opacity-50 rounded-full blur-3xl pointer-events-none" />
              <div className="relative flex flex-col h-full">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#ABDF90] mb-3">Étape 2 · chaque mois</p>
                <div className="w-10 h-10 rounded-xl bg-[#BEF264]/20 flex items-center justify-center text-[#ABDF90] mb-3">
                  <Bot className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-[#FAFAF7] mb-1">Votre formule</h2>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-black text-[#FAFAF7]">{PLANS.essentiel.monthlyEur}–{PLANS.performance.monthlyEur} €</span>
                  <span className="text-[#ABDF90]/70 text-sm">/mois</span>
                </div>
                <p className="text-[#ABDF90]/80 text-sm leading-relaxed mb-4">
                  C&apos;est le produit. Votre site reste hébergé et à jour, votre assistante IA continue de
                  répondre, et chaque demande arrive dans votre espace client. Les formules diffèrent par
                  le nombre de conversations incluses — rien n&apos;est réservé aux formules supérieures.
                </p>
                <ul className="flex flex-col gap-2 mb-6 flex-1">
                  {[
                    "Assistante IA 24 h/24 dans toutes les formules",
                    "Hébergement, domaine et email pro inclus",
                    "Alertes immédiates + espace client",
                    "Deux mois offerts en paiement annuel",
                  ].map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-[#FAFAF7]/85">
                      <CheckCircle className="w-4 h-4 text-[#BEF264] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <a href="#formules"
                  className="block text-center w-full py-3.5 rounded-xl font-bold text-sm bg-[#BEF264] text-[#0A1F14] hover:bg-[#D9F99D] transition-colors">
                  Comparer les formules ↓
                </a>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-[#71717A] mt-8">
            Vous hésitez ? Commencez par l&apos;
            <Link href="/fr/audit" className="font-bold text-[#36671E] hover:underline">audit gratuit</Link>
            {" "}— nous vous recommandons le bon système, sans engagement.
          </p>
        </div>
      </section>

      {/* Le processus — ce qui se passe après le choix d'une formule */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Le processus</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#18181B]">Ce qui se passe après avoir choisi votre formule</h2>
          </div>
          <div className="relative">
            <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-[#36671E]/30 via-[#6BA52A]/40 to-[#ABDF90]/20 hidden sm:block" />
            <div className="flex flex-col gap-5">
              {processus.map((s, i) => (
                <div key={i} className="flex items-start gap-5 sm:pl-12 relative">
                  <div className="sm:absolute sm:left-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#36671E] to-[#295115] flex items-center justify-center text-[#18181B] text-xs font-black flex-shrink-0 shadow-md shadow-[#6BA52A]/20">
                    {s.num}
                  </div>
                  <div className="bg-[#FAFAF7] rounded-xl px-5 py-4 flex-1 border border-[#E8E6E0]">
                    <p className="font-black text-[#18181B] text-sm mb-0.5">{s.title}</p>
                    <p className="text-[#71717A] text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Formules mensuelles (tout compris, mensuel/annuel — 2 mois offerts) */}
      <div id="formules" />
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
              <strong className="text-[#18181B]">10 % de la mise en place par jour de retard, jusqu'à 50 %</strong> — automatiquement.
              Prix fixe par écrit avant tout paiement. Tous les fichiers vous appartiennent au paiement final.
            </p>
          </div>
        </div>
      </section>

      {/* Questions fréquentes sur les tarifs */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-[#18181B] mb-2">Questions fréquentes sur les tarifs</h2>
          </div>
          <div className="flex flex-col gap-4">
            {faqs.map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E8E6E0] p-5 shadow-sm">
                <h3 className="font-bold text-[#18181B] text-sm mb-2">{f.q}</h3>
                <p className="text-[#52525B] text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-white">
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
