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
    let to = e.email;
    if (!to && e.buildId && db) {
      const { data } = await db.from("builds").select("email").eq("id", e.buildId).maybeSingle();
      to = (data as { email?: string | null } | null)?.email ?? null;
    }
    if (to) {
      const tpl = liveEmail(to.split("@")[0], `https://${e.domain}`, e.lang);
      await sendEmail(to, tpl.subject, tpl.html).catch(() => false);
    }
    await sendTelegramMessage(
      `LIVE on her own domain - ${e.business}\nhttps://${e.domain}\n${to ? `Go-live email sent to ${to}.` : "No address on file - tell her yourself."}`,
      undefined, { plain: true },
    ).catch(() => {});
  }
  if (out.errors.length) {
    await sendTelegramMessage(`Domain check hit errors\n${out.errors.map((x) => `- ${x}`).join("\n")}`, undefined, { plain: true }).catch(() => {});
  }
  return NextResponse.json({ ok: true, live: out.live.length, waiting: out.waiting.length, errors: out.errors.length });
}
