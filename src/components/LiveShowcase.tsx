// No "use client": nothing here needs the client runtime (hover states are
// CSS, links are plain anchors). Imported from the client homepages it simply
// bundles as client code; from any server page it stays on the server.
import Link from "next/link";
import { SITE_TEMPLATES } from "@/lib/templates";
import { ArrowRight, ExternalLink } from "lucide-react";

/**
 * The strongest proof we have, shown instead of claimed: the three live demo
 * sites, embedded as scaled previews. Driven by SITE_TEMPLATES so this section
 * can never drift from the templates that actually exist.
 *
 * Every demo is a FICTIONAL practice — the sub-line says so explicitly.
 * No animations beyond hover states, so prefers-reduced-motion needs no
 * special handling here.
 */

const T = {
  en: {
    eyebrow: "Live right now",
    title: "Don’t take our word for it.",
    titleAccent: "Click the product.",
    sub: "Three fictional practices, built on the real templates we deliver — every page and the AI receptionist are fully functional.",
    numbersPrompt: "Prefer the numbers?",
    numbersLink: "See the example deployments",
    numbersHref: "/case-studies",
    badge: "LIVE DEMO",
    open: "Open the live site",
    all: "See what’s in each template",
    allHref: "/examples",
  },
  fr: {
    eyebrow: "En ligne en ce moment",
    title: "Ne nous croyez pas sur parole.",
    titleAccent: "Cliquez sur le produit.",
    sub: "Trois cabinets fictifs, construits sur les vrais templates que nous livrons — chaque page et la réceptionniste IA sont pleinement fonctionnelles.",
    numbersPrompt: "Vous préférez les chiffres ?",
    numbersLink: "Voir les exemples de déploiements",
    numbersHref: "/fr/cas-clients",
    badge: "DÉMO EN DIRECT",
    open: "Ouvrir le site en ligne",
    all: "Voir le détail de chaque template",
    allHref: "/fr/exemples",
  },
};

export default function LiveShowcase({ lang = "en" }: { lang?: "en" | "fr" }) {
  const l = lang === "fr" ? ("fr" as const) : ("en" as const);
  const t = T[l];

  return (
    <section className="py-20 lg:py-28 bg-[#FAFAF7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="inline-flex items-center gap-2 text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#36671E]" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
            {t.title}{" "}
            <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
              {t.titleAccent}
            </span>
          </h2>
          <p className="text-sm text-[#71717A] max-w-2xl mx-auto mb-1.5">{t.sub}</p>
          <p className="text-xs text-[#71717A]">
            {t.numbersPrompt}{" "}
            <Link href={t.numbersHref} className="font-bold text-[#36671E] hover:underline">
              {t.numbersLink} →
            </Link>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {SITE_TEMPLATES.map((tpl) => (
            <div
              key={tpl.key}
              className="relative group flex flex-col rounded-2xl border border-[#E8E6E0] bg-white overflow-hidden hover:border-[#36671E]/40 hover:shadow-card transition-all duration-200"
            >
              {/* Fake browser chrome */}
              <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#F5F4EF] bg-[#FAFAF7]">
                <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
                <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
                <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
                <span className="ml-2 flex-1 truncate rounded-md bg-white border border-[#E8E6E0] px-2 py-0.5 text-[10px] font-mono text-[#71717A]">
                  /sites/{tpl.demoSlug}
                </span>
              </div>

              {/* Scaled live preview — decorative, the real link follows.
                  width 400% + scale(0.25) renders the page at 4× the card
                  width (≈1280–1400px on desktop cards) and shrinks it to fit
                  the card exactly at every breakpoint — pure CSS, no
                  ResizeObserver. */}
              <div className="relative h-[230px] sm:h-[260px] overflow-hidden bg-white">
                <iframe
                  src={`/sites/${tpl.demoSlug}`}
                  title={`${tpl.demoBusiness} — ${t.badge}`}
                  loading="lazy"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
                  style={{ width: "400%", height: 2000, transform: "scale(0.25)" }}
                />
              </div>

              <div className="flex flex-col flex-1 p-5 border-t border-[#F5F4EF]">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-sm font-black text-[#18181B] leading-tight">
                    <span className="mr-1.5" aria-hidden="true">{tpl.emoji}</span>
                    {tpl.name[l]}
                  </h3>
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#BEF264] text-[#0A1F14] text-[9px] font-black uppercase tracking-widest">
                    {t.badge}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#36671E] mb-2">
                  {tpl.demoBusiness} · {tpl.demoCity}
                </p>
                <p className="text-[11px] text-[#71717A] leading-relaxed mb-4 flex-1">{tpl.audience[l]}</p>
                {/* after:inset-0 stretches this link over the whole card —
                    one anchor, whole card clickable, no nested links. */}
                <a
                  href={`/sites/${tpl.demoSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#36671E] group-hover:underline after:absolute after:inset-0"
                >
                  {t.open} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href={t.allHref}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#E8E6E0] bg-white text-[#18181B] font-bold text-sm hover:border-[#36671E] hover:text-[#36671E] transition-colors"
          >
            {t.all} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
