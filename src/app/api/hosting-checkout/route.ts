import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { clientRefFor, langFor } from "@/lib/clientRefs";
import {
  resolveHostingPlan,
  hostingAmountCents,
  productCopy,
  HOSTING_TIERS,
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
    /* ALWAYS A YEAR. A domain is a yearly thing wherever it is bought, and
       Stripe will not put a yearly item on a monthly subscription. So on a
       yearly plan the domain is a second yearly item that renews with the
       plan; on a monthly plan the first year is a one-time line on the first
       invoice, and each later year is added to the anniversary invoice by
       the domain-billing cron. */
    const withPlan = period === "annual";
    domainLine = {
      price_data: {
        currency: "usd",
        product_data: {
          name: `${lang === "fr" ? "Domaine" : "Domain"} · ${name}${withPlan ? "" : lang === "fr" ? " — 1 an" : " — 1 year"}`,
          description: lang === "fr"
            ? (withPlan
                ? "Enregistré par Servolia, renouvelé avec votre formule. Il vous appartient."
                : "Enregistré par Servolia, renouvelé chaque année sur votre facture. Il vous appartient.")
            : (withPlan
                ? "Registered by Servolia, renewed with your plan. Yours to keep."
                : "Registered by Servolia, renewed each year on your invoice. Yours to keep."),
        },
        unit_amount: q.yearlyUsd * 100,
        ...(withPlan ? { recurring: { interval: "year" as const } } : {}),
      },
      quantity: 1,
    };
    domainMeta = {
      domain: name,
      domain_retail_usd: String(q.yearlyUsd),
      domain_cost_usd: String(q.purchaseUsd),
      domain_billing: withPlan ? "with-plan" : "yearly-invoice",
    };
    business = name;
  }

  /* A ONE-TIME LINE THE PLAN CARRIES (Business: mailbox setup). Charged on
     the first invoice only; the subscription itself stays at the plan's
     price. Same one-time shape as a domain's year on a monthly plan.

     GATED ON THE PLAN BEING A HOSTING TIER, not merely on setupUsd existing.
     This line is literally "Mailbox setup", so it only makes sense attached to
     a plan that comes with mailboxes. seo_multilingual carried a leftover
     setupUsd of 345 from when it was quoted as a setup-plus-subscription, and
     an ungated check put a $345 mailbox charge on a $145 one-off — a $490
     checkout page, with a line item describing a service the buyer is not
     buying. The field has since been removed too; this is the guard that stops
     the next one. */
  const setupLine: Stripe.Checkout.SessionCreateParams.LineItem | null =
    hostingPlan.setupUsd && HOSTING_TIERS.includes(hostingPlan.key)
    ? {
        price_data: {
          currency: "usd",
          product_data: {
            name: lang === "fr" ? "Mise en place des boîtes email — une fois" : "Mailbox setup — one time",
            description: lang === "fr"
              ? "Jusqu'à 3 boîtes sur votre domaine, avec SPF, DKIM et DMARC configurés. Facturé une seule fois."
              : "Up to 3 mailboxes on your domain, with SPF, DKIM and DMARC set up. Charged once.",
          },
          unit_amount: hostingPlan.setupUsd * 100,
        },
        quantity: 1,
      }
    : null;

  try {
    const stripe = new Stripe(key);
    /* The copy Stripe's own page will show. It used to be the literal string
     * "Website hosting" for every product, so an AI assistant purchase was
     * headed "Website hosting — temghid.ma" on the one screen where the buyer
     * is deciding whether to trust the charge. */
    const copy = productCopy(hostingPlan, lang);
    /* A ONE-OFF PRODUCT TAKES A PAYMENT, NOT A SUBSCRIPTION.
     *
     * Stripe refuses a `recurring` price in payment mode and a non-recurring
     * one in subscription mode, so this cannot be papered over with a flag —
     * the shape of the line item has to follow the shape of the sale. Getting
     * it wrong bills a finished job every month, which a client notices on the
     * second invoice and does not forget. */
    const oneOff = Boolean(hostingPlan.oneOffUsd);
    const session = await stripe.checkout.sessions.create({
      mode: oneOff ? "payment" : "subscription",
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
            ...(oneOff ? {} : { recurring: { interval: (period === "annual" ? "year" : "month") as "year" | "month" } }),
          },
          quantity: 1,
        },
        ...(domainLine ? [domainLine] : []),
        ...(setupLine ? [setupLine] : []),
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
        ...(hostingPlan.setupUsd ? { setup_usd: String(hostingPlan.setupUsd) } : {}),
      },
      /* The SAME metadata on the subscription, not only on the session.
       * Stripe does not copy one to the other, and the session is a record of
       * one moment: everything afterwards — the upgrade to yearly, a support
       * question about which product a charge is for — starts from the
       * subscription, which without this knows nothing about the client. */
      /* Omitted entirely for a one-off: there is no subscription to carry it,
         and Stripe rejects the field in payment mode. The session's own
         metadata above still identifies the sale for the webhook. */
      ...(oneOff
        ? {}
        : {
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
          }),
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
      /* THE ASSISTANT'S TWO ENDINGS. A site we host gets the assistant
       * installed by the webhook (`hosted=1`: "it is being added now"). A
       * site elsewhere needs the buyer to add one line and describe their
       * business (`brief=1`), which is NOT the hosting handover form — asking
       * "where does your site live?" of someone who bought an assistant for a
       * site they run themselves is the wrong question on the wrong page. */
      /* A ONE-OFF never takes the handover step: the step's link is minted
       * from a subscription, which a one-off never has, so `setup=1` put
       * "one short step left" above no button at all. */
      success_url: hostingPlan.key === "chatbot"
        ? `${origin}/hosting/thanks?product=chatbot&lang=${lang}${client?.gateWidget ? "&restored=1" : client?.repo ? "&hosted=1" : "&brief=1&session_id={CHECKOUT_SESSION_ID}"}`
        : oneOff
          ? `${origin}/hosting/thanks?product=${hostingPlan.key}&lang=${lang}`
          : `${origin}/hosting/thanks?product=${hostingPlan.key}&lang=${lang}${client?.gateWidget ? "&restored=1" : ""}${domainLine ? "&domain=1" : ""}${client ? "" : "&setup=1&session_id={CHECKOUT_SESSION_ID}"}`,
      cancel_url: `${origin}/${hostingPlan.key === "chatbot" ? "chatbot" : "hosting"}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[hosting-checkout]", message);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
