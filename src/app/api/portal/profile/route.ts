import { NextRequest, NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * A portal client's own profile: display name, phone, avatar, and their
 * explicit opt-in for marketing email.
 *
 * The opt-in is real consent — turning it on adds them to email_subscribers
 * with a consent timestamp; turning it off unsubscribes them. That keeps one
 * source of truth for who may be emailed (the broadcast tool reads the same
 * table), so a client can always take themselves back out.
 */

export async function GET() {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ profile: null });

  try {
    const { data } = await db.from("client_profiles").select("*").eq("email", email).maybeSingle();
    return NextResponse.json({ profile: data ?? { email, marketing_opt_in: false } });
  } catch {
    // Table not created yet — don't break the portal.
    return NextResponse.json({ profile: { email, marketing_opt_in: false }, missingTable: true });
  }
}

export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    displayName?: string; phone?: string; avatarUrl?: string; marketingOptIn?: boolean;
  };

  const row: Record<string, unknown> = { email };
  if (body.displayName !== undefined) row.display_name = String(body.displayName).trim().slice(0, 120) || null;
  if (body.phone !== undefined) row.phone = String(body.phone).trim().slice(0, 40) || null;
  if (body.avatarUrl !== undefined) row.avatar_url = String(body.avatarUrl).trim().slice(0, 500) || null;
  if (body.marketingOptIn !== undefined) {
    row.marketing_opt_in = !!body.marketingOptIn;
    row.opt_in_at = body.marketingOptIn ? new Date().toISOString() : null;
  }

  try {
    await db.from("client_profiles").upsert(row, { onConflict: "email" });
  } catch {
    return NextResponse.json({ error: "Could not save (is the client_profiles table created?)" }, { status: 500 });
  }

  // Keep the mailing list in sync with the client's own choice.
  if (body.marketingOptIn !== undefined) {
    try {
      if (body.marketingOptIn) {
        await db.from("email_subscribers").upsert({
          email,
          status: "active",
          consented_at: new Date().toISOString(),
          unsubscribed_at: null,
          source: "portal",
        }, { onConflict: "email" });
      } else {
        await db.from("email_subscribers")
          .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
          .eq("email", email);
      }
    } catch { /* list sync is best-effort — the profile save already succeeded */ }
  }

  return NextResponse.json({ ok: true });
}
