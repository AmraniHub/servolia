"use client";

import { usePathname } from "next/navigation";
import CookieBanner from "@/components/CookieBanner";
import ScrollToTop from "@/components/ScrollToTop";
import Analytics from "@/components/Analytics";
import PageTracker from "@/components/PageTracker";

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
 */
const BARE = ["/client-editor"];

export default function SiteChrome() {
  const pathname = usePathname() || "";
  if (BARE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return (
    <>
      <CookieBanner />
      <ScrollToTop />
      <Analytics />
      <PageTracker />
    </>
  );
}
