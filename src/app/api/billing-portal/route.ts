import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";

export const runtime = "nodejs";

/**
 * Opens the Stripe billing portal for the LOGGED-IN client.
 * Requires a portal session (magic-link login) — the email comes from the
 * signed session cookie, never from the request body, so nobody can open
 * another customer's billing portal.
 */
export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) {
    return NextResponse.json({ error: "Please log in first", login: true }, { status: 401 });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const stripe = new Stripe(key);

  try {
    const customers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 1 });

    if (!customers.data.length) {
      return NextResponse.json(
        { error: "No billing account found for your email yet — contact hello@servolia.com." },
        { status: 404 },
      );
    }

    const origin = req.headers.get("origin") ?? "https://servolia.com";
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${origin}/portal`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Billing portal error:", err);

    // The portal CONFIGURATION is per-mode, and switching to live keys does not
    // carry the test one over. Until the portal settings are saved once in the
    // live dashboard, this call fails for every client - and the generic
    // message that used to be returned gave nobody a way to work that out.
    const msg = err instanceof Error ? err.message : "";
    if (/default configuration has not been created|No configuration provided/i.test(msg)) {
      console.error(
        "[billing-portal] SETUP REQUIRED: save the Customer Portal settings once in the LIVE Stripe dashboard " +
          "(Settings -> Billing -> Customer portal). Configurations do not carry over from test mode.",
      );
      return NextResponse.json(
        { error: "Billing self-service is not switched on yet - email hello@servolia.com and we will sort it in minutes." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Could not open billing portal" }, { status: 500 });
  }
}
