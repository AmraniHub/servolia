import { NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * A logged-in client's own lead history: every enquiry their AI receptionist
 * handled, plus this-month stats. This is the "your pipeline lives here" view.
 */

interface SessionRow {
  created_at: string;
  qualified: boolean | null;
  email_captured: string | null;
  phone_captured: string | null;
  messages: { role: string; content: string }[] | null;
  utm: Record<string, string> | null;
  site_slug: string;
}

export async function GET() {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ leads: [], stats: null });

  // The client's sites: builds by email → client_sites by build_id
  const { data: builds } = await db.from("builds").select("id").eq("email", email);
  const buildIds = (builds ?? []).map((b) => b.id);
  if (!buildIds.length) return NextResponse.json({ leads: [], stats: null });

  const { data: sites } = await db
    .from("client_sites").select("slug").in("build_id", buildIds);
  const slugs = (sites ?? []).map((s) => s.slug);
  if (!slugs.length) return NextResponse.json({ leads: [], stats: null });

  const { data } = await db
    .from("chat_sessions")
    .select("created_at, qualified, email_captured, phone_captured, messages, utm, site_slug")
    .in("site_slug", slugs)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data as SessionRow[] | null) ?? [];
  const leads = rows.map((r) => {
    const firstUser = (r.messages ?? []).find((m) => m.role === "user");
    return {
      created_at: r.created_at,
      qualified: !!r.qualified,
      contact: r.email_captured ?? r.phone_captured ?? null,
      excerpt: firstUser?.content?.slice(0, 120) ?? "",
      fromAds: !!(r.utm && /facebook|instagram|fb|ig|meta|google/i.test(`${r.utm.utm_source ?? ""} ${r.utm.utm_medium ?? ""}`)),
    };
  });

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const thisMonth = rows.filter((r) => new Date(r.created_at) >= monthStart);
  const stats = {
    monthEnquiries: thisMonth.length,
    monthBookings: thisMonth.filter((r) => r.qualified).length,
    monthContacts: thisMonth.filter((r) => r.email_captured || r.phone_captured).length,
  };

  return NextResponse.json({ leads, stats });
}
