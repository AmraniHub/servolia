import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { sendEmail, liveEmail } from "@/lib/email";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { id } = await params;
  const updates = await req.json();

  // Set timestamps automatically when status flips
  if (updates.status === "building" && !updates.started_at) updates.started_at = new Date().toISOString();
  if (updates.status === "delivered" && !updates.delivered_at) updates.delivered_at = new Date().toISOString();
  if (updates.status === "live" && !updates.live_at) updates.live_at = new Date().toISOString();

  // The go-live email fires on the TRANSITION to live, so it needs the prior
  // status — re-saving an already-live build must never re-send it.
  let wasLive = false;
  if (updates.status === "live") {
    const { data: prev } = await db.from("builds").select("status").eq("id", id).single();
    wasLive = prev?.status === "live";
  }

  const { data, error } = await db.from("builds").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // "Your system is live" — the moment the client actually paid for. Written
  // long ago (lib/email.ts liveEmail) but never wired; sent here, exactly once,
  // fire-and-forget: an email failure must never fail the status change.
  let liveEmailSent = false;
  if (updates.status === "live" && !wasLive && data?.email) {
    try {
      const { data: site } = await db
        .from("client_sites")
        .select("slug, config")
        .eq("build_id", id)
        .limit(1)
        .single();
      const cfg = (site?.config ?? {}) as { language?: string; contactName?: string };
      const url = site?.slug ? `https://servolia.com/sites/${site.slug}` : "https://servolia.com";
      const lang = cfg.language === "fr" ? "fr" as const : "en" as const;
      const firstName = (cfg.contactName || data.business || "").split(" ")[0] || data.business;
      const mail = liveEmail(firstName, url, lang);
      liveEmailSent = await sendEmail(data.email, mail.subject, mail.html);
    } catch {
      // logged by sendEmail; the build update already succeeded
    }
  }

  return NextResponse.json({ build: data, liveEmailSent });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { id } = await params;
  const { error } = await db.from("builds").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
