import Link from "next/link";
import type { ClientProduct } from "@/lib/hosting";
import ProductCheckout from "./ProductCheckout";

/**
 * The payment page shell shared by every client-services product.
 *
 * One layout, so hosting and the AI assistant cannot drift apart visually --
 * a client who is sent two links from the same company should recognise both.
 */
export default function ClientProductPage({
  product,
  refCode,
  siteLabel,
  defaultBilling,
}: {
  product: ClientProduct;
  refCode: string;
  siteLabel: string;
  defaultBilling?: "annual" | "monthly";
}) {
  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      {/* Brand. The buyer needs to see who is being paid before entering a
          card -- the same wordmark as the rest of the site, not a variant. */}
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
            {product.heading}
          </h1>
          <p className="text-[#52525B] leading-relaxed">{product.blurb}</p>
        </div>

        <ProductCheckout
          planKey={product.key}
          monthlyUsd={product.monthlyUsd}
          annualUsd={product.annualUsd}
          includes={product.includes}
          refCode={refCode}
          siteLabel={siteLabel}
          defaultBilling={defaultBilling}
        />
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
