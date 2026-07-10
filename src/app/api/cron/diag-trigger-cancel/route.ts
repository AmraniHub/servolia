import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Diagnostic: creates a throwaway test customer + subscription, then
 * immediately cancels it. This fires a REAL, correctly-signed
 * `customer.subscription.deleted` event to the live webhook endpoint,
 * so we can verify the churn-handling logic end-to-end without needing
 * the Stripe CLI or a real client to cancel.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: "Stripe not configured" });
  if (!key.startsWith("sk_test_")) {
    return NextResponse.json({ ok: false, reason: "Refusing to run — this only runs in Stripe TEST mode" });
  }

  const stripe = new Stripe(key);

  try {
    const customer = await stripe.customers.create({ email: "webhook-diag@servolia.com", name: "Webhook Diagnostic" });
    const product = await stripe.products.create({ name: "Diagnostic Care Plan (throwaway)" });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price_data: {
          currency: "eur",
          product: product.id,
          unit_amount: 6900,
          recurring: { interval: "month" },
        },
      }],
      payment_behavior: "default_incomplete",
    });

    const cancelled = await stripe.subscriptions.cancel(subscription.id);

    // Clean up the throwaway customer + product so they don't clutter the Stripe dashboard.
    await stripe.customers.del(customer.id).catch(() => {});
    await stripe.products.update(product.id, { active: false }).catch(() => {});

    return NextResponse.json({
      ok: true,
      customerId: customer.id,
      subscriptionId: subscription.id,
      cancelledStatus: cancelled.status,
      note: "customer.subscription.deleted should now have fired to the live webhook — check clients table next.",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 });
  }
}
