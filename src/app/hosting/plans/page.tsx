import type { Metadata } from "next";
import Link from "next/link";
import PlanChooser, { type Tier, type Feature } from "@/components/PlanChooser";
import { CLIENT_PRODUCTS, productCopy } from "@/lib/hosting";
import { siteLabelFor, langFor, clientRefFor, maskEmail } from "@/lib/clientRefs";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; lang?: string }>;
}): Promise<Metadata> {
  const { ref = "", lang = "" } = await searchParams;
  const fr = langFor(ref, lang) === "fr";
  return {
    title: fr ? "Hébergement — formules" : "Hosting plans",
    description: fr
      ? "Deux formules d'hébergement, la différence étant qui renouvelle votre domaine."
      : "Two hosting plans, differing in who renews your domain.",
    // Operator-sent, like every other client surface.
    robots: { index: false, follow: false },
  };
}

/**
 * THE PAGE TO SEND A CLIENT WHO HAS NOT PICKED A PLAN.
 *
 * /hosting sells one agreed plan to a named client. This sells the choice, and
 * the two are deliberately separate: a client who has already been quoted a
 * price should not be shown a cheaper option on the page where they came to
 * pay, and a client choosing cannot compare anything on a page that shows one
 * plan at a time.
 *
 * The tiers, prices and feature lists all come from lib/hosting.ts. Nothing on
 * this page is typed twice, so it cannot disagree with what Stripe charges.
 */
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; lang?: string }>;
}) {
  const { ref = "", lang = "" } = await searchParams;
  const l = langFor(ref, lang);
  const fr = l === "fr";

  const lite = CLIENT_PRODUCTS.hosting_lite;
  const full = CLIENT_PRODUCTS.hosting;
  const liteCopy = productCopy(lite, l);
  const fullCopy = productCopy(full, l);

  /* The feature matrix, BUILT from the two lists rather than written out.
     Shared lines first, in Essential's order, then what Complete adds — so a
     feature added to either product appears in the comparison automatically
     and cannot silently go missing from it. */
  const features: Feature[] = [
    ...liteCopy.includes.map((label) => ({
      label,
      essential: true,
      complete: fullCopy.includes.includes(label),
    })),
    ...fullCopy.includes
      .filter((label) => !liteCopy.includes.includes(label))
      .map((label) => ({ label, essential: false, complete: true })),
  ];

  const tiers: [Tier, Tier] = [
    {
      planKey: lite.key,
      tier: liteCopy.tier ?? "Essential",
      blurb: liteCopy.blurb,
      monthlyUsd: lite.monthlyUsd,
      annualUsd: lite.annualUsd,
    },
    {
      planKey: full.key,
      tier: fullCopy.tier ?? "Complete",
      blurb: fullCopy.blurb,
      monthlyUsd: full.monthlyUsd,
      annualUsd: full.annualUsd,
    },
  ];

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center mb-9">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3">
            {fr ? "Hébergement Servolia" : "Servolia hosting"}
          </p>
          <h1 className="text-3xl sm:text-[38px] font-black tracking-tight mb-3 text-[#18181B]">
            {fr ? "Choisissez votre " : "Choose your "}
            <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
              {fr ? "formule" : "plan"}
            </span>
          </h1>
          <p className="text-[#52525B] leading-relaxed max-w-xl mx-auto">
            {fr
              ? "La seule différence : qui renouvelle votre domaine et gère le DNS. L'hébergement, le SSL et la surveillance sont identiques."
              : "The only difference is who renews your domain and manages DNS. The hosting, SSL and monitoring are the same on both."}
          </p>
        </div>

        <PlanChooser
          tiers={tiers}
          features={features}
          refCode={ref}
          siteLabel={siteLabelFor(ref)}
          maskedEmail={maskEmail(clientRefFor(ref)?.email)}
          lang={l}
        />

        <p className="mt-10 text-center text-[13px] text-[#8A8A80]">
          <Link href="/hosting/terms" className="text-[#36671E] hover:underline">
            {fr ? "Le détail de la prestation" : "What you get, in full"}
          </Link>
        </p>
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">
            {fr ? "Facturé par " : "Billed by "}
            <span className="font-bold text-[#52525B]">Servolia</span>
            {fr ? " · Paiement traité par Stripe" : " · Payments processed by Stripe"}
          </p>
        </div>
      </footer>
    </main>
  );
}
