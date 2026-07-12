import Link from "next/link";
import { ArrowRight, Quote, CheckCircle } from "lucide-react";
import type { CaseStudy } from "@/lib/caseStudies";

/** Renders real, published client case studies — the proof section. */
export default function RealCaseStudies({ studies }: { studies: CaseStudy[] }) {
  if (!studies.length) return null;

  return (
    <section className="py-16 lg:py-20 bg-white border-y border-[#E8E6E0]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-black text-[#36671E] uppercase tracking-widest bg-[#EEF5EA] px-3 py-1 rounded-full mb-4">
            Real clients · Real numbers
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#18181B]">Proof, not promises.</h2>
        </div>

        <div className="space-y-8">
          {studies.map((c) => (
            <article key={c.id} id={c.slug} className="rounded-3xl border border-[#E8E6E0] overflow-hidden shadow-card">
              <div className="grid lg:grid-cols-5">
                {/* Story */}
                <div className="lg:col-span-3 p-7 lg:p-9">
                  <div className="flex items-center gap-3 mb-4">
                    {c.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.logoUrl} alt={c.business} className="h-9 w-auto object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-sm" style={{ background: c.accent }}>
                        {c.business.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-black text-[#18181B] text-sm">{c.business}</p>
                      <p className="text-xs text-[#A1A1AA]">{[c.city, c.niche, c.plan].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>

                  <h3 className="text-xl lg:text-2xl font-black text-[#18181B] leading-tight mb-3">{c.headline}</h3>
                  {c.summary && <p className="text-[#52525B] text-sm leading-relaxed mb-5">{c.summary}</p>}

                  {c.challenge && (
                    <div className="mb-4">
                      <p className="text-xs font-black text-[#71717A] uppercase tracking-wide mb-1">The challenge</p>
                      <p className="text-sm text-[#52525B] leading-relaxed">{c.challenge}</p>
                    </div>
                  )}
                  {c.solution && (
                    <div className="mb-4">
                      <p className="text-xs font-black text-[#71717A] uppercase tracking-wide mb-1">What we did</p>
                      <p className="text-sm text-[#52525B] leading-relaxed flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: c.accent }} />{c.solution}
                      </p>
                    </div>
                  )}

                  {c.quote && (
                    <blockquote className="mt-5 p-4 rounded-xl bg-[#FAFAF7] border-l-4" style={{ borderColor: c.accent }}>
                      <Quote className="w-4 h-4 mb-1.5" style={{ color: c.accent }} />
                      <p className="text-sm text-[#18181B] italic leading-relaxed">&ldquo;{c.quote}&rdquo;</p>
                      {c.quoteAuthor && <footer className="text-xs text-[#71717A] font-bold mt-2">— {c.quoteAuthor}</footer>}
                    </blockquote>
                  )}
                </div>

                {/* Metrics */}
                <div className="lg:col-span-2 p-7 lg:p-9 flex flex-col justify-center" style={{ background: "#0A1F14" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-5" style={{ color: "#ABDF90" }}>The results</p>
                  <div className="grid grid-cols-2 gap-4">
                    {c.metrics.map((m, i) => (
                      <div key={i}>
                        <p className="text-2xl lg:text-3xl font-black text-[#FAFAF7] tabular-nums leading-none">{m.value}</p>
                        <p className="text-xs text-[#FAFAF7]/60 mt-1.5 leading-tight">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <Link href="/call" className="mt-7 inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#BEF264] text-[#0A1F14] font-black text-sm hover:bg-[#D9F99D] transition-colors">
                    Get results like this <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
