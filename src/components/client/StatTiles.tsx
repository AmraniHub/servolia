/**
 * The four numbers a client actually wants at a glance.
 *
 * What is live, what it costs, when it renews, how big it is. Not decoration:
 * every tile is the answer to a question that otherwise becomes an email to
 * us, which is the cost this whole panel exists to remove.
 *
 * Deliberately not a chart. A hosting account has four facts and no trend —
 * drawing a graph of them would be visual effort spent making something look
 * informative rather than making it informative.
 */

export interface Tile {
  label: string;
  value: string;
  /** Small grey line under the number. */
  hint?: string;
  /** Draws the dot in green and makes it pulse — for "live right now". */
  live?: boolean;
}

export default function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-2xl border border-[#E8E6E0] bg-white p-4 transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-black text-[#8A8A80] uppercase tracking-[0.14em]">
            {t.live ? (
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                {/* The ping is the one animation on this page. It earns its
                    place: "is my site up" is the question underneath most of
                    the others, and a still green dot answers it less. */}
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#36671E] opacity-70 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#36671E]" />
              </span>
            ) : null}
            {t.label}
          </p>
          <p className="mt-1.5 text-[19px] font-black text-[#18181B] tabular-nums leading-tight break-words">
            {t.value}
          </p>
          {t.hint ? <p className="mt-0.5 text-[12px] text-[#8A8A80] leading-snug">{t.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
