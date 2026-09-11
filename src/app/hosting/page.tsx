import type { Metadata } from "next";
import Link from "next/link";
import ClientProductPage from "@/components/ClientProductPage";
import PlanChooser, { type Tier, type Feature } from "@/components/PlanChooser";
import { CLIENT_PRODUCTS, productCopy, resolveHostingPlan } from "@/lib/hosting";
import { siteLabelFor, langFor, clientRefFor, maskEmail } from "@/lib/clientRefs";
import { isDomainSalesConfigured } from "@/lib/domainSales";

/**
 * ONE URL, TWO SITUATIONS.
 *
 * /hosting                → the visitor has not chosen: show all plans, let
 *                           them compare, choose, identify themselves, pay.
 * /hosting?ref=goodscochina → a client we already quoted: show THAT plan and
 *                           nothing else. Someone who agreed $88 should not
 *                           meet a $66 option on the page they came to pay on.
 *
 * This used to be two pages with different logic -- /hosting showed a single
 * plan with an identify-yourself form to everyone, while /hosting/plans showed
 * three -- so a stranger landing on /hosting never learned there were cheaper
 * options, and the two URLs disagreed about what hosting cost. Only the server
 * knows whether a ref names a real client, so it decides which of the two to
 * render, and /hosting/plans now just redirects here.
 *
 * `?plan=hosting_lite` pre-selects a tier on the chooser, for the case where
 * a plan has been discussed but the client is not yet in CLIENT_REFS.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; lang?: string }>;
}): Promise<Metadata> {
  const { ref = "", lang = "" } = await searchParams;
  const l = langFor(ref, lang);
  const known = Boolean(clientRefFor(ref));
  const copy = productCopy(CLIENT_PRODUCTS.hosting, l);
  return {
    title: known
      ? copy.heading
      : l === "fr"
        ? "Hébergement de site web — à partir de 6 $/mois | Servolia"
        : "Website hosting — from $6/month | Servolia",
    description: known
      ? copy.description
      : l === "fr"
        ? "Hébergement, SSL, surveillance et formulaires maintenus pour un site que vous avez déjà. Trois formules, de 6 à 11 $ par mois. Résiliable à tout moment."
        : "Hosting, SSL, monitoring and forms kept working for a website you already have. Three plans from $6 to $11 a month. Cancel anytime.",
    // The plan chooser is a public product, linked from the menu, so it is
    // indexed. A client's own page (?ref=) is about one business and is not.
    robots: known ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function HostingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; billing?: string; lang?: string; plan?: string }>;
}) {
  // Next 16: searchParams is a promise and must be awaited.
  const { ref = "", billing = "", lang = "", plan = "" } = await searchParams;
  const l = langFor(ref, lang);
  const client = clientRefFor(ref);

  /* ── A quoted client: their plan, and only their plan ────────────────── */
  if (client) {
    const agreed = resolveHostingPlan(plan) ?? CLIENT_PRODUCTS.hosting;
    return (
      <ClientProductPage
        product={agreed}
        refCode={ref}
        siteLabel={siteLabelFor(ref)}
        maskedEmail={maskEmail(client.email)}
        defaultBilling={billing === "monthly" ? "monthly" : "annual"}
        lang={l}
      />
    );
  }

  /* ── Everyone else: compare, choose, identify, pay ───────────────────── */
  const fr = l === "fr";
  const products = [
    CLIENT_PRODUCTS.hosting_lite,
    CLIENT_PRODUCTS.hosting,
    CLIENT_PRODUCTS.hosting_business,
  ];
  const copies = products.map((p) => productCopy(p, l));

  // Derived, never typed twice: labels in the order they first appear going
  // up the ladder, then a tick per tier that lists that exact line.
  const labels: string[] = [];
  for (const c of copies) for (const label of c.includes) if (!labels.includes(label)) labels.push(label);
  const features: Feature[] = labels.map((label) => ({
    label,
    // The same line means the same thing on every tier, so the first
    // explanation found is the explanation.
    hint: copies.map((c) => c.explain?.[label]).find(Boolean),
    on: copies.map((c) => c.includes.includes(label)),
  }));

  const tiers: Tier[] = products.map((p, i) => ({
    planKey: p.key,
    tier: copies[i].tier ?? p.name,
    blurb: copies[i].blurb,
    bestFor: copies[i].bestFor,
    includes: copies[i].includes,
    monthlyUsd: p.monthlyUsd,
    annualUsd: p.annualUsd,
    // The middle carries the badge: an unmarked three-column choice makes
    // people default to cheapest, and Complete is where most should be.
    featured: p.key === "hosting",
  }));

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-5xl mx-auto">
          <Link href={fr ? "/fr" : "/"} className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        {/* The heading is rendered by the chooser: it changes with the step. */}
        <PlanChooser
          tiers={tiers}
          features={features}
          refCode=""
          siteLabel=""
          lang={l}
          initialPlan={resolveHostingPlan(plan)?.key ?? null}
          domainsOffered={isDomainSalesConfigured()}
        />

        <p className="mt-10 text-center text-[13px] text-[#8A8A80]">
          <Link href="/hosting/terms" className="text-[#36671E] hover:underline">
            {fr ? "Le détail de la prestation" : "What you get, in full"}
          </Link>
        </p>

        {/* A visitor from the main menu needs to know which product this is:
            hosting for a site that exists, not the Servolia plans that build
            one. Without this line, an $8 figure sits one click from a €49
            plan with no explanation of why. */}
        <p className="mt-6 text-center text-[13px] text-[#8A8A80] max-w-xl mx-auto leading-relaxed">
          {fr
            ? "Ces formules hébergent et entretiennent un site que vous avez déjà. Il vous faut un site neuf, avec un réceptionniste IA ? "
            : "These plans host and look after a website you already have. Need a new site, with an AI receptionist? "}
          <Link href={fr ? "/fr/tarifs" : "/pricing"} className="text-[#36671E] hover:underline">
            {fr ? "Voir les offres Servolia" : "See Servolia plans"}
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
