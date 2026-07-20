import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { CARE_PLANS, careAmountCents } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY to Vercel env vars" }, { status: 503 });
  }
  const stripe = new Stripe(key);

  try {
    const { plan, email, billing } = await req.json() as {
      plan: string; email?: string; billing?: "monthly" | "annual";
    };
    const p = CARE_PLANS[plan];
    if (!p) {
      return NextResponse.json({ error: "Unknown care plan" }, { status: 400 });
    }

    const interval: "month" | "year" = billing === "annual" ? "year" : "month";
    const amount = careAmountCents(p, interval === "year" ? "annual" : "monthly");
    const origin = req.headers.get("origin") ?? "https://servolia.com";

    const productName = interval === "year"
      ? `Servolia ${p.name} Plan — Annual (1 month free)`
      : `Servolia ${p.name} Plan — Monthly`;
    const submitMsg = interval === "year"
      ? "Billed yearly · one month free · renews annually"
      : "Billed monthly · Cancel anytime with 30 days notice";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: productName,
              description: "All-in: domain, hosting, professional email, your AI receptionist, and monthly reports.",
            },
            unit_amount: amount,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/billing?subscribed=1&plan=${plan}&billing=${interval === "year" ? "annual" : "monthly"}`,
      cancel_url: `${origin}/pricing`,
      metadata: { plan, kind: "care_plan", billing: interval === "year" ? "annual" : "monthly", source: "servolia-website" },
      custom_text: {
        submit: { message: submitMsg },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Subscription checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
