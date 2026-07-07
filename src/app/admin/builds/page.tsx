import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { Hammer, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  intake:    { bg: "#F5F4EF", fg: "#71717A" },
  building:  { bg: "#FEF3C7", fg: "#92400E" },
  review:    { bg: "#EDE9FE", fg: "#5B21B6" },
  delivered: { bg: "#DBEAFE", fg: "#1D4ED8" },
  live:      { bg: "#D1FAE5", fg: "#065F46" },
};

export default async function BuildsPage() {
  const db = supabaseAdmin();
  const { data: builds } = db
    ? await db.from("builds").select("*").order("created_at", { ascending: false })
    : { data: [] };

  const active = (builds ?? []).filter(b => b.status !== "live");
  const completed = (builds ?? []).filter(b => b.status === "live");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Builds</h1>
      <p className="text-sm text-[#71717A] mb-6">{active.length} active · {completed.length} completed</p>

      {(builds?.length ?? 0) === 0 ? (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-12 text-center">
          <Hammer className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
          <p className="text-sm text-[#71717A]">No builds yet. When a client pays a deposit via Stripe, a build appears here automatically.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-3">Active</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {active.map(b => <BuildCard key={b.id} build={b} />)}
              </div>
            </>
          )}
          {completed.length > 0 && (
            <>
              <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-3">Live</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completed.map(b => <BuildCard key={b.id} build={b} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function BuildCard({ build: b }: { build: { id: string; business: string; plan_name: string; total_price: number; deposit_paid: number; balance_due: number; status: string; deadline: string | null; started_at: string | null } }) {
  const colors = STATUS_COLORS[b.status] ?? STATUS_COLORS.intake;
  return (
    <Link href={`/admin/builds/${b.id}`}
      className="bg-white border border-[#E8E6E0] rounded-2xl p-5 hover:border-[#36671E]/40 transition-colors block">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-black text-[#18181B] truncate flex-1">{b.business}</p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: colors.bg, color: colors.fg }}>{b.status.toUpperCase()}</span>
      </div>
      <p className="text-xs text-[#71717A] mb-3">{b.plan_name} · €{Number(b.total_price).toLocaleString()}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#36671E] font-bold">€{Number(b.deposit_paid).toLocaleString()} paid</span>
        <span className="text-[#71717A]">€{Number(b.balance_due).toLocaleString()} due</span>
      </div>
      {b.deadline && (
        <div className="mt-3 pt-3 border-t border-[#F5F4EF] flex items-center gap-1.5 text-xs text-[#71717A]">
          <Clock className="w-3 h-3" />
          Due {new Date(b.deadline).toLocaleDateString()}
        </div>
      )}
    </Link>
  );
}
