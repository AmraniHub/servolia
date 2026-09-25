import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { stripeFor, isLiveKey } from "@/lib/stripeMode";
import { createDomainOrderLink } from "@/lib/domainOrders";
import { sameOriginRequest } from "@/lib/sameOrigin";

export const runtime = "nodejs";

/**
 * A payment link for a domain on its own (src/lib/domainOrders.ts): the
 * client pays with their card, the webhook buys the name and emails them.
 *
 * ALWAYS LIVE, deliberately ignoring founder test mode, like every admin
 * link: it is sent to a real client, who could never pay a test one. The
 * mode is returned so the form can say so if the live key is a test key.
 *
 * Admin session AND same-origin: the link it makes is a live charge.
 */
export async function POST(req: NextRequest) {
  if (!sameOriginRequest(req.headers)) return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }
  const stripe = stripeFor(true);
  if (!stripe) return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  try {
    const res = await createDomainOrderLink(stripe, {
      domain: str("domain"),
      email: str("email"),
      name: str("name"),
      project: str("project"),
      lang: str("lang") === "fr" ? "fr" : "en",
      origin: "https://servolia.com",
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ...res, mode: isLiveKey(process.env.STRIPE_SECRET_KEY) ? "live" : "test" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Stripe error" }, { status: 502 });
  }
}
