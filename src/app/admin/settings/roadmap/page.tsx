import { STATUS_META, type RoadmapStatus } from "@/lib/roadmap";
import { openRoadmap } from "../_data";

export const dynamic = "force-dynamic";

/**
 * The live roadmap. This is the part of settings actually read daily, which is
 * why it now has its own route instead of sitting at the bottom of a long
 * scroll. Grouped by status so blocked work can't hide behind queued work.
 */
export default function RoadmapSettings() {
  const roadmap = openRoadmap();

  const groups: { status: RoadmapStatus; items: typeof roadmap }[] = (
    ["blocked", "in_progress", "todo"] as RoadmapStatus[]
  )
    .map((status) => ({ status, items: roadmap.filter((r) => r.status === status) }))
    .filter((g) => g.items.length > 0);

  if (!roadmap.length) {
    return (
      <div className="p-8 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20 text-center">
        <p className="text-sm font-black text-[#36671E]">Nothing open.</p>
        <p className="text-xs text-[#295115] mt-1">Every roadmap entry is marked done in src/lib/roadmap.ts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const st = STATUS_META[g.status];
        return (
          <div key={g.status}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                {st.label}
              </span>
              <span className="text-[11px] font-bold text-[#A1A1AA]">{g.items.length}</span>
            </div>
            <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
              {g.items.map((r, i) => (
                <div key={i} className="px-5 py-4 border-b border-[#F5F4EF] last:border-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-[#A1A1AA]">P{r.priority}</span>
                    <span className="text-sm font-bold text-[#18181B]">{r.title}</span>
                  </div>
                  {r.detail && <p className="text-xs text-[#71717A] mt-1.5 leading-relaxed">{r.detail}</p>}
                  {r.needs && <p className="text-xs text-[#92400E] mt-1">Needs: {r.needs}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
