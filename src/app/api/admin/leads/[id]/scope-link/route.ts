import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateScopeDocument } from "@/lib/scopeDocument";
import { BUILD_PLANS, CARE_PLANS } from "@/lib/pricing";

export const runtime = "nodejs";

/** Creates a shareable, token-secured acceptance link for a lead's scope document. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  const { businessName, contactName, email, planKey, carePlanKey } = (await req.json().catch(() => ({}))) as {
    businessName?: string; contactName?: string | null; email?: string | null;
    planKey?: keyof typeof BUILD_PLANS; carePlanKey?: keyof typeof CARE_PLANS | null;
  };
  if (!businessName || !planKey || !(planKey in BUILD_PLANS)) {
    return NextResponse.json({ error: "businessName and a valid planKey are required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const token = randomUUID();
  const scopeText = generateScopeDocument({ businessName, contactName, email, planKey, carePlanKey, forWeb: true });

  const { error } = await db.from("scope_acceptances").insert({
    lead_id: leadId,
    token,
    business_name: businessName,
    contact_name: contactName ?? null,
    email: email ?? null,
    plan_key: planKey,
    care_plan_key: carePlanKey ?? null,
    scope_text: scopeText,
  });
  if (error) return NextResponse.json({ error: "Failed to create link" }, { status: 500 });

  const origin = req.headers.get("origin") ?? "https://servolia.com";
  return NextResponse.json({ url: `${origin}/scope/${token}` });
}
