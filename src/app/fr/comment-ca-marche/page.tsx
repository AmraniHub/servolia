import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import VideoEmbed from "@/components/VideoEmbed";
import Link from "next/link";
import { ArrowRight, FileText, Video, CreditCard, ClipboardList, Hammer, Eye, Rocket, BarChart3, MessageSquare, CheckCircle } from "lucide-react";
import type { Metadata } from "next";
import ValueStack from "@/components/ValueStack";
import Guarantee from "@/components/Guarantee";

const DEMO_VIDEO_ID = process.env.NEXT_PUBLIC_DEMO_VIDEO_ID;

export const metadata: Metadata = {
  title: "Comment ça marche — Servolia",
  description:
    "De l'audit gratuit au système IA en ligne en 7 jours. Découvrez le processus de livraison Servolia — ce qui se passe, quand, et ce que vous devez faire.",
  alternates: {
    canonical: "https://servolia.com/fr/comment-ca-marche",
    languages: {
      "en-US": "https://servolia.com/how-it-works",
      "fr-FR": "https://servolia.com/fr/comment-ca-marche",
      "x-default": "https://servolia.com/how-it-works",
    },
  },
};

const steps = [
  {
    num: "01",
    icon: <FileText className="w-5 h-5" />,
    title: "Vous demandez un audit gratuit",
    who: "Vous",
    time: "5 minutes",
    desc: "Remplissez le formulaire d'audit. Indiquez votre activité, votre plus gros problème et l'adresse de votre site actuel. Aucun appel téléphonique requis.",
    detail: "Nous demandons 8 informations : nom de l'entreprise, site web, pays, secteur, problèmes principaux (choix multiple), valeur moyenne d'un client, email et téléphone. C'est tout.",
    color: "from-[#36671E] to-[#295115]",
  },
  {
    num: "02",
    icon: <Video className="w-5 h-5" />,
    title: "Vous recevez votre audit vidéo sous 24h",
    who: "Servolia",
    time: "Sous 24 heures",
    desc: "Nous enregistrons une vidéo de 5 minutes qui analyse votre présence en ligne actuelle — ce qui vous coûte des clients et ce que nous corrigerions.",
    detail: "Ce n'est pas un modèle générique. Nous examinons votre site, votre fiche Google Maps, vos concurrents dans la même ville et votre parcours de réservation. Des observations précises, pas des conseils vagues.",
    color: "from-[#295115] to-[#6B8439]",
  },
  {
    num: "03",
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Appel découverte de 15 min (optionnel)",
    who: "Vous (optionnel)",
    time: "À votre convenance",
    desc: "Si vous voulez discuter de l'audit, poser des questions ou approfondir — nous sommes disponibles. Si l'audit suffit à vous convaincre, passez directement à l'étape 4.",
    detail: "Aucune vente forcée. Si Servolia est le bon choix, l'audit le rend évident. Nous ne relançons pas avec pression. Si vous êtes prêt, nous envoyons le document de périmètre.",
    color: "from-[#059669] to-[#10B981]",
  },
  {
    num: "04",
    icon: <FileText className="w-5 h-5" />,
    title: "Périmètre confirmé par écrit",
    who: "Servolia",
    time: "Le jour même",
    desc: "Nous envoyons un document d'une page : exactement ce que nous construisons, ce qui n'est pas inclus, le prix fixe et la date de livraison. Vous validez avant tout paiement.",
    detail: "Cela vous protège. Aucune dérive de périmètre possible puisque tout est convenu par écrit d'abord. Si vous voulez ajouter quelque chose plus tard, nous le chiffrons séparément — sans surprise.",
    color: "from-[#F59E0B] to-[#EF4444]",
  },
  {
    num: "05",
    icon: <CreditCard className="w-5 h-5" />,
    title: "Acompte de 50 % via Stripe",
    who: "Vous",
    time: "2 minutes",
    desc: "Réglez votre acompte de 50 % via notre paiement Stripe. Reçu immédiat, et la construction démarre le jour ouvré suivant.",
    detail: "Toutes les cartes principales acceptées. EUR et USD. Votre paiement est protégé par Stripe — l'infrastructure de paiement la plus fiable au monde. Les 50 % restants ne sont dus qu'à la livraison.",
    color: "from-[#6366F1] to-[#8B5CF6]",
  },
  {
    num: "06",
    icon: <ClipboardList className="w-5 h-5" />,
    title: "Vous remplissez le formulaire de démarrage",
    who: "Vous",
    time: "8 minutes",
    desc: "Juste après le paiement, vous êtes redirigé vers un formulaire en 5 étapes : informations, image de marque, services, objectifs et configuration technique.",
    detail: "Nous demandons votre logo (un lien Google Drive suffit), vos couleurs, vos services avec prix, votre client cible, 3 concurrents, votre nom de domaine et votre langue. Plus vous êtes précis, moins d'allers-retours.",
    color: "from-[#EC4899] to-[#F43F5E]",
  },
  {
    num: "07",
    icon: <Hammer className="w-5 h-5" />,
    title: "Nous construisons votre système",
    who: "Servolia",
    time: "3–7 jours",
    desc: "Nous construisons selon notre checklist de livraison en 22 étapes. Chaque système passe un contrôle qualité avant que vous le voyiez — test mobile, vitesse, formulaires, conformité RGPD.",
    detail: "Nous utilisons Next.js, l'IA pour le chatbot, Vercel pour l'hébergement et Stripe pour les paiements. Votre système est rapide, sécurisé et durable — pas un template WordPress.",
    color: "from-[#36671E] to-[#295115]",
  },
  {
    num: "08",
    icon: <Eye className="w-5 h-5" />,
    title: "Présentation vidéo de votre maquette",
    who: "Servolia",
    time: "Jour 3–5",
    desc: "Nous enregistrons une présentation complète de votre version de travail — page par page, fonction par fonction. Vous voyez tout avant le paiement final.",
    detail: "C'est ici que vous donnez votre avis. Une série de révisions est incluse dans chaque formule : textes, ajustements de design, réglages de fonctionnalités. Les ajouts majeurs sont chiffrés séparément.",
    color: "from-[#06B6D4] to-[#3B82F6]",
  },
  {
    num: "09",
    icon: <CreditCard className="w-5 h-5" />,
    title: "Paiement final → mise en ligne",
    who: "Vous",
    time: "Jour 5–7",
    desc: "Une fois la maquette validée, nous envoyons un lien de paiement Stripe pour les 50 % restants. Paiement reçu → mise en ligne sous 24 heures.",
    detail: "La mise en ligne comprend : connexion du domaine, SSL, tests finaux mobile et ordinateur, activation de Google Analytics, vérification du Pixel Meta (si inclus) et activation du chatbot.",
    color: "from-[#059669] to-[#10B981]",
  },
  {
    num: "10",
    icon: <Rocket className="w-5 h-5" />,
    title: "Votre système est en ligne",
    who: "Les deux",
    time: "Jour 7",
    desc: "Votre système IA est en ligne, testé et reçoit du trafic. Vous recevez un email de lancement avec vos identifiants, vos statistiques de départ et ce qui vous attend les 30 premiers jours.",
    detail: "La réceptionniste IA commence à répondre aux demandes dès le premier jour — même à 2h du matin.",
    color: "from-[#F59E0B] to-[#EF4444]",
  },
  {
    num: "11",
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Votre forfait mensuel s'active",
    who: "Servolia",
    time: "Jour 30",
    desc: "Au jour 30, votre forfait mensuel est prélevé automatiquement via Stripe. Il couvre l'hébergement, la surveillance, le réentraînement du chatbot et votre rapport mensuel.",
    detail: "Vous recevez un PDF d'une page le 5 de chaque mois : leads capturés, rendez-vous pris, principale source de trafic, conversations du chatbot et une recommandation d'amélioration pour le mois suivant.",
    color: "from-[#36671E] to-[#295115]",
  },
];

