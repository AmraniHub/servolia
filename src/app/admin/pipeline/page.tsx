import Link from "next/link";
import { supabaseAdmin, type Lead } from "@/lib/supabase";
import { List, Plus } from "lucide-react";
import PipelineBoard from "@/components/admin/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const db = supabaseAdmin();
  const { data } = db
    ? await db.from("leads").select("*").order("created_at", { ascending: false }).limit(500)
    : { data: [] };
  const leads = (data ?? []) as Lead[];

  const openValue = leads
    .filter(l => !["live", "lost"].includes(l.stage))
    .reduce((s, l) => s + Number(l.value_estimate ?? 0), 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Pipeline</h1>
          <p className="text-sm text-[#71717A] mt-1">
            Drag cards between stages · {leads.length} leads · open value €{openValue.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/leads"
            className="px-3 py-2.5 rounded-lg border border-[#E8E6E0] bg-white text-[#52525B] text-sm font-semibold hover:bg-[#F5F4EF] flex items-center gap-1.5">
            <List className="w-4 h-4" /> List view
          </Link>
          <Link href="/admin/leads/new"
            className="px-4 py-2.5 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add lead
          </Link>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-12 text-center">
          <p className="text-sm text-[#A1A1AA] mb-3">No leads yet.</p>
          <Link href="/admin/leads/new" className="text-sm text-[#36671E] font-semibold hover:underline">+ Add your first lead</Link>
        </div>
      ) : (
        <PipelineBoard initialLeads={leads} />
      )}
    </div>
  );
}
