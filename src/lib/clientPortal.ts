import { inEitherMode } from "@/lib/stripeMode";

/**
 * THE BILLING PORTAL IS STRIPE'S, NOT OURS.
 *
 * Everything a hosting client actually needs to do — replace an expired card,
 * download an invoice for their accountant, cancel — Stripe already hosts,
 * translated, and PCI-compliant. Building our own would mean building card
 * entry, and the reason the checkout is safe today is that card details never
 * touch this server. There is nothing to win and a lot to lose.
 *
 * "Renew" is deliberately absent: these are `charge_automatically`
 * subscriptions. Stripe charges the card on the renewal date and the client
 * does nothing. A portal offering a renew button would be a door onto an empty
 * room — and would teach clients to expect a manual step that does not exist.
 *
 * The portal is reached by a signed link in an email we send to the address on
 * the subscription, exactly like the upgrade page. No password, no reset flow,
 * no account to support.
 */

/** Stripe's portal locale codes overlap ours for these two. */
type PortalLocale = "en" | "fr";

/**
 * Stripe's no-code portal login page — the way back in when a signed link has
 * expired.
 *
 * The client types the address they pay with and Stripe emails them a way in.
 * Stripe answers identically whether or not the address is a customer, so it
 * reveals nothing, and it needs nothing from us at request time.
 *
 * The live value is the default rather than only an env var, so the button
 * works without anything being configured in Vercel first — an env var nobody
 * remembers to set is a button that silently never appears. Set
 * STRIPE_PORTAL_LOGIN_URL to override it without a deploy if the link is ever
 * regenerated in the Stripe dashboard.
 */
export const PORTAL_LOGIN_URL =
  process.env.STRIPE_PORTAL_LOGIN_URL?.trim() ||
  "https://billing.stripe.com/p/login/9B614macp4MGfcJcDTabK00";

/**
 * A one-time URL into this client's billing portal.
 *
 * Returns null rather than throwing so a caller composing an email can drop
 * the button and still send the message. A payment-failure notice that never
 * arrives because the portal call failed is far worse than one whose link is
 * missing — the client at least learns their card was declined.
 */
export async function billingPortalUrl(
  subscriptionId: string,
  opts: { returnUrl?: string; locale?: PortalLocale; livemode?: boolean } = {},
): Promise<string | null> {
  try {
    /* The subscription's own mode: `livemode` from the webhook's event, or —
       from a link — live first, then a founder test subscription
       (src/lib/stripeMode.ts inEitherMode). The portal session is opened on
       the key that found it. */
    const found = await inEitherMode((s) => s.subscriptions.retrieve(subscriptionId), opts.livemode);
    if (!found) return null;
    const { stripe, value: sub } = found;
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const session = await stripe.billingPortal.sessions.create({
      customer,
      locale: opts.locale ?? "en",
      /* Every caller passes its own, language-tagged. The default is the same
         page rather than the marketing home page so a future call site that
         forgets still returns the client somewhere that acknowledges what they
         just did, instead of dumping them on a sales page. */
      return_url: opts.returnUrl ?? "https://servolia.com/hosting/billing?done=1",
    });
    return session.url;
  } catch (err) {
    /* The most likely cause by far is the portal never having been switched on
       for the account (Stripe → Settings → Billing → Customer portal). That
       reads as a plain API error, so name it here rather than leaving a future
       reader to guess. */
    console.error(
      "[portal] could not create a billing portal session — is the Customer portal enabled in Stripe?",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
