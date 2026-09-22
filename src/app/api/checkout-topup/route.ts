import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { TOPUP_PACKS } from "@/lib/conversationCap";
import { getClientEmail } from "@/lib/clientAuth";

export const runtime = "nodejs";

/**
 * A one-off conversation top-up, bought from the portal.
 *
 * Same shape and the same rule as /api/checkout-addon: the buyer is the
 * logged-in client (never an email from the body), the amount comes from
 * TOPUP_PACKS (never from the request), and the webhook credits the pack to
 * the clients row that carries this email — idempotent on the session id.
 * Payment mode, not subscription: a pack is bought when needed, not monthly.
 */
export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Please log in first", login: true }, { status: 401 });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const stripe = new Stripe(key);

  try {
    const { pack, lang } = (await req.json().catch(() => ({}))) as { pack?: string; lang?: string };
    const p = pack ? TOPUP_PACKS[pack] : undefined;
    if (!p) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
    const fr = lang === "fr";
    const origin = req.headers.get("origin") ?? "https://servolia.com";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Servolia — ${fr ? p.nameFr : p.name}`,
            description: fr
              ? `${p.conversations} conversations IA en plus pour ce mois. Paiement unique.`
              : `${p.conversations} extra AI conversations for this month. One-off payment.`,
          },
          unit_amount: p.priceEur * 100,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/portal?topup=done`,
      cancel_url: `${origin}/portal`,
      metadata: { kind: "topup", pack: p.key, conversations: String(p.conversations), email, lang: fr ? "fr" : "en", source: "servolia-portal" },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Top-up checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
