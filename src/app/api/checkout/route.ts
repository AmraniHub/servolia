import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { BUILD_PLANS, depositCents, balanceCents } from "@/lib/pricing";

// 50% deposit amounts in cents (EUR) — prices come from src/lib/pricing.ts
const PLANS: Record<string, { name: string; nameFr: string; deposit: number; balance: number }> =
  Object.fromEntries(
    Object.values(BUILD_PLANS).map((p) => [
      p.key,
      { name: p.name, nameFr: p.nameFr, deposit: depositCents(p), balance: balanceCents(p) },
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
              name: fr ? `${p.nameFr} — acompte de 50 %` : `${p.name} — 50% Deposit`,
              description: fr
                ? `Solde de ${(p.balance / 100).toLocaleString("fr-FR")} € à la livraison. Prix fixe, délai fixe.`
                : `Balance of €${(p.balance / 100).toLocaleString()} due on delivery. Fixed price, fixed deadline.`,
              images: ["https://servolia.com/og-image.png"],
            },
            unit_amount: p.deposit,
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
            ? "50 % maintenant · Solde à la livraison · Délai fixé par écrit"
            : "50% now · Balance on delivery · Fixed deadline in writing",
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
          value_estimate: (p.deposit + p.balance) / 100,
        }).select("id").single();
        if (newLead) finalLeadId = newLead.id;
      }

      await db.from("builds").insert({
        lead_id: finalLeadId,
        business: "Pending intake",
        plan,
        plan_name: p.name,
        total_price: (p.deposit + p.balance) / 100,
        balance_due: p.balance / 100,
        status: "intake",
        checkout_session_id: session.id,
      });

      // Mark the lead as awaiting payment (will flip to deposit_paid on webhook)
      if (finalLeadId) {
        await db.from("leads").update({ stage: "qualified" }).eq("id", finalLeadId);
        await db.from("lead_activities").insert({
          lead_id: finalLeadId,
          type: "payment",
          description: `Started checkout for ${p.name} — €${(p.deposit / 100).toLocaleString()} deposit`,
        });
      }
    }

    // Meta Conversions API — checkout started (fire and forget)
    sendMetaCapiEvent({
      eventName: "InitiateCheckout",
      value: p.deposit / 100,
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
