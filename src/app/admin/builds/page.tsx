import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { Hammer, Clock, AlertTriangle, UserRound, Check, TrendingDown } from "lucide-react";
import {
  loadProgressFacts, buildProgress, buildLane,
  type BuildLike, type BuildProgress,
} from "@/lib/buildProgress";
import { daysUntil, relativeDays } from "@/lib/deadlines";

export const dynamic = "force-dynamic";

/**
 * BUILDS — organised by WHO has to act, not by an abstract status.
 *
 * Three lanes: what needs you, what's waiting on the client, what's live.
 * That distinction is the whole point — a build parked ten days because the
 * client never sent their intake is a chase, not a task, and per the CGV it
 * doesn't burn your delivery guarantee. The checklist on each card derives
 * itself from the data (see lib/buildProgress.ts), so it can never drift.
 */

interface BuildRow extends BuildLike {
  business: string;
  plan_name: string | null;
  plan: string;
  created_at: string;
}

export default async function BuildsPage() {
  const db = supabaseAdmin();
  const { data } = db
    ? await db.from("builds").select("*").order("created_at", { ascending: false })
    : { data: [] };
  const builds = (data ?? []) as BuildRow[];

  const facts = await loadProgressFacts(builds);
  const rows = builds.map((b) => {
    const progress = buildProgress(b, facts);
    return { build: b, progress, lane: buildLane(b, progress) };
  });

  const needsYou = rows.filter((r) => r.lane === "needs-you");
  const waiting = rows.filter((r) => r.lane === "waiting-client");
  const live = rows.filter((r) => r.lane === "live");
  const atRisk = rows.reduce((s, r) => s + r.progress.atRiskEur, 0);
  const lateCount = rows.filter((r) => r.progress.daysLate > 0 && r.build.status !== "live").length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1 flex items-center gap-2">
        <Hammer className="w-5 h-5 text-[#36671E]" /> Builds
      </h1>
      <p className="text-sm text-[#71717A] mb-6">
        Grouped by who has to act next. The checklist on each build fills itself in from your data.
      </p>

      {builds.length === 0 ? (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-12 text-center">
          <Hammer className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
          <p className="text-sm text-[#71717A]">
            No builds yet. When a client pays a deposit via Stripe, a build appears here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <Tile label="Needs you" value={String(needsYou.length)}
              sub={needsYou.length ? "Your move" : "Nothing on your plate"}
              tone={needsYou.length ? "warn" : "ok"} icon={<Hammer className="w-4 h-4" />} />
            <Tile label="Waiting on client" value={String(waiting.length)}
              sub={waiting.length ? "Chase them" : "Nobody to chase"}
              tone="neutral" icon={<UserRound className="w-4 h-4" />} />
            <Tile label="Refund risk" value={`€${atRisk.toLocaleString()}`}
              sub={lateCount ? `${lateCount} late · client delays excluded` : "Nothing late"}
              tone={atRisk > 0 ? "bad" : "ok"} icon={<TrendingDown className="w-4 h-4" />} />
          </div>

          <Lane title="Needs you" hint="You're the blocker — generate, review or publish." rows={needsYou} />
          <Lane title="Waiting on client" hint="Chase them. The delivery guarantee is paused while you wait." rows={waiting} />
          <Lane title="Live" hint="Delivered and running." rows={live} muted />
        </>
      )}
    </div>
  );
}

function Lane({ title, hint, rows, muted }: {
  title: string;
  hint: string;
  rows: { build: BuildRow; progress: BuildProgress }[];
  muted?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest">{title}</h2>
        <span className="text-xs font-bold text-[#A1A1AA]">{rows.length}</span>
      </div>
      <p className="text-xs text-[#71717A] mt-1 mb-3">{hint}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(({ build, progress }) => (
          <BuildCard key={build.id} b={build} p={progress} muted={muted} />
        ))}
      </div>
    </section>
  );
}

