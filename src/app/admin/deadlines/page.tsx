import Link from "next/link";
import { CalendarDays, AlertTriangle, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  collectDeadlines, localDateKey, monthGrid, daysUntil, relativeDays, KIND_META,
  type DeadlineEvent,
} from "@/lib/deadlines";

export const dynamic = "force-dynamic";

/**
 * DEADLINES — every dated commitment in one place: build delivery dates,
 * discovery calls, dunning suspensions, lead SLA breaches, unsigned scopes.
 *
 * The headline number is "€ at risk": the CGV owe 10% of the project price per
 * day of late delivery, so a slipping build is a live cost, not a worry.
 *
 * Month navigation is a plain ?m=<offset> link, so the whole page stays a
 * server component — no client JS, no hydration, always fresh data.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function DeadlinesPage({
  searchParams,
}: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const offset = Number.isFinite(Number(m)) ? Math.trunc(Number(m)) : 0;

  const events = await collectDeadlines();

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const cells = monthGrid(year, month);
  const todayKey = localDateKey(new Date());

  const byDay = new Map<string, DeadlineEvent[]>();
  for (const e of events) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }

  const overdue = events.filter((e) => daysUntil(e.date) < 0);
  const next7 = events.filter((e) => daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7);
  const atRisk = events.reduce((sum, e) => sum + (e.atRiskEur ?? 0), 0);

  // Anything already late, plus the next two weeks — the actual working list.
  const agenda = events
    .filter((e) => daysUntil(e.date) >= -30 && daysUntil(e.date) <= 14)
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-[#36671E]" /> Deadlines
      </h1>
      <p className="text-sm text-[#71717A] mb-6">
        Delivery dates, calls, suspensions and follow-ups on one calendar.
      </p>

      {/* Headline tiles — money first */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Tile
          label="Overdue"
          value={String(overdue.length)}
          sub={overdue.length ? "Deal with these first" : "Nothing late"}
          tone={overdue.length ? "bad" : "ok"}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <Tile
          label="Refund risk"
          value={`€${atRisk.toLocaleString()}`}
          sub="10%/day late, capped at 50%"
          tone={atRisk > 0 ? "bad" : "ok"}
          icon={<TrendingDown className="w-4 h-4" />}
        />
        <Tile
          label="Next 7 days"
          value={String(next7.length)}
          sub="Commitments coming up"
          tone="neutral"
          icon={<CalendarDays className="w-4 h-4" />}
        />
      </div>

      {/* Calendar */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-[#E8E6E0] bg-[#FAFAF7] flex items-center justify-between gap-3">
          <h2 className="font-black text-[#18181B] capitalize">
            {base.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center gap-1">
            <NavLink href={`/admin/deadlines?m=${offset - 1}`} aria="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </NavLink>
            <Link
              href="/admin/deadlines"
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#52525B] hover:bg-[#F5F4EF] transition-colors"
            >
              Today
            </Link>
            <NavLink href={`/admin/deadlines?m=${offset + 1}`} aria="Next month">
              <ChevronRight className="w-4 h-4" />
            </NavLink>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-[10px] font-black uppercase tracking-widest text-[#A1A1AA] text-center pb-1">
                {d}
              </div>
            ))}

            {cells.map((d, i) => {
              if (!d) return <div key={`pad-${i}`} className="min-h-[84px] rounded-lg bg-[#FAFAF7]/60" />;
              const key = localDateKey(d);
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`min-h-[84px] rounded-lg border p-1.5 ${
                    isToday ? "border-[#36671E] bg-[#EEF5EA]" : "border-[#E8E6E0] bg-white"
                  }`}
                >
                  <div className={`text-[11px] font-black mb-1 ${isToday ? "text-[#36671E]" : "text-[#71717A]"}`}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e, j) => {
                      const meta = KIND_META[e.kind];
                      return (
                        <Link
                          key={j}
                          href={e.href}
                          title={`${meta.label} · ${e.label} — ${e.sub}`}
                          className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.chip} hover:opacity-80 transition-opacity`}
                        >
                          {meta.icon} {e.label}
                        </Link>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] font-bold text-[#A1A1AA] px-1.5">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-[#F5F4EF]">
            {Object.entries(KIND_META).map(([k, meta]) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] text-[#71717A]">
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} /> {meta.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Agenda */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E8E6E0] bg-[#FAFAF7]">
          <h2 className="font-black text-[#18181B]">What needs you</h2>
          <p className="text-xs text-[#71717A] mt-0.5">Everything late, plus the next 14 days.</p>
        </div>

        {agenda.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="font-bold text-[#18181B] text-sm">Clear ahead</p>
            <p className="text-xs text-[#71717A] mt-1">
              Nothing late and nothing due in the next two weeks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F5F4EF]">
            {agenda.map((e, i) => {
              const meta = KIND_META[e.kind];
              const late = daysUntil(e.date) < 0;
              return (
                <Link
                  key={i}
                  href={e.href}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAF7] transition-colors"
                >
                  <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm ${meta.chip}`}>
                    {meta.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#18181B] truncate">{e.label}</span>
                    <span className="block text-xs text-[#71717A] truncate">{e.sub}</span>
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-full ${
                      late ? "bg-[#FEE2E2] text-[#B91C1C]"
                        : daysUntil(e.date) <= 2 ? "bg-[#FEF3C7] text-[#92400E]"
                        : "bg-[#F5F4EF] text-[#52525B]"
                    }`}
                  >
                    {relativeDays(e.date)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NavLink({ href, aria, children }: { href: string; aria: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={aria}
      className="w-8 h-8 rounded-lg border border-[#E8E6E0] flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F4EF] transition-colors"
    >
      {children}
    </Link>
  );
}

function Tile({ label, value, sub, tone, icon }: {
  label: string; value: string; sub: string; tone: "ok" | "bad" | "neutral"; icon: React.ReactNode;
}) {
  const toneCls =
    tone === "bad" ? "text-[#B91C1C]" : tone === "ok" ? "text-[#166534]" : "text-[#18181B]";
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
