import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveHostingPlan, isAddOn, hostingAmountCents } from "@/lib/hosting";

/**
 * List a hosting client BEFORE they pay: one row with status `awaiting_payment`.
 *
 * Why it exists (2026-10-01, Solyra Academy): the checkout link deliberately
 * writes nothing, so a site the founder has agreed to host was invisible on
 * /admin/hosting until the client paid — and "I sent a link" is easy to lose.
 *
 * Why it is safe:
 *  - Nothing counts it. The page's MRR and "paid, not hosted yet" read
 *    status === "active" only.
 *  - Nothing acts on it. Every cron (dunning, domain billing, setup rechecks)
 *    reads status in (active, past_due).
 *  - The payment COMPLETES it rather than duplicating it: the Stripe webhook
 *    looks for a row with the same email, the same plan and no subscription
 *    before inserting (webhooks/stripe "A row created by hand before the
 *    payment"), and sets status active.
 *
 * Refuses a second awaiting row for the same email + plan: the webhook takes
 * the newest, and two would leave one stranded forever.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const business = (body.business ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const plan = (body.plan ?? "hosting").trim();
  const period: "monthly" | "annual" = body.period === "monthly" ? "monthly" : "annual";

  if (!business || !email.includes("@")) {
    return NextResponse.json({ error: "business and a valid email are required" }, { status: 400 });
  }
  const product = resolveHostingPlan(plan);
  if (!product || isAddOn(product.key)) {
    return NextResponse.json({ error: `Not a hosting tier: ${plan}` }, { status: 400 });
  }

  const { data: existing, error: readErr } = await db
    .from("hosting_clients")
    .select("id")
    .ilike("email", email)
    .eq("plan", product.key)
    .is("subscription_id", null)
    .limit(1);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (existing?.length) {
    return NextResponse.json({ error: "Already listed as awaiting payment", id: existing[0].id }, { status: 409 });
  }

  // Same figure the webhook stores: annual rows hold the monthly equivalent.
  const planUsd = hostingAmountCents(product, period) / 100;
  const monthlyUsd = period === "annual" ? planUsd / 12 : planUsd;
  const opt = (k: string) => (body[k] ?? "").trim() || null;

  const { data, error } = await db
    .from("hosting_clients")
    .insert({
      business,
      contact_name: opt("contactName"),
      email,
      site_url: opt("siteUrl"),
      repo: opt("repo"),
      branch: opt("branch") ?? "main",
      site_root: opt("siteRoot"),
      vercel_project: opt("vercelProject"),
      plan: product.key,
      monthly_usd: monthlyUsd,
      billing_period: period,
      status: "awaiting_payment",
      notes: `Listed before payment on ${new Date().toISOString().slice(0, 10)}; the payment link completes this row.`,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
