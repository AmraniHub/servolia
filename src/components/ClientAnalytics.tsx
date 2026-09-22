"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

/**
 * A client site's OWN analytics tags — never Servolia's — and only with the
 * visitor's consent.
 *
 * Servolia's GA4/Pixel are suppressed on client sites (see SiteChrome), so
 * this is the only third-party tracking a client site loads, and only when
 * that client supplied an ID at intake. Sites with no IDs load nothing, ask
 * nothing, and still get first-party numbers in the portal via PageTracker.
 *
 * CONSENT FIRST (2026-09-22). Until then these tags fired on first load with
 * no question asked — on sites whose plan promises "pages RGPD conformes",
 * and which C2 now serves at the practice's own domain. In France the CNIL
 * requires consent before an audience-measurement or advertising cookie, and
 * the practice is the one answerable for it. So: nothing loads until the
 * visitor says yes; "no" is as easy as "yes"; the answer is remembered per
 * site under a neutral key (no supplier's name in her visitors' storage).
 */

const CLEAN_ID = /^[A-Za-z0-9-]{4,32}$/;

export default function ClientAnalytics({
  ga4Id,
  metaPixelId,
  slug,
  lang = "fr",
}: {
  ga4Id?: string;
  metaPixelId?: string;
  slug: string;
  lang?: "fr" | "en";
}) {
  // The ids go into inline script text: anything but an id is dropped.
  const ga = ga4Id && CLEAN_ID.test(ga4Id) ? ga4Id : "";
  const px = metaPixelId && /^\d{5,20}$/.test(metaPixelId) ? metaPixelId : "";
  const key = `site-consent-${slug}`;
  const [choice, setChoice] = useState<"yes" | "no" | "ask" | null>(null);

  useEffect(() => {
    if (!ga && !px) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(key); } catch { /* private mode: ask */ }
    // One read of browser storage after mount — the only place it exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(saved === "yes" || saved === "no" ? saved : "ask");
  }, [ga, px, key]);

  if (!ga && !px) return null;

  const answer = (v: "yes" | "no") => {
    try { localStorage.setItem(key, v); } catch { /* remembered for this page only */ }
    setChoice(v);
  };
  const fr = lang === "fr";

  return (
    <>
      {choice === "ask" ? (
        <div role="dialog" aria-label={fr ? "Cookies de mesure d'audience" : "Analytics cookies"}
          className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm z-[60] rounded-2xl bg-white border border-[#E4E4E7] shadow-xl p-4 text-[13px] text-[#3F3F46]">
          <p>
            {fr
              ? "Nous aimerions mesurer la fréquentation de ce site avec des cookies. Vous pouvez refuser : le site fonctionne de la même façon."
              : "We would like to measure visits to this site with cookies. You can say no: the site works the same."}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => answer("no")}
              className="flex-1 h-9 rounded-lg border border-[#D4D4D8] font-semibold text-[#18181B]">
              {fr ? "Refuser" : "Decline"}
            </button>
            <button type="button" onClick={() => answer("yes")}
              className="flex-1 h-9 rounded-lg bg-[#18181B] font-semibold text-white">
              {fr ? "Accepter" : "Accept"}
            </button>
          </div>
        </div>
      ) : null}

      {choice === "yes" && ga ? (
        <>
          <Script async src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="client-ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga}', { anonymize_ip: true });`}
          </Script>
        </>
      ) : null}
      {choice === "yes" && px ? (
        <Script id="client-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${px}'); fbq('track', 'PageView');`}
        </Script>
      ) : null}
    </>
  );
}
