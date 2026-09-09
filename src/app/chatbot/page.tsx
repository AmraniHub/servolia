import type { Metadata } from "next";
import ClientProductPage from "@/components/ClientProductPage";
import { CLIENT_PRODUCTS, productCopy } from "@/lib/hosting";
import { siteLabelFor, langFor, clientRefFor, maskEmail } from "@/lib/clientRefs";

/* The tab title follows the client's language, like the page itself. Next
   refuses a static `metadata` export beside generateMetadata, so noindex is
   set inside it rather than alongside. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; lang?: string }>;
}): Promise<Metadata> {
  const { ref = "", lang = "" } = await searchParams;
  const copy = productCopy(CLIENT_PRODUCTS.chatbot, langFor(ref, lang));
  return {
    title: copy.heading,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export default async function ChatbotPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; billing?: string; lang?: string }>;
}) {
  const { ref = "", billing = "", lang = "" } = await searchParams;
  return (
    <ClientProductPage
      product={CLIENT_PRODUCTS.chatbot}
      refCode={ref}
      siteLabel={siteLabelFor(ref)}
      maskedEmail={maskEmail(clientRefFor(ref)?.email)}
      defaultBilling={billing === "monthly" ? "monthly" : "annual"}
      lang={langFor(ref, lang)}
    />
  );
}
