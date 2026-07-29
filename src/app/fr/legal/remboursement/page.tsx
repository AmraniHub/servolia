import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import Link from "next/link";
import { SETUP_PLAN, PLANS } from "@/lib/pricing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de remboursement — Servolia",
  description: "La politique de remboursement de Servolia — dont la garantie de 10 % par jour de retard de livraison.",
  alternates: {
    canonical: "https://servolia.com/fr/legal/remboursement",
    languages: {
      "en-US": "https://servolia.com/legal/refund",
      "fr-FR": "https://servolia.com/fr/legal/remboursement",
      "x-default": "https://servolia.com/legal/refund",
    },
  },
};

export default function RemboursementPage() {
  return (
    <main className="flex flex-col bg-white">
      <FrenchNav enHref="/legal/refund" />
      <section className="bg-[#FAFAF7] pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Légal</p>
          <h1 className="text-4xl font-black text-[#18181B]">Politique de remboursement</h1>
          <p className="text-[#52525B] mt-2">Dernière mise à jour : juillet 2026</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 text-[#3F3F46] text-sm leading-relaxed">
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">1. Notre engagement</h2>
              <p>Servolia livre des prestations numériques (sites web, réceptionnistes IA, portails client, alertes de contact) sous forme d&apos;une mise en place unique, à périmètre et délai fixes, suivie d&apos;un abonnement mensuel. Chaque projet étant réalisé sur mesure, les remboursements fonctionnent différemment de ceux des biens physiques — cette page explique exactement quand et comment un remboursement s&apos;applique.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">2. Garantie de livraison</h2>
              <p>Si nous manquons la date de livraison convenue de notre propre fait, vous avez droit à un remboursement de <strong>10 % du prix du projet par jour de retard</strong>, plafonné à 50 % du prix total. Le délai court à partir de la réception de vos frais de mise en place et de la complétion de votre formulaire d&apos;intake. Les retards qui vous sont imputables ne sont pas comptabilisés dans cette garantie.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">2 bis. Garantie de temps de réponse (« Zéro demande manquée »)</h2>
              <p>Une fois votre site en ligne, chaque demande adressée à votre réceptionniste IA reçoit une réponse <strong>en moins de 60 secondes, 24 h/24</strong>. Si une seule demande d&apos;un mois civil reste sans réponse au-delà de 60 secondes, <strong>l&apos;abonnement de ce mois est intégralement remboursé</strong> &mdash; automatiquement si nous le détectons en premier, ou sur simple demande. Les temps de réponse proviennent d&apos;horodatages serveur que vous pouvez vérifier vous-même dans votre espace client. Les exclusions et le texte complet figurent à l&apos;article 4 bis des <Link href="/fr/legal/cgv" className="text-[#36671E] underline">CGV</Link>.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">3. Remboursement des frais de mise en place</h2>
              <p>Les frais de mise en place de {SETUP_PLAN.totalEur} € sont <strong>non remboursables une fois le travail commencé</strong> — ils couvrent le temps de conception et de développement déjà engagé sur votre projet. Si Servolia ne peut pas livrer du tout le périmètre convenu, ils vous sont <strong>intégralement remboursés</strong>.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">4. Le jour de la livraison</h2>
              <p>Rien n&apos;est dû le jour de la livraison : il n&apos;y a pas de solde à régler. Une fois votre site en ligne, relu et validé par vos soins, votre abonnement mensuel démarre simplement. Vous n&apos;êtes jamais facturé pour un travail que vous n&apos;avez pas approuvé.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">5. Abonnements mensuels</h2>
              <p>Votre formule mensuelle ({PLANS.essentiel.monthlyEur} €, {PLANS.croissance.monthlyEur} € ou {PLANS.performance.monthlyEur} € selon la formule — le site, la réceptionniste IA, l&apos;hébergement, le domaine et l&apos;email) est facturée automatiquement chaque mois. En cas d&apos;annulation dans les <strong>5 jours</strong> suivant la date de facturation du mois, le mois est intégralement remboursé. Au-delà, le mois en cours n&apos;est pas remboursable, mais vous pouvez résilier à tout moment pour arrêter la facturation future — sans pénalité, avec 30 jours de préavis par email.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">6. Ce qui n&apos;est pas couvert</h2>
              <p>Les remboursements ne s&apos;appliquent pas : aux retards imputables au client (retours tardifs, contenus manquants, intake incomplet), aux travaux sur mesure déjà validés et livrés, ni à une insatisfaction liée aux résultats commerciaux (demandes, rendez-vous, chiffre d&apos;affaires) qui dépendent de facteurs hors de notre contrôle.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">7. Comment demander un remboursement</h2>
              <p>Écrivez à <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a> avec les détails de votre commande et le motif de la demande. Nous répondons sous 2 jours ouvrés et traitons les remboursements approuvés vers votre moyen de paiement d&apos;origine via Stripe sous 5 à 10 jours ouvrés.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">8. Conditions complètes</h2>
              <p>Cette page résume les conditions de remboursement de nos <Link href="/fr/legal/cgv" className="text-[#36671E] underline">Conditions Générales de Vente</Link>, qui régissent l&apos;ensemble des prestations payantes.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">9. Contact</h2>
              <p>Une question sur un remboursement : <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a></p>
            </div>
          </div>
        </div>
      </section>
      <FrenchFooter />
    </main>
  );
}
