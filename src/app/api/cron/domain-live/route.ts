import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkPendingDomains } from "@/lib/siteDomain";
import { sendEmail, liveEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * THE GO-LIVE EMAIL, SENT WHEN IT IS TRUE (C2).
 *
 * Every quarter hour: each published site whose own domain is attached but
 * not yet live is fetched over HTTPS at that domain. The first time it serves
 * the site (DNS pointed, certificate issued, proxy routing), the row is
 * stamped and the client gets the go-live email with HER address in it — not
 * servolia.com/sites/<slug>, and not before her DNS answers. The stamp comes
 * first, so a crash between the two costs an email, never a second one.
 *
 * Scheduled in vercel.json. Auth: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const out = await checkPendingDomains();
  const db = supabaseAdmin();

  for (const e of out.live) {
    if (!e.announce) {
      // The same domain, detached and re-attached: announced before, not again.
      await sendTelegramMessage(`Back live on her own domain - ${e.business}\nhttps://${e.domain}\n(announced before - no email this time)`, undefined, { plain: true, silent: true }).catch(() => {});
      continue;
    }
    /* The ACCOUNT holder first: the address her portal login works with
       (builds.email). The site's contact address (config.email) is often a
       reception desk inbox, and the email tells her to sign in with the
       address it arrived at (review, 2026-09-22). */
    let to: string | null = null;
    if (e.buildId && db) {
      const { data } = await db.from("builds").select("email").eq("id", e.buildId).maybeSingle();
      to = (data as { email?: string | null } | null)?.email ?? null;
    }
    to = to || e.contactEmail;
    let sent = false;
    if (to) {
      const greet = e.business.split(" ")[0] || to.split("@")[0];
      const tpl = liveEmail(greet, `https://${e.domain}`, e.lang);
      sent = await sendEmail(to, tpl.subject, tpl.html).catch(() => false);
    }
    await sendTelegramMessage(
      `LIVE on her own domain - ${e.business}\nhttps://${e.domain}\n` +
      (sent ? `Go-live email sent to ${to}.` : to ? `Go-live email to ${to} FAILED - tell her yourself.` : "No address on file - tell her yourself."),
      undefined, { plain: true },
    ).catch(() => {});
  }
  if (out.errors.length) {
    await sendTelegramMessage(`Domain check hit errors\n${out.errors.map((x) => `- ${x}`).join("\n")}`, undefined, { plain: true }).catch(() => {});
  }
  return NextResponse.json({ ok: true, live: out.live.length, waiting: out.waiting.length, errors: out.errors.length });
}
