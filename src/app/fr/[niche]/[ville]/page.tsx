import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, ArrowRight, Bot, Calendar, BarChart3, Clock, Lock, TrendingUp, MapPin } from "lucide-react";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import Guarantee from "@/components/Guarantee";
import ValueStack from "@/components/ValueStack";
import { FR_GEO_NICHE_MAP, FR_CITY_MAP, allFrGeoCombos } from "@/lib/content/frGeo";

/**
 * FR Geo-SEO landing: /fr/[niche]/[ville].
 *
 * Static-generated (cartesian of niche × city from src/lib/content/frGeo.ts).
 * Two-audience optimisation on the same page:
 *  1. Google — unique <title>, <meta>, canonical, LocalBusiness JSON-LD.
 *  2. Generative engines (ChatGPT / Perplexity / Google AI overviews) —
 *     FAQPage JSON-LD + a canonical Q&A block that reads cleanly when lifted.
 */

const packages = [
  { name: "Cabinet Essentiel", price: "290 €", delivery: "3 jours", popular: false, blurb: "Site pro + formulaire — pour ne plus rien perdre." },
  { name: "Système IA Cabinet", price: "590 €", delivery: "5 jours", popular: true, blurb: "Site + assistante IA + prise de RDV — la formule qui rentabilise le plus vite." },
  { name: "Cabinet Pro Complet", price: "990 €", delivery: "7 jours", popular: false, blurb: "Formule premium avec pages soins détaillées, IA multilingue, suivi ROI." },
];

export function generateStaticParams() {
  return allFrGeoCombos();
}

export async function generateMetadata({ params }: { params: Promise<{ niche: string; ville: string }> }): Promise<Metadata> {
  const { niche, ville } = await params;
  const n = FR_GEO_NICHE_MAP[niche];
  const c = FR_CITY_MAP[ville];
  if (!n || !c) return {};
  return {
    title: n.seoTitle(c.nameWithArticle),
    description: n.seoDesc(c.nameWithArticle),
    alternates: { canonical: `https://servolia.com/fr/${n.slug}/${c.slug}` },
    openGraph: {
      title: n.seoTitle(c.nameWithArticle),
      description: n.seoDesc(c.nameWithArticle),
      type: "website",
      locale: "fr_FR",
      url: `https://servolia.com/fr/${n.slug}/${c.slug}`,
    },
  };
}

