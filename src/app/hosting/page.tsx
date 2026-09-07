import type { Metadata } from "next";
import ClientProductPage from "@/components/ClientProductPage";
import { CLIENT_PRODUCTS } from "@/lib/hosting";
import { siteLabelFor } from "@/lib/clientRefs";

export const metadata: Metadata = {
  // The root layout appends " | Servolia".
  title: "Website hosting",
  description: "Hosting, SSL, domain and DNS managed, with your site's forms and tracking kept working.",
  // Operator-sold, sent by link. Indexing it would put an $8 page in search
  // against Servolia's own pricing.
  robots: { index: false, follow: false },
};

export default async function HostingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; billing?: string }>;
}) {
  // Next 16: searchParams is a promise and must be awaited.
  const { ref = "", billing = "" } = await searchParams;
  return (
    <ClientProductPage
      product={CLIENT_PRODUCTS.hosting}
      refCode={ref}
      siteLabel={siteLabelFor(ref)}
      defaultBilling={billing === "monthly" ? "monthly" : "annual"}
    />
  );
}
