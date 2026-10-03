"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { alternatePath, browserPrefersFrench, getLangPref, setLangPref } from "@/lib/langPref";

/**
 * On an English page, offers the same page in French to a visitor whose
 * browser is set to French. Never redirects on a first visit and never runs
 * on the server, so search engines see exactly what they saw before.
 *
 *  - choice "fr" remembered  -> an English page with a French twin opens in
 *    French (client-side; a crawler never has this choice stored)
 *  - choice "en" remembered  -> nothing is shown again
 *  - no choice + French browser -> a small card: "Voir en français" / close
 */
export default function LanguageHint() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  /* Keyed to the page it was computed for, so a stale offer never shows on the next page. */
  const [offer, setOffer] = useState<{ on: string; to: string } | null>(null);
  const frPath = offer && offer.on === pathname ? offer.to : null;
  const setFrPath = (to: string | null) => setOffer(to ? { on: pathname, to } : null);

  useEffect(() => {
    if (pathname === "/fr" || pathname.startsWith("/fr/")) return;
    /* The head's hreflang tags update with the page; read them a tick later. */
    const t = window.setTimeout(() => {
      const target = alternatePath("fr");
      if (!target) return;
      const pref = getLangPref();
      if (pref === "en") return;
      if (pref === "fr") {
        router.replace(target);
        return;
      }
      if (browserPrefersFrench()) setOffer({ on: pathname, to: target });
    }, 50);
    return () => window.clearTimeout(t);
  }, [pathname, router]);

  if (!frPath) return null;

  return (
    <div
      role="dialog"
      aria-label="Version française disponible"
      lang="fr"
      className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-[60] rounded-xl border border-[#E8E6E0] bg-[#FAFAF7] shadow-xl p-4"
    >
      <button
        type="button"
        onClick={() => { setLangPref("en"); setFrPath(null); }}
        className="absolute top-2 right-2 p-1 text-[#71717A] hover:text-[#18181B]"
        aria-label="Rester en anglais"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="text-sm text-[#18181B] font-semibold pr-6">Cette page existe en français.</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => { setLangPref("fr"); router.push(frPath); }}
          className="px-4 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:opacity-90"
        >
          Voir en français
        </button>
        <button
          type="button"
          onClick={() => { setLangPref("en"); setFrPath(null); }}
          className="text-sm text-[#52525B] hover:text-[#18181B] underline"
          lang="en"
        >
          Stay in English
        </button>
      </div>
    </div>
  );
}
