"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Fires one first-party pageview per route change to /api/track.
 * Runs alongside GA4/Meta (which stay for ad attribution) — this one exists so
 * traffic shows up in our OWN dashboards, for servolia.com and every client site.
 */

const SESSION_KEY = "servolia_sid";
const UTM_KEY = "servolia_utm";

/** A client site lives at /sites/{slug}[/page] — anything else is servolia.com itself. */
function siteSlugFrom(pathname: string): string | null {
  const m = pathname.match(/^\/sites\/([^/]+)/);
  return m ? m[1] : null;
}

function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Guards against double-firing in React strict mode and on no-op re-renders.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    // Never count our own admin pages as traffic — they'd drown out real visitors.
    if (pathname.startsWith("/admin")) return;

    const key = pathname + searchParams.toString();
    if (lastSent.current === key) return;
    lastSent.current = key;

    let sessionId = "";
    let isEntry = false;
    try {
      sessionId = sessionStorage.getItem(SESSION_KEY) ?? "";
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, sessionId);
        isEntry = true; // first view of this browser session = one "visit"
      }
    } catch {
      // Private mode / storage blocked — still track the view, just without a session.
    }

    // Keep the campaign that brought them in for the whole session, so a lead
    // that converts three pages later is still credited to the right ad.
    let utm: Record<string, string> | null = null;
    try {
      const fresh: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
        const v = searchParams.get(k);
        if (v) fresh[k] = v;
      }
      if (Object.keys(fresh).length) {
        sessionStorage.setItem(UTM_KEY, JSON.stringify(fresh));
        utm = fresh;
      } else {
        const saved = sessionStorage.getItem(UTM_KEY);
        if (saved) utm = JSON.parse(saved) as Record<string, string>;
      }
    } catch {}

    const payload = JSON.stringify({
      path: pathname,
      siteSlug: siteSlugFrom(pathname),
      referrer: document.referrer || null,
      sessionId,
      isEntry,
      utm,
    });

    // keepalive so the view still lands if they immediately navigate away.
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}

export default function PageTracker() {
  // useSearchParams needs a Suspense boundary or it opts the whole tree out of SSG.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
