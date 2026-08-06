import { ExternalLink } from "lucide-react";
import { nicheLabel, type BuiltSite } from "@/lib/showcase";

/**
 * The proof grid — a browser frame around a LIVE preview of each site.
 *
 * Live iframes rather than screenshots, deliberately: a screenshot is a claim
 * about a page, an iframe IS the page. It can't go stale, can't be flattering,
 * and a sceptical visitor can click straight through and use the thing. That
 * is the whole argument of this page.
 *
 * Demo cards are labelled as fictional on the card itself, not just in a
 * footnote — the distinction has to survive someone screenshotting one card.
 */

const T = {
  en: {
    live: "LIVE", demo: "DEMO", fictional: "Fictional practice — fully working",
    visit: "Open the live site", niche: "Type", city: "City", language: "Language", built: "We built",
    fr: "French", enLang: "English",
  },
  fr: {
    live: "EN LIGNE", demo: "DÉMO", fictional: "Cabinet fictif — entièrement fonctionnel",
    visit: "Ouvrir le site en ligne", niche: "Type", city: "Ville", language: "Langue", built: "Nous avons construit",
    fr: "Français", enLang: "Anglais",
  },
};

export default function BuiltGrid({
  sites,
  lang = "en",
}: {
  sites: BuiltSite[];
  lang?: "en" | "fr";
}) {
  const l = lang === "fr" ? ("fr" as const) : ("en" as const);
  const t = T[l];

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {sites.map((s) => (
        <article key={s.slug}
          className="group relative flex flex-col rounded-2xl border border-[#E8E6E0] bg-white overflow-hidden hover:border-[#36671E]/40 hover:shadow-card transition-all duration-200">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#F5F4EF] bg-[#FAFAF7]">
            <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
            <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
            <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
            <span className="ml-2 flex-1 truncate rounded-md bg-white border border-[#E8E6E0] px-2 py-0.5 text-[10px] font-mono text-[#71717A]">
              {s.displayUrl}
            </span>
          </div>

          {/* Live preview — decorative; the real link is below.
              width 400% + scale(0.25) fits the card exactly at every
              breakpoint in pure CSS, no measurement needed. */}
          <div className="relative h-[220px] sm:h-[240px] overflow-hidden bg-white">
            <iframe
              src={s.href}
              title={`${s.business} — ${s.kind === "demo" ? t.demo : t.live}`}
              loading="lazy" tabIndex={-1} aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
              style={{ width: "400%", height: 1800, transform: "scale(0.25)" }}
            />
            <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
              s.kind === "client" ? "bg-[#BEF264] text-[#0A1F14]" : "bg-[#0A1F14]/85 text-[#BEF264]"
            }`}>
              {s.kind === "client" ? t.live : t.demo}
            </span>
          </div>

          <div className="flex flex-col flex-1 p-5">
            <h3 className="text-base font-black text-[#18181B] leading-snug">{s.business}</h3>
            {s.kind === "demo" && (
              <p className="text-[11px] text-[#A1A1AA] mt-0.5">{t.fictional}</p>
            )}
            {s.summary && (
              <p className="text-sm text-[#52525B] leading-relaxed mt-2 line-clamp-3">{s.summary}</p>
            )}

            <dl className="mt-4 mb-5 space-y-2 text-sm border-t border-[#F5F4EF] pt-4">
              <Row k={t.niche} v={nicheLabel(s.niche, l)} />
              {s.city && <Row k={t.city} v={s.city} />}
              <Row k={t.language} v={s.language === "fr" ? t.fr : t.enLang} />
              <Row k={t.built} v={s.built} />
            </dl>

            {/* Stretched over the whole card — one anchor, no nested links. */}
            <a href={s.href} target="_blank" rel="noopener noreferrer"
              className="mt-auto inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#0A1F14] text-[#FAFAF7] font-black text-sm hover:bg-[#143424] transition-colors after:absolute after:inset-0">
              {t.visit} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[#71717A] text-xs">{k}</dt>
      <dd className="font-bold text-[#18181B] text-right text-xs">{v}</dd>
    </div>
  );
}
