import { NextRequest, NextResponse } from "next/server";
import { backfillSiteUrls } from "@/lib/hostingRow";

export const runtime = "nodejs";

/**
 * Fill in any blank `hosting_clients.site_url` from the address the client's
 * reference already carries. Auth: Bearer CRON_SECRET, same as every cron.
 *
 * WHY THIS IS ITS OWN ROUTE AND NOT JUST A LINE IN THE DAILY PASS (it is
 * both). The daily pass also chases overdue invoices, ends assistant trials
 * and emails clients about all of it. Running that by hand to fill in a URL
 * would send real mail to real people at whatever hour someone pressed the
 * button — a destructive way to do a harmless thing.
 *
 * So this does ONE thing and sends nothing: it writes a single column, only
 * where it is empty, and reports what it touched. Safe to run at any time and
 * safe to run twice, which is what makes it safe to hand to a button.
 *
 * It exists because the secrets that can write this column — ADMIN_PASSWORD,
 * SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET — are all sensitive in Vercel and
 * cannot be read back onto a laptop. The write has to happen where they live.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const out = await backfillSiteUrls();
  return NextResponse.json({
    ok: out.errors.length === 0,
    filled: out.filled,
    count: out.filled.length,
    errors: out.errors,
  });
}
