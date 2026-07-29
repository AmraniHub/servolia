import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import { SETUP_PLAN, PLANS } from "@/lib/pricing";
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
              <p>Une commande est confirmée lorsque : (a) le client a validé le périmètre écrit envoyé par Servolia, et (b) les frais de mise en place de {SETUP_PLAN.totalEur} € ont été réglés via Stripe — ou, pour un client démarrant sur une formule annuelle, le premier paiement annuel. Le travail ne démarre qu&apos;après confirmation de ce paiement.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">3. Prix et paiement</h2>
              <p>Tous les prix sont en euros et s&apos;entendent hors taxes sauf mention contraire. Modalités : des frais de mise en place de {SETUP_PLAN.totalEur} €, une seule fois, dus au démarrage et offerts en cas de paiement annuel d&apos;avance. L&apos;abonnement mensuel est ensuite prélevé automatiquement chaque mois ({PLANS.essentiel.monthlyEur} € {PLANS.essentiel.nameFr}, {PLANS.croissance.monthlyEur} € {PLANS.croissance.nameFr}, {PLANS.performance.monthlyEur} € {PLANS.performance.nameFr}, selon la formule choisie), ou réglé annuellement au tarif de dix mois pour douze mois. Les paiements sont traités de manière sécurisée via Stripe. Rien n&apos;est dû le jour de la livraison.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">4. Livraison</h2>
              <p>Servolia s&apos;engage à livrer le périmètre convenu dans le délai annoncé (7 jours à compter du démarrage des travaux). Le délai court à partir de la réception des frais de mise en place ET de la complétion du formulaire d&apos;intake par le client. Si Servolia manque la date convenue de son propre fait, le client a droit à un remboursement de 10 % par jour de retard, plafonné à 50 % du prix total. Les retards imputables au client ne sont pas comptabilisés dans cette garantie.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">4 bis. Garantie de temps de réponse (« Zéro demande manquée »)</h2>
              <p>À compter de la mise en ligne du site, Servolia garantit que <strong>toute demande adressée à la réceptionniste IA sur le site hébergé par Servolia reçoit une réponse en moins de 60 secondes, 24 h/24</strong>. Les temps de réponse sont mesurés à partir des horodatages serveur de Servolia, que le client peut consulter à tout moment dans son espace client.</p>
              <p className="mt-3">Si une seule demande d&apos;un mois civil donné reste sans réponse au-delà de 60 secondes, l&apos;abonnement mensuel du client <strong>pour ce mois est intégralement remboursé</strong>, sur demande ou automatiquement lorsque Servolia détecte le manquement en premier. Les frais de mise en place et les options ne sont pas couverts par cette garantie. Le dédommagement est limité à l&apos;abonnement de ce mois et ne couvre aucun préjudice indirect.</p>
              <p className="mt-3">La garantie ne s&apos;applique pas lorsque le manquement résulte : d&apos;une panne du domaine, du DNS ou de l&apos;hébergement du client lorsque celui-ci en a repris la gestion ; d&apos;une suspension pour défaut de paiement ; d&apos;une modification apportée par le client ou un tiers au site ou à la configuration de la réceptionniste IA ; d&apos;une maintenance programmée annoncée au moins 48 heures à l&apos;avance ; ou d&apos;un cas de force majeure, y compris la défaillance d&apos;un fournisseur d&apos;IA en amont persistant malgré les systèmes de secours de Servolia.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">5. Révisions</h2>
              <p>La mise en place inclut <strong>une série de révisions</strong> avant la mise en ligne. Une série de révisions correspond à une liste consolidée de modifications transmise en un seul document. Les séries supplémentaires, ainsi que toute modification demandée après la mise en ligne, sont facturées 50 € / heure ou chiffrées au forfait au préalable.</p>
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
              <p>Les frais de mise en place de {SETUP_PLAN.totalEur} € ne sont pas remboursables une fois le travail commencé. Si Servolia ne livre pas du tout le périmètre convenu, ils sont intégralement remboursés. L&apos;abonnement mensuel est remboursable pour le mois en cours si l&apos;annulation intervient dans les 5 jours suivant la date de facturation de ce mois. Au-delà de cette fenêtre, le mois en cours n&apos;est pas remboursable, mais la facturation future s&apos;arrête.</p>
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
