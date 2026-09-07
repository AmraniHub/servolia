import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  resolveHostingPlan,
  hostingAmountCents,
  HOSTING_METADATA_KIND,
} from "@/lib/hosting";

/**
 * PUBLIC hosting checkout — the client picks a plan and pays, no admin step.
 *
 * Separate from /api/checkout-subscription, which sells the Servolia product
 * and carries an installation fee and a conversation quota. Hosting has
 * neither, and mixing them would mean editing the live purchase path
 * Servolia's own customers use.
 *
 * Accepts only a plan key and a billing period — never an amount. A price
 * posted from the browser is a price the buyer can edit, so the figure is
 * always read from src/lib/hosting.ts on the server.
 *
 * `ref` lets a link carry which site this is for (e.g. /hosting?ref=goodscochina)
 * so the operator can match the payment to a site. It is a label only and is
 * never trusted for anything.
 */
export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { plan = "hosting", billing = "annual", email = "", business = "", ref = "" } =
    body as Record<string, string>;

  const hostingPlan = resolveHostingPlan(plan);
  if (!hostingPlan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const period: "monthly" | "annual" = billing === "monthly" ? "monthly" : "annual";
  const origin = req.nextUrl.origin;

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Stripe collects the email on its own page when we do not have one, so
      // the page can ask for as little as possible.
      ...(email ? { customer_email: email } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Website hosting${business ? ` — ${business}` : ""}`,
              description: hostingPlan.description,
            },
            unit_amount: hostingAmountCents(hostingPlan, period),
            recurring: { interval: period === "annual" ? "year" : "month" },
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: HOSTING_METADATA_KIND,
        plan: hostingPlan.key,
        period,
        business: business || ref || "",
        // Site details are attached by the operator afterwards: the client
        // does not know their repo, and the gate that needs them is not
        // wired up to fire automatically anyway.
        ref,
      },
      allow_promotion_codes: true,
      success_url: `${origin}/hosting/thanks`,
      cancel_url: `${origin}/hosting`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[hosting-checkout]", message);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
