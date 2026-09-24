import { NextRequest, NextResponse } from "next/server";
import { addonForSale } from "@/lib/pricing";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { checkoutStripe, founderTestBrowser } from "@/lib/testMode";
import { excludeTest } from "@/lib/testContext";

/** The slugs this client actually owns: builds by email -> client_sites.
 *  Same scoping the portal's leads route uses. */
async function ownedSlugs(email: string): Promise<string[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  // `is_test is not true`, except in the founder's own test-mode browser.
  const { data: builds } = await excludeTest(db, (live) => live(db.from("builds").select("id").eq("email", email)), { keepTest: await founderTestBrowser() });
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

  // Founder test mode (src/lib/testMode.ts), else the live key as before.
  const co = checkoutStripe(req);
  if (co.refused) return co.refused;
  if (!co.stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const stripe = co.stripe;

  try {
    const { addon, siteSlug } = await req.json() as { addon: string; siteSlug?: string };
    // Retired add-ons (SMS, reviews) are refused here, not only hidden on the
    // pages: nothing performs them, so taking the money would be the bug.
    const sale = addonForSale(addon);
    if ("error" in sale) {
      return sale.error === "retired"
        ? NextResponse.json({ error: "This add-on is no longer offered." }, { status: 410 })
        : NextResponse.json({ error: "Unknown add-on" }, { status: 400 });
    }
    const a = sale.addon;

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
      customer_email: co.buyer ?? email, // test mode: the founder's address
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
      metadata: { kind: "addon", addon, siteSlug: slug, email: co.buyer ?? email, source: "servolia-portal", ...co.tag },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Add-on checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
