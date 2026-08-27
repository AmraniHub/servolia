import { CalendarClock } from "lucide-react";
import type { CapacityState } from "@/lib/capacity";

/**
 * Honest scarcity. Renders whatever is actually true, in this order:
 *   week full          → "This week is full — next start is [next week]"
 *   depletion known    → "2 of 3 build slots left this week"
 *   count unknown      → "We start 3 installations a week" (the cap alone)
 *
 * Never renders a countdown, a fake timer, or a number that isn't in the
 * database — see the honesty rule in src/lib/capacity.ts.
 */

const COPY = {
  en: {
    full: (n: number) => `This week is full — we start ${n} installations a week`,
    fullSub: "Start now and you're first in next week's queue.",
    left: (left: number, cap: number) =>
      `${left} of ${cap} build slot${cap === 1 ? "" : "s"} left this week`,
    leftSub: "One person, a written 7-day deadline — so the week has a hard limit.",
    cap: (n: number) => `We start ${n} installations a week`,
    capSub: "One person, a written 7-day deadline — so the week has a hard limit.",
  },
  fr: {
    full: (n: number) => `Semaine complète — nous démarrons ${n} mises en place par semaine`,
    fullSub: "Démarrez maintenant et vous êtes prioritaire la semaine prochaine.",
    left: (left: number, cap: number) =>
      `${left} place${left === 1 ? "" : "s"} sur ${cap} restante${left === 1 ? "" : "s"} cette semaine`,
    leftSub: "Une seule personne, un délai de 7 jours engagé par écrit — la semaine a donc une limite stricte.",
    cap: (n: number) => `Nous démarrons ${n} mises en place par semaine`,
    capSub: "Une seule personne, un délai de 7 jours engagé par écrit — la semaine a donc une limite stricte.",
  },
};

export default function CapacityBadge({
  state,
  lang = "en",
  className = "",
}: {
  state: CapacityState;
  lang?: "en" | "fr";
  className?: string;
}) {
  const t = COPY[lang === "fr" ? "fr" : "en"];
  const { capacity, slotsLeft, full } = state;

  // "3 of 3 slots left" is the honest number when nothing has sold this week —
  // and it reads to a visitor as "nobody is buying this". Same fact, wrong
  // signal. At full availability, state the capacity instead: it says exactly
  // as much, without advertising an empty week. The depletion count appears
  // the moment it means something, i.e. once a slot has actually gone.
  const untouched = slotsLeft != null && slotsLeft >= capacity;
  const showCount = slotsLeft != null && !untouched;

  const headline = full ? t.full(capacity) : showCount ? t.left(slotsLeft, capacity) : t.cap(capacity);
  const sub = full ? t.fullSub : showCount ? t.leftSub : t.capSub;

  return (
    <div
      className={`inline-flex items-start gap-2.5 rounded-xl border px-4 py-3 text-left ${
        full ? "border-[#FCD34D] bg-[#FFFBEB]" : "border-[#D6E2CF] bg-[#EEF5EA]"
      } ${className}`}
    >
      <CalendarClock
        className={`w-4 h-4 mt-0.5 shrink-0 ${full ? "text-[#92400E]" : "text-[#36671E]"}`}
        aria-hidden="true"
      />
      <div>
        <p className={`text-sm font-black ${full ? "text-[#92400E]" : "text-[#36671E]"}`}>{headline}</p>
        <p className="text-xs text-[#71717A] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
