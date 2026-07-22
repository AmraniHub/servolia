import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchTraffic, summarize } from "@/lib/traffic";
import { Users, Eye, MousePointerClick, Globe, Monitor, Link2, Megaphone, FileText, TrendingUp, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

/** Who is on servolia.com right now, where they came from, and what they read. */
export default async function TrafficPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const db = supabaseAdmin();
  if (!db) {
    return <Empty title="Supabase not configured" body="Add the Supabase env vars to start collecting traffic." />;
  }

  let current: Awaited<ReturnType<typeof fetchTraffic>>["current"] = [];
  let previous: typeof current = [];
  let tableMissing = false;
  try {
    const res = await fetchTraffic(db, { days, slugs: null });
    current = res.current;
    previous = res.previous;
  } catch {
    tableMissing = true;
  }

  if (tableMissing) {
    return (
      <Empty
        title="The page_views table doesn't exist yet"
        body="Run the page_views block at the end of supabase/schema.sql in the Supabase SQL editor. Traffic starts recording the moment it exists."
      />
    );
  }

  const s = summarize(current, days, previous);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <h1 className="text-2xl font-black text-[#18181B]">Traffic</h1>
        <div className="flex gap-1 p-1 rounded-xl bg-[#F5F4EF] border border-[#E8E6E0]">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/admin/traffic?days=${d}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                days === d ? "bg-white text-[#36671E] shadow-sm" : "text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>
      <p className="text-sm text-[#71717A] mb-6">
        servolia.com · last {days} days · cookie-free first-party tracking (client sites are in each client&apos;s portal)
      </p>

      {s.views === 0 ? (
        <Empty
          title="No traffic recorded yet"
          body="The tracker is live on every public page. Data appears here as soon as someone visits — deploy, then open the site in a normal browser tab."
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi icon={<Users className="w-4 h-4" />} label="Visitors" value={s.visitors} trend={s.trend.visitors} accent />
            <Kpi icon={<Eye className="w-4 h-4" />} label="Pageviews" value={s.views} trend={s.trend.views} sub={`${s.viewsPerVisit} per visit`} />
            <Kpi icon={<MousePointerClick className="w-4 h-4" />} label="Visits" value={s.visits} sub={`${s.bounceRate}% bounced`} />
            <Kpi icon={<Megaphone className="w-4 h-4" />} label="From ads" value={s.fromAds} sub={s.views ? `${Math.round((s.fromAds / s.views) * 100)}% of views` : undefined} />
          </div>

          {/* Traffic over time */}
          <Panel icon={<TrendingUp className="w-4 h-4" />} title="Visitors per day" subtitle={`Last ${days} days`} className="mb-6">
            <Chart days={s.days} />
          </Panel>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Panel icon={<FileText className="w-4 h-4" />} title="Top pages" subtitle="What people actually read">
              <Bars rows={s.topPages} total={s.views} mono />
            </Panel>
            <Panel icon={<Link2 className="w-4 h-4" />} title="Where they came from" subtitle="Referring site">
              <Bars rows={s.referrers} total={s.views} accent />
            </Panel>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Panel icon={<Globe className="w-4 h-4" />} title="Countries">
              <Bars rows={s.countries} total={s.views} />
            </Panel>
            <Panel icon={<Monitor className="w-4 h-4" />} title="Devices & browsers">
              <Bars rows={s.devices} total={s.views} accent />
              <div className="mt-4 pt-3 border-t border-[#F5F4EF]">
                <Bars rows={s.browsers} total={s.views} />
              </div>
            </Panel>
            <Panel icon={<Megaphone className="w-4 h-4" />} title="Campaigns" subtitle="utm_campaign">
              {s.campaigns.length === 0 ? (
                <p className="text-sm text-[#A1A1AA] py-6 text-center">No tagged campaigns yet.</p>
              ) : (
                <Bars rows={s.campaigns} total={s.views} />
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────────── pieces ───────────────────────────── */

function Chart({ days }: { days: { label: string; views: number; visitors: number }[] }) {
  const max = Math.max(...days.map((d) => d.views), 1);
  // Above ~45 bars the labels collide, so thin them out.
  const step = days.length > 45 ? 7 : days.length > 14 ? 3 : 1;
  return (
    <div className="flex items-end justify-between gap-[2px] h-40 mt-3">
      {days.map((d, i) => (
        <div key={d.label + i} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
          <span className="text-[10px] font-bold text-[#36671E] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {d.visitors}v · {d.views}pv
          </span>
          <div
            className="w-full rounded-t-sm bg-gradient-to-t from-[#36671E] to-[#BEF264] transition-all min-h-[2px] hover:opacity-80"
            style={{ height: `${Math.max((d.views / max) * 100, 2)}%` }}
          />
          <span className="text-[8px] text-[#A1A1AA] whitespace-nowrap">{i % step === 0 ? d.label : ""}</span>
        </div>
      ))}
    </div>
  );
}

function Bars({ rows, total, accent, mono }: { rows: [string, number][]; total: number; accent?: boolean; mono?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-[#A1A1AA] py-6 text-center">No data yet.</p>;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <div className="space-y-2.5 mt-3">
      {rows.map(([label, n]) => (
        <div key={label}>
          <div className="flex items-center justify-between text-xs mb-1 gap-3">
            <span className={`font-semibold text-[#18181B] truncate ${mono ? "font-mono text-[11px]" : "capitalize"}`}>{label}</span>
            <span className="text-[#71717A] shrink-0">
              {n}
              {total > 0 && <span className="text-[#A1A1AA]"> · {Math.round((n / total) * 100)}%</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#F5F4EF]">
            <div className={`h-full rounded-full ${accent ? "bg-[#BEF264]" : "bg-[#36671E]"}`} style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({
  icon, label, value, sub, trend, accent,
}: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; trend?: number | null; accent?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border ${accent ? "bg-[#EEF5EA] border-[#36671E]/30" : "bg-white border-[#E8E6E0]"}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${accent ? "text-[#36671E]" : "text-[#71717A]"}`}>{label}</p>
        <span className={accent ? "text-[#36671E]" : "text-[#A1A1AA]"}>{icon}</span>
      </div>
      <p className={`text-xl font-black mt-1 ${accent ? "text-[#36671E]" : "text-[#18181B]"}`}>{value}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {trend !== null && trend !== undefined && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trend >= 0 ? "text-[#166534]" : "text-[#B91C1C]"}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
        {sub && <p className={`text-[10px] ${accent ? "text-[#36671E]/70" : "text-[#A1A1AA]"}`}>{sub}</p>}
      </div>
    </div>
  );
}

function Panel({
  icon, title, subtitle, children, className = "",
}: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white border border-[#E8E6E0] rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#36671E]">{icon}</span>
        <h2 className="text-sm font-black text-[#18181B]">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-[#A1A1AA] mb-2">{subtitle}</p>}
      {children}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Traffic</h1>
      <div className="mt-6 bg-white border border-[#E8E6E0] rounded-2xl p-8 text-center">
        <p className="font-black text-[#18181B] mb-1.5">{title}</p>
        <p className="text-sm text-[#71717A] max-w-md mx-auto leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
