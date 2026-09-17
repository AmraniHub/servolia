import Link from "next/link";
import type { ClientProduct } from "@/lib/hosting";
import { productCopy } from "@/lib/hosting";
import ProductCheckout from "./ProductCheckout";
import AssistantOffer from "./AssistantOffer";

/**
 * The payment page shell shared by every client-services product.
 *
 * One layout, so hosting and the AI assistant cannot drift apart visually --
 * a client who is sent two links from the same company should recognise both.
 *
 * The language comes from the client record, not from the visitor's browser:
 * these pages are always about one specific business, and that business has one
 * language. See langFor() in src/lib/clientRefs.ts.
 *
 * THE ASSISTANT GETS A FILM. Hosting is a thing that either works or does
 * not; a price card describes it fully. An assistant is a thing a buyer has
 * to picture — answering at 2am, in Arabic, catching a lead — and a bullet
 * list cannot make anyone picture that. So its page is wider, and beside the
 * price it replays a conversation (AssistantDemo). Everything else on the
 * page is unchanged, which is why this is a branch and not a second shell.
 */
export default function ClientProductPage({
  product,
  refCode,
  siteLabel,
  maskedEmail = "",
  defaultBilling,
  lang = "en",
  niche,
  languages,
  accent,
}: {
  product: ClientProduct;
  refCode: string;
  siteLabel: string;
  maskedEmail?: string;
  defaultBilling?: "annual" | "monthly";
  lang?: "en" | "fr";
  /** The client's line of business, which picks the demo's script. */
  niche?: string;
  /** The languages this client's assistant speaks — the demo's tabs. */
  languages?: ("ar" | "fr" | "en")[];
  /** The client's brand colour, so the demo looks like THEIR widget. */
  accent?: string;
}) {
  const copy = productCopy(product, lang);
  const fr = lang === "fr";
  const withDemo = product.key === "chatbot";
  const width = withDemo ? "max-w-5xl" : "max-w-md";

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      {/* Brand. The buyer needs to see who is being paid before entering a
          card -- the same wordmark as the rest of the site, not a variant. */}
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className={`${width} mx-auto`}>
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className={`${withDemo ? "max-w-2xl" : "max-w-md"} mx-auto text-center mb-9 lg:mb-12`}>
          <h1 className="text-3xl sm:text-[34px] font-black text-[#18181B] tracking-tight mb-3">
            {copy.heading}
          </h1>
          <p className="text-[#52525B] leading-relaxed">{copy.blurb}</p>
        </div>

        {withDemo ? (
          <AssistantOffer
            planKey={product.key}
            monthlyUsd={product.monthlyUsd}
            annualUsd={product.annualUsd}
            includes={copy.includes}
            refCode={refCode}
            siteLabel={siteLabel}
            maskedEmail={maskedEmail}
            defaultBilling={defaultBilling}
            lang={lang}
            niche={niche}
            languages={languages}
            accent={accent}
          />
        ) : (
          <ProductCheckout
            planKey={product.key}
            monthlyUsd={product.monthlyUsd}
            annualUsd={product.annualUsd}
            setupUsd={product.setupUsd}
            includes={copy.includes}
            refCode={refCode}
            siteLabel={siteLabel}
            maskedEmail={maskedEmail}
            defaultBilling={defaultBilling}
            lang={lang}
          />
        )}
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className={`${width} mx-auto text-center`}>
          <p className="text-xs text-[#8A8A80] mb-2">
            {fr ? "Facturé par " : "Billed by "}
            <span className="font-bold text-[#52525B]">Servolia</span>
            {fr ? " · Paiement traité par Stripe" : " · Payments processed by Stripe"}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-[#A8A8A0]">
            {/* /legal is not a page — only its children are. A 404 behind
                "Terms" sits on the one screen where a buyer is deciding
                whether this company is real. */}
            <Link href="/legal/terms" className="hover:text-[#52525B]">
              {fr ? "Conditions" : "Terms"}
            </Link>
            <Link href="/contact" className="hover:text-[#52525B]">
              {fr ? "Contact" : "Contact"}
            </Link>
            <a href="https://servolia.com" className="hover:text-[#52525B]">servolia.com</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
