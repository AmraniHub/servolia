"use client";

import { useEffect } from "react";

/**
 * Sets the DOCUMENT's language after hydration — for pages that must imitate
 * a client's multilingual site so the assistant widget answers in Arabic,
 * French or English.
 *
 * Why an effect and not an inline <script>: the root layout renders
 * <html lang="en">; a script that rewrote it before React hydrated produced
 * "server rendered HTML didn't match the client" on every ?lang= showroom
 * link — a red badge in dev and a mismatch React refuses to patch. Set after
 * hydration, the attribute change is exactly what the widget's own
 * MutationObserver exists to follow (it tracks language switchers on real
 * client sites), so it re-renders in the new language by itself.
 *
 * Restores the previous values on unmount, because Next keeps the document
 * alive across client navigations.
 */
export default function PageLang({ lang }: { lang: "ar" | "fr" | "en" }) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = { lang: el.getAttribute("lang"), dir: el.getAttribute("dir") };
    el.setAttribute("lang", lang);
    el.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    return () => {
      if (prev.lang === null) el.removeAttribute("lang"); else el.setAttribute("lang", prev.lang);
      if (prev.dir === null) el.removeAttribute("dir"); else el.setAttribute("dir", prev.dir);
    };
  }, [lang]);
  return null;
}
