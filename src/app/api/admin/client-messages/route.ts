import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, newPortalMessageEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ messages: [] });

  const { data } = await db
    .from("client_messages")
    .select("id, sender, body, created_at")
    .eq("email", email)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, buildId, body } = (await req.json().catch(() => ({}))) as { email?: string; buildId?: string; body?: string };
  const text = body?.trim();
  if (!email || !text) return NextResponse.json({ error: "email and body required" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data: inserted, error } = await db
    .from("client_messages")
    .insert({ email, build_id: buildId ?? null, sender: "admin", body: text })
    .select("id, sender, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Failed to send" }, { status: 500 });

  const firstName = email.split("@")[0];
  sendEmail(email, newPortalMessageEmail(firstName, text).subject, newPortalMessageEmail(firstName, text).html).catch(() => {});

  return NextResponse.json({ ok: true, message: inserted });
}
