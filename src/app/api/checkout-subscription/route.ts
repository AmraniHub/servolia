import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { resolvePlan, planAmountCents, SETUP_PLAN } from "@/lib/pricing";

export const runtime = "nodejs";

/**
 * THE ONLY WAY TO BUY. One checkout collects everything a new client owes:
 *
 *   MONTHLY  → €490 installation charged now (one-time line item)
 *              + the monthly plan, first charge after a 7-day trial so the
 *              recurring clock starts when the site goes live, exactly as
 *              /how-it-works promises ("your monthly plan starts the day you
 *              go live — not 30 days later").
 *   ANNUAL   → the yearly fee only. The installation is genuinely waived,
 *              which is what both pricing pages say.
 *
 * Before 2026-07-30 this route charged ONLY the recurring amount, so every
 * monthly self-serve signup silently skipped the €490 the pricing page had
 * just promised. The installation sat behind a second button that nothing
 * required anyone to press.
 *
 * VERIFIED 2026-08-12 (live test-mode checkout, rendered by Stripe itself):
 * "€490.00 due today · Then €149.00 per month" — with `trial_period_days`
 * set, Stripe charges the one-time installation line at checkout and starts
 * the subscription after the trial, exactly as intended. The feared deferral
 * to trial end does not occur. `metadata.installation_cents` still records
 * intent so any future regression is visible in the dashboard.
 */

/** Days between paying and go-live — matches SETUP_PLAN.delivery. */
const DELIVERY_TRIAL_DAYS = 7;

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY to Vercel env vars" }, { status: 503 });
  }
  const stripe = new Stripe(key);

  try {
    const { plan, email, billing, lang } = await req.json() as {
      plan: string; email?: string; billing?: "monthly" | "annual"; lang?: "en" | "fr";
    };
    const fr = lang === "fr";
    // resolvePlan tolerates the pre-2026-07-28 keys (care / care_growth / care_scale).
    const p = resolvePlan(plan);
    if (!p) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    const annual = billing === "annual";
    const interval: "month" | "year" = annual ? "year" : "month";
    const amount = planAmountCents(p, annual ? "annual" : "monthly");
    const installationCents = annual ? 0 : SETUP_PLAN.totalEur * 100;
    const origin = req.headers.get("origin") ?? "https://servolia.com";

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: annual
              ? `Servolia ${fr ? p.nameFr : p.name} — ${fr ? "Annuel (2 mois offerts)" : "Annual (2 months free)"}`
              : `Servolia ${fr ? p.nameFr : p.name} — ${fr ? "Mensuel" : "Monthly"}`,
            description: fr
              ? "Tout compris : domaine, hébergement, email pro, votre réceptionniste IA et vos rapports mensuels."
              : "All-in: domain, hosting, professional email, your AI receptionist, and monthly reports.",
          },
          unit_amount: amount,
          recurring: { interval },
        },
        quantity: 1,
      },
    ];

    // One-time installation, monthly only — no `recurring`, so Stripe treats it
    // as a setup fee instead of adding it to every renewal.
    if (installationCents > 0) {
      line_items.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: fr ? `${SETUP_PLAN.nameFr} (une seule fois)` : `${SETUP_PLAN.name} (one-time)`,
            description: fr
              ? "Site construit et rédigé pour votre cabinet, réceptionniste IA entraînée, domaine et email configurés. Offerte en paiement annuel."
              : "Your site built and written for your practice, AI receptionist trained, domain and email set up. Waived when you pay yearly.",
          },
          unit_amount: installationCents,
        },
        quantity: 1,
      });
    }

    const submitMsg = annual
      ? (fr ? "Facturé à l'année · 2 mois offerts · mise en place offerte" : "Billed yearly · two months free · installation waived")
      : (fr
          ? `Mise en place réglée aujourd'hui · votre abonnement démarre dans ${DELIVERY_TRIAL_DAYS} jours, à la mise en ligne`
          : `Installation paid today · your monthly plan starts in ${DELIVERY_TRIAL_DAYS} days, when you go live`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items,
      mode: "subscription",
      locale: fr ? "fr" : "en",
      // Monthly: hold the recurring charge until go-live. Annual is paid in
      // full today — there is no installation to offset and no promise to keep.
      ...(annual ? {} : { subscription_data: { trial_period_days: DELIVERY_TRIAL_DAYS } }),
      // Land them on the intake form: the build cannot start without it.
      success_url: `${origin}${fr ? "/fr/demarrage" : "/onboarding"}?subscribed=1&plan=${plan}&billing=${annual ? "annual" : "monthly"}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${fr ? "/fr/tarifs" : "/pricing"}`,
      metadata: {
        plan,
        kind: "care_plan",
        billing: annual ? "annual" : "monthly",
        // What we intended to collect up front — lets the webhook and the
        // Stripe dashboard reconcile against what was actually charged.
        installation_cents: String(installationCents),
        lang: fr ? "fr" : "en",
        source: "servolia-website",
      },
      custom_text: { submit: { message: submitMsg } },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Subscription checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
