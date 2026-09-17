import AssistantDemo from "./AssistantDemo";
import ProductCheckout from "./ProductCheckout";

/**
 * The AI-assistant pay page's body: the film on one side, the price on the
 * other.
 *
 * It used to share state — the website typed into the checkout appeared in
 * the demo's title bar, so the product "ran on their site" before they paid.
 * That was removed 2026-09-17: putting the buyer's real domain above an
 * invented lead with an invented phone number made the example read as their
 * own traffic, and a buyer who doubts one number doubts the product. The
 * demo now names an obviously-other business and says so on the frame. No
 * shared state, so this is a plain server component.
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
  languages,
  accent,
  business,
  initialSite,
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
  /** The languages this client's assistant speaks — the demo's tabs. */
  languages?: ("ar" | "fr" | "en")[];
  accent?: string;
  /** A probed prospect: the demo wears their name and domain. */
  business?: { name: string; domain: string };
  /** Pre-fills the checkout's site field for that same prospect. */
  initialSite?: string;
}) {
  return (
    <div className="max-w-5xl mx-auto grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
      <div className="order-1">
        <AssistantDemo lang={lang} niche={niche} languages={languages} accent={accent} business={business} />
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
          initialSite={initialSite}
        />
      </div>
    </div>
  );
}
