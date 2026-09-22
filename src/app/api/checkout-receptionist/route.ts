import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { resolvePlan, planAmountCents, SETUP_PLAN } from "@/lib/pricing";
import { readReceptionistToken, loadReceptionist, receptionistPhase } from "@/lib/receptionistTrial";

export const runtime = "nodejs";

/**
 * POST /api/checkout-receptionist { token, plan, billing } — keep the
 * receptionist she tried on her own site.
 *
 * The same EUR plans as /pricing, at the same prices, with ONE difference
 * decided on 2026-09-22: no installation line. The €690 pays for setting a
 * practice up; her trial already did that (she pasted the line, it answered
 * her patients), so charging it again would bill her for work that is done.
 * No `trial_period_days` either — it is live on her site today, so the plan
 * starts today.
 *
 * Authorised by her trial token, so the checkout is prefilled with the
 * address that owns the receptionist, and the webhook's `receptionist`
 * branch (above the generic plan branch, which would open a build and send
 * her an intake form for a site she does not need) turns the payment into a
 * client on that very receptionist.
 */
export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { token?: string; plan?: string; billing?: string };
  const claim = await readReceptionistToken(typeof body.token === "string" ? body.token.slice(0, 2000) : "");
  if (!claim) return NextResponse.json({ error: "invalid-link" }, { status: 400 });
  const plan = resolvePlan(body.plan);
  if (!plan) return NextResponse.json({ error: "unknown-plan" }, { status: 400 });
  const annual = body.billing === "annual";

  const row = await loadReceptionist(claim.slug);
  const r = row?.config.receptionist;
  if (!row || !r || r.email?.toLowerCase() !== claim.email.toLowerCase()) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const phase = receptionistPhase(r);
  // row.build_id too: a payment the webhook has linked but not yet marked.
  if (phase === "paid" || row.build_id) return NextResponse.json({ error: "already-paid" }, { status: 409 });
  if (phase === "draft") return NextResponse.json({ error: "not-started" }, { status: 409 });

  const fr = claim.lang === "fr";
  const origin = req.headers.get("origin") ?? "https://servolia.com";
  const back = `${origin}/fr/essai/confirmer?t=${encodeURIComponent(body.token!)}`;
  const metadata = {
    kind: "receptionist",
    slug: row.slug,
    plan: plan.key,
    billing: annual ? "annual" : "monthly",
    email: claim.email,
    lang: claim.lang,
    installation_cents: "0",
    source: "receptionist-trial",
  };

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: claim.email,
      locale: fr ? "fr" : "en",
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Servolia ${fr ? plan.nameFr : plan.name} — ${annual ? (fr ? "Annuel (2 mois offerts)" : "Annual (2 months free)") : (fr ? "Mensuel" : "Monthly")}`,
            description: fr
              ? `Votre réceptionniste IA sur ${r.domain} : ${plan.conversations} conversations par mois, alertes de demandes et espace client.`
              : `Your AI receptionist on ${r.domain}: ${plan.conversations} conversations a month, enquiry alerts and client space.`,
          },
          unit_amount: planAmountCents(plan, annual ? "annual" : "monthly"),
          recurring: { interval: annual ? "year" : "month" },
        },
        quantity: 1,
      }],
      subscription_data: { metadata },
      metadata,
      custom_text: {
        submit: {
          message: fr
            ? `Mise en place (${SETUP_PLAN.totalEur} €) offerte : elle est déjà installée sur votre site.`
            : `Installation (€${SETUP_PLAN.totalEur}) waived: it is already installed on your site.`,
        },
      },
      success_url: `${back}&paid=1`,
      cancel_url: back,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout-receptionist]", err);
    return NextResponse.json({ error: "checkout-failed" }, { status: 500 });
  }
}
