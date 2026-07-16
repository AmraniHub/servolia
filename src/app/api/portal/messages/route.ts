import { NextRequest, NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET() {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ messages: [] });

  const { data } = await db
    .from("client_messages")
    .select("id, sender, body, created_at, attachment_url, attachment_type")
    .eq("email", email)
    .is("deleted_by_client_at", null)
    .order("created_at", { ascending: true });

  // Mark admin replies as read now that the client has opened the thread.
  db.from("client_messages").update({ read_by_client: true }).eq("email", email).eq("sender", "admin").then(() => {});

  return NextResponse.json({ messages: data ?? [] });
}

/** Delete this conversation — clears it from the client's own portal view only. The admin's CRM is untouched. */
export async function DELETE() {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { error } = await db.from("client_messages")
    .update({ deleted_by_client_at: new Date().toISOString() })
    .eq("email", email).is("deleted_by_client_at", null);
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { body, attachmentUrl, attachmentType } = (await req.json().catch(() => ({}))) as {
    body?: string; attachmentUrl?: string; attachmentType?: string;
  };
  const text = body?.trim() ?? "";
  if (!text && !attachmentUrl) return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  // Tie the message to their most recent build, if they have one, for context in the CRM.
  const { data: build } = await db
    .from("builds")
    .select("id, business")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: inserted, error } = await db
    .from("client_messages")
    .insert({
      email, build_id: build?.id ?? null, sender: "client", body: text,
      attachment_url: attachmentUrl ?? null, attachment_type: attachmentType ?? null,
    })
    .select("id, sender, body, created_at, attachment_url, attachment_type")
    .single();

  if (error) return NextResponse.json({ error: "Failed to send" }, { status: 500 });

  const { data: pref } = await db.from("chat_notification_prefs").select("telegram_muted").eq("email", email).maybeSingle();
  if (!pref?.telegram_muted) {
    const preview = text || "📷 Sent a photo";
    const msg =
      `💬 *New portal message*\n` +
      `${build?.business ? `*${build.business}*` : email}\n` +
      `📧 ${email}\n\n` +
      `"${preview.slice(0, 300)}"` +
      (build?.id ? `\n\n[Open build in CRM](https://servolia.com/admin/builds/${build.id})` : "");
    sendTelegramMessage(msg);
  }

  return NextResponse.json({ ok: true, message: inserted });
}
