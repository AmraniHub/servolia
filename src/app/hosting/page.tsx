import type { Metadata } from "next";
import Link from "next/link";
import ClientProductPage from "@/components/ClientProductPage";
import PlanChooser, { type Tier, type Feature } from "@/components/PlanChooser";
import { CLIENT_PRODUCTS, productCopy, resolveHostingPlan } from "@/lib/hosting";
import { siteLabelFor, langFor, clientRefFor, maskEmail } from "@/lib/clientRefs";

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
    title: known ? copy.heading : l === "fr" ? "Hébergement — formules" : "Hosting plans",
    description: copy.description,
    // Operator-sold and sent by link. Indexing it would put an $8 page in
    // search against Servolia's own pricing.
    robots: { index: false, follow: false },
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
    on: copies.map((c) => c.includes.includes(label)),
  }));

  const tiers: Tier[] = products.map((p, i) => ({
    planKey: p.key,
    tier: copies[i].tier ?? p.name,
    blurb: copies[i].blurb,
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
          refCode=""
          siteLabel=""
          lang={l}
          initialPlan={resolveHostingPlan(plan)?.key ?? null}
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
