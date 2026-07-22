import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Personalized/extra work a client asks for beyond their plan.
 *
 * Records the ask (data) AND creates a one-off Stripe payment link for it, so
 * custom demands never end up as unbilled favours or untracked scope. The
 * Stripe webhook flips status → "paid" when the client pays.
 *
 * Admin-only. Needs the `custom_requests` table (supabase/schema.sql).
 */

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ requests: [] });

  const buildId = req.nextUrl.searchParams.get("buildId");
  try {
    let q = db.from("custom_requests").select("*").order("created_at", { ascending: false });
    if (buildId) q = q.eq("build_id", buildId);
    const { data } = await q;
    return NextResponse.json({ requests: data ?? [] });
  } catch {
    // Table not created yet — don't break the admin page.
    return NextResponse.json({ requests: [], missingTable: true });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { buildId, title, description, amountEur } = (await req.json().catch(() => ({}))) as {
    buildId?: string; title?: string; description?: string; amountEur?: number;
  };
  if (!buildId || !title?.trim()) {
    return NextResponse.json({ error: "buildId and title are required" }, { status: 400 });
  }
  const amount = Math.max(0, Math.round(Number(amountEur) || 0));

  const { data: build } = await db.from("builds").select("id, business, email").eq("id", buildId).maybeSingle();
  if (!build) return NextResponse.json({ error: "Build not found" }, { status: 404 });

  // 1. Record the ask first — the data matters even if payment isn't set up.
  const { data: row, error } = await db.from("custom_requests").insert({
    build_id: buildId,
    email: build.email ?? null,
    title: title.trim().slice(0, 200),
    description: (description ?? "").trim().slice(0, 4000) || null,
    amount_eur: amount,
    status: "quoted",
  }).select("*").single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Could not save (is the custom_requests table created?)" }, { status: 500 });
  }

  // 2. Create a one-off payment link so it can be billed immediately.
  let paymentUrl: string | null = null;
  const key = process.env.STRIPE_SECRET_KEY;
  if (key && amount > 0) {
    try {
      const stripe = new Stripe(key);
      const origin = req.headers.get("origin") ?? "https://servolia.com";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: build.email ?? undefined,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: `${title.trim().slice(0, 120)} — ${build.business}`,
              description: (description ?? "Custom work").trim().slice(0, 300) || undefined,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        }],
        success_url: `${origin}/portal?custom=paid`,
        cancel_url: `${origin}/portal`,
        metadata: { kind: "custom_request", requestId: row.id, buildId },
      });
      paymentUrl = session.url ?? null;
      await db.from("custom_requests")
        .update({ checkout_session_id: session.id, payment_url: paymentUrl })
        .eq("id", row.id);
    } catch (err) {
      console.error("Custom request payment link failed:", err);
      // The request is still recorded — the link can be regenerated later.
    }
  }

  return NextResponse.json({ request: { ...row, payment_url: paymentUrl } });
}

/** Mark a request done (or back to quoted). */
export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!id || !["quoted", "paid", "done"].includes(status ?? "")) {
    return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
  }
  await db.from("custom_requests")
    .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
