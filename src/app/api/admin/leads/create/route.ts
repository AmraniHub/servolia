import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, estimateLeadValue } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

/**
 * Manually create a lead from the CRM (e.g. cold email reply, referral).
 */
export async function POST(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const body = await req.json();
  const valueEstimate = estimateLeadValue(body.niche, body.plan_interest);

  const { data, error } = await db.from("leads").insert({
    name:          body.name || null,
    email:         body.email || null,
    phone:         body.phone || null,
    business:      body.business || null,
    website:       body.website || null,
    country:       body.country || null,
    city:          body.city || null,
    niche:         body.niche || null,
    plan_interest: body.plan_interest || null,
    notes:         body.notes || null,
    source:        body.source || "cold-email",
    stage:         body.stage || "new",
    value_estimate: valueEstimate,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("lead_activities").insert({
    lead_id: data.id,
    type: "created",
    description: `Manually added via CRM (${body.source ?? "cold-email"})`,
  });

  return NextResponse.json({ lead_id: data.id });
}
