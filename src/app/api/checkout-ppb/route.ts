import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { PAY_PER_BOOKING, payPerBookingEligible } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * Pay-per-booking checkout — the aesthetic/med-spa wedge offer.
 *
 * Charges the setup fee (€990) IN FULL (not the 50%-deposit model — the trade
 * of this plan is lower risk upfront + €60 per attended booking after, so the
 * setup is paid once and whole). The monthly invoicing cron then bills
 * attended bookings against the card-on-file customer.
 *
 * HARD LEGAL GATE: payPerBookingEligible(niche) must pass. Dental/medical is
 * refused server-side no matter what the link says — French "compérage" rules
 * (see src/lib/pricing.ts). Never weaken this check.
 *
 * Founder-led sales flow: POST { niche, lang, email?, leadId? } → { url },
 * or just send the GET link directly:
 *   https://servolia.com/api/checkout-ppb?niche=aesthetic&lang=fr
 * which 303-redirects into Stripe Checkout.
 */

async function createSession(req: NextRequest, params: { niche: string; lang?: string; email?: string; leadId?: string }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Stripe not configured", status: 503 as const };

  const niche = (params.niche ?? "").trim();
  if (!payPerBookingEligible(niche)) {
    return { error: "Pay-per-booking is not available for this business type.", status: 403 as const };
  }

  const fr = params.lang === "fr";
  const stripe = new Stripe(key);
  const origin = req.headers.get("origin") ?? "https://servolia.com";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: fr
              ? `${PAY_PER_BOOKING.nameFr} — frais de mise en place`
              : `${PAY_PER_BOOKING.name} — setup fee`,
            description: fr
              ? `Puis ${PAY_PER_BOOKING.perBookingEur} € par consultation honorée prise par l'IA. Facturé chaque début de mois, uniquement sur résultat.`
              : `Then €${PAY_PER_BOOKING.perBookingEur} per attended AI-booked consultation. Invoiced monthly, results only.`,
            images: ["https://servolia.com/og-image.png"],
          },
          unit_amount: PAY_PER_BOOKING.setupEur * 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    locale: fr ? "fr" : "en",
    customer_email: params.email || undefined,
    // Save the card so monthly per-booking invoices can charge automatically.
    customer_creation: "always",
    payment_intent_data: { setup_future_usage: "off_session" },
    success_url: `${origin}${fr ? "/fr/demarrage" : "/onboarding"}?plan=pay_per_booking&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${fr ? "/fr/tarifs" : "/pricing"}`,
    metadata: {
      kind: "ppb_setup",
      plan: "pay_per_booking",
      niche,
      per_booking_rate: String(PAY_PER_BOOKING.perBookingEur),
      lead_id: params.leadId ?? "",
      lang: fr ? "fr" : "en",
      source: "servolia-website",
    },
    custom_text: {
      submit: {
        message: fr
          ? `Mise en place unique · Ensuite ${PAY_PER_BOOKING.perBookingEur} €/consultation honorée uniquement`
          : `One-time setup · Then €${PAY_PER_BOOKING.perBookingEur}/attended consultation only`,
      },
    },
  });

  // Track it in the CRM immediately (same pattern as /api/checkout).
  const db = supabaseAdmin();
  if (db) {
    let leadId = params.leadId ?? null;
    if (!leadId) {
      const { data: newLead } = await db.from("leads").insert({
        business: "Direct purchase · Pay-per-booking",
        email: params.email ?? null,
        source: "direct-purchase",
        stage: "qualified",
        niche,
        plan_interest: "pay_per_booking",
        value_estimate: PAY_PER_BOOKING.setupEur,
      }).select("id").single();
      if (newLead) leadId = newLead.id;
    }
    await db.from("builds").insert({
      lead_id: leadId,
      business: "Pending intake",
      plan: "pay_per_booking",
      plan_name: PAY_PER_BOOKING.name,
      total_price: PAY_PER_BOOKING.setupEur,
      balance_due: 0,
      status: "intake",
      checkout_session_id: session.id,
    });
  }

  sendMetaCapiEvent({
    eventName: "InitiateCheckout",
    value: PAY_PER_BOOKING.setupEur,
    currency: "EUR",
    eventSourceUrl: "https://servolia.com/pricing",
    req,
  });

  return { url: session.url ?? undefined, status: 200 as const };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { niche?: string; lang?: string; email?: string; leadId?: string };
    const res = await createSession(req, { niche: body.niche ?? "", lang: body.lang, email: body.email, leadId: body.leadId });
    if ("error" in res && res.error) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ url: res.url });
  } catch (err) {
    console.error("PPB checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}

/** GET variant so the founder can just send a link in a DM/email. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const res = await createSession(req, {
      niche: sp.get("niche") ?? "",
      lang: sp.get("lang") ?? "fr",
      email: sp.get("email") ?? undefined,
    });
    if ("error" in res && res.error) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.redirect(res.url!, 303);
  } catch (err) {
    console.error("PPB checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
