import { NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { excludeTest } from "@/lib/testContext";
import { founderTestBrowser } from "@/lib/testMode";

export const runtime = "nodejs";

/** A logged-in client's own monthly report history (the same numbers the monthly-report cron emails them). */
export async function GET() {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ reports: [] });

  // `is_test is not true`, except in the founder's own test-mode browser.
  const { data: builds } = await excludeTest(db, (live) => live(db.from("builds").select("id").eq("email", email)), { keepTest: await founderTestBrowser() });
  const buildIds = (builds ?? []).map((b) => b.id);
  if (!buildIds.length) return NextResponse.json({ reports: [] });

  const { data: sites } = await db.from("client_sites").select("slug").in("build_id", buildIds);
  const slugs = (sites ?? []).map((s) => s.slug);
  if (!slugs.length) return NextResponse.json({ reports: [] });

  const { data } = await db
    .from("client_reports")
    .select("period, metrics, sent_at")
    .in("site_slug", slugs)
    .order("period", { ascending: false })
    .limit(24);

  return NextResponse.json({ reports: data ?? [] });
}
