import type { Metadata } from "next";
import HostingPlans from "./HostingPlans";

export const metadata: Metadata = {
  title: "Website hosting — Servolia",
  description: "Hosting, SSL, domain and DNS managed, with your site's forms and tracking kept working.",
  // Operator-sold, sent by link. Keeping it out of the index stops it
  // competing with Servolia's own pricing page in search.
  robots: { index: false, follow: false },
};

export default async function HostingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // Next 16: searchParams is a promise and must be awaited.
  const { ref = "" } = await searchParams;

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-5 py-16 sm:py-24">
      <div className="max-w-lg mx-auto text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">Website hosting</h1>
        <p className="text-[#52525B] leading-relaxed">
          Your site stays online, fast and secure — and the forms that bring you
          enquiries keep working. Pick how you would like to pay.
        </p>
      </div>
      <HostingPlans refCode={ref} />
    </main>
  );
}
