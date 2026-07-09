import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

// Monthly Care Plan amounts in cents (EUR) — recurring
const CARE_PLANS: Record<string, { name: string; amount: number }> = {
  care:        { name: "Care",   amount: 6900  }, // €69/mo
  care_growth: { name: "Growth", amount: 14900 }, // €149/mo
  care_scale:  { name: "Scale",  amount: 29900 }, // €299/mo
};

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY to Vercel env vars" }, { status: 503 });
  }
  const stripe = new Stripe(key);

  try {
    const { plan, email } = await req.json() as { plan: string; email?: string };
    const p = CARE_PLANS[plan];

    if (!p) {
      return NextResponse.json({ error: "Unknown care plan" }, { status: 400 });
    }

    const origin = req.headers.get("origin") ?? "https://servolia.com";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Servolia ${p.name} Plan — Monthly`,
              description: "Hosting, maintenance, and monthly optimization. Cancel anytime with 30 days notice.",
            },
            unit_amount: p.amount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/billing?subscribed=1&plan=${plan}`,
      cancel_url: `${origin}/pricing`,
      metadata: { plan, kind: "care_plan", source: "servolia-website" },
      custom_text: {
        submit: { message: "Billed monthly · Cancel anytime with 30 days notice" },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Subscription checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
