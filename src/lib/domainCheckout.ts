import { inEitherMode } from "@/lib/stripeMode";

/**
 * PAYING FOR AN EXTRA DOMAIN, FROM INSIDE THE PANEL.
 *
 * A one-off charge for the first year, on the card the client already has with
 * us, and the renewal goes on their invoice a year later. Not a second
 * subscription: a client does not want two Stripe relationships with one
 * supplier, and an add-on that arrives as its own recurring charge is the kind
 * of surprise that produces a chargeback rather than a question.
 *
 * WHY THE CHARGE HAPPENS BEFORE THE DOMAIN IS BOUGHT. A registrar takes the
 * name the moment it is ordered and will not take it back, so ordering first
 * and collecting afterwards means eating the cost of every abandoned checkout.
 * Stripe confirms the payment, the webhook registers the name. If the registrar
 * then refuses — it was taken in those few seconds — the client is refunded,
 * which is a conversation, and the alternative is a name we paid for that
 * nobody wants.
 *
 * The price never comes from the browser. It is quoted against the registrar
 * on the server, put into the session by the server, and written into metadata
 * so the webhook charges and registers the same figure the client agreed to.
 */

export async function domainCheckoutUrl({
  subscriptionId,
  domain,
  retailUsd,
  ref,
  email,
  origin,
}: {
  subscriptionId: string;
  domain: string;
  retailUsd: number;
  ref: string;
  email: string | null;
  origin: string;
}): Promise<string | null> {
  try {
    /* Billed to the customer already on the subscription, so it lands on the
       card they expect and appears in the same billing history as everything
       else. A new customer for an add-on is how one client becomes two rows
       that never reconcile. */
    /* FOUNDER TEST MODE follows the SUBSCRIPTION, not a cookie: a test
       subscription (bought in test mode) exists only under the test key,
       and the extra domain is charged on that same test customer, tagged
       `test`. A live subscription is found under the live key first, exactly
       as before (src/lib/stripeMode.ts inEitherMode). */
    const found = await inEitherMode((s) => s.subscriptions.retrieve(subscriptionId));
    if (!found) return null;
    const { stripe, value: sub, livemode } = found;
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!customer) return null;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(retailUsd * 100),
            product_data: {
              name: `${domain} — 12 months`,
              description: "Domain registration, renewed yearly on your invoice unless you tell us to stop.",
            },
          },
        },
      ],
      metadata: {
        kind: "domain_addon",
        domain,
        domain_retail_usd: String(retailUsd),
        ref,
        subscription_id: subscriptionId,
        ...(livemode ? {} : { test: "1" }),
      },
      ...(email ? { customer_update: { address: "auto" as const } } : {}),
      success_url: `${origin}/hosting/account?page=domains&bought=${encodeURIComponent(domain)}`,
      cancel_url: `${origin}/hosting/account?page=domains`,
    });
    return session.url ?? null;
  } catch (err) {
    console.error("[domain-checkout] could not create a session:", err instanceof Error ? err.message : err);
    return null;
  }
}
