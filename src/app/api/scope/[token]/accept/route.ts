import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * The actual "signature" moment. Public (token-secured, no login) — a lead
 * isn't a portal user yet at this stage of the sales flow. Records a simple
 * electronic signature: typed name + timestamp + IP + user agent. Idempotent
 * — re-accepting an already-accepted link just returns the original record
 * rather than overwriting evidence of the first acceptance.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const typedName = name?.trim();
  if (!typedName) return NextResponse.json({ error: "Your name is required" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data: existing } = await db.from("scope_acceptances").select("*").eq("token", token).maybeSingle();
  if (!existing) return NextResponse.json({ error: "This link is invalid or has expired" }, { status: 404 });

  if (existing.accepted_at) {
    return NextResponse.json({ ok: true, planKey: existing.plan_key, leadId: existing.lead_id, alreadyAccepted: true });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  const { error } = await db.from("scope_acceptances")
    .update({ accepted_at: new Date().toISOString(), accepted_name: typedName, accepted_ip: ip, accepted_user_agent: userAgent })
    .eq("token", token).is("accepted_at", null); // guard against a race between two near-simultaneous accepts
  if (error) return NextResponse.json({ error: "Failed to record acceptance" }, { status: 500 });

  if (existing.lead_id) {
    await db.from("lead_activities").insert({
      lead_id: existing.lead_id,
      type: "note",
      description: `✅ Scope accepted online by "${typedName}" (${ip}) — ${existing.business_name}`,
    });

    // Accepting the scope is a strong buying signal — advance the pipeline,
    // but never move a lead backward (e.g. one that's already paid a deposit).
    const { data: lead } = await db.from("leads").select("stage").eq("id", existing.lead_id).maybeSingle();
    if (lead && ["new", "audit_sent"].includes(lead.stage)) {
      await db.from("leads").update({ stage: "qualified" }).eq("id", existing.lead_id);
    }
  }

  return NextResponse.json({ ok: true, planKey: existing.plan_key, leadId: existing.lead_id, alreadyAccepted: false });
}
