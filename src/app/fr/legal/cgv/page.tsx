import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente (CGV) — Servolia",
  description: "Conditions générales de vente de Servolia, en français.",
  alternates: {
    canonical: "https://servolia.com/fr/legal/cgv",
    languages: {
      "en-US": "https://servolia.com/legal/cgv",
      "fr-FR": "https://servolia.com/fr/legal/cgv",
      "x-default": "https://servolia.com/legal/cgv",
    },
  },
};

export default function CgvFrPage() {
  return (
    <main className="flex flex-col bg-white">
      <FrenchNav enHref="/legal/cgv" />
      <section className="bg-[#FAFAF7] pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Légal</p>
          <h1 className="text-4xl font-black text-[#18181B]">Conditions Générales de Vente</h1>
          <p className="text-[#52525B] mt-2">Dernière mise à jour : juillet 2026</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 text-[#3F3F46] text-sm leading-relaxed">
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">1. Prestataire</h2>
              <p>Servolia est un studio de services numériques : création de sites web, systèmes IA et automatisation pour entreprises. Les prestations sont fournies dans le cadre d&apos;un accord écrit confirmé par email. Contact : hello@servolia.com</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">2. Commande et acceptation</h2>
              <p>Une commande est confirmée lorsque : (a) le client a validé la proposition écrite envoyée par Servolia, et (b) l&apos;acompte a été réglé via Stripe. Le travail ne démarre qu&apos;après confirmation de l&apos;acompte.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">3. Prix et paiement</h2>
              <p>Tous les prix sont en euros et s&apos;entendent hors taxes sauf mention contraire. Modalités : acompte de 50 % à la confirmation de commande, solde de 50 % le jour de la livraison. Les paiements sont traités de manière sécurisée via Stripe. Les abonnements mensuels sont prélevés automatiquement chaque mois.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">4. Livraison</h2>
              <p>Servolia s&apos;engage à livrer le périmètre convenu dans le délai annoncé (3 à 7 jours ouvrés selon la formule). Le délai court à partir de la réception de l&apos;acompte ET de la complétion du formulaire d&apos;intake par le client. Si Servolia manque la date convenue de son propre fait, le client a droit à un remboursement de 10 % par jour de retard, plafonné à 50 % du prix total.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">5. Révisions</h2>
              <p>Chaque formule inclut un nombre défini de tours de révision (Essentiel : 2 tours ; Système IA : 3 tours ; Pro : illimité le premier mois). Un tour de révision correspond à une liste consolidée de modifications transmise en un seul document. Les tours supplémentaires sont facturés 50 € / heure.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">6. Obligations du client</h2>
              <p>Le client s&apos;engage à : fournir des informations exactes sur son activité, relire et valider les livrables sous 5 jours ouvrés, et fournir les contenus ou images spécifiques qu&apos;il souhaite utiliser. Les retards imputables au client ne prolongent pas la garantie de livraison de Servolia.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">7. Propriété intellectuelle</h2>
              <p>Au paiement intégral, le client devient pleinement propriétaire de tous les fichiers, maquettes et contenus créés par Servolia. Servolia conserve le droit de présenter le projet dans son portfolio, sauf accord écrit contraire.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">8. Remboursements</h2>
              <p>L&apos;acompte de 50 % n&apos;est pas remboursable une fois le travail commencé. Si Servolia ne livre pas le périmètre convenu, le client a droit à un remboursement intégral. Les abonnements mensuels sont remboursables pour le mois en cours si l&apos;annulation intervient dans les 5 jours suivant la facturation. Aucun remboursement partiel au-delà de cette fenêtre.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">9. Résiliation des abonnements</h2>
              <p>Les abonnements mensuels sont résiliables à tout moment par email à hello@servolia.com avec un préavis de 30 jours. Aucune pénalité. Le client conserve tous les éléments produits pendant la période d&apos;abonnement.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">10. Limitation de responsabilité</h2>
              <p>Servolia n&apos;est pas responsable des résultats commerciaux (demandes, chiffre d&apos;affaires, rendez-vous), ceux-ci dépendant de conditions de marché hors de notre contrôle. Nous garantissons la livraison du périmètre technique convenu. Notre responsabilité est en tout état de cause limitée au montant payé par le client pour la prestation concernée.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">11. Droit applicable</h2>
              <p>Les présentes conditions sont régies par le droit français. Tout litige fera d&apos;abord l&apos;objet d&apos;une tentative de résolution amiable. À défaut, les tribunaux français compétents seront saisis.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">12. Contact</h2>
              <p>Pour toute question sur ces conditions : <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a></p>
            </div>
          </div>
        </div>
      </section>
      <FrenchFooter />
    </main>
  );
}
