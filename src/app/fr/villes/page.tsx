import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { FR_CITIES, FR_GEO_NICHES } from "@/lib/content/frGeo";

/**
 * Hub page for the FR Geo-SEO surface — links every city × niche combo
 * so the 45 individual pages are internally reachable (not orphans).
 * Also acts as a lookup index for a French clinic owner browsing by city.
 */

export const metadata: Metadata = {
  title: "Servolia par ville · site web + IA pour cabinets et cliniques en France",
  description: "Site web professionnel et assistante IA pour cabinets dentaires, cliniques esthétiques et artisans dans les 15 plus grandes villes françaises. Livré en 7 jours.",
  alternates: { canonical: "https://servolia.com/fr/villes" },
};

// Group cities by region for readability — same regions as in frGeo.ts.
function citiesByRegion() {
  const map = new Map<string, typeof FR_CITIES>();
  for (const c of FR_CITIES) {
    const arr = map.get(c.region) ?? [];
    arr.push(c);
    map.set(c.region, arr);
  }
  return Array.from(map.entries()).sort(([, a], [, b]) => b.length - a.length);
}

export default function FrCitiesHub() {
  const grouped = citiesByRegion();

  return (
    <main className="flex flex-col bg-white">
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

      <section className="bg-[#FAFAF7] pt-28 pb-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#36671E]/30 bg-[#EEF5EA] text-sm text-[#36671E] mb-5">
              <MapPin className="w-3.5 h-3.5" /> <span className="font-semibold">France — {FR_CITIES.length} villes couvertes</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] leading-tight mb-4">
              Servolia dans votre ville.
            </h1>
            <p className="text-lg text-[#52525B] max-w-2xl mx-auto">
              Site + assistante IA pour cabinets et cliniques dans les 15 plus grandes villes françaises. Contenu local, prix fixe, livraison en 7 jours.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {grouped.map(([region, cities]) => (
            <div key={region}>
              <h2 className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-4">{region}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cities.map((c) => (
                  <div key={c.slug} className="border border-[#E8E6E0] rounded-2xl p-5 bg-[#FAFAF7]">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-[#36671E]" />
                      <h3 className="font-black text-[#18181B]">{c.name}</h3>
                    </div>
                    <ul className="space-y-1.5">
                      {FR_GEO_NICHES.map((n) => (
                        <li key={n.slug}>
                          <Link href={`/fr/${n.slug}/${c.slug}`}
                            className="flex items-center justify-between text-sm text-[#52525B] hover:text-[#36671E] group">
                            <span className="truncate">Site + IA pour {n.labelSingular}</span>
                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 bg-[#FAFAF7] border-t border-[#E8E6E0]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-[#18181B] mb-3">Votre ville n'est pas dans la liste ?</h2>
          <p className="text-[#52525B] mb-6">
            Nous livrons partout en France — demandez un audit gratuit et nous adapterons la présentation à votre marché local.
          </p>
          <Link href="/fr/audit" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90">
            Recevoir mon audit gratuit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-[#FAFAF7] border-t border-[#E8E6E0] py-8 text-center text-xs text-[#71717A]">
        © {new Date().getFullYear()} Servolia · {" "}
        <a href="mailto:hello@servolia.com" className="hover:text-[#36671E]">hello@servolia.com</a> · {" "}
        <Link href="/legal/privacy" className="hover:text-[#36671E]">Confidentialité</Link>
      </footer>
    </main>
  );
}
