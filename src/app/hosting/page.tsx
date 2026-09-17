import type { Metadata } from "next";
import Link from "next/link";
import ClientProductPage from "@/components/ClientProductPage";
import PlanChooser, { type Tier, type Feature } from "@/components/PlanChooser";
import { CLIENT_PRODUCTS, productCopy, resolveHostingPlan, isAddOn } from "@/lib/hosting";
import { siteLabelFor, langFor, clientRefFor, maskEmail } from "@/lib/clientRefs";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { probeBrand } from "@/lib/brandProbe";
import { isDomainSalesConfigured } from "@/lib/domainSales";
import { supabaseAdmin } from "@/lib/supabase";
import { nextChargeDate } from "@/lib/hosting";
import AlreadyActive from "@/components/AlreadyActive";

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
 *
 * THIRD SITUATION, added 2026-09-16:
 * /hosting?plan=chatbot&ref=x → an ADD-ON. Sellable to anyone, including a
 *                           client who already pays for hosting, because an
 *                           add-on is bought on top rather than instead.
 *                           Checked before the client branch, since a paying
 *                           client is otherwise shown "your hosting is active"
 *                           and has no route to a pay page at all. That is why
 *                           the AI assistant sat in the price list for months
 *                           with nothing that could sell it.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; lang?: string; plan?: string }>;
}): Promise<Metadata> {
  const { ref = "", lang = "", plan = "" } = await searchParams;
  const l = langFor(ref, lang);
  const known = Boolean(clientRefFor(ref));
  /* An add-on page must title itself after the add-on. Reading only `ref` here
     titled the AI assistant page "Hebergement du site - Complet", so the tab,
     the bookmark and every link preview named the wrong product on the page a
     client is being asked to pay on. The body was right; only this was not. */
  const addOn = resolveHostingPlan(plan);
  const titled = addOn && isAddOn(addOn.key) ? addOn : CLIENT_PRODUCTS.hosting;
  const copy = productCopy(titled, l);
  const isAdd = Boolean(addOn && isAddOn(addOn.key));
  return {
    // An add-on titles itself whether or not the visitor is a known ref —
    // otherwise ?plan=seo_multilingual with no ref renders the search page
    // under a "Website hosting from $6" title.
    title: known || isAdd
      ? copy.heading
      : l === "fr"
        ? "Hébergement de site web — à partir de 6 $/mois | Servolia"
        : "Website hosting — from $6/month | Servolia",
    description: known || isAdd
      ? copy.description
      : l === "fr"
        ? "Hébergement, SSL, surveillance et formulaires maintenus pour un site que vous avez déjà. Trois formules, de 6 à 11 $ par mois. Résiliable à tout moment."
        : "Hosting, SSL, monitoring and forms kept working for a website you already have. Three plans from $6 to $11 a month. Cancel anytime.",
    // The plan chooser is a public product, linked from the menu, so it is
    // indexed. A client's own page (?ref=) is about one business and is not.
    // An add-on page is always about one client's purchase, so it is never
    // indexed even when the visitor is not a known ref.
    robots: known || isAdd
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default async function HostingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; billing?: string; lang?: string; plan?: string; site?: string }>;
}) {
  // Next 16: searchParams is a promise and must be awaited.
  const { ref = "", billing = "", lang = "", plan = "", site = "" } = await searchParams;
  const l = langFor(ref, lang);
  const client = clientRefFor(ref);

  /* ── AN ADD-ON: sellable to anyone, including a paying client ─────────
   *
   * Checked BEFORE the client branch on purpose. An existing client is shown
   * "your hosting is active" and has no route to a pay page — correct for a
   * hosting tier, since nobody should buy hosting twice, and wrong for an
   * add-on, which only an existing client would ever want. That ordering is
   * why the AI assistant lived in the price list for months with no page that
   * could sell it, and why the new multilingual search line would have had
   * the same fate.
   *
   * An add-on is by definition not a tier, so this cannot sell hosting twice. */
  const addOn = resolveHostingPlan(plan);
  if (addOn && isAddOn(addOn.key)) {
    /* The assistant's demo runs in the buyer's own colour and tells the
       buyer's own kind of story. For a known client both come from the
       brief kept in code. For anyone else, `?site=` — the link /assistant
       hands out — makes the SAME thing true without a brief: the brand
       probe reads their homepage for the name, the colour and the
       languages, so the product is Servolia's for every domain, not a
       favour hand-built for one. A stranger with neither gets the house
       green and the fictitious example. */
    const brief = client ? ASSISTANT_SITES[ref.toLowerCase()] : undefined;
    const probed = !client && addOn.key === "chatbot" && site ? await probeBrand(site) : null;
    return (
      <ClientProductPage
        product={addOn}
        refCode={ref}
        siteLabel={siteLabelFor(ref)}
        maskedEmail={client?.email ? maskEmail(client.email) : ""}
        defaultBilling={billing === "monthly" ? "monthly" : "annual"}
        lang={l}
        niche={client?.niche ?? probed?.niche ?? undefined}
        languages={brief?.languages ?? probed?.languages}
        accent={brief?.accent ?? probed?.accent}
        business={probed ? { name: probed.name, domain: probed.domain } : undefined}
        initialSite={probed?.domain}
      />
    );
  }

  /* ── A quoted client: their plan, and only their plan ────────────────── */
  if (client) {
    /* ALREADY PAYING? Then this is not a pay page any more.
     *
     * The link a client was sent lives on in their inbox, their bookmarks
     * and whatever they forwarded to a colleague. Rendering "Pay $88" to a
     * client who paid last month invites a second subscription -- and reads,
     * to them, as if we had no idea who they are. So the server checks for a
     * live subscription on the address we hold for this ref, and if there is
     * one the page says so and offers the one thing they are here for: their
     * service page. */
    const db = client.email ? supabaseAdmin() : null;
    const { data: live } = db
      ? await db
          .from("hosting_clients")
          .select("plan, billing_period, started_at, status")
          .eq("email", client.email!)
          .in("status", ["active", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (live) {
      const fr = l === "fr";
      const livePlan = resolveHostingPlan(live.plan) ?? CLIENT_PRODUCTS.hosting;
      const liveCopy = productCopy(livePlan, l);
      const period: "monthly" | "annual" = live.billing_period === "annual" ? "annual" : "monthly";
      const started = live.started_at ? new Date(live.started_at) : null;
      const fmt = (d: Date) => d.toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      const renews = started ? nextChargeDate(started, period) : null;
      return (
        <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
          <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
            <div className="max-w-md mx-auto">
              <Link href={fr ? "/fr" : "/"} className="inline-flex items-center">
                <span className="text-xl font-black tracking-tight text-[#18181B]">
                  Serv<span className="gradient-text">olia</span>
                </span>
              </Link>
            </div>
          </header>
          <div className="flex-1 px-5 py-16">
            <div className="max-w-md mx-auto">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3">
                {fr ? "Hébergement Servolia" : "Servolia hosting"}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-[#18181B] mb-3">
                {live.status === "past_due"
                  ? (fr ? "Un paiement est en attente" : "A payment is outstanding")
                  : (fr ? "Votre hébergement est actif" : "Your hosting is active")}
              </h1>
              <p className="text-[#52525B] leading-relaxed mb-8">
                {liveCopy.heading}
                {client.label ? ` · ${client.label}` : ""}
                {started ? (fr ? ` · depuis le ${fmt(started)}` : ` · since ${fmt(started)}`) : ""}
                {renews && live.status !== "past_due"
                  ? (fr ? `. Renouvellement le ${fmt(renews)}.` : `. Renews on ${fmt(renews)}.`)
                  : "."}
              </p>
              <div className="rounded-2xl border border-[#E8E6E0] bg-white p-6 shadow-[0_1px_3px_rgba(22,26,21,0.05)]">
                <p className="text-[15px] text-[#18181B] font-semibold mb-1">
                  {fr ? "Votre page de service" : "Your service page"}
                </p>
                <p className="text-[14px] text-[#5E6659] leading-relaxed mb-5">
                  {live.status === "past_due"
                    ? (fr
                        ? "Le lien de votre page de service permet de mettre à jour votre carte en une minute. Il est dans votre email — ou renvoyez-le-vous ici."
                        : "Your service page is where you update your card in a minute. The link is in your email — or send it to yourself again here.")
                    : (fr
                        ? "Ce que couvre votre formule, la date de renouvellement, vos factures, votre carte et la résiliation — sans mot de passe. Le lien est dans votre email de confirmation ; renvoyez-le-vous ici si besoin."
                        : "What your plan covers, when it renews, your invoices, your card and cancelling — no password. The link is in your confirmation email; send it to yourself again here if you need it.")}
                </p>
                <AlreadyActive refCode={ref} maskedEmail={maskEmail(client.email)} lang={l} />
              </div>
              <p className="mt-8 text-center text-[13px] text-[#8A8A80]">
                <Link href="/hosting/terms" className="text-[#36671E] hover:underline">
                  {fr ? "Le détail de la prestation" : "What you get, in full"}
                </Link>
                {" · "}
                {fr ? "Une question ? Répondez à n'importe lequel de nos emails." : "A question? Reply to any of our emails."}
              </p>
            </div>
          </div>
          <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
            <div className="max-w-md mx-auto text-center">
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
    setupUsd: p.setupUsd,
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

        {/* The assistant is the add-on every hosted site can carry, and
            /assistant is where any owner can see it wearing their own
            brand before paying a cent. */}
        <p className="mt-3 text-center text-[13px] text-[#8A8A80] max-w-xl mx-auto leading-relaxed">
          {fr ? "Ou voyez l'assistant IA sur votre propre site : " : "Or see the AI assistant on your own website: "}
          <Link href={fr ? "/assistant?lang=fr" : "/assistant"} className="text-[#36671E] hover:underline">
            {fr ? "essayer avec votre domaine" : "try it with your domain"}
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
