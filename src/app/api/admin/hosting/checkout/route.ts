import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { checkoutStripe } from "@/lib/testMode";
import {
  resolveHostingPlan,
  hostingAmountCents,
  isAddOn,
  HOSTING_METADATA_KIND,
} from "@/lib/hosting";

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
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Founder test mode (src/lib/testMode.ts): the admin's own browser can
  // mint a TEST link to walk the hosting purchase; otherwise live as before.
  const co = checkoutStripe(req);
  if (co.refused) return co.refused;
  if (!co.stripe) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set" }, { status: 503 });
  }
  const key = co.test ? "sk_test_" : (process.env.STRIPE_SECRET_KEY ?? "");

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

  const billing: "monthly" | "annual" = period === "annual" ? "annual" : "monthly";
  const origin = req.nextUrl.origin;

  try {
    const stripe = co.stripe;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
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
      metadata: {
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
        ...co.tag,
      },
      success_url: `${origin}/portal?hosting=active`,
      cancel_url: `${origin}/`,
    });

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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[hosting/checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
