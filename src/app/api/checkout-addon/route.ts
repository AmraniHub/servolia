import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { ADDONS } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * Self-serve add-on subscription. The client clicks "Enable" in the portal →
 * a recurring Stripe subscription starts → the webhook provisions it. This is
 * what turns the manual add-ons into one-click recurring revenue.
 */
export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const stripe = new Stripe(key);

  try {
    const { addon, email, siteSlug } = await req.json() as {
      addon: string; email?: string; siteSlug?: string;
    };
    const a = ADDONS[addon];
    if (!a) return NextResponse.json({ error: "Unknown add-on" }, { status: 400 });

    const origin = req.headers.get("origin") ?? "https://servolia.com";
    const unitLabel = a.interval === "year" ? "/year" : a.per === "mailbox" ? "/mailbox/month" : "/month";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Servolia — ${a.name}`,
              description: `Managed add-on billed €${a.priceEur}${unitLabel}. Cancel anytime.`,
            },
            unit_amount: a.priceEur * 100,
            recurring: { interval: a.interval },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/portal?addon=${addon}&enabled=1`,
      cancel_url: `${origin}/portal`,
      metadata: { kind: "addon", addon, siteSlug: siteSlug ?? "", source: "servolia-portal" },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Add-on checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
