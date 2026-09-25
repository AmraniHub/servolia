import Link from "next/link";
import ReceptionistTrialAction from "@/components/admin/ReceptionistTrialAction";
import OneOffDoneAction from "@/components/admin/OneOffDoneAction";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { buildToday, type TodayItem } from "@/lib/today";

export const dynamic = "force-dynamic";

/**
 * /admin/today — the one page to open in the morning.
 *
 * Every row is one action with its link, grouped by what it is, ordered by
 * how soon. "Waiting on the client" rows are shown but muted: the CGV pause
 * the delivery clock while the ball is theirs, and you should not feel busy
 * about work that is not yours to do. Same data as the morning Telegram.
 */
export default async function TodayPage() {
  if (!(await isAdminAuthed())) redirect("/admin/login");
  const t = await buildToday();
  const date = new Date(t.generatedAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Today</h1>
          <p className="text-sm text-[#71717A]">{date}</p>
        </div>
        <p className="text-sm text-[#71717A]">
          <span className="font-black text-[#18181B]">{t.counts.me}</span> for you ·{" "}
          <span className="font-black text-[#18181B]">{t.counts.client}</span> waiting on clients
          {t.counts.urgent > 0 && <> · <span className="font-black text-[#B91C1C]">{t.counts.urgent} today</span></>}
        </p>
      </div>

      {t.sections.length === 0 && (
        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-8 text-center">
          <p className="font-black text-[#18181B] mb-1">Nothing needs you.</p>
          <p className="text-sm text-[#71717A]">No lead past its SLA, no draft unsent, no card failed, no trial ending. Go sell.</p>
          <Link href="/admin/prospects" className="inline-block mt-4 text-sm font-bold text-[#36671E] hover:underline">Open prospects →</Link>
        </div>
      )}

      {t.sections.map((s) => (
        <section key={s.key} className="mb-8">
          <h2 className="text-xs font-black tracking-widest uppercase text-[#71717A] mb-3">{s.label}</h2>
          <ul className="space-y-2">
            {s.items.map((i, n) => <Row key={`${i.kind}-${n}`} item={i} />)}
          </ul>
        </section>
      ))}

      <p className="text-xs text-[#A1A1AA] mt-10">
        Same list as the morning Telegram. Scripts can read it at <code>/api/admin/today</code>.
      </p>
    </div>
  );
}

function Row({ item }: { item: TodayItem }) {
  const mine = item.owner === "me";
  const tone = item.urgency === 2 ? "border-[#FCA5A5] bg-[#FEF2F2]" : mine ? "border-[#E8E6E0] bg-white" : "border-[#F1F0EC] bg-[#FAFAF7]";
  return (
    <li className="flex items-center gap-2">
      <Link href={item.href} className={`flex-1 min-w-0 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 hover:border-[#36671E] transition-colors ${tone}`}>
        <div className="min-w-0">
          <p className={`text-sm font-black truncate ${mine ? "text-[#18181B]" : "text-[#71717A]"}`}>{item.title}</p>
          {item.detail && <p className="text-xs text-[#71717A] mt-0.5">{item.detail}</p>}
        </div>
        <span className={`shrink-0 text-[10px] font-black tracking-widest uppercase mt-1 ${item.urgency === 2 ? "text-[#B91C1C]" : mine ? "text-[#36671E]" : "text-[#A1A1AA]"}`}>
          {item.urgency === 2 ? "today" : mine ? "you" : "client"}
        </span>
      </Link>
      {item.trialSlug ? <ReceptionistTrialAction slug={item.trialSlug} ended={Boolean(item.trialEnded)} /> : null}
      {item.oneOff ? <OneOffDoneAction where={item.oneOff.where} id={item.oneOff.id} session={item.oneOff.session} /> : null}
    </li>
  );
}
