"use client";

import { usePathname, useSelectedLayoutSegments } from "next/navigation";
import CookieBanner from "@/components/CookieBanner";
import ScrollToTop from "@/components/ScrollToTop";
import Analytics from "@/components/Analytics";
import PageTracker from "@/components/PageTracker";
import { editorMountPaths } from "@/lib/siteEditor";

/**
 * Servolia's own furniture — cookie banner, back-to-top, analytics — on every
 * page EXCEPT the ones served at a client's own domain.
 *
 * `/client-editor/*` is proxied by a client's host so it appears at their
 * address, and it inherited all of this. Three separate problems, found by
 * driving the page rather than reading it:
 *
 *  - the cookie banner sat over the Save button, on a tool whose whole job is
 *    that button;
 *  - a consent banner on an admin screen the client was handed a password for
 *    is nonsense — they are not a visitor being tracked, they are the owner;
 *  - Servolia's analytics and page tracker were recording a client's private
 *    editing session as traffic on Servolia's own site.
 *
 * The head-level Organization schema still renders. It is invisible, and the
 * client is a Servolia hosting client who knows perfectly well who hosts them
 * — but it is the next thing to move if this editor is ever served somewhere
 * that must not name Servolia at all.
 *
 * AND THE PATH IS NOT THE ONE WE SERVE IT AT. The client's host rewrites their
 * own /admin to this, so `usePathname()` returns THEIR path, not ours — which
 * is how this gate silently stopped working the moment the editor was really
 * mounted on a domain, putting our consent banner back over her Save button.
 * The mount paths are therefore read from the same config that defines the
 * mounts, never listed by hand here.
 */
const BARE = ["/client-editor", ...editorMountPaths()];

export default function SiteChrome() {
  const pathname = usePathname() || "";
  const segments = useSelectedLayoutSegments();
  if (BARE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  /* A practice's generated site — at servolia.com/sites/<slug> or, since C2,
     at her own domain, where the browser path is "/" and could be our own
     homepage. The rendered route says which it is. Her site gets none of
     Servolia's furniture: no Servolia consent banner, no Servolia analytics.
     Only the first-party counter, credited to her site, feeds her portal. */
  if (segments[0] === "sites") return <PageTracker siteSlug={segments[1] ?? null} />;
  return (
    <>
      <CookieBanner />
      <ScrollToTop />
      <Analytics />
      <PageTracker />
    </>
  );
}
