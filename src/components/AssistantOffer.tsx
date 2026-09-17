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
  tryUrl,
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
  /**
   * The showroom: a known client whose assistant Servolia has ALREADY built.
   * The film below stays an honest example; this card is the door to the
   * real one, live, in their name — the strongest demo there is, and the
   * one the film exists to stand in for when there is no brief yet.
   */
  tryUrl?: string;
}) {
  const fr = lang === "fr";
  return (
    <div className="max-w-5xl mx-auto grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
      <div className="order-1">
        {tryUrl ? (
          <a
            href={tryUrl}
            data-testid="already-built"
            className="mb-6 block rounded-2xl border border-[#CBE3BC] bg-[#F7FBF4] px-5 py-4 hover:bg-[#F3F9EE] transition"
          >
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#36671E] mb-1">
              {fr ? "Déjà construit pour vous" : "Already built for you"}
            </span>
            <span className="block text-[15px] font-bold text-[#18181B]">
              {fr
                ? `Servolia a construit l'assistant de ${siteLabel} à partir de votre site — essayez le vrai avant de décider →`
                : `Servolia built ${siteLabel}'s assistant from your website — try the real one before you decide →`}
            </span>
            <span className="block text-[13px] text-[#71717A] mt-1">
              {fr
                ? "À votre nom, à vos couleurs, formé sur vos pages. Aucune carte, rien n'est enregistré."
                : "In your name, your colours, trained on your pages. No card, nothing is saved."}
            </span>
          </a>
        ) : null}
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
