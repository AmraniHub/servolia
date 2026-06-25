import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

// 50% deposit amounts in cents (EUR)
const PLANS: Record<string, { name: string; deposit: number; balance: number }> = {
  starter:  { name: "Website System",  deposit: 39500,  balance: 39500  }, // €790 total
  growth:   { name: "Booking System",  deposit: 74500,  balance: 74500  }, // €1,490 total
  pro:      { name: "Client System",   deposit: 145000, balance: 145000 }, // €2,900 total
  mobile:   { name: "Mobile App",      deposit: 49500,  balance: 49500  }, // €990 total
  webapp:   { name: "Web App / SaaS",  deposit: 39500,  balance: 39500  }, // €790 total
};

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY to Vercel env vars" }, { status: 503 });
  }
  const stripe = new Stripe(key);

  try {
    const { plan } = await req.json() as { plan: string };
    const p = PLANS[plan];

    if (!p) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    const origin = req.headers.get("origin") ?? "https://servolia.com";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${p.name} — 50% Deposit`,
              description: `Balance of €${(p.balance / 100).toLocaleString()} due on delivery. Fixed price, fixed deadline.`,
              images: ["https://servolia.com/og-image.png"],
            },
            unit_amount: p.deposit,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/contact?payment=success&plan=${plan}`,
      cancel_url: `${origin}/pricing`,
      metadata: { plan, source: "servolia-website" },
      custom_text: {
        submit: { message: "50% now · Balance on delivery · Fixed deadline in writing" },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
