"use client";

import dynamic from "next/dynamic";
import { useSelectedLayoutSegment } from "next/navigation";

/* On demand: still rendered on the server for every servolia.com page (so
   crawlers read it in the HTML), but its code is a separate chunk that a
   practice's page never loads. */
const ServoliaTags = dynamic(() => import("@/components/ServoliaTags"));

/**
 * Servolia's own head tags — its Organization and WebSite schema and Meta's
 * domain-verification tag — on every page EXCEPT a client's generated site.
 *
 * A practice's site is rendered by the same app: at servolia.com/sites/<slug>
 * and, since C2, at her own domain, where the browser path is "/" and
 * usePathname() cannot tell her homepage from ours. The selected layout
 * segment can: it is the route that actually rendered ("sites"), on the
 * server and in the browser alike, whatever the URL bar says.
 *
 * The tags are rendered HERE rather than passed in as children from the
 * server layout: children would travel in the page's data payload even when
 * not rendered, and a curl of her homepage found "Servolia LLC" in it.
 * Measured 2026-09-22.
 */
export default function ServoliaHead() {
  const segment = useSelectedLayoutSegment();
  if (segment === "sites") return null;
  return <ServoliaTags />;
}
