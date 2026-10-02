import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { sameOriginRequest } from "@/lib/sameOrigin";
import { supabaseAdmin } from "@/lib/supabase";
import { stripeFor } from "@/lib/stripeMode";
import { saveNotes } from "@/lib/hostingRow";
import { normalizeDomain } from "@/lib/domainSales";
import { writeLinkedDomain, domainsFromNotes } from "@/lib/clientDns";

/**
 * Give a hosting client DNS control of a domain they bought as a DOMAIN-ONLY
 * order (src/lib/domainOrders.ts), which has no row of its own.
 *
 * Founder-only and explicit, on purpose. Matching such orders to a client by
 * email automatically let anyone who typed a client's address at a hosting
 * checkout take over that client's DNS (adversarial review, 2026-10-02).
 * Here the founder names the row and the domain, and the order must be a
 * bought one whose Stripe customer email is the row's email.
 *
 * POST { id: hosting_clients.id, domain }
 */
export async function POST(req: NextRequest) {
  if (!sameOriginRequest(req.headers)) return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  const stripe = stripeFor(true);
  if (!db || !stripe) return NextResponse.json({ error: "Database or Stripe not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "").trim();
  const domain = normalizeDomain(String(body.domain ?? ""));
  if (!id || !domain) return NextResponse.json({ error: "id and a valid domain are required" }, { status: 400 });

  const { data: row, error } = await db
    .from("hosting_clients")
    .select("id, email, business, plan, status, notes, subscription_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return NextResponse.json({ error: "Hosting client not found" }, { status: 404 });
  const email = String(row.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "That client has no email on record" }, { status: 400 });
  if (domainsFromNotes(row.notes).includes(domain)) return NextResponse.json({ ok: true, already: true });

  const found = await stripe.customers.search({
    query: `metadata['servolia_domain']:'${domain}'`,
    limit: 10,
  });
  const order = found.data.find((c) => (c.metadata?.servolia_domain_status ?? "") === "bought");
  if (!order) return NextResponse.json({ error: `No bought domain-only order for ${domain}` }, { status: 404 });
  if ((order.email ?? "").trim().toLowerCase() !== email) {
    return NextResponse.json(
      { error: `${domain} was paid by ${order.email ?? "an unknown email"}, not by this client (${email}). Not linked.` },
      { status: 409 },
    );
  }

  const saveError = await saveNotes(row, writeLinkedDomain(row.notes, domain));
  if (saveError) return NextResponse.json({ error: `Not saved: ${saveError}` }, { status: 502 });
  return NextResponse.json({ ok: true, domain, client: row.business ?? email });
}
