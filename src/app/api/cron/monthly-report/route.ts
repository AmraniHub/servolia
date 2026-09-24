import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { testIds } from "@/lib/testContext";
import { listClientSites } from "@/lib/clientSites";
import { sendEmail, monthlyReportEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { reportMetrics, isFormRequest, type ReportSession } from "@/lib/reportMetrics";
import { writeReportNarrative, visitorQuestions } from "@/lib/reportNarrative";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Monthly client report — runs on the 1st, covers the previous month.
 * For every published client site: aggregate its chat sessions with
 * reportMetrics() (src/lib/reportMetrics.ts — the one definition shared with
 * her portal), store a snapshot in client_reports, and email her the number
 * that renews her: booking requests taken BY THE RECEPTIONIST, apart from
 * what her contact form collected (C4). A few sentences Claude writes from
 * her month and one idea for the next ride along in the same email; they
 * were a second email on the 5th until 2026-09-23 (Phase D).
 */

interface SessionRow extends ReportSession {
  session_id: string | null;
  messages: { role: string; content: string }[] | null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: "DB not configured" });

  // Previous calendar month
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const period = start.toISOString().slice(0, 7); // "2026-06"

  const sites = (await listClientSites()).filter((s) => s.status === "published");
  // Sites on a founder TEST build get no report (src/lib/testContext.ts).
  const testBuilds = await testIds(db, "builds");
  const results: { slug: string; sent: boolean; booked: number; conversations: number; forms: number }[] = [];

  for (const site of sites) {
    const { data } = await db
      .from("chat_sessions")
      .select("session_id, created_at, qualified, utm, messages")
      .eq("site_slug", site.slug)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    const sessions = (data as SessionRow[] | null) ?? [];

    // Who to email (the build's address, the one her portal login works
    // with) and what she pays (her active plan, for the cover line).
    let email = site.email ?? null;
    let planEur: number | null = null;
    const { data: siteRow } = await db
      .from("client_sites").select("build_id").eq("slug", site.slug).maybeSingle();
    if (siteRow?.build_id && testBuilds.has(siteRow.build_id)) continue;
    if (siteRow?.build_id) {
      const { data: build } = await db
        .from("builds").select("email").eq("id", siteRow.build_id).maybeSingle();
      if (build?.email) email = build.email;
      const { data: plan } = await db
        .from("clients").select("monthly_amount").eq("build_id", siteRow.build_id).eq("status", "active").limit(1);
      const amount = Number((plan as { monthly_amount?: number }[] | null)?.[0]?.monthly_amount);
      if (amount > 0) planEur = amount;
    }

    const metrics = reportMetrics(sessions, {
      timeZone: site.timezone,
      planEur,
      avgTreatmentValue: site.avgTreatmentValue,
      niche: site.niche,
    });

    let sent = false;
    if (email && metrics.enquiries > 0) {
      const periodLabel = start.toLocaleDateString(site.language === "fr" ? "fr-FR" : "en-GB", {
        month: "long", year: "numeric",
      });
      const narrative = await writeReportNarrative({
        businessName: site.businessName,
        niche: site.niche,
        language: site.language,
        conversations: metrics.conversations,
        receptionistBookings: metrics.receptionistBookings,
        questions: visitorQuestions(sessions.filter((s) => !isFormRequest(s))),
      });
      const tpl = monthlyReportEmail({
        businessName: site.businessName,
        period: periodLabel,
        lang: site.language,
        metrics,
        narrative,
      });
      sent = await sendEmail(email, tpl.subject, tpl.html);
    }

    await db.from("client_reports").upsert(
      { site_slug: site.slug, period, metrics, emailed_to: sent ? email : null, sent_at: sent ? new Date().toISOString() : null },
      { onConflict: "site_slug,period" },
    );

    results.push({ slug: site.slug, sent, booked: metrics.receptionistBookings, conversations: metrics.conversations, forms: metrics.formRequests });
  }

  const summary = results.map((r) =>
    `• ${r.slug}: ${r.booked} booked by the receptionist / ${r.conversations} conversations${r.forms ? `, ${r.forms} via the form` : ""}${r.sent ? " — report emailed ✅" : ""}`,
  ).join("\n");
  await sendTelegramMessage(`📊 *Monthly client reports — ${period}*\n${summary || "No published client sites yet."}`);

  return NextResponse.json({ ok: true, period, results });
}
