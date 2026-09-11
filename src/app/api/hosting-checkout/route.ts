import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { clientRefFor, langFor } from "@/lib/clientRefs";
import {
  resolveHostingPlan,
  hostingAmountCents,
  productCopy,
  HOSTING_METADATA_KIND,
} from "@/lib/hosting";
import { domainQuote, isDomainSalesConfigured, normalizeDomain } from "@/lib/domainSales";

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
    plan = "hosting", billing = "annual", email = "", business: rawBusiness = "",
    ref = "", mode = "", lang: bodyLang = "",
  } = body as Record<string, string>;
  const buyDomain = (body as Record<string, unknown>).buyDomain === true;
  let business = rawBusiness;

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

  /* A DOMAIN BOUGHT WITH THE PLAN.
   *
   * Quoted again HERE, from Vercel, not taken from the browser: the chooser
   * showed a price, but the browser can post any figure it likes. The domain
   * becomes a second line on the same subscription, at the same interval, so
   * it renews when the plan renews and stops when the plan stops. */
  let domainLine: Stripe.Checkout.SessionCreateParams.LineItem | null = null;
  let domainMeta: Record<string, string> = {};
  if (buyDomain) {
    const name = normalizeDomain((body as Record<string, unknown>).domain as string);
    if (!name) return NextResponse.json({ error: lang === "fr" ? "Nom de domaine invalide" : "Invalid domain name" }, { status: 400 });
    if (!isDomainSalesConfigured()) {
      return NextResponse.json({ error: lang === "fr" ? "Les domaines ne sont pas proposés pour le moment" : "Domains are not offered right now" }, { status: 400 });
    }
    const q = await domainQuote(name);
    if (!q.sellable) {
      const why = lang === "fr"
        ? { taken: "Ce domaine n'est plus disponible", unsupported: "Cette extension n'est pas proposée", "too-expensive": "Cette extension est trop chère pour cette formule" }
        : { taken: "That domain is no longer available", unsupported: "That ending is not offered", "too-expensive": "That ending is too expensive for this plan" };
      return NextResponse.json({ error: why[q.reason as keyof typeof why] ?? (lang === "fr" ? "Domaine indisponible" : "Domain unavailable") }, { status: 400 });
    }
    const amountUsd = period === "annual" ? q.yearlyUsd : q.monthlyUsd;
    domainLine = {
      price_data: {
        currency: "usd",
        product_data: {
          name: `${lang === "fr" ? "Domaine" : "Domain"} · ${name}`,
          description: lang === "fr"
            ? "Enregistré et renouvelé par Servolia. Il vous appartient."
            : "Registered and renewed by Servolia. Yours to keep.",
        },
        unit_amount: amountUsd * 100,
        recurring: { interval: period === "annual" ? "year" : "month" },
      },
      quantity: 1,
    };
    domainMeta = { domain: name, domain_retail_usd: String(q.yearlyUsd), domain_cost_usd: String(q.purchaseUsd) };
    business = name;
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
      /* An agreed address wins over anything the browser sent. Setting
       * customer_email also LOCKS the field on Stripe's page, which is the
       * point: the client asked for the account to be under one specific
       * company address, and this guarantees it rather than hoping they type
       * it correctly. They see it (masked) on our page first, so a wrong one
       * can be raised before they are locked into it. Where no address has
       * been agreed, Stripe asks as before. */
      ...((client?.email || email) ? { customer_email: client?.email || email } : {}),
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
        ...(domainLine ? [domainLine] : []),
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
        ...domainMeta,
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
          ...domainMeta,
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
      /* `setup=1` for a buyer we do not already host: their site lives
       * somewhere else and nothing can happen until they tell us where. Only
       * the server knows which case this is, so the flag is set here rather
       * than guessed by the page. */
      success_url: `${origin}/hosting/thanks?product=${hostingPlan.key}&lang=${lang}${client?.gateWidget ? "&restored=1" : ""}${domainLine ? "&domain=1" : ""}${client ? "" : "&setup=1&session_id={CHECKOUT_SESSION_ID}"}`,
      cancel_url: `${origin}/${hostingPlan.key === "chatbot" ? "chatbot" : "hosting"}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[hosting-checkout]", message);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
