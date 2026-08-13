import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { ADDONS } from "@/lib/pricing";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";

/** The slugs this client actually owns: builds by email -> client_sites.
 *  Same scoping the portal's leads route uses. */
async function ownedSlugs(email: string): Promise<string[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data: builds } = await db.from("builds").select("id").eq("email", email);
  const buildIds = (builds ?? []).map((b) => b.id);
  if (!buildIds.length) return [];
  const { data: sites } = await db.from("client_sites").select("slug").in("build_id", buildIds);
  return (sites ?? []).map((s) => s.slug);
}

export const runtime = "nodejs";

/**
 * Self-serve add-on subscription. The client clicks "Enable" in the portal →
 * a recurring Stripe subscription starts → the webhook provisions it. This is
 * what turns the manual add-ons into one-click recurring revenue.
 */
export async function POST(req: NextRequest) {
  // Add-ons are provisioned by the webhook against metadata.siteSlug, so the
  // caller must be a logged-in client and the slug must be one they own.
  // Taking either from the request body would let anyone attach an add-on to
  // someone else's site. Mirrors /api/billing-portal and /api/portal/leads.
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
    const { addon, siteSlug } = await req.json() as { addon: string; siteSlug?: string };
    const a = ADDONS[addon];
    if (!a) return NextResponse.json({ error: "Unknown add-on" }, { status: 400 });

    // A slug may be supplied, but only one of the client's own.
    let slug = "";
    if (siteSlug) {
      const owned = await ownedSlugs(email);
      if (!owned.includes(siteSlug)) {
        return NextResponse.json({ error: "That site is not on your account." }, { status: 403 });
      }
      slug = siteSlug;
    }

    const origin = req.headers.get("origin") ?? "https://servolia.com";
    const unitLabel = a.interval === "year" ? "/year" : a.per === "mailbox" ? "/mailbox/month" : "/month";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Servolia — ${a.name}`,
              description: `Managed add-on billed €${a.priceEur}${unitLabel}. Cancel anytime.`,
            },
            unit_amount: a.priceEur * 100,
            recurring: { interval: a.interval },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/portal?addon=${addon}&enabled=1`,
      cancel_url: `${origin}/portal`,
      metadata: { kind: "addon", addon, siteSlug: slug, email, source: "servolia-portal" },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Add-on checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
