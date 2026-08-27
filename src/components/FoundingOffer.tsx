import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SETUP_PLAN } from "@/lib/pricing";

/**
 * The founding-ten offer — the case-study supplier.
 *
 * The site launches with honestly-labeled scenario case studies; NAMED ones
 * can only come from real clients. This banner trades the installation fee
 * for that proof: first ten practices, any plan, installation waived, in
 * exchange for a named case study once results are in. Claimed through the
 * audit — not self-serve checkout — so the waiver is applied at scope stage,
 * before any payment is taken. The "10 places" count is maintained by hand:
 * update or remove this banner as places fill.
 */
/**
 * ONE SWITCH for the whole offer.
 *
 * The banner promised the installation waived while the plan cards, directly
 * below it, charged it in full. With zero clients every buyer qualified, so
 * the button was wrong for literally everyone who could click it - and a
 * discount advertised next to a button that ignores it reads as a fake
 * discount. The cards now import this flag, so the two cannot disagree.
 *
 * Set to false once the ten places are gone, and every mention disappears
 * together.
 */
export const FOUNDING_PLACES_OPEN = true;
export const FOUNDING_PLACES = 10;

export default function FoundingOffer({ lang = "en" }: { lang?: "en" | "fr" }) {
  const fr = lang === "fr";
  if (!FOUNDING_PLACES_OPEN) return null;
  return (
    <div className="max-w-3xl mx-auto rounded-2xl border-2 border-[#36671E]/30 bg-[#EEF5EA] px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-[#36671E] flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-[#FAFAF7]" />
        </span>
        <div>
          <p className="text-sm font-black text-[#18181B]">
            {fr ? `Cabinets fondateurs — ${FOUNDING_PLACES} places` : `Founding practices — ${FOUNDING_PLACES} places`}
          </p>
          <p className="text-sm text-[#3F3F46] mt-1 leading-relaxed">
            {fr ? (
              <>
                Lancement : les {FOUNDING_PLACES} premiers cabinets obtiennent la mise en place offerte
                (−{SETUP_PLAN.totalEur} €), quelle que soit la formule, en échange d’une étude de cas
                nommée une fois vos résultats au rendez-vous. Réservez votre place via l’
                <Link href="/fr/audit" className="font-bold text-[#36671E] underline underline-offset-2">
                  audit gratuit
                </Link>{" "}
                — mentionnez « fondateur ».
              </>
            ) : (
              <>
                We’re launching: the first {FOUNDING_PLACES} practices get the €{SETUP_PLAN.totalEur} installation
                waived — on any plan — in exchange for a named case study once your results are in.
                Claim your place through the{" "}
                <Link href="/free-audit" className="font-bold text-[#36671E] underline underline-offset-2">
                  free audit
                </Link>{" "}
                and mention “founding”.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
