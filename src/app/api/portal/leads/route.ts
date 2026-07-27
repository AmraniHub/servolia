import { NextRequest, NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * A logged-in client's own lead history: every enquiry their AI receptionist
 * handled, plus this-month stats. This is the "your pipeline lives here" view.
 * PATCH lets the client work the pipeline: status + a private note per lead
 * (the "Lead pipeline with statuses / Client notes & history" promises).
 */

interface SessionRow {
  id: string;
  created_at: string;
  qualified: boolean | null;
  email_captured: string | null;
  phone_captured: string | null;
  messages: { role: string; content: string }[] | null;
  utm: Record<string, string> | null;
  site_slug: string;
  client_status?: string | null;
  client_note?: string | null;
}

const LEAD_STATUSES = ["new", "contacted", "booked", "won", "lost"] as const;

/** The slugs this logged-in client owns — the authorization boundary for PATCH. */
async function ownedSlugs(email: string): Promise<string[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data: builds } = await db.from("builds").select("id").eq("email", email);
  const buildIds = (builds ?? []).map((b) => b.id);
  if (!buildIds.length) return [];
  const { data: sites } = await db.from("client_sites").select("slug").in("build_id", buildIds);
  return (sites ?? []).map((s) => s.slug);
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

  // client_status / client_note may not exist until the pipeline SQL block
  // runs — fall back to the legacy column list so the portal never breaks.
  let rows: SessionRow[] = [];
  {
    const full = await db
      .from("chat_sessions")
      .select("id, created_at, qualified, email_captured, phone_captured, messages, utm, site_slug, client_status, client_note")
      .in("site_slug", slugs)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!full.error) rows = (full.data as SessionRow[] | null) ?? [];
    else {
      const legacy = await db
        .from("chat_sessions")
        .select("id, created_at, qualified, email_captured, phone_captured, messages, utm, site_slug")
        .in("site_slug", slugs)
        .order("created_at", { ascending: false })
        .limit(100);
      rows = (legacy.data as SessionRow[] | null) ?? [];
    }
  }

  const leads = rows.map((r) => {
    const firstUser = (r.messages ?? []).find((m) => m.role === "user");
    return {
      id: r.id,
      created_at: r.created_at,
      qualified: !!r.qualified,
      contact: r.email_captured ?? r.phone_captured ?? null,
      excerpt: firstUser?.content?.slice(0, 120) ?? "",
      fromAds: !!(r.utm && /facebook|instagram|fb|ig|meta|google/i.test(`${r.utm.utm_source ?? ""} ${r.utm.utm_medium ?? ""}`)),
      status: r.client_status ?? "new",
      note: r.client_note ?? "",
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

  // Lifetime totals — the retention number. When a client wonders whether the
  // plan is worth it, this is what answers them. Deliberately unbounded (the
  // list above is capped at 100) and kept light: two columns only.
  let lifetime: { enquiries: number; bookings: number; afterHours: number; since: string | null } | null = null;
  try {
    const { data: all } = await db
      .from("chat_sessions")
      .select("created_at, qualified")
      .in("site_slug", slugs);
    const every = (all as { created_at: string; qualified: boolean | null }[] | null) ?? [];
    if (every.length) {
      // "After hours" = outside 08:00–19:00, or any time at the weekend.
      const afterHours = every.filter((r) => {
        const d = new Date(r.created_at);
        const h = d.getHours(), day = d.getDay();
        return h < 8 || h >= 19 || day === 0 || day === 6;
      }).length;
      const since = every.reduce<string | null>(
        (min, r) => (!min || r.created_at < min ? r.created_at : min), null
      );
      lifetime = {
        enquiries: every.length,
        bookings: every.filter((r) => r.qualified).length,
        afterHours,
        since,
      };
    }
  } catch { /* keep the dashboard working even if this fails */ }

  return NextResponse.json({ leads, stats, lifetime });
}

/** Client works their pipeline: PATCH { id, status?, note? }. Scoped to their own sites. */
export async function PATCH(req: NextRequest) {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { id, status, note } = (await req.json().catch(() => ({}))) as { id?: string; status?: string; note?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.client_status = status;
  }
  if (note !== undefined) update.client_note = String(note).slice(0, 1000);
  if (!Object.keys(update).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  // Authorization boundary: the lead must belong to one of THIS client's sites.
  const slugs = await ownedSlugs(email);
  if (!slugs.length) return NextResponse.json({ error: "No sites" }, { status: 403 });

  const { error } = await db.from("chat_sessions").update(update).eq("id", id).in("site_slug", slugs);
  if (error) return NextResponse.json({ error: "Update failed — has the pipeline SQL block been run?" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
