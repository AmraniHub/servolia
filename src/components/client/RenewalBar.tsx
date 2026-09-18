"use client";

import { useEffect, useState } from "react";

/**
 * How much of the paid period is left, as a bar.
 *
 * A date alone makes someone do arithmetic to answer the question they
 * actually have, which is "am I about to be charged". The bar answers that at
 * a glance; the date stays above it for anyone who wants the specifics.
 *
 * WHY THIS IS A CLIENT COMPONENT AND NOT A SERVER ONE. It needs the current
 * time, and reading the clock while rendering is impure — the same component
 * renders differently every time it is asked, which is what react-hooks/purity
 * refuses and is right to. Measuring after mount is the honest version. The
 * renewal DATE is already server-rendered directly above, so nothing is
 * missing or wrong in the frame before this appears.
 */
export default function RenewalBar({
  renewsAt,
  interval,
  label,
}: {
  renewsAt: string;
  interval: "month" | "year";
  label: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  /* The await is not decoration. Calling setState straight from an effect body
     is a synchronous update during render — react-hooks/set-state-in-effect,
     the same trap AssistantDemo and SiteEditor both hit. Yielding once moves
     it out. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (alive) setNow(Date.now());
    })();
    return () => { alive = false; };
  }, []);
  if (now === null) return null;

  const end = Date.parse(renewsAt);
  if (!Number.isFinite(end)) return null;
  const span = interval === "year" ? 365 * 86_400_000 : 30 * 86_400_000;
  const left = end - now;
  /* Nothing is drawn for a period that has passed, or for a date further out
     than the period can explain — a half-filled bar computed from a figure we
     do not understand is a confident picture of nothing. */
  if (left <= 0 || left > span * 1.2) return null;

  const used = Math.min(100, Math.max(0, ((span - left) / span) * 100));
  const days = Math.max(1, Math.round(left / 86_400_000));

  return (
    <div className="px-7 pb-6">
      <div className="h-1.5 rounded-full bg-[#EDEBE4] overflow-hidden">
        <div className="h-full rounded-full bg-[#36671E]" style={{ width: `${used}%` }} />
      </div>
      <p className="mt-2 text-[12.5px] text-[#8A8A80]">{label.replace("{n}", String(days))}</p>
    </div>
  );
}
