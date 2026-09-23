"use client";

import { OrgSchema, WebSiteSchema } from "@/components/StructuredData";

/** Servolia's own head tags, loaded on demand by ServoliaHead (ServoliaOnly.tsx). */
export default function ServoliaTags() {
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
