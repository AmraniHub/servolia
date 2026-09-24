import { NextRequest, NextResponse } from "next/server";
import { readUpgradeToken } from "@/lib/upgrade";
import { billingPortalUrl } from "@/lib/clientPortal";
import { subscriptionContext } from "@/lib/upgrade";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * "Manage billing" — hands the client straight into Stripe's portal.
 *
 * A GET that redirects, because this is a link in an email and a link in an
 * email is a GET. The session is created at the moment it is clicked, so the
 * URL in the email never goes stale: Stripe portal sessions are short-lived,
 * and minting one at send time would have expired long before a client
 * clicked it a fortnight later.
 *
 * Authorised by the same signed token as the upgrade page. Both grant actions
 * on the client's own subscription and both are delivered only to the address
 * already on it, so they carry the same trust: holding the link means holding
 * the inbox.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const subscriptionId = await readUpgradeToken(token);
  const origin = req.nextUrl.origin;

  const bad = (reason: string) =>
    NextResponse.redirect(`${origin}/hosting/billing?problem=${reason}`, 302);

  if (!subscriptionId) return bad("invalid-link");

  const ctx = await subscriptionContext(subscriptionId);
  const url = await billingPortalUrl(subscriptionId, {
    locale: ctx?.lang ?? "en",
    // Back to a page of ours that says what just happened, rather than the
    // marketing home page, which reads as being dumped out of the process.
    returnUrl: `${origin}/hosting/billing?done=1${ctx?.lang === "fr" ? "&lang=fr" : ""}`,
  });

  if (!url) return bad("unavailable");
  return NextResponse.redirect(url, 302);
}

/**
 * "Manage billing" from the PORTAL (src/components/PortalDashboard.tsx,
 * src/app/billing/page.tsx): the logged-in EUR client, authorised by the
 * signed portal session cookie -- the email is never read from the request,
 * so nobody can open another customer's billing.
 *
 * This handler was dropped when the GET above replaced it (940d771), and both
 * portal buttons kept POSTing: every EUR client's card update, invoices and
 * cancellation answered 405 (found by the Step 6 map, 2026-09-24).
 *
 * The client's own subscription is used (clients.subscription_id), not the
 * first Stripe customer with that email: a returning buyer can have several.
 */
export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) {
    return NextResponse.json({ error: "Please log in first", login: true }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Billing is unavailable right now - email hello@servolia.com." }, { status: 503 });

  const { data: rows } = await db.from("clients")
    .select("subscription_id, status, created_at")
    // Exact, never ilike: "_" and "%" are wildcards there, and marie_dubois@…
    // would also match another client's address.
    .in("email", Array.from(new Set([email.trim(), email.trim().toLowerCase()])))
    .not("subscription_id", "is", null)
    .order("created_at", { ascending: false });
  const list = (rows ?? []) as { subscription_id: string; status: string }[];
  const pick = list.find((r) => r.status === "active") ?? list[0];
  if (!pick) {
    return NextResponse.json(
      { error: "No billing account found for your email yet - contact hello@servolia.com." },
      { status: 404 },
    );
  }

  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  // subscriptionContext knows hosting plans only; an EUR plan client (mostly
  // French practices) gets their browser's language instead of English.
  const ctx = await subscriptionContext(pick.subscription_id);
  const browserFr = /^fr\b/i.test(req.headers.get("accept-language") ?? "");
  const url = await billingPortalUrl(pick.subscription_id, {
    locale: ctx?.lang ?? (browserFr ? "fr" : "en"),
    returnUrl: `${origin}/portal`,
  });
  if (!url) {
    // billingPortalUrl has already logged the cause (most often: the Customer
    // portal was never saved in the LIVE Stripe dashboard).
    return NextResponse.json(
      { error: "Billing self-service is not available right now - email hello@servolia.com and we will sort it in minutes." },
      { status: 503 },
    );
  }
  return NextResponse.json({ url });
}
