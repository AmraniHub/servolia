import { NextRequest, NextResponse } from "next/server";
import { readUpgradeToken } from "@/lib/upgrade";
import { billingPortalUrl } from "@/lib/clientPortal";
import { subscriptionContext } from "@/lib/upgrade";

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
