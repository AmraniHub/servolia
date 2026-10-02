import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { resolvePlan, planAmountCents, SETUP_PLAN } from "@/lib/pricing";
import { checkoutStripe } from "@/lib/testMode";
import { supabaseAdmin } from "@/lib/supabase";
import { clientEmailFromCookies } from "@/lib/clientAuth";
import { rowsForEmail, knownStripeCustomer, buyerFields, businessTaxFields, withStaleCustomerRetry } from "@/lib/stripeCustomer";
import { HAS_PLAN_TEXT, hasPlanUrl } from "@/lib/planNotice";

export const runtime = "nodejs";

/**
 * THE ONLY WAY TO BUY. One checkout collects everything a new client owes:
 *
 *   MONTHLY  → €690 installation charged now (one-time line item)
 *              + the monthly plan, first charge after a FIXED 7-day trial —
 *              the length of the build. It does not wait for go-live (nothing
 *              extends the trial if a build runs late), so every page says
 *              "7 days after payment", never "when you go live".
 *   ANNUAL   → the yearly fee only. The installation is genuinely waived,
 *              which is what both pricing pages say.
 *
 * Before 2026-07-30 this route charged ONLY the recurring amount, so every
 * monthly self-serve signup silently skipped the €690 the pricing page had
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
  // Founder test mode (src/lib/testMode.ts), else the live key as before.
  const co = checkoutStripe(req);
  if (co.refused) return co.refused;
  if (!co.stripe) {
    return NextResponse.json({ error: "Stripe not configured — add STRIPE_SECRET_KEY to Vercel env vars" }, { status: 503 });
  }
  const stripeClient = co.stripe;

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

    /* WHO IS BUYING, WHEN THE SERVER KNOWS (2026-10-02, tightened after
       review). Only a SERVER-KNOWN identity — the founder's test-mode buyer,
       or the logged-in portal client (their signed session cookie) — may pick
       an existing Stripe customer or be refused a second plan. An address in
       the request body is anyone's to type: it is used only to prefill
       Stripe's email field, never to select a customer (that would put a
       stranger's checkout on a client's account) and never to answer "this
       address already pays us" to an anonymous caller. An anonymous /pricing
       visitor is caught after paying by the webhook's second-plan alert and
       the daily billing check instead. */
    const known = co.buyer ?? (await clientEmailFromCookies(req.cookies).catch(() => null));
    const prefill = known ?? (email?.trim() || null);
    const db = supabaseAdmin();
    let customerId: string | null = null;
    if (known && db) {
      /* ONE PLAN PER LOGIN. Changing plan is done from the portal (Stripe's
         billing portal), never by buying again. A practice with a SECOND
         site is a real case: the notice tells them to write to us so it is
         set up on its own account (src/lib/planNotice.ts). Refused BEFORE
         Stripe is touched, in their language. */
      const live = (await rowsForEmail<{ subscription_id: string | null }>(db, "clients", "id, subscription_id, status, created_at", known, {
        test: co.test, statuses: ["active", "past_due", "paused"],
      })).filter((r) => r.subscription_id);
      if (live.length) {
        const lang = fr ? "fr" : "en";
        return NextResponse.json(
          { url: hasPlanUrl(origin, lang), alreadySubscribed: true, error: HAS_PLAN_TEXT[lang] },
          { status: 409 },
        );
      }
      // A returning client (churned, or a receptionist trial client) keeps their Stripe customer.
      customerId = await knownStripeCustomer(db, "clients", known, co.test);
    }
    // A stored customer Stripe no longer has is retried once as a new one (src/lib/stripeCustomer.ts).
    const stripe = withStaleCustomerRetry(stripeClient, prefill);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: annual
              ? `Servolia ${fr ? p.nameFr : p.name} — ${fr ? "Annuel (2 mois offerts)" : "Annual (2 months free)"}`
              : `Servolia ${fr ? p.nameFr : p.name} — ${fr ? "Mensuel" : "Monthly"}`,
            description: fr
              ? "Tout compris : votre domaine (un nouveau est offert), l'hébergement, 1 adresse email pro, votre réceptionniste IA et vos rapports mensuels."
              : "All-in: your domain (a new one is on us), hosting, 1 professional email address, your AI receptionist, and monthly reports.",
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
              ? "Site construit et rédigé pour votre cabinet, réceptionniste IA entraînée, votre domaine connecté et votre adresse email pro créée. Offerte en paiement annuel."
              : "Your site built and written for your practice, AI receptionist trained, your domain connected and your pro email address created. Waived when you pay yearly.",
          },
          unit_amount: installationCents,
        },
        quantity: 1,
      });
    }

    const submitMsg = annual
      ? (fr ? "Facturé à l'année · 2 mois offerts · mise en place offerte" : "Billed yearly · two months free · installation waived")
      : (fr
          ? `Mise en place réglée aujourd'hui · votre abonnement démarre dans ${DELIVERY_TRIAL_DAYS} jours`
          : `Installation paid today · your monthly plan starts in ${DELIVERY_TRIAL_DAYS} days`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      // Test mode: always the founder's address (src/lib/testMode.ts). The
      // existing Stripe customer when there is one (src/lib/stripeCustomer.ts).
      ...buyerFields(customerId, prefill),
      // B2B: VAT number (reverse charge) + billing address; no VAT charged.
      ...businessTaxFields("subscription", Boolean(customerId)),
      line_items,
      mode: "subscription",
      locale: fr ? "fr" : "en",
      // Monthly: hold the recurring charge until go-live. Annual is paid in
      // full today — there is no installation to offset and no promise to keep.
      ...(annual ? {} : { subscription_data: { trial_period_days: DELIVERY_TRIAL_DAYS } }),
      // A test subscription says so on the subscription object too.
      ...(co.test ? { subscription_data: { ...(annual ? {} : { trial_period_days: DELIVERY_TRIAL_DAYS }), metadata: co.tag } } : {}),
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
        ...co.tag,
      },
      custom_text: { submit: { message: submitMsg } },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Subscription checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
