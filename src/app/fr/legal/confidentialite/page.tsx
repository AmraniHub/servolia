import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Servolia",
  description: "Politique de confidentialité de Servolia et conformité RGPD.",
  alternates: {
    canonical: "https://servolia.com/fr/legal/confidentialite",
    languages: {
      "en-US": "https://servolia.com/legal/privacy",
      "fr-FR": "https://servolia.com/fr/legal/confidentialite",
      "x-default": "https://servolia.com/legal/privacy",
    },
  },
};

export default function ConfidentialitePage() {
  return (
    <main className="flex flex-col bg-white">
      <FrenchNav enHref="/legal/privacy" />
      <section className="bg-[#FAFAF7] pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Légal</p>
          <h1 className="text-4xl font-black text-[#18181B]">Politique de confidentialité</h1>
          <p className="text-[#52525B] mt-2">Dernière mise à jour : juillet 2026</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 text-[#3F3F46] text-sm leading-relaxed">
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">1. Qui sommes-nous</h2>
              <p>Servolia (« nous ») est un studio de systèmes web IA : sites web, réceptionnistes IA, systèmes de capture de demandes et automatisation pour les entreprises de services en Europe. Contact : <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a></p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">2. Données collectées</h2>
              <p>Nous collectons les données que vous fournissez volontairement via nos formulaires : nom, adresse email, nom de l&apos;entreprise, adresse du site web et le contenu de votre message. Nous ne collectons aucune donnée à votre insu.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">3. Finalités du traitement</h2>
              <p>Vos données servent à : (a) répondre à votre demande d&apos;audit ou de service, (b) vous envoyer l&apos;audit gratuit, (c) communiquer sur votre projet, (d) vous envoyer occasionnellement des informations utiles si vous y avez consenti. Nous ne vendons jamais vos données à des tiers.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">4. Base légale (RGPD)</h2>
              <p>Au sens du RGPD, nos bases légales sont l&apos;intérêt légitime (répondre à votre demande) et l&apos;exécution contractuelle (fournir les services achetés). Pour les communications marketing, nous nous appuyons sur votre consentement explicite.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">5. Durée de conservation</h2>
              <p>Les données des demandes de contact sont conservées jusqu&apos;à 24 mois. Les données des projets clients sont conservées jusqu&apos;à 5 ans à des fins comptables. Vous pouvez demander leur suppression à tout moment.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">6. Cookies</h2>
              <p id="cookies">Nous utilisons : (a) des <strong>cookies essentiels</strong> — nécessaires au fonctionnement du site ; (b) des <strong>cookies analytiques</strong> (Google Analytics 4) — pour comprendre l&apos;usage du site, activés uniquement avec votre consentement via le bandeau cookies.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">7. Services tiers</h2>
              <p>Nous utilisons Stripe pour les paiements (soumis à la <a href="https://stripe.com/fr/privacy" className="text-[#36671E]">politique de confidentialité de Stripe</a>) et Google Analytics (soumis à la politique de Google). Stripe ne stocke jamais vos données de carte complètes sur nos serveurs.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">8. Vos droits (RGPD)</h2>
              <p>Vous disposez des droits suivants : accès à vos données, rectification, effacement, limitation du traitement, portabilité et retrait du consentement à tout moment. Écrivez à <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a> pour exercer l&apos;un de ces droits. Vous pouvez également saisir la CNIL (cnil.fr).</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">9. Contact</h2>
              <p>Pour toute question relative à vos données : <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a></p>
            </div>
          </div>
        </div>
      </section>
      <FrenchFooter />
    </main>
  );
}
