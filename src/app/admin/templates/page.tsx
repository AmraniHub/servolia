import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { SITE_TEMPLATES, templateForNiche } from "@/lib/templates";
import {
  LayoutTemplate, Check, ExternalLink, Wand2, ArrowRight, Globe,
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * TEMPLATES — the delivery readiness board.
 *
 * One card per fully-wired niche template from the SITE_TEMPLATES registry
 * (src/lib/templates.ts). The registry is gated: an entry only exists once its
 * niche module, AI copy playbook, receptionist prompt AND live demo all ship —
 * so everything on this page is, by construction, ready to deliver.
 *
 * If Supabase is connected we also count how many REAL client sites (demos
 * excluded) run on each template, so you can see which rungs actually earn.
 */

/** How a paying client flows through a template — the whole delivery motion. */
const FLOW_STEPS = [
  "Pays installation",
  "Fills intake",
  "Draft site auto-generates",
  "You review & polish",
  "Publish + plan starts",
];

interface SiteCountRow {
  slug: string;
  niche?: string | null;
  status?: string | null;
  config?: { isDemo?: boolean; niche?: string } | null;
}

type TemplateCounts = Record<string, { total: number; published: number }>;

export default async function TemplatesPage() {
  const db = supabaseAdmin();

  // Real client sites per template. null = no data available (no Supabase or
  // table not created yet) — the cards simply omit the counts line.
  let counts: TemplateCounts | null = null;
  if (db) {
    try {
      const { data } = await db.from("client_sites").select("slug, niche, status, config");
      const rows = (data as SiteCountRow[] | null) ?? [];
      counts = Object.fromEntries(SITE_TEMPLATES.map((t) => [t.key, { total: 0, published: 0 }]));
      for (const r of rows) {
        // Demos don't count as delivery: skip demo- slugs and prospect demos.
        if (r.slug?.startsWith("demo-") || r.config?.isDemo) continue;
        const t = templateForNiche(r.niche ?? r.config?.niche);
        if (!t) continue;
        counts[t.key].total += 1;
        if (r.status === "published") counts[t.key].published += 1;
      }
    } catch {
      counts = null; // client_sites table missing — degrade gracefully
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1 flex items-center gap-2">
        <LayoutTemplate className="w-5 h-5 text-[#36671E]" /> Templates
      </h1>
      <p className="text-sm text-[#71717A] mb-6">
        The ready-to-deliver niche templates — every entry here is fully wired and backed by a live demo.
      </p>

      {/* How a new client gets wired — the delivery motion, left to right */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-4 mb-8 overflow-x-auto">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#A1A1AA] mb-3">
          How a new client gets wired
        </p>
        <div className="flex items-center gap-2 min-w-max">
          {FLOW_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#EEF5EA]">
                <span className="w-5 h-5 rounded-full bg-[#36671E] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs font-bold text-[#36671E] whitespace-nowrap">{step}</span>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <ArrowRight className="w-4 h-4 text-[#A1A1AA] shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* One card per registry entry */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SITE_TEMPLATES.map((t) => {
          const c = counts?.[t.key];
          return (
            <div key={t.key} className="bg-white border border-[#E8E6E0] rounded-2xl p-5 flex flex-col">
              {/* Identity */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl leading-none" aria-hidden>{t.emoji}</span>
                  <h2 className="text-sm font-black text-[#18181B]">{t.name.en}</h2>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${
                  t.rung === 1 ? "bg-[#BEF264] text-[#0A1F14]" : "bg-[#F5F4EF] text-[#52525B]"
                }`}>
                  {t.rung === 1 ? "Rung 1 · beachhead" : `Rung ${t.rung}`}
                </span>
              </div>
              <p className="text-xs text-[#71717A] mb-3">{t.audience.en}</p>

              {/* Real client sites on this template (demos excluded) */}
              {c && (
                <p className="text-[11px] font-bold mb-3">
                  {c.total === 0 ? (
                    <span className="text-[#A1A1AA]">No client sites on this template yet</span>
                  ) : (
                    <span className="text-[#36671E]">
                      {c.total} client site{c.total === 1 ? "" : "s"} · {c.published} published
                    </span>
                  )}
                </p>
              )}

              {/* What the generated site ships with */}
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                Every site ships with
              </p>
              <ul className="space-y-1 mb-4">
                {t.includes.en.map((line) => (
                  <li key={line} className="flex items-start gap-1.5 text-xs text-[#52525B]">
                    <Check className="w-3.5 h-3.5 text-[#36671E] shrink-0 mt-[1px]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {/* Wiring — all green by construction (see the footnote below) */}
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                Wiring
              </p>
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {["Niche module", "AI copy playbook", "Receptionist prompt", "Live demo"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#EEF5EA]">
                    <Check className="w-3 h-3 text-[#36671E] shrink-0" />
                    <span className="text-[11px] font-bold text-[#36671E]">{item}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-auto pt-3 border-t border-[#F5F4EF] space-y-2">
                <a
                  href={`/sites/${t.demoSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E6E0] hover:border-[#36671E]/40 hover:bg-[#FAFAF7] transition-colors group"
                >
                  <Globe className="w-4 h-4 text-[#36671E] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-black text-[#18181B]">Open live demo</span>
                    <span className="block text-[11px] text-[#71717A] truncate">
                      {t.demoBusiness}, {t.demoCity} (fictional demo)
                    </span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#A1A1AA] group-hover:text-[#36671E] shrink-0" />
                </a>
                <Link
                  href="/admin/demo"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#36671E] hover:bg-[#295115] transition-colors"
                >
                  <Wand2 className="w-4 h-4 text-[#BEF264] shrink-0" />
                  <span className="text-xs font-black text-white">Generate a prospect demo</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#A1A1AA] mt-4">
        Wiring is always fully green here by design — the registry is gated, so a template only
        appears on this board once its niche module, AI copy playbook, receptionist prompt and live
        demo all exist. A half-wired niche never gets an entry.
      </p>
    </div>
  );
}
