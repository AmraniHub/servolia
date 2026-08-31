import { NextRequest, NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { pushConfigured } from "@/lib/push";

export const runtime = "nodejs";

/**
 * Register or drop this device for push.
 *
 * The email comes from the SIGNED SESSION COOKIE, never the request body. That
 * is the whole security model here: if the client could name the account, one
 * person could subscribe to another clinic's patient enquiries — which is both
 * a data breach and, for a dental practice, a confidentiality problem.
 *
 * GET    → whether push is available and whether this device is registered
 * POST   → { subscription } from PushManager.subscribe()
 * DELETE → { endpoint } to unregister this device only
 */

interface BrowserSubscription {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function GET() {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  return NextResponse.json({
    available: pushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? null,
  });
}

export async function POST(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Push is not configured on this deployment" }, { status: 503 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });

  const { subscription } = (await req.json().catch(() => ({}))) as {
    subscription?: BrowserSubscription;
  };
  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Incomplete subscription" }, { status: 400 });
  }

  // Upsert on (email, endpoint): re-subscribing the same device refreshes its
  // keys rather than piling up rows that would each fire a duplicate buzz.
  const { error } = await db.from("push_subscriptions").upsert(
    {
      email: email.toLowerCase().trim(),
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    },
    { onConflict: "email,endpoint" },
  );

  if (error) {
    const missing = /relation .* does not exist|could not find the table/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? "Push storage not set up — run section 9 of supabase/pending-migration.sql."
          : error.message,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });

  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "No endpoint" }, { status: 400 });

  // Scoped to this account AND this endpoint — unsubscribing one device must
  // not silently unsubscribe the client's other devices, or anyone else's.
  await db
    .from("push_subscriptions")
    .delete()
    .eq("email", email.toLowerCase().trim())
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
