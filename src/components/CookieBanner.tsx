"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isClientSurface } from "@/lib/clientSurfaces";

/**
 * A cookie NOTICE, not a consent choice (founder decision 2026-09-30).
 * Servolia's own analytics and ad tags run for every visitor
 * (src/components/Analytics.tsx), so the old "Decline" button promised a
 * choice that changed nothing. One button, in the page's language.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [fr, setFr] = useState(false);
  const pathname = usePathname();
  /* No trackers run on a client's own pages, so there is nothing to notify
     about -- and a bar covering the bottom of the service page someone just
     paid for is a poor first impression of a company they are deciding to
     trust. */
  const suppressed = isClientSurface(pathname);

  useEffect(() => {
    if (suppressed) return;
    try {
      // French pages: /fr/... or the shared pages opened with ?lang=fr (/hosting, /assistant).
      const { pathname: path, search } = window.location;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the address and storage are only readable after mount
      setFr(path === "/fr" || path.startsWith("/fr/") || new URLSearchParams(search).get("lang") === "fr");
      if (!localStorage.getItem("servolia-cookie-consent")) setVisible(true);
    } catch {}
  }, [suppressed, pathname]);

  const dismiss = () => {
    try { localStorage.setItem("servolia-cookie-consent", "noticed"); } catch {}
    setVisible(false);
  };

  if (suppressed || !visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-[#FAFAF7]/95 backdrop-blur-md border-t border-[#D4D2CC] px-4 py-4 shadow-2xl">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4 justify-between">
        <p className="text-sm text-[#52525B] text-center sm:text-left max-w-2xl">
          {fr
            ? "Ce site utilise des cookies pour mesurer son audience et ses publicités. "
            : "This site uses cookies to measure its audience and its advertising. "}
          <Link href={fr ? "/fr/legal/confidentialite" : "/legal/privacy"} className="underline hover:text-[#18181B] transition-colors">
            {fr ? "Politique de confidentialité" : "Privacy policy"}
          </Link>
          .
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 px-6 py-2 rounded-lg bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-sm font-bold hover:opacity-90 transition-opacity"
        >
          OK
        </button>
      </div>
    </div>
  );
}
