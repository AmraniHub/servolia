import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle, ArrowRight, ExternalLink, Clock, Sparkles } from "lucide-react";
import { SITE_TEMPLATES } from "@/lib/templates";
import { SETUP_PLAN } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Exemples de sites en ligne par métier — Servolia",
  description:
    "Choisissez votre métier et parcourez une démo en ligne — réceptionniste IA comprise. Chaque modèle Servolia est un vrai site fonctionnel que vous pouvez tester avant de choisir une formule.",
  alternates: {
    canonical: "https://servolia.com/fr/exemples",
    languages: {
      "en-US": "https://servolia.com/examples",
      "fr-FR": "https://servolia.com/fr/exemples",
      "x-default": "https://servolia.com/examples",
    },
  },
};

export default function FrenchExamplesPage() {
  return (
    <main className="flex flex-col bg-white">
      <FrenchNav enHref="/examples" />

      {/* Hero */}
      <section className="bg-[#FAFAF7] pt-28 pb-14 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#EEF5EA] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#36671E]/30 bg-[#EEF5EA] text-sm text-[#36671E]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-semibold">Exemples en ligne — cliquez, naviguez, parlez à l&apos;IA</span>
            </div>
          </div>
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-black text-[#18181B] leading-tight mb-5">
            Voyez le produit fini <span className="gradient-text">avant d&apos;acheter.</span>
          </h1>
          <p className="text-center text-lg text-[#52525B] max-w-2xl mx-auto mb-4">
            Choisissez votre métier ci-dessous et ouvrez une démo en ligne — un vrai
            système Servolia fonctionnel, réceptionniste IA comprise. Pas de captures
            d&apos;écran. Pas de maquettes.
          </p>
          <p className="text-center text-sm text-[#71717A] max-w-2xl mx-auto">
            Chaque modèle est livré en {SETUP_PLAN.deliveryFr} dans le cadre de la mise en place à {SETUP_PLAN.totalEur} €,
            puis fonctionne avec une formule mensuelle.
          </p>
        </div>
      </section>

      {/* Cartes modèles — pilotées entièrement par le registre de modèles */}
      <section className="py-14 lg:py-16 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SITE_TEMPLATES.map((t) => (
              <div key={t.key} className="bg-white rounded-2xl border border-[#E8E6E0] p-6 flex flex-col hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{t.emoji}</div>
                <h2 className="text-lg font-black text-[#18181B] mb-1.5">{t.name.fr}</h2>
                <p className="text-sm text-[#71717A] leading-relaxed mb-5">{t.audience.fr}</p>
                <ul className="flex flex-col gap-2 mb-6">
                  {t.includes.fr.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#3F3F46]">
                      <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <div className="rounded-xl border border-[#36671E]/20 bg-[#EEF5EA]/40 p-4">
                    <p className="text-xs font-semibold text-[#18181B] mb-2.5">
                      {t.demoBusiness} · {t.demoCity}
                    </p>
                    <a
                      href={`/sites/${t.demoSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-sm hover:opacity-90 glow-button transition-opacity"
                    >
                      Ouvrir la démo en ligne <ExternalLink className="w-4 h-4" />
                    </a>
                    <p className="text-[11px] text-[#71717A] leading-relaxed mt-2.5">
                      Cabinet fictif — une démo en ligne que vous pouvez tester, réceptionniste IA comprise.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Du modèle à VOTRE site */}
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-4">
            Du modèle à votre cabinet
          </p>
          <p className="text-lg text-[#18181B] font-medium leading-relaxed mb-3">
            Votre site est généré à partir de ce modèle, puis rédigé spécifiquement
            pour votre cabinet — vos soins, vos tarifs, votre ton.
          </p>
          <div className="inline-flex items-center gap-1.5 text-sm text-[#52525B]">
            <Clock className="w-3.5 h-3.5 text-[#36671E]" />
            Livré en {SETUP_PLAN.deliveryFr} dans le cadre de la mise en place à {SETUP_PLAN.totalEur} € — puis fonctionne avec une formule mensuelle.
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-[#18181B] mb-4">
            Vous avez trouvé le modèle pour <span className="gradient-text">votre cabinet ?</span>
          </h2>
          <p className="text-[#52525B] mb-6">
            Choisissez votre formule mensuelle — ou commencez par un audit gratuit et nous vous montrons exactement ce qui manque à votre site actuel.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/fr/tarifs"
              className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 glow-button flex items-center gap-2"
            >
              Voir les tarifs <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/fr/audit"
              className="px-6 py-3.5 rounded-xl border-2 border-[#36671E]/30 text-[#36671E] font-bold hover:bg-[#EEF5EA] transition-colors"
            >
              Recevoir mon audit gratuit
            </Link>
          </div>
        </div>
      </section>

      <FrenchFooter />
    </main>
  );
}
