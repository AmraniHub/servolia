import type { Metadata } from "next";
import ClientProductPage from "@/components/ClientProductPage";
import { CLIENT_PRODUCTS } from "@/lib/hosting";
import { siteLabelFor } from "@/lib/clientRefs";

export const metadata: Metadata = {
  title: "AI assistant",
  description: "An AI assistant on your site that answers customers around the clock and passes real enquiries to you.",
  robots: { index: false, follow: false },
};

export default async function ChatbotPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; billing?: string }>;
}) {
  const { ref = "", billing = "" } = await searchParams;
  return (
    <ClientProductPage
      product={CLIENT_PRODUCTS.chatbot}
      refCode={ref}
      siteLabel={siteLabelFor(ref)}
      defaultBilling={billing === "monthly" ? "monthly" : "annual"}
    />
  );
}
