import Link from "next/link";
import type { Recommendation } from "@/lib/recommendations";

/**
 * What we noticed about THIS site.
 *
 * Styled deliberately unlike the service cards. Those are a catalogue and look
 * like one; this is a set of findings, and it reads as one — the measurement
 * first, in the client's own numbers, then what we would do, then the price
 * only where there is something to buy.
 *
 * An empty list renders one calm line rather than nothing, because silence on
 * a panel is ambiguous: a client cannot tell "we looked and all is well" from
 * "this section is broken".
 */
export default function Recommendations({
  items,
  heading,
  sub,
  quiet,
}: {
  items: Recommendation[];
  heading: string;
  sub: string;
  quiet: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white overflow-hidden">
      <div className="px-7 pt-6 pb-4">
        <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">{heading}</p>
        <p className="text-[13px] text-[#8A8A80] leading-relaxed">{sub}</p>
      </div>

      {items.length === 0 ? (
        <p className="px-7 pb-6 text-[14px] text-[#3F3F46] leading-relaxed">{quiet}</p>
      ) : (
        <ul className="divide-y divide-[#F0EFEA]">
          {items.map((r) => (
            <li key={r.id} className="px-7 py-5">
              {/* The finding leads, and it is the largest thing in the row.
                  A client should be able to check it against their own site. */}
              <p className="text-[15px] font-bold text-[#18181B] leading-snug">{r.finding}</p>
              <p className="mt-1.5 text-[14px] text-[#52525B] leading-relaxed">{r.action}</p>
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <Link
                  href={r.href}
                  className="inline-flex items-center h-9 px-4 rounded-lg border border-[#CBE3BC] bg-[#F7FBF4] text-[13px] font-bold text-[#36671E] hover:bg-[#F3F9EE] transition-colors"
                >
                  {r.cta} →
                </Link>
                {r.price ? (
                  <span className="text-[13px] font-bold text-[#18181B] tabular-nums">{r.price}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
