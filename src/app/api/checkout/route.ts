import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { SELLABLE_BUILD_PLANS, PLANS as SUB_PLANS, SETUP_PLAN } from "@/lib/pricing";

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

/** First-year value of a lead who just started checkout — installation plus a
 *  year of the anchor tier. Matches estimateLeadValue() in src/lib/supabase.ts. */
const FIRST_YEAR_ESTIMATE = SETUP_PLAN.totalEur + SUB_PLANS.croissance.monthlyEur * 12;

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

    // ── Create / link a Lead + Build pre-payment so we track it ──────────
    const db = supabaseAdmin();
    if (db) {
      let finalLeadId = leadId ?? null;

      // If no leadId came from the form/chatbot, this is a direct purchase —
      // create a "qualified" lead now so it shows up in the CRM immediately.
      if (!finalLeadId) {
        const { data: newLead } = await db.from("leads").insert({
          business: `Direct purchase · ${p.name}`,
          source: "direct-purchase",
          stage: "qualified",
          plan_interest: plan,
          value_estimate: FIRST_YEAR_ESTIMATE,
        }).select("id").single();
        if (newLead) finalLeadId = newLead.id;
      }

      await db.from("builds").insert({
        lead_id: finalLeadId,
        business: "Pending intake",
        plan,
        plan_name: p.name,
        total_price: p.amount / 100,
        balance_due: 0, // nothing is owed on delivery under the current model

        status: "intake",
        checkout_session_id: session.id,
      });

      // Mark the lead as awaiting payment (the webhook flips it once paid).
      if (finalLeadId) {
        await db.from("leads").update({ stage: "qualified" }).eq("id", finalLeadId);
        await db.from("lead_activities").insert({
          lead_id: finalLeadId,
          type: "payment",
          description: `Started checkout for ${p.name} — €${(p.amount / 100).toLocaleString()}`,
        });
      }
    }

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
