import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { SELLABLE_BUILD_PLANS } from "@/lib/pricing";

// One-time amounts in cents (EUR) — prices come from src/lib/pricing.ts.
// Charged IN FULL: under the current model the installation is the only
// one-time payment and nothing is owed on delivery. Retired plans are
// deliberately absent, so a stale link to one can't be paid for.
const PLANS: Record<string, { name: string; nameFr: string; delivery: string; amount: number }> =
  Object.fromEntries(
    SELLABLE_BUILD_PLANS.map((p) => [
      p.key,
      { name: p.name, nameFr: p.nameFr, delivery: p.delivery, amount: p.totalEur * 100 },
    ])
  );

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY to Vercel env vars" }, { status: 503 });
  }
  const stripe = new Stripe(key);

  try {
    const { plan, leadId, lang } = await req.json() as { plan: string; leadId?: string; lang?: "en" | "fr" };
    const fr = lang === "fr";
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
              name: fr ? p.nameFr : p.name,
              description: fr
                ? `Paiement unique. Rien n'est dû à la livraison — votre abonnement mensuel démarre une fois le site en ligne. Délai : ${p.delivery}.`
                : `One-time payment. Nothing is due on delivery — your monthly plan starts once the site is live. Delivery: ${p.delivery}.`,
              images: ["https://servolia.com/og-image.png"],
            },
            unit_amount: p.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      locale: fr ? "fr" : "en",
      // French buyers land on the French intake — the language they answer in is
      // the language their generated site comes out in.
      success_url: `${origin}${fr ? "/fr/demarrage" : "/onboarding"}?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${fr ? "/fr/tarifs" : "/pricing"}`,
      metadata: { plan, source: "servolia-website", lead_id: leadId ?? "", lang: fr ? "fr" : "en" },
      custom_text: {
        submit: {
          message: fr
            ? "Paiement unique · Rien à la livraison · Délai fixé par écrit"
            : "One-time payment · Nothing on delivery · Fixed deadline in writing",
        },
      },
    });

    // NOTHING is written to the CRM here, on purpose.
    //
    // This route runs when someone CLICKS the pay button — not when they pay.
    // It used to create a "qualified" lead and an in-delivery build at that
    // moment, which meant every abandoned checkout and every test click left a
    // phantom qualified lead at full first-year value and a phantom build
    // sitting in delivery. The dashboard counted work that did not exist.
    //
    // The CRM row is now written by the Stripe webhook on
    // checkout.session.completed — i.e. when money actually moved. The leadId
    // travels in metadata so a lead that already exists still gets linked.

    // Meta Conversions API — checkout started (fire and forget)
    sendMetaCapiEvent({
      eventName: "InitiateCheckout",
      value: p.amount / 100,
      currency: "EUR",
      eventSourceUrl: "https://servolia.com/pricing",
      req,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
