"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { OrgSchema, WebSiteSchema } from "@/components/StructuredData";

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
  return (
    <>
      <OrgSchema />
      <WebSiteSchema />
      {/* Meta checks servolia.com's own pages for this; it was in the root
          metadata, which Next merges into every page — hers included. */}
      <meta name="facebook-domain-verification" content="y91x60qk6fueqiuz3ncnb295oepldu" />
    </>
  );
}