export default function FrenchHowItWorksPage() {
  return (
    <>
      <FrenchNav enHref="/how-it-works" />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-[#FAFAF7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Le processus</p>
            <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] leading-tight mb-5">
              De l&apos;audit au système IA en ligne.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">
                En 7 jours.
              </span>
            </h1>
            <p className="text-[#52525B] text-lg max-w-2xl mx-auto mb-8">
              Un processus fixe, un prix fixe et une date fixe — confirmés par écrit avant que vous ne payiez un seul centime.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-[#71717A]">
              {["Audit gratuit → sans engagement", "Périmètre écrit d'abord", "Acompte de 50 % pour démarrer", "Solde uniquement à la livraison", "En ligne en 7 jours ou remboursé"].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#36671E]" />{t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VIDEO — n'apparaît qu'une fois une vraie vidéo enregistrée et NEXT_PUBLIC_DEMO_VIDEO_ID défini */}
        {DEMO_VIDEO_ID && (
          <section className="pb-16 lg:pb-20 bg-[#FAFAF7]">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <VideoEmbed videoId={DEMO_VIDEO_ID} title="Voir l'IA gérer une vraie demande en direct" />
            </div>
          </section>
        )}

        {/* STEPS */}
        <section className="py-16 lg:py-24 bg-[#FAFAF7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[#36671E]/50 via-[#ABDF90]/20 to-transparent hidden md:block" />
              <div className="space-y-6">
                {steps.map((s, i) => (
                  <div key={i} className="relative flex gap-6">
                    <div className={`hidden md:flex w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} items-center justify-center text-[#FAFAF7] shrink-0 shadow-md z-10`}>
                      {s.icon}
                    </div>
                    <div className="flex-1 bg-white rounded-2xl border border-[#E8E6E0] p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-[#52525B] tracking-widest">{s.num}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${s.color} text-[#FAFAF7]`}>{s.who}</span>
                          </div>
                          <h3 className="text-base font-black text-[#080E1C]">{s.title}</h3>
                        </div>
                        <span className="text-xs font-medium text-[#71717A] bg-[#FAFAF7] border border-[#E8E6E0] px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">{s.time}</span>
                      </div>
                      <p className="text-sm text-[#374151] mb-2 leading-relaxed">{s.desc}</p>
                      <p className="text-xs text-[#71717A] leading-relaxed">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#080E1C] mb-8 text-center">Questions sur le processus</h2>
            <div className="grid md:grid-cols-2 gap-5">
              {[
                { q: "Dois-je rédiger les textes du site ?", a: "Non. Nous rédigeons tout à partir de vos réponses au formulaire de démarrage. Vous relisez et validez avant la mise en ligne." },
                { q: "Et si je n'ai pas de logo ?", a: "Aucun problème. Nous travaillons avec ce que vous avez, ou proposons un logotype simple qui correspond à votre style." },
                { q: "Puis-je demander des modifications après avoir vu la maquette ?", a: "Oui — une série complète de révisions est incluse dans chaque formule. Les ajouts majeurs sont chiffrés séparément." },
                { q: "Dans quelle langue le site est-il construit ?", a: "Au choix : français, anglais ou les deux. Nous sommes bilingues et avons livré des sites dans les deux langues." },
                { q: "Qui héberge le site ?", a: "Nous l'hébergeons sur Vercel (la même infrastructure que de grandes plateformes mondiales) via votre forfait mensuel." },
                { q: "Et si vous manquez la date de livraison ?", a: "Nos CGV garantissent 10 % de votre paiement remboursés par jour de retard si le retard vient de nous. Nous n'avons jamais eu à le payer." },
              ].map((faq, i) => (
                <div key={i} className="p-5 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
                  <h3 className="text-sm font-black text-[#080E1C] mb-2">{faq.q}</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-black text-[#18181B] mb-4">Prêt à démarrer ?</h2>
            <p className="text-[#52525B] mb-8">L&apos;étape 1 prend 5 minutes et ne coûte rien.</p>
            <Link href="/fr/audit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black hover:opacity-90 transition-opacity">
              Demander mon audit gratuit <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-[#A1A1AA] mt-4">Sans appel · Vidéo envoyée sous 24h · Sans carte bancaire</p>
          </div>
        </section>
      </main>
      <ValueStack lang="fr" />
      <Guarantee lang="fr" />
      <FrenchFooter />
    </>
  );
}
