import Link from "next/link";

/**
 * WHAT THE CLIENT HAS, AND WHAT ELSE THERE IS.
 *
 * A hosting panel is the one place a client comes voluntarily, already signed
 * in, already paying, at the moment they are thinking about their website. It
 * is the best advertising surface this business has and it was showing one
 * card.
 *
 * WHAT KEEPS IT FROM BECOMING A BILLBOARD. Everything already bought is listed
 * FIRST and marked as theirs — a client who cannot immediately see what they
 * pay for, on the page that lists what they could pay for, correctly reads the
 * whole page as a sales pitch and stops trusting it. The price is always
 * visible, because a service with a hidden price is one nobody clicks.
 *
 * Nothing here charges anything. Each card opens the page that explains the
 * service properly; buying is a decision made with the details in front of
 * you, not from a tile.
 */

export interface ServiceCard {
  key: string;
  name: string;
  blurb: string;
  /** "$12/month", "$88/year" — already formatted for the client's language. */
  price: string;
  /** Where to read more and buy. */
  href: string;
  /** They already pay for this one. */
  owned?: boolean;
  /** Two or three lines of what it includes. */
  includes?: string[];
  /** Built for them and waiting — the strongest thing we can say. */
  ready?: boolean;
}

const T = {
  en: { yours: "Yours", ready: "Built for you", more: "See what it does", add: "Add this" },
  fr: { yours: "Inclus", ready: "Déjà prêt", more: "Voir en détail", add: "Ajouter" },
};

export default function ServiceCards({ cards, lang }: { cards: ServiceCard[]; lang: "en" | "fr" }) {
  const t = T[lang];
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {cards.map((c) => (
        <div
          key={c.key}
          className={`rounded-2xl border p-6 flex flex-col transition-shadow ${
            c.owned
              ? "border-[#CBE3BC] bg-[#F7FBF4]"
              : "border-[#E8E6E0] bg-white hover:shadow-[0_2px_14px_rgba(0,0,0,0.06)]"
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="text-[16px] font-black text-[#18181B] leading-snug">{c.name}</h3>
            {c.owned ? (
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#36671E] text-white">
                {t.yours}
              </span>
            ) : c.ready ? (
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#CBE3BC] bg-white text-[#36671E]">
                {t.ready}
              </span>
            ) : null}
          </div>

          <p className="text-[13.5px] text-[#52525B] leading-relaxed">{c.blurb}</p>

          {c.includes?.length ? (
            <ul className="mt-3 space-y-1">
              {c.includes.slice(0, 3).map((line) => (
                <li key={line} className="flex items-start gap-2 text-[13px] text-[#3F3F46]">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-[#A8A8A0] shrink-0" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 pt-3 border-t border-black/[0.06] flex items-center justify-between gap-3">
            <span className="text-[14px] font-black text-[#18181B] tabular-nums">{c.price}</span>
            {c.owned ? null : (
              <Link
                href={c.href}
                className="text-[13px] font-bold text-[#36671E] hover:underline shrink-0"
              >
                {c.ready ? t.add : t.more} →
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
