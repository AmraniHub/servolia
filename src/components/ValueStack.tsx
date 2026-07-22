import { Target, ShieldCheck, Zap, Feather } from "lucide-react";
import { valueLevers, VALUE_HEADING, type Lang } from "@/lib/valueEquation";

/**
 * The value equation, rendered. Four tiles: a bigger outcome and a surer bet
 * (the numerators), against less waiting and less work (the denominators).
 *
 * Droppable on any public page — pass the page's language, and its niche when
 * the page is niche-specific so the outcome tile speaks to that reader.
 * Copy lives in src/lib/valueEquation.ts so every page makes the same promise.
 */

const ICONS = {
  outcome: Target,
  likelihood: ShieldCheck,
  speed: Zap,
  effort: Feather,
} as const;

export default function ValueStack({
  lang = "en",
  niche = "default",
  dark = false,
}: {
  lang?: Lang;
  niche?: string;
  /** Use on cream/white pages by default; `dark` matches the forest hero sections. */
  dark?: boolean;
}) {
  const levers = valueLevers(lang, niche);
  const h = VALUE_HEADING[lang];

  return (
    <section className={`py-16 lg:py-20 ${dark ? "bg-[#0A1F14]" : "bg-[#FAFAF7]"}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">
            <span className={dark ? "text-[#BEF264]" : "text-[#36671E]"}>{h.eyebrow}</span>
          </p>
          <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-black mb-4 leading-tight ${dark ? "text-[#FAFAF7]" : "text-[#080E1C]"}`}>
            {h.h}
          </h2>
          <p className={`text-sm sm:text-base max-w-2xl mx-auto leading-relaxed ${dark ? "text-[#ABDF90]/80" : "text-[#52525B]"}`}>
            {h.sub}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {levers.map((l) => {
            const Icon = ICONS[l.kind];
            // The outcome tile is the one that has to land — give it the accent.
            const lead = l.kind === "outcome";
            return (
              <div
                key={l.kind}
                className={`rounded-2xl p-6 flex flex-col border transition-colors ${
                  dark
                    ? lead
                      ? "bg-[#BEF264]/10 border-[#BEF264]/40"
                      : "bg-white/[0.04] border-white/10 hover:bg-white/[0.07]"
                    : lead
                    ? "bg-[#EEF5EA] border-[#36671E]/30"
                    : "bg-white border-[#E8E6E0]"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                    lead ? "bg-[#36671E] text-[#FAFAF7]" : dark ? "bg-white/10 text-[#BEF264]" : "bg-[#F5F4EF] text-[#36671E]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${dark ? "text-[#ABDF90]" : "text-[#36671E]"}`}>
                  {l.label}
                </p>
                <h3 className={`font-black text-base mb-2 leading-snug ${dark ? "text-[#FAFAF7]" : "text-[#080E1C]"}`}>
                  {l.headline}
                </h3>
                <p className={`text-sm leading-relaxed ${dark ? "text-[#FAFAF7]/70" : "text-[#52525B]"}`}>
                  {l.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
