import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, newPortalMessageEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  // Trash preview lets the admin see everything (incl. what they deleted) before restoring.
  const includeDeleted = req.nextUrl.searchParams.get("includeDeleted") === "1";

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ messages: [] });

  let query = db
    .from("client_messages")
    .select("id, sender, body, created_at, deleted_by_admin_at, deleted_by_client_at, attachment_url, attachment_type")
    .eq("email", email)
    .order("created_at", { ascending: true });
  if (!includeDeleted) query = query.is("deleted_by_admin_at", null);
  const { data } = await query;

  // Mark this client's messages as read now that the admin has opened the thread.
  db.from("client_messages").update({ read_by_admin: true })
    .eq("email", email).eq("sender", "client").then(() => {});

  return NextResponse.json({ messages: data ?? [] });
}

/** Delete a chat — soft-delete, admin's own view only. The client's portal is untouched. */
export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { error } = await db.from("client_messages")
    .update({ deleted_by_admin_at: new Date().toISOString() })
    .eq("email", email).is("deleted_by_admin_at", null);
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, buildId, body, attachmentUrl, attachmentType, notify } = (await req.json().catch(() => ({}))) as {
    email?: string; buildId?: string; body?: string; attachmentUrl?: string; attachmentType?: string; notify?: boolean;
  };
  const text = body?.trim() ?? "";
  if (!email || (!text && !attachmentUrl)) return NextResponse.json({ error: "email and (body or image) required" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { data: inserted, error } = await db
    .from("client_messages")
    .insert({
      email, build_id: buildId ?? null, sender: "admin", body: text,
      attachment_url: attachmentUrl ?? null, attachment_type: attachmentType ?? null,
    })
    .select("id, sender, body, created_at, attachment_url, attachment_type")
    .single();

  if (error) return NextResponse.json({ error: "Failed to send" }, { status: 500 });

  // Email notification is opt-out per message — the admin toggles it off for
  // quick back-and-forth chat to avoid burning Resend credits on every reply.
  if (notify !== false) {
    const firstName = email.split("@")[0];
    const preview = text || "📷 Sent a photo";
    sendEmail(email, newPortalMessageEmail(firstName, preview).subject, newPortalMessageEmail(firstName, preview).html).catch(() => {});
  }

  return NextResponse.json({ ok: true, message: inserted });
}