function BuildCard({ b, p, muted }: { b: BuildRow; p: BuildProgress; muted?: boolean }) {
  const days = b.deadline ? daysUntil(b.deadline) : null;
  const late = !muted && days !== null && days < 0;
  const soon = !muted && days !== null && days >= 0 && days <= 3;

  // Urgency reads at a glance: red = late, amber = due within 3 days.
  const edge = late ? "border-l-4 border-l-[#B91C1C]"
    : soon ? "border-l-4 border-l-[#D97706]"
    : "border-l-4 border-l-transparent";

  const pct = Math.round((p.doneCount / p.total) * 100);

  return (
    <Link
      href={`/admin/builds/${b.id}`}
      className={`group bg-white border border-[#E8E6E0] ${edge} rounded-2xl p-4 hover:border-[#36671E]/40 hover:shadow-card transition-all block ${muted ? "opacity-70 hover:opacity-100" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-black text-[#18181B] truncate flex-1">{b.business}</p>
        {days !== null && !muted && (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${
            late ? "bg-[#FEE2E2] text-[#B91C1C]"
              : soon ? "bg-[#FEF3C7] text-[#92400E]"
              : "bg-[#F5F4EF] text-[#52525B]"
          }`}>
            {relativeDays(b.deadline!)}
          </span>
        )}
      </div>
      <p className="text-xs text-[#71717A] mb-3">
        {b.plan_name ?? b.plan} · €{Number(b.total_price).toLocaleString()}
        {Number(b.balance_due) > 0 && <> · €{Number(b.balance_due).toLocaleString()} due</>}
      </p>

      {/* Derived progress — never hand-ticked, so it can't drift */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#A1A1AA]">Delivery</span>
          <span className="text-[10px] font-bold text-[#71717A]">{p.doneCount}/{p.total}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#F0EFEA] overflow-hidden">
          <div className="h-full rounded-full bg-[#36671E] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* The one thing blocking this build, and whose move it is */}
      {p.current ? (
        <div className={`rounded-xl p-2.5 ${p.waitingOnClient ? "bg-[#FEF3C7]" : "bg-[#EEF5EA]"}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
              p.waitingOnClient ? "bg-[#FDE68A] text-[#92400E]" : "bg-[#D6E2CF] text-[#36671E]"
            }`}>
              {p.waitingOnClient ? "CLIENT" : "YOU"}
            </span>
            <span className={`text-[11px] font-black ${p.waitingOnClient ? "text-[#92400E]" : "text-[#36671E]"}`}>
              {p.current.label}
            </span>
          </div>
          <p className={`text-[11px] leading-snug ${p.waitingOnClient ? "text-[#92400E]" : "text-[#36671E]"}`}>
            {p.current.hint}
          </p>
        </div>
      ) : (
        <div className="rounded-xl p-2.5 bg-[#D1FAE5] flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-[#065F46]" />
          <span className="text-[11px] font-black text-[#065F46]">Fully delivered</span>
        </div>
      )}

      {p.atRiskEur > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#B91C1C]">
          <AlertTriangle className="w-3 h-3" />
          €{p.atRiskEur.toLocaleString()} refund risk · {p.daysLate}d late
        </div>
      )}
      {p.waitingOnClient && p.daysLate > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#71717A]">
          <Clock className="w-3 h-3" />
          {p.daysLate}d past target — guarantee paused (client delay)
        </div>
      )}
    </Link>
  );
}

function Tile({ label, value, sub, tone, icon }: {
  label: string; value: string; sub: string; tone: "ok" | "bad" | "warn" | "neutral"; icon: React.ReactNode;
}) {
  const toneCls = tone === "bad" ? "text-[#B91C1C]"
    : tone === "warn" ? "text-[#92400E]"
    : tone === "ok" ? "text-[#166534]"
    : "text-[#18181B]";
  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#71717A]">{label}</p>
        <span className="text-[#A1A1AA]">{icon}</span>
      </div>
      <p className={`text-2xl font-black ${toneCls}`}>{value}</p>
      <p className="text-[11px] text-[#A1A1AA] mt-0.5">{sub}</p>
    </div>
  );
}
