import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { unsubscribeFooterHtml } from "@/lib/unsubscribe";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Send a broadcast from the admin to a chosen audience.
 *
 * Safety rails baked in, because this is outward-facing and irreversible:
 *   - Admin-only, and the admin triggers it explicitly from the UI.
 *   - Anyone unsubscribed is always skipped, whatever the audience.
 *   - Every email gets a signed one-click unsubscribe footer (GDPR).
 *   - Recipients are de-duplicated.
 *   - Capped per request so a slip can't blast a huge list in one click.
 *   - "test" mode sends only to you, so you always preview the real thing.
 */

const MAX_PER_SEND = 300;
const CONCURRENCY = 4;

type Audience = "subscribers" | "leads";

/** GET → how many people a given audience would reach right now. */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ counts: { subscribers: 0, leads: 0 } });

  const counts = { subscribers: 0, leads: 0 };
  try {
    const { data: subs } = await db.from("email_subscribers").select("email").eq("status", "active");
    counts.subscribers = (subs ?? []).length;
  } catch { /* table may be missing */ }
  try {
    const { data: leads } = await db.from("leads").select("email").not("email", "is", null);
    counts.leads = new Set((leads ?? []).map((l: { email: string }) => l.email?.toLowerCase()).filter(Boolean)).size;
  } catch { /* ignore */ }

  return NextResponse.json({ counts, cap: MAX_PER_SEND });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { audience, subject, bodyHtml, test, testTo } = (await req.json().catch(() => ({}))) as {
    audience?: Audience; subject?: string; bodyHtml?: string; test?: boolean; testTo?: string;
  };

  if (!subject?.trim() || !bodyHtml?.trim()) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }
  const origin = req.headers.get("origin") ?? "https://servolia.com";

  // ── Test send: only ever to the single address you type. ───────────────
  if (test) {
    const to = (testTo ?? "").trim();
    if (!to) return NextResponse.json({ error: "Enter an address to send the test to" }, { status: 400 });
    const html = bodyHtml + unsubscribeFooterHtml(to, origin);
    const ok = await sendEmail(to, `[TEST] ${subject}`, html);
    return NextResponse.json({ ok, test: true, sent: ok ? 1 : 0 });
  }

  // ── Build the recipient list ───────────────────────────────────────────
  let recipients: string[] = [];
  try {
    if (audience === "leads") {
      const { data } = await db.from("leads").select("email").not("email", "is", null);
      recipients = (data ?? []).map((l: { email: string }) => l.email);
    } else {
      const { data } = await db.from("email_subscribers").select("email").eq("status", "active");
      recipients = (data ?? []).map((s: { email: string }) => s.email);
    }
  } catch {
    return NextResponse.json({ error: "Could not read the audience list" }, { status: 500 });
  }

  // Normalise + de-duplicate.
  const seen = new Set<string>();
  recipients = recipients
    .map((e) => (e ?? "").trim().toLowerCase())
    .filter((e) => /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(e))
    .filter((e) => (seen.has(e) ? false : (seen.add(e), true)));

  // Always exclude anyone who opted out — even if they're in the leads table.
  let skipped = 0;
  try {
    const { data: optedOut } = await db
      .from("email_subscribers").select("email").neq("status", "active");
    const blocked = new Set((optedOut ?? []).map((s: { email: string }) => s.email?.toLowerCase()));
    const before = recipients.length;
    recipients = recipients.filter((e) => !blocked.has(e));
    skipped = before - recipients.length;
  } catch { /* if the table is missing, nothing to exclude */ }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No reachable recipients in that audience", skipped }, { status: 400 });
  }
  const capped = recipients.length > MAX_PER_SEND;
  const batch = recipients.slice(0, MAX_PER_SEND);

  // ── Send, a few at a time, each with its own unsubscribe link ─────────
  let sent = 0, failed = 0;
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map((to) => sendEmail(to, subject, bodyHtml + unsubscribeFooterHtml(to, origin)).catch(() => false))
    );
    results.forEach((ok) => (ok ? sent++ : failed++));
  }

  try {
    await db.from("email_campaigns").insert({
      subject, body_html: bodyHtml, audience: audience ?? "subscribers",
      sent_count: sent, failed_count: failed, skipped_count: skipped,
    });
  } catch { /* history table may not exist yet — the send still happened */ }

  return NextResponse.json({
    ok: true, sent, failed, skipped,
    remaining: capped ? recipients.length - batch.length : 0,
  });
}
