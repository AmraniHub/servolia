import { NextRequest, NextResponse } from "next/server";
import { canBuyDomains, domainQuote, isDomainSalesConfigured, normalizeDomain } from "@/lib/domainSales";

export const runtime = "nodejs";

/**
 * "Is example.com available, and what would it cost me?" -- for the plan
 * chooser. Returns only what the buyer needs: the retail price. Vercel's own
 * price never leaves the server.
 */
export async function GET(req: NextRequest) {
  const name = normalizeDomain(req.nextUrl.searchParams.get("name"));
  if (!name) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  if (!isDomainSalesConfigured()) return NextResponse.json({ ok: false, reason: "not-offered" });

  const q = await domainQuote(name);
  return NextResponse.json(
    // `purchasable` says whether the webhook can buy (registrant contact
    // configured) -- a boolean, nothing private, so the operator can verify
    // the setup from outside without an admin session.
    { ok: true, domain: q.domain, sellable: q.sellable, reason: q.reason ?? null, yearlyUsd: q.yearlyUsd, monthlyUsd: q.monthlyUsd, purchasable: canBuyDomains() },
    { headers: { "cache-control": "no-store" } },
  );
}
