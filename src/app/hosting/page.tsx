import type { Metadata } from "next";
import ClientProductPage from "@/components/ClientProductPage";
import { CLIENT_PRODUCTS, productCopy } from "@/lib/hosting";
import { siteLabelFor, langFor, clientRefFor, maskEmail } from "@/lib/clientRefs";

/** The tab title follows the client's language, like the page itself. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; lang?: string }>;
}): Promise<Metadata> {
  const { ref = "", lang = "" } = await searchParams;
  const copy = productCopy(CLIENT_PRODUCTS.hosting, langFor(ref, lang));
  return {
    // The root layout appends " | Servolia".
    title: copy.heading,
    description: copy.description,
    // Operator-sold, sent by link. Indexing it would put an $8 page in search
    // against Servolia's own pricing.
    robots: { index: false, follow: false },
  };
}

export default async function HostingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; billing?: string; lang?: string }>;
}) {
  // Next 16: searchParams is a promise and must be awaited.
  const { ref = "", billing = "", lang = "" } = await searchParams;
  return (
    <ClientProductPage
      product={CLIENT_PRODUCTS.hosting}
      refCode={ref}
      siteLabel={siteLabelFor(ref)}
      maskedEmail={maskEmail(clientRefFor(ref)?.email)}
      defaultBilling={billing === "monthly" ? "monthly" : "annual"}
      lang={langFor(ref, lang)}
    />
  );
}
