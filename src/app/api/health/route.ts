import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public system health check — booleans only, never values.
 * Answers: is every critical subsystem wired in this deployment?
 */
export async function GET() {
  const env = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    stripeLiveMode: (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_"),
    cronSecret: !!process.env.CRON_SECRET,
    telegram: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,
    ga4DataApi: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!process.env.GA4_PROPERTY_ID,
    metaCapi: !!process.env.META_CAPI_ACCESS_TOKEN,
    // Without Resend, ALL outbound email silently no-ops: audit confirmations,
    // Stripe receipts, portal magic-link login, 48h follow-ups, client reports.
    resend: !!process.env.RESEND_API_KEY,
  };

  // Table existence checks — a select that fails means "not migrated yet".
  const tables: Record<string, boolean> = {};
  const db = supabaseAdmin();
  if (db) {
    for (const t of ["leads", "builds", "clients", "chat_sessions", "blog_posts", "linkedin_drafts", "client_sites"]) {
      const { error } = await db.from(t).select("id", { count: "exact", head: true }).limit(1);
      tables[t] = !error;
    }
  }

  const ok = env.anthropic && env.supabase && env.stripe && (tables.leads ?? false);
  return NextResponse.json({ ok, env, tables }, { status: ok ? 200 : 503 });
}
