import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { clientRefFor } from "@/lib/clientRefs";
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
  const { plan = "hosting", billing = "annual", email = "", business = "", ref = "", mode = "" } =
    body as Record<string, string>;

  const hostingPlan = resolveHostingPlan(plan);
  if (!hostingPlan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const period: "monthly" | "annual" = billing === "monthly" ? "monthly" : "annual";
  const origin = req.nextUrl.origin;

  /* ARREARS
   * Settled as a SEPARATE one-time payment, not folded into the subscription.
   * Stripe refuses a one-time price beside a recurring one in subscription
   * mode, and the supported alternative (add_invoice_items) needs a real
   * Product id rather than inline product data -- more moving parts, and a
   * failure that would only show up when a client with a balance tried to pay.
   * Two clear payments are also easier for the client to read on a statement
   * than one combined figure they have to decompose.
   *
   * The amount is read from the server-side client map, never the request: an
   * amount posted from a browser is an amount the payer can edit.
   */
  const client = clientRefFor(ref);
  if (mode === "arrears") {
    const owed = client?.arrearsUsd ?? 0;
    if (owed <= 0) {
      return NextResponse.json({ error: "Nothing outstanding" }, { status: 400 });
    }
    const stripeOnce = new Stripe(key);
    const once = await stripeOnce.checkout.sessions.create({
      mode: "payment",
      ...(email ? { customer_email: email } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: client?.arrearsLabel || "Outstanding balance",
              description: "Unpaid amount from previous months. Charged once.",
            },
            unit_amount: Math.round(owed * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { kind: HOSTING_METADATA_KIND, plan: "arrears", ref },
      success_url: `${origin}/hosting/thanks`,
      cancel_url: `${origin}/hosting`,
    });
    return NextResponse.json({ url: once.url });
  }

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
