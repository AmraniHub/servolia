import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { clientRefFor, langFor } from "@/lib/clientRefs";
import {
  resolveHostingPlan,
  hostingAmountCents,
  productCopy,
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
  const {
    plan = "hosting", billing = "annual", email = "", business = "",
    ref = "", mode = "", lang: bodyLang = "",
  } = body as Record<string, string>;

  const hostingPlan = resolveHostingPlan(plan);
  if (!hostingPlan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const period: "monthly" | "annual" = billing === "monthly" ? "monthly" : "annual";
  const origin = req.nextUrl.origin;

  /* Language is resolved HERE, from the client record, not taken from the
   * request. The page sends what it rendered in, but only as a fallback for an
   * unknown ref — a known client is spoken to in their own language whatever
   * the browser posts. This decides the wording on Stripe's page and in the
   * confirmation email, so it belongs on the server. */
  const lang = langFor(ref, bodyLang);

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
      locale: lang,
      ...(email ? { customer_email: email } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: client?.arrearsLabel || (lang === "fr" ? "Solde impayé" : "Outstanding balance"),
              description: lang === "fr"
                ? "Montant impayé des mois précédents. Facturé une seule fois."
                : "Unpaid amount from previous months. Charged once.",
            },
            unit_amount: Math.round(owed * 100),
          },
          quantity: 1,
        },
      ],
      // `label` is carried so the confirmation email can name the charge the
      // same way the checkout page did. "Outstanding balance" on a receipt
      // with no other explanation is what causes the support email.
      metadata: {
        kind: HOSTING_METADATA_KIND,
        plan: "arrears",
        ref,
        lang,
        label: client?.arrearsLabel || (lang === "fr" ? "Solde impayé" : "Outstanding balance"),
      },
      success_url: `${origin}/hosting/thanks?product=arrears&lang=${lang}`,
      cancel_url: `${origin}/hosting${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`,
    });
    return NextResponse.json({ url: once.url });
  }

  try {
    const stripe = new Stripe(key);
    /* The copy Stripe's own page will show. It used to be the literal string
     * "Website hosting" for every product, so an AI assistant purchase was
     * headed "Website hosting — temghid.ma" on the one screen where the buyer
     * is deciding whether to trust the charge. */
    const copy = productCopy(hostingPlan, lang);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Renders Stripe's whole checkout page in the client's language.
      locale: lang,
      // Stripe collects the email on its own page when we do not have one, so
      // the page can ask for as little as possible.
      ...(email ? { customer_email: email } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${copy.heading}${business ? ` — ${business}` : ""}`,
              description: copy.description,
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
        ref,
        lang,
        // Carried so the webhook can restore the service on payment. Sourced
        // from the server-side client map, never the request: these name a
        // repository that gets written to.
        ...(client?.repo ? { repo: client.repo } : {}),
        ...(client?.branch ? { branch: client.branch } : {}),
        ...(client?.siteRoot ? { site_root: client.siteRoot } : {}),
        ...(client?.gateWidget ? { gate_widget: client.gateWidget } : {}),
      },
      /* The SAME metadata on the subscription, not only on the session.
       * Stripe does not copy one to the other, and the session is a record of
       * one moment: everything afterwards — the upgrade to yearly, a support
       * question about which product a charge is for — starts from the
       * subscription, which without this knows nothing about the client. */
      subscription_data: {
        metadata: {
          kind: HOSTING_METADATA_KIND,
          plan: hostingPlan.key,
          period,
          business: business || ref || "",
          ref,
          lang,
        },
      },
      allow_promotion_codes: true,
      /* The thank-you page is shared by every client product, so it is told
       * which one this was. Display only — it decides wording, never money.
       *
       * `restored` here means "this client has a suspension gate", not "the
       * gate was actually flipped": the flip happens in the webhook, after the
       * redirect, so the page cannot know the outcome. The confirmation EMAIL
       * uses the real result. Worst case a client who was never suspended
       * reads "back online" on one page. */
      success_url: `${origin}/hosting/thanks?product=${hostingPlan.key}&lang=${lang}${client?.gateWidget ? "&restored=1" : ""}`,
      cancel_url: `${origin}/${hostingPlan.key === "chatbot" ? "chatbot" : "hosting"}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[hosting-checkout]", message);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
