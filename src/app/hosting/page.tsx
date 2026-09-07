import type { Metadata } from "next";
import Link from "next/link";
import HostingPlans from "./HostingPlans";

export const metadata: Metadata = {
  // The root layout appends " | Servolia"; saying it here too would
  // render "Website hosting — Servolia | Servolia".
  title: "Website hosting",
  description:
    "Hosting, SSL, domain and DNS managed, with your site's forms and tracking kept working.",
  // Operator-sold, sent by link. Indexing it would put an $8 page in search
  // against Servolia's own pricing.
  robots: { index: false, follow: false },
};

/**
 * Known clients, so a link can say which site is being paid for.
 *
 * A payment page that names nothing looks like a phishing link — the buyer has
 * to take on faith that a generic form is really about their website. The ref
 * is a display label only and is never trusted for anything: an unknown ref
 * simply shows no site name rather than erroring, so a new client can be sent
 * a link before this map is updated.
 */
const SITES: Record<string, string> = {
  goodscochina: "goodscochina.com",
  excellenceagency: "excellenceagency.ma",
};

export default async function HostingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // Next 16: searchParams is a promise and must be awaited.
  const { ref = "" } = await searchParams;
  const siteLabel = SITES[ref.toLowerCase()] ?? "";

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      {/* Brand. The buyer needs to see who is being paid before they enter a
          card — the same wordmark as the rest of the site, not a variant. */}
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-md mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-md mx-auto text-center mb-9">
          <h1 className="text-3xl sm:text-[34px] font-black text-[#18181B] tracking-tight mb-3">
            Website hosting
          </h1>
          <p className="text-[#52525B] leading-relaxed">
            Your site stays online, fast and secure — and the forms that bring
            you enquiries keep working.
          </p>
        </div>

        <HostingPlans refCode={ref} siteLabel={siteLabel} />
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-md mx-auto text-center">
          <p className="text-xs text-[#8A8A80] mb-2">
            Billed by <span className="font-bold text-[#52525B]">Servolia</span> · Payments processed by Stripe
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-[#A8A8A0]">
            <Link href="/legal" className="hover:text-[#52525B]">Terms</Link>
            <Link href="/contact" className="hover:text-[#52525B]">Contact</Link>
            <a href="https://servolia.com" className="hover:text-[#52525B]">servolia.com</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
