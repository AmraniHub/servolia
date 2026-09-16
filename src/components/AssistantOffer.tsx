"use client";

import { useState } from "react";
import AssistantDemo from "./AssistantDemo";
import ProductCheckout from "./ProductCheckout";

/**
 * The AI-assistant pay page's body: the film on one side, the price on the
 * other, sharing one piece of state — the website the buyer types in.
 *
 * That link is the point of the component. A visitor who arrives with no
 * ref sees "your website" in the demo's title bar; the moment they type
 * "clinique-atlas.ma" into the checkout, the demo is running on
 * clinique-atlas.ma. The product stops being generic at the exact moment
 * they start to imagine owning it.
 */
export default function AssistantOffer({
  planKey,
  monthlyUsd,
  annualUsd,
  includes,
  refCode,
  siteLabel,
  maskedEmail,
  defaultBilling,
  lang,
  niche,
  accent,
}: {
  planKey: string;
  monthlyUsd: number;
  annualUsd: number;
  includes: string[];
  refCode: string;
  siteLabel: string;
  maskedEmail?: string;
  defaultBilling?: "annual" | "monthly";
  lang?: "en" | "fr";
  niche?: string;
  accent?: string;
}) {
  const [typedSite, setTypedSite] = useState("");
  const shown = siteLabel || typedSite.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  return (
    <div className="max-w-5xl mx-auto grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
      <div className="order-1">
        <AssistantDemo lang={lang} niche={niche} siteLabel={shown} accent={accent} />
      </div>
      <div className="order-2 w-full">
        <ProductCheckout
          planKey={planKey}
          monthlyUsd={monthlyUsd}
          annualUsd={annualUsd}
          includes={includes}
          refCode={refCode}
          siteLabel={siteLabel}
          maskedEmail={maskedEmail}
          defaultBilling={defaultBilling}
          lang={lang}
          onSiteChange={setTypedSite}
        />
      </div>
    </div>
  );
}
