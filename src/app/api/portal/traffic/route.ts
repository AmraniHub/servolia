import { NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchTraffic, summarize } from "@/lib/traffic";

export const runtime = "nodejs";

/**
 * A logged-in client's own website traffic — the same page_views rows the admin
 * Traffic page reads, but scoped to the sites that belong to this client.
 *
 * It also returns the enquiry count for the window so the portal can show the
 * real funnel (visitors → enquiries), which is the number that actually tells
 * them whether the site is working.
 */
export async function GET(req: Request) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ traffic: null });

  const url = new URL(req.url);
  const days = [7, 30, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;

  // Same ownership chain the leads route uses: builds by email → client_sites.
  const { data: builds } = await db.from("builds").select("id").eq("email", email);
  const buildIds = (builds ?? []).map((b) => b.id);
  if (!buildIds.length) return NextResponse.json({ traffic: null, days });

  const { data: sites } = await db.from("client_sites").select("slug").in("build_id", buildIds);
  const slugs = (sites ?? []).map((s) => s.slug);
  if (!slugs.length) return NextResponse.json({ traffic: null, days });

  try {
    const { current, previous } = await fetchTraffic(db, { days, slugs });
    const traffic = summarize(current, days, previous);

    // Enquiries in the same window, so visitors → enquiries is an honest ratio.
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { data: chats } = await db
      .from("chat_sessions")
      .select("qualified")
      .in("site_slug", slugs)
      .gte("created_at", cutoff);
    const rows = (chats as { qualified: boolean | null }[] | null) ?? [];

    return NextResponse.json({
      traffic,
      days,
      enquiries: rows.length,
      bookings: rows.filter((r) => r.qualified).length,
    });
  } catch {
    // page_views table not created yet — the tab shows its empty state.
    return NextResponse.json({ traffic: null, days });
  }
}