export default async function FrGeoPage({ params }: { params: Promise<{ niche: string; ville: string }> }) {
  const { niche, ville } = await params;
  const n = FR_GEO_NICHE_MAP[niche];
  const c = FR_CITY_MAP[ville];
  if (!n || !c) notFound();

  const faqs = n.faqs(c.nameWithArticle);

  // JSON-LD: LocalBusiness (Servolia serving the city) + Service + FAQPage.
  // FAQPage in particular is the one that gets lifted into Google AI Overviews
  // and Perplexity answers — worth the size.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: `Site web + assistante IA pour ${n.labelPlural} ${c.nameWithArticle}`,
        provider: {
          "@type": "Organization",
          name: "Servolia",
          url: "https://servolia.com",
          email: "hello@servolia.com",
        },
        areaServed: {
          "@type": "City",
          name: c.name,
          containedInPlace: { "@type": "AdministrativeArea", name: c.region },
        },
        serviceType: `Site web professionnel avec réceptionniste IA pour ${n.labelSingular}`,
        offers: packages.map((p) => ({
          "@type": "Offer",
          name: p.name,
          price: p.price.replace(/[^\d]/g, ""),
          priceCurrency: "EUR",
          description: p.blurb,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main className="flex flex-col bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF7]/85 backdrop-blur-xl border-b border-[#E8E6E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/fr" className="flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
          <Link href="/fr/audit" className="px-4 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] transition-colors">
            Audit gratuit →
          </Link>
        </div>
      </nav>

      {/* HERO — local intent up top */}
      <section className="bg-[#FAFAF7] pt-28 pb-14 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#EEF5EA] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#36671E]/30 bg-[#EEF5EA] text-sm text-[#36671E]">
              <MapPin className="w-3.5 h-3.5" />
              <span className="font-semibold">{c.name} · {c.region}</span>
            </div>
          </div>
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-black text-[#18181B] leading-tight mb-5">
            {n.h1(c.nameWithArticle)}
          </h1>
          <p className="text-center text-lg text-[#52525B] max-w-2xl mx-auto mb-6">
            {n.subline(c.nameWithArticle)}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/fr/audit" className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-base hover:opacity-90 flex items-center gap-2">
              Recevoir mon audit gratuit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/fr/tarifs" className="text-[#52525B] hover:text-[#18181B] text-sm font-semibold transition-colors">
              Voir les tarifs →
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#52525B]">
            <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#059669]" /> Conçu pour plus de rendez-vous</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#36671E]" /> Livraison en 7 jours</div>
            <div className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#36671E]" /> Prix fixe par écrit</div>
          </div>
        </div>
      </section>

      {/* LOCAL CONTEXT — the one paragraph that makes this page unique */}
      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border border-[#E8E6E0] rounded-2xl p-6 bg-[#FAFAF7]">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-2">
              Contexte local · {c.name}
            </p>
            <p className="text-[#18181B] text-base leading-relaxed">{c.hook}</p>
            <p className="text-[#52525B] text-sm leading-relaxed mt-3">
              Le problème n°1 des {n.labelPlural} {c.nameWithArticle} : {n.problemSlug}. C'est exactement ce qu'un site + assistant IA Servolia règle.
            </p>
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      <section className="py-14 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-2">Formules Servolia</p>
            <h2 className="text-3xl font-black text-[#18181B] mb-3">Choisissez votre formule</h2>
            <p className="text-[#71717A]">Prix HT (EUR). Acompte de 50 % · Solde à la livraison.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((p, i) => (
              <div key={i} className={`bg-white rounded-2xl border-2 p-6 relative ${p.popular ? "border-[#36671E] shadow-2xl shadow-[#ABDF90]/15" : "border-[#E8E6E0]"}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-xs font-black whitespace-nowrap">
                    RECOMMANDÉ
                  </div>
                )}
                <h3 className="text-lg font-black text-[#18181B] mb-1">{p.name}</h3>
                <div className="text-3xl font-black text-[#18181B] mb-1">{p.price}</div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock className="w-3.5 h-3.5 text-[#059669]" />
                  <span className="text-xs font-semibold text-[#059669]">Livré en {p.delivery}</span>
                </div>
                <p className="text-sm text-[#52525B] mb-4 leading-relaxed">{p.blurb}</p>
                <Link href="/fr/audit" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${p.popular ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90" : "border border-[#E8E6E0] text-[#18181B] hover:border-[#36671E] hover:text-[#36671E]"}`}>
                  Choisir →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: <Bot className="w-5 h-5" />, title: "Réceptionniste IA", desc: `Formée sur vos soins, vos tarifs et vos horaires — pour vos ${n.clientNoun}, 24 h/24.` },
              { icon: <Calendar className="w-5 h-5" />, title: "Réservation en ligne", desc: "Demandes de rendez-vous avec confirmation automatique, compatibles Doctolib." },
              { icon: <BarChart3 className="w-5 h-5" />, title: "Suivi ROI", desc: `Rapport mensuel : combien de ${n.clientNoun} captés, d'où, et à quelle valeur estimée.` },
            ].map((item, i) => (
              <div key={i} className="border border-[#E8E6E0] rounded-xl p-5">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#36671E] to-[#143424] flex items-center justify-center text-[#FAFAF7] mb-3">
                  {item.icon}
                </div>
                <h3 className="font-black text-[#18181B] text-sm mb-1.5">{item.title}</h3>
                <p className="text-[#71717A] text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — human-readable AND FAQPage schema above; this block is the one LLMs will lift */}
      <section className="py-14 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-2">Questions fréquentes · {c.name}</p>
            <h2 className="text-3xl font-black text-[#18181B]">Ce que les {n.labelPlural} nous demandent le plus.</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <details key={i} className="bg-white border border-[#E8E6E0] rounded-xl p-5 group open:shadow-sm">
                <summary className="cursor-pointer font-black text-[#18181B] text-sm flex items-center justify-between gap-3">
                  <span>{f.q}</span>
                  <ArrowRight className="w-4 h-4 text-[#36671E] group-open:rotate-90 transition-transform" />
                </summary>
                <p className="mt-3 text-[#52525B] text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bullets */}
      <section className="py-10 bg-white border-t border-[#E8E6E0]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              `Prix ferme écrit avant de démarrer — jamais de surprise sur la facture.`,
              `Livraison en 7 jours ou remboursement total de l'acompte.`,
              `Hébergement inclus, sécurité et RGPD gérés — vous n'avez rien à installer ${c.nameWithArticle}.`,
              `Aucun engagement de durée sur la maintenance — vous partez quand vous voulez.`,
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                <span className="text-sm text-[#52525B]">{line}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-[#18181B] mb-4">
            Prêt à remplir l'agenda de votre {n.labelSingular} {c.nameWithArticle} ?
          </h2>
          <p className="text-[#52525B] mb-6">
            Recevez un audit gratuit personnalisé. On regarde votre présence en ligne actuelle et on vous montre ce qui manque — sans appel obligatoire.
          </p>
          <Link href="/fr/audit" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90">
            Recevoir mon audit gratuit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <StickyMobileCTA label="Recevoir mon audit gratuit" sub="Gratuit · Livré en 24 h · Sans appel" href="/fr/audit" />

      <ValueStack lang="fr" />
      <Guarantee lang="fr" />

      <footer className="bg-[#FAFAF7] border-t border-[#E8E6E0] py-8 text-center text-xs text-[#71717A]">
        © {new Date().getFullYear()} Servolia · {" "}
        <a href="mailto:hello@servolia.com" className="hover:text-[#36671E]">hello@servolia.com</a> · {" "}
        <Link href="/legal/privacy" className="hover:text-[#36671E]">Confidentialité</Link>
      </footer>
    </main>
  );
}
