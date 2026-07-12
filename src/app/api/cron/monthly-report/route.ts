import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listClientSites } from "@/lib/clientSites";
import { sendEmail, monthlyReportEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Monthly client ROI report — runs on the 1st, covers the previous month.
 * For every published client site: aggregate its chat sessions, store a
 * snapshot in client_reports, and email the client their numbers.
 */

interface SessionRow {
  created_at: string;
  qualified: boolean | null;
  utm: Record<string, string> | null;
}

const AD_SOURCES = /facebook|instagram|fb|ig|meta|google|adwords|tiktok/i;

// Fallback avg € per new client when the site config doesn't specify one.
const NICHE_VALUE: Record<string, number> = {
  dental: 800, aesthetic: 450, "med-spa": 450, "hair-transplant": 2500,
  "real-estate": 3000, "home-services": 600, "law-firm": 2000,
};

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
  const results: { slug: string; sent: boolean; enquiries: number }[] = [];

  for (const site of sites) {
    const { data } = await db
      .from("chat_sessions")
      .select("created_at, qualified, utm")
      .eq("site_slug", site.slug)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

    const sessions = (data as SessionRow[] | null) ?? [];
    const enquiries = sessions.length;
    const bookings = sessions.filter((s) => s.qualified).length;
    const afterHours = sessions.filter((s) => {
      const h = new Date(s.created_at).getUTCHours() + 1; // ~CET
      return h < 9 || h >= 19;
    }).length;
    const fromAds = sessions.filter((s) => {
      const src = `${s.utm?.utm_source ?? ""} ${s.utm?.utm_medium ?? ""}`;
      return AD_SOURCES.test(src);
    }).length;

    const perClient = site.avgTreatmentValue ?? NICHE_VALUE[site.niche] ?? 500;
    const estValue = bookings * perClient;

    const metrics = { enquiries, bookings, afterHours, fromAds, estValue, perClient };

    // Find who to email: the client site's build → email
    let email = site.email ?? null;
    const { data: siteRow } = await db
      .from("client_sites").select("build_id").eq("slug", site.slug).maybeSingle();
    if (siteRow?.build_id) {
      const { data: build } = await db
        .from("builds").select("email").eq("id", siteRow.build_id).maybeSingle();
      if (build?.email) email = build.email;
    }

    let sent = false;
    if (email && enquiries > 0) {
      const periodLabel = start.toLocaleDateString(site.language === "fr" ? "fr-FR" : "en-GB", {
        month: "long", year: "numeric",
      });
      const tpl = monthlyReportEmail({
        businessName: site.businessName,
        period: periodLabel,
        lang: site.language,
        enquiries, bookings, afterHours, fromAds, estValue,
      });
      sent = await sendEmail(email, tpl.subject, tpl.html);
    }

    await db.from("client_reports").upsert(
      { site_slug: site.slug, period, metrics, emailed_to: sent ? email : null, sent_at: sent ? new Date().toISOString() : null },
      { onConflict: "site_slug,period" },
    );

    results.push({ slug: site.slug, sent, enquiries });
  }

  const summary = results.map((r) => `• ${r.slug}: ${r.enquiries} enquiries${r.sent ? " — report emailed ✅" : ""}`).join("\n");
  await sendTelegramMessage(`📊 *Monthly client reports — ${period}*\n${summary || "No published client sites yet."}`);

  return NextResponse.json({ ok: true, period, results });
}
