import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { isAdminAuthed } from "@/lib/auth";
import {
  resolveHostingPlan,
  hostingAmountCents,
  isAddOn,
  HOSTING_METADATA_KIND,
  HOSTING_TIERS,
} from "@/lib/hosting";
import { parseOwnedDomainLink, verifyOwnedDomain, applyOwnedDomainLink } from "@/lib/ownedDomain";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeDomain } from "@/lib/domainSales";
import { rowsForEmail, knownStripeCustomer, buyerFields, businessTaxFields, withStaleCustomerRetry, LIVE_ROW_STATUSES } from "@/lib/stripeCustomer";

/**
 * Create a hosting checkout link for one client.
 *
 * Admin-only, and deliberately separate from /api/checkout-subscription: that
 * route is the live purchase path Servolia's own customers use, and hosting is
 * operator-sold — no visitor will ever hit this.
 *
 * Runs server-side so STRIPE_SECRET_KEY never has to exist on a laptop. The
 * client row is written by the Stripe webhook when payment succeeds, not here,
 * so an abandoned checkout leaves nothing behind to clean up.
 *
 * ALWAYS LIVE, deliberately ignoring founder test mode (src/lib/testMode.ts):
 * a link made here is sent to a real client, and a test-mode link would be
 * one they could never pay.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    business,
    email,
    contactName = "",
    siteUrl = "",
    repo = "",
    branch = "main",
    siteRoot = "",
    vercelProject = "",
    period = "monthly",
    plan = "hosting",
  } = body as Record<string, string>;

  if (!business || !email) {
    return NextResponse.json({ error: "business and email are required" }, { status: 400 });
  }

  const hostingPlan = resolveHostingPlan(plan);
  if (!hostingPlan) {
    return NextResponse.json({ error: `Unknown hosting plan: ${plan}` }, { status: 400 });
  }
  /* Hosting tiers only. Everything below this line is hosting-shaped: the line
     item is named "Website hosting", the metadata carries HOSTING_METADATA_KIND
     so the webhook writes a hosting client row, and the mode is a subscription.
     Push an add-on through it and the client is charged a recurring fee for a
     one-time service, on a statement line naming a product they did not buy —
     `seo_multilingual` at $145 once would bill $145 every month. The admin form
     only ever sends `hosting`, so this guards the route, not the UI. */
  if (isAddOn(plan)) {
    return NextResponse.json(
      { error: `${plan} is an add-on, not a hosting tier. Sell it from the client's own panel.` },
      { status: 400 },
    );
  }

  /* Optional: free days first, and a domain we ALREADY own billed for its
     first year today (src/lib/ownedDomain.ts). Checked before Stripe is
     touched, so a refused link leaves nothing behind. */
  const extra = parseOwnedDomainLink(body as Record<string, unknown>);
  if (!extra.ok) return NextResponse.json({ error: extra.error }, { status: 400 });
  if (extra.value.owned) {
    const check = await verifyOwnedDomain(extra.value.owned.domain, vercelProject.trim());
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const billing: "monthly" | "annual" = period === "annual" ? "annual" : "monthly";
  const origin = req.nextUrl.origin;

  /* ONE LIVE SUBSCRIPTION PER SITE (P3, 2026-10-02). A second link for a
     site that already has a live hosting subscription under this address
     would bill the client twice. A DIFFERENT site for the same owner is fine
     (an agency; Solyra beside Ithar), so the comparison is per site: the
     repository, else the domain of the site address. Live rows only. */
  const db = supabaseAdmin();
  const mySites = new Set([repo.trim().toLowerCase(), normalizeDomain(siteUrl) ?? "", extra.value.owned?.domain ?? ""].filter(Boolean));
  if (db && mySites.size) {
    const clash = (await rowsForEmail<{ id: string; plan: string | null; status: string | null; subscription_id: string | null; repo: string | null; site_url: string | null }>(
      db, "hosting_clients", "id, plan, status, subscription_id, repo, site_url, created_at", email, { test: false, statuses: LIVE_ROW_STATUSES },
    )).find((r) => r.subscription_id && HOSTING_TIERS.includes(String(r.plan ?? ""))
      && [String(r.repo ?? "").trim().toLowerCase(), normalizeDomain(r.site_url) ?? ""].some((k) => k && mySites.has(k)));
    if (clash) {
      return NextResponse.json({
        error: `${email} already has a live hosting subscription for this site (${clash.subscription_id}, row ${clash.id}, ${clash.status}). A second link would bill them twice. Change the plan on the existing subscription, or cancel it first.`,
      }, { status: 409 });
    }
  }
  // The client's existing live Stripe customer (src/lib/stripeCustomer.ts).
  const customerId = await knownStripeCustomer(db, "hosting_clients", email, false);

  /* The same metadata on the SUBSCRIPTION, not only on the session (P9):
     Stripe copies neither way, and everything after the payment — the
     upgrade to yearly, the failed-payment notice's language and site name
     (src/lib/upgrade.ts subscriptionContext) — starts from the
     subscription. Same rule as /api/hosting-checkout. */
  const metadata: Record<string, string> = {
    kind: HOSTING_METADATA_KIND,
    plan: hostingPlan.key,
    period: billing,
    business,
    contact_name: contactName,
    site_url: siteUrl,
    repo,
    branch,
    site_root: siteRoot,
    vercel_project: vercelProject,
  };

  try {
    const stripe = withStaleCustomerRetry(new Stripe(key), email);
    const session = await stripe.checkout.sessions.create(applyOwnedDomainLink({
      mode: "subscription",
      /* Card only, like every other checkout here: a delayed method (SEPA,
         bank transfer) completes the session unpaid, and the webhook only
         fulfils a PAID session — the later async_payment_succeeded event is
         not handled, so that buyer would pay and receive nothing. */
      payment_method_types: ["card"],
      ...buyerFields(customerId, email),
      // B2B: VAT number (reverse charge) + billing address; no VAT charged.
      ...businessTaxFields("subscription", Boolean(customerId)),
      subscription_data: { metadata: { ...metadata } },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Website hosting — ${business}`,
              description: hostingPlan.description,
            },
            unit_amount: hostingAmountCents(hostingPlan, billing),
            recurring: { interval: billing === "annual" ? "year" : "month" },
          },
          quantity: 1,
        },
      ],
      // The webhook routes on kind. Without it this payment lands in `clients`
      // and USD hosting money shows up inside Servolia's EUR MRR.
      metadata,
      success_url: `${origin}/portal?hosting=active`,
      cancel_url: `${origin}/`,
    }, extra.value));

    return NextResponse.json({
      url: session.url,
      // Surfaced so the operator can see at a glance whether they are about to
      // send a client a test-mode link that will never actually charge.
      mode: key.startsWith("sk_live") ? "live" : "test",
      // Read back from the same call that set unit_amount, so the figure the
      // operator sees before sending a link cannot disagree with what Stripe
      // will actually charge.
      amountUsd: hostingAmountCents(hostingPlan, billing) / 100,
      period: billing,
      plan: hostingPlan.tier,
      trialDays: extra.value.trialDays,
      domain: extra.value.owned?.domain ?? null,
      // What the client pays at checkout: the domain's year, or nothing.
      todayUsd: (extra.value.owned?.usd ?? 0) + (extra.value.trialDays > 0 ? 0 : hostingAmountCents(hostingPlan, billing) / 100),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[hosting/checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
