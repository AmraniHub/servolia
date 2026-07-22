import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import Link from "next/link";
import { ArrowRight, CheckCircle, Target, Heart, Zap } from "lucide-react";
import type { Metadata } from "next";
import ValueStack from "@/components/ValueStack";

export const metadata: Metadata = {
  title: "À propos de Servolia — Construit par un opérateur, pour des opérateurs",
  description:
    "Servolia est une agence de systèmes d'acquisition client par IA pour les entreprises de services en Europe et aux États-Unis. Sites IA et systèmes de leads à prix fixe, livrés en 7 jours.",
  alternates: {
    canonical: "https://servolia.com/fr/a-propos",
    languages: {
      "en-US": "https://servolia.com/about",
      "fr-FR": "https://servolia.com/fr/a-propos",
      "x-default": "https://servolia.com/about",
    },
  },
};

export default function FrenchAboutPage() {
  return (
    <>
      <FrenchNav enHref="/about" />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">À propos</p>
            <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] leading-tight mb-6">
              Nous construisons le système IA que votre agence aurait dû construire —{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">en 7 jours, à prix fixe.</span>
            </h1>
            <p className="text-lg text-[#52525B] leading-relaxed">
              Servolia est une agence de systèmes d&apos;acquisition client par IA pour les entreprises de services — cabinets dentaires, cliniques esthétiques, agents immobiliers et services à domicile. Pas de projets sans fin ni de facturation à l&apos;heure : nous livrons un système opérationnel en une semaine, puis nous le faisons tourner pour un petit forfait mensuel.
            </p>
          </div>
        </section>

        {/* MISSION */}
        <section className="py-16 lg:py-20 bg-white border-y border-[#E8E6E0]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
                <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center mb-3">
                  <Target className="w-5 h-5 text-[#FAFAF7]" />
                </div>
                <h3 className="font-black text-[#18181B] mb-2">Le résultat avant tout</h3>
                <p className="text-sm text-[#52525B] leading-relaxed">Nous nous mesurons aux réservations, aux leads et au chiffre d&apos;affaires que votre système génère — pas aux heures facturées.</p>
              </div>
              <div className="p-6 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
                <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-[#FAFAF7]" />
                </div>
                <h3 className="font-black text-[#18181B] mb-2">Rapide, fixe, fini</h3>
                <p className="text-sm text-[#52525B] leading-relaxed">Périmètre verrouillé par écrit. Prix verrouillé par écrit. Date verrouillée par écrit. Puis nous livrons.</p>
              </div>
              <div className="p-6 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
                <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center mb-3">
                  <Heart className="w-5 h-5 text-[#FAFAF7]" />
                </div>
                <h3 className="font-black text-[#18181B] mb-2">Bien après le lancement</h3>
                <p className="text-sm text-[#52525B] leading-relaxed">Votre forfait mensuel garde le système rapide, l&apos;IA affûtée et les rapports honnêtes. Nous grandissons avec vous.</p>
              </div>
            </div>
          </div>
        </section>

        {/* WHY */}
        <section className="py-16 lg:py-24 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Pourquoi Servolia existe</p>
            <h2 className="text-3xl font-black text-[#18181B] leading-tight mb-6">
              Les entreprises de services n&apos;ont pas besoin d&apos;un site de plus. Elles ont besoin d&apos;un système qui amène des clients.
            </h2>
            <div className="space-y-4 text-[15px] text-[#3F3F46] leading-relaxed">
              <p>
                La plupart des cabinets dentaires, cliniques esthétiques et entreprises de services que nous rencontrons ont un site qui fait une seule chose correctement : <em>être joli</em>. Il ne répond pas aux questions après la fermeture. Il ne capture pas les demandes quand le téléphone est occupé. Il ne vous dit pas quelle publicité a amené un client payant.
              </p>
              <p>
                Servolia existe pour corriger ça. Nous remplaçons votre ancien site par un système d&apos;acquisition client propulsé par l&apos;IA — site, chatbot, réservation, capture de leads, suivi complet — en 7 jours, pour un prix connu à l&apos;avance.
              </p>
              <p>
                Puis nous restons. Votre forfait mensuel maintient tout en marche : hébergement, sécurité, réentraînement de l&apos;IA, rapports de performance mensuels et une amélioration par mois. Le genre de partenariat qu&apos;une agence locale promet mais tient rarement.
              </p>
            </div>
          </div>
        </section>

        {/* PRINCIPLES */}
        <section className="py-16 lg:py-20 bg-white border-y border-[#E8E6E0]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#18181B] mb-8">Notre façon de travailler</h2>
            <ul className="space-y-4">
              {[
                ["Audit gratuit avant tout.", "Nous enregistrons une vidéo de 5 minutes sur votre présence en ligne actuelle — ce qui fonctionne, ce qui vous coûte des clients, et ce que nous corrigerions. Sans engagement, sans appel."],
                ["Périmètre écrit avant tout paiement.", "Chaque projet commence par un document d'une page. Livrables fixes. Prix fixe. Date fixe. Validé par vous avant toute facture."],
                ["50 % d'acompte, 50 % à la livraison.", "Vous voyez votre système terminé avant de payer le solde. Si vous n'êtes pas satisfait, nous révisons. Si nous manquons la date par notre faute, nous remboursons 10 % par jour de retard."],
                ["Une série de révisions incluse.", "Les ajouts majeurs sont chiffrés séparément. Pas de factures surprises, pas de facturation à l'heure, pas de jeux d'agence."],
                ["Nous ne disparaissons jamais.", "Point d'avancement chaque semaine. Réponse aux emails le jour même. Vidéos explicatives à chaque étape clé."],
              ].map(([title, body], i) => (
                <li key={i} className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-[#36671E] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#18181B]">{title}</p>
                    <p className="text-sm text-[#52525B] mt-1 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#36671E]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-[#FAFAF7] mb-4">
              Envie de voir ce que nous construirions pour vous ?
            </h2>
            <p className="text-[#FAFAF7]/80 mb-8 max-w-xl mx-auto">
              Demandez un audit gratuit. Nous enregistrons une vidéo de 5 minutes montrant exactement ce que nous corrigerions sur votre site actuel pour attirer plus de clients. Sans appel, sans carte bancaire.
            </p>
            <Link href="/fr/audit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#FAFAF7] text-[#36671E] font-black hover:bg-white transition-colors">
              Demander mon audit gratuit <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <ValueStack lang="fr" />
      <FrenchFooter />
    </>
  );
}
