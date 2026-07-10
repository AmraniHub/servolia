import Link from "next/link";
import type { Metadata } from "next";
import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import { Globe, Bot, Calendar, LayoutDashboard, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Solutions — Systèmes clients IA pour entreprises de services | Servolia",
  description:
    "Découvrez les systèmes d'acquisition client Servolia : sites IA, réceptionniste IA, réservation en ligne et tableaux de bord CRM. Prix fixe, livré en quelques jours.",
  alternates: {
    canonical: "https://servolia.com/fr/solutions",
    languages: {
      "en-US": "https://servolia.com/solutions",
      "fr-FR": "https://servolia.com/fr/solutions",
      "x-default": "https://servolia.com/solutions",
    },
  },
};

const solutions = [
  {
    icon: Globe,
    title: "Sites web IA",
    sub: "Un site conçu pour convertir — pas seulement pour être joli. Mobile-first, conforme RGPD, avec appels à l'action de réservation et de contact, en ligne en 72 heures.",
    tag: "Dès 490 €",
  },
  {
    icon: Bot,
    title: "Réceptionniste IA",
    sub: "Répond aux visiteurs 24h/24 en français et en anglais, qualifie les demandes, répond aux questions sur vos services et prix, et enregistre chaque conversation comme un lead scoré.",
    tag: "Inclus dès 990 €",
  },
  {
    icon: Calendar,
    title: "Systèmes de réservation",
    sub: "Vos clients réservent en ligne, reçoivent confirmations et rappels automatiques — même à 2h du matin, même le dimanche. Fini les appels manqués qui partent chez le concurrent.",
    tag: "Inclus dès 990 €",
  },
  {
    icon: LayoutDashboard,
    title: "Tableaux de bord CRM",
    sub: "Chaque lead, sa source, son statut et sa valeur dans un seul tableau de bord. Pipeline de suivi, notifications automatiques et rapport mensuel de performance.",
    tag: "Inclus dès 1 900 €",
  },
];

export default function FrenchSolutionsHub() {
  return (
    <>
      <FrenchNav heroDark enHref="/solutions" />
      <main className="bg-[#FAFAF7]">
        {/* HERO */}
        <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-20 bg-[#0A1F14] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#36671E] opacity-60 rounded-full blur-[120px]" />
            <div className="absolute inset-0 grain opacity-30" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#BEF264]/40 bg-[#BEF264]/10 text-[#ABDF90] text-xs font-bold uppercase tracking-widest mb-6">
              Nos solutions
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#FAFAF7] leading-[1.05] tracking-tight mb-6">
              Une plateforme.{" "}
              <span className="bg-gradient-to-r from-[#BEF264] to-[#ABDF90] bg-clip-text text-transparent">Chaque étape de l&apos;acquisition client.</span>
            </h1>
            <p className="text-[#ABDF90]/80 text-lg max-w-2xl mx-auto leading-relaxed">
              De la première visite au rendez-vous réservé et au rapport mensuel — chaque système Servolia gère une étape de la transformation d&apos;un inconnu en client payant.
            </p>
          </div>
        </section>

        {/* SOLUTIONS */}
        <section className="py-20 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-5">
              {solutions.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.title}
                    className="bg-white rounded-2xl p-7 border border-[#E8E6E0] hover:border-[#36671E]/30 hover:shadow-card transition-all duration-300 flex flex-col">
                    <div className="w-11 h-11 rounded-xl bg-[#36671E] flex items-center justify-center text-[#FAFAF7] mb-5 shadow-lg shadow-[#36671E]/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-[#18181B] mb-2">{s.title}</h2>
                    <p className="text-sm text-[#71717A] leading-relaxed mb-5 flex-1">{s.sub}</p>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-[#EEF5EA] text-[#36671E] text-xs font-bold">{s.tag}</span>
                      <Link href="/fr/tarifs" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#36671E] hover:gap-2.5 transition-all">
                        Voir les tarifs <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* INDUSTRIES */}
        <section className="py-16 lg:py-20 bg-white border-y border-[#E8E6E0]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Par secteur</p>
              <h2 className="text-2xl sm:text-3xl font-black text-[#18181B]">Conçu pour votre métier</h2>
              <p className="text-sm text-[#71717A] mt-3 max-w-xl mx-auto">
                Nous sommes spécialisés dans les métiers où chaque appel manqué coûte un vrai client — dentistes, cliniques esthétiques, immobilier, services à domicile, avocats.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/fr/dentistes"
                className="px-4 py-2.5 rounded-xl border-2 border-[#36671E] bg-[#EEF5EA] text-[#36671E] text-sm font-bold hover:bg-[#D6E2CF] transition-colors">
                🦷 Cabinets dentaires
              </Link>
              {["Cliniques esthétiques", "Immobilier", "Services à domicile", "Avocats", "Experts-comptables", "Consultants"].map((n) => (
                <Link key={n} href="/fr/contact"
                  className="px-4 py-2.5 rounded-xl border border-[#E8E6E0] bg-[#FAFAF7] text-[#18181B] text-sm font-semibold hover:border-[#36671E] hover:text-[#36671E] transition-colors">
                  {n}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-black text-[#18181B] mb-4">Pas sûr du système qu&apos;il vous faut ?</h2>
            <p className="text-[#71717A] mb-8">Commencez par un audit gratuit — nous vous recommandons le bon système pour votre activité, sans frais et sans appel.</p>
            <Link href="/fr/audit"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#36671E] text-[#FAFAF7] font-black hover:bg-[#295115] transition-colors">
              Réserver un audit gratuit <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>
      <FrenchFooter />
    </>
  );
}
