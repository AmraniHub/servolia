import { MAIN_FLOW, SCHEMA, FEATURES, RUNNING_COSTS } from "@/lib/systemGuide";
import { Workflow, Database, Boxes, Wallet, Code2, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SystemPage() {
  const groups = Array.from(new Set(SCHEMA.map((t) => t.group)));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">How the system works</h1>
      <p className="text-sm text-[#71717A] mb-8">
        The structure, the process, and what each part costs and earns. Updated whenever we build something.
      </p>

      {/* ── THE FLOW ── */}
      <section className="mb-10">
        <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest flex items-center gap-2 mb-4">
          <Workflow className="w-4 h-4 text-[#36671E]" /> Stranger → paying client
        </h2>
        <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
          {MAIN_FLOW.map((f, i) => (
            <div key={i} className="px-5 py-4 border-b border-[#F5F4EF] last:border-0 flex gap-4">
              <span className="text-xs font-black text-[#36671E] whitespace-nowrap pt-0.5">{f.step}</span>
              <p className="text-sm text-[#52525B] leading-relaxed">{f.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="mb-10">
        <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest flex items-center gap-2 mb-4">
          <Boxes className="w-4 h-4 text-[#36671E]" /> Every feature, explained ({FEATURES.length})
        </h2>
        <div className="space-y-3">
          {FEATURES.map((f) => (
            <details key={f.name} className="group bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
              <summary className="px-5 py-4 cursor-pointer list-none flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#18181B]">{f.name}</p>
                  <p className="text-xs text-[#71717A] mt-1 leading-relaxed">{f.summary}</p>
                </div>
                <span className="text-[#A1A1AA] text-xl leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
              </summary>

              <div className="px-5 pb-5 border-t border-[#F5F4EF] pt-4 space-y-4">
                <Block title="How it works">
                  <ol className="space-y-1.5">
                    {f.how.map((h, i) => (
                      <li key={i} className="text-sm text-[#52525B] leading-relaxed flex gap-2">
                        <span className="text-[#A1A1AA] font-mono text-xs pt-0.5">{i + 1}.</span> {h}
                      </li>
                    ))}
                  </ol>
                </Block>

                <Block title="How you use it">
                  <ul className="space-y-1.5">
                    {f.use.map((u, i) => (
                      <li key={i} className="text-sm text-[#52525B] leading-relaxed flex gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#36671E] shrink-0 mt-1" /> {u}
                      </li>
                    ))}
                  </ul>
                </Block>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0]">
                    <p className="text-[10px] font-black text-[#71717A] uppercase tracking-widest mb-1.5">Cost</p>
                    <p className="text-sm text-[#18181B] leading-relaxed">{f.cost}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20">
                    <p className="text-[10px] font-black text-[#36671E] uppercase tracking-widest mb-1.5">Value it provides</p>
                    <p className="text-sm text-[#18181B] leading-relaxed">{f.value}</p>
                  </div>
                </div>

                <p className="text-[11px] text-[#A1A1AA] font-mono flex items-start gap-1.5">
                  <Code2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {f.code}
                </p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── SCHEMA ── */}
      <section className="mb-10">
        <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-[#36671E]" /> Data model ({SCHEMA.length} tables)
        </h2>
        <p className="text-xs text-[#71717A] mb-4">
          Full SQL lives in <code className="font-mono">supabase/schema.sql</code>.
        </p>
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g} className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-[#FAFAF7] border-b border-[#F5F4EF]">
                <span className="text-xs font-black text-[#18181B] uppercase tracking-widest">{g}</span>
              </div>
              {SCHEMA.filter((t) => t.group === g).map((t) => (
                <div key={t.name} className="px-5 py-3.5 border-b border-[#F5F4EF] last:border-0">
                  <code className="text-sm font-mono font-bold text-[#36671E]">{t.name}</code>
                  <p className="text-sm text-[#52525B] mt-1 leading-relaxed">{t.purpose}</p>
                  <p className="text-[11px] text-[#A1A1AA] font-mono mt-1.5">{t.key}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── COSTS ── */}
      <section>
        <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest flex items-center gap-2 mb-4">
          <Wallet className="w-4 h-4 text-[#36671E]" /> What it costs to run
        </h2>
        <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
          {RUNNING_COSTS.map((c) => (
            <div key={c.item} className="px-5 py-4 border-b border-[#F5F4EF] last:border-0 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#18181B]">{c.item}</p>
                <p className="text-xs text-[#71717A] mt-0.5 leading-relaxed">{c.note}</p>
              </div>
              <span className="text-xs font-black text-[#36671E] whitespace-nowrap">{c.cost}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#A1A1AA] mt-3 leading-relaxed">
          The only cost that scales with usage is AI (cents per conversation). Everything else is flat until real volume.
        </p>
      </section>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black text-[#71717A] uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  );
}
