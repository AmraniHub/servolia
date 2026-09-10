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

  /* Cheapest to dearest. Everything below is DERIVED from these three, so a
     price change or a new feature line lands on the page by itself. */
  const products = [
    CLIENT_PRODUCTS.hosting_lite,
    CLIENT_PRODUCTS.hosting,
    CLIENT_PRODUCTS.hosting_business,
  ];
  const copies = products.map((p) => productCopy(p, l));

  /* The matrix, built from the products rather than written out: labels in the
     order they first appear going up the ladder, then a tick per tier that
     lists that exact line. Written by hand it would drift the first time a
     feature was added to one plan and not to the table. */
  const labels: string[] = [];
  for (const c of copies) {
    for (const label of c.includes) if (!labels.includes(label)) labels.push(label);
  }
  const features: Feature[] = labels.map((label) => ({
    label,
    on: copies.map((c) => c.includes.includes(label)),
  }));

  const tiers: Tier[] = products.map((p, i) => ({
    planKey: p.key,
    tier: copies[i].tier ?? p.name,
    blurb: copies[i].blurb,
    monthlyUsd: p.monthlyUsd,
    annualUsd: p.annualUsd,
    // The middle one carries the badge: it is the plan most clients should be
    // on, and an unmarked three-column table makes people default to cheapest.
    featured: p.key === "hosting",
  }));

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
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
              ? "L'hébergement, le SSL et la surveillance sont identiques sur les trois. Ce qui change : si nous gérons votre domaine, et si vous avez une messagerie à votre nom."
              : "Hosting, SSL and monitoring are the same on all three. What changes is whether we handle your domain, and whether you get email on it."}
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
        <div className="max-w-5xl mx-auto text-center">
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
