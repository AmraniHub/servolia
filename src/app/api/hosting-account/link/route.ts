import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clientRefFor } from "@/lib/clientRefs";
import { accountLinkFor } from "@/lib/upgrade";
import { sendEmail, accountLinkEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { excludeTest } from "@/lib/testContext";

export const runtime = "nodejs";

/**
 * "Email me my service page link" -- for a client who already pays and comes
 * back to their /hosting?ref= page (from an old message, a bookmark, a
 * forwarded link) looking for their account.
 *
 * The link goes ONLY to the address on file for that ref, never to an address
 * posted by the browser, and the response is the same whether or not
 * anything was sent: the ref is guessable, and a different answer would tell
 * a stranger which businesses are clients.
 */
export async function POST(req: NextRequest) {
  /* `?ref=` as well as a JSON body, and a request naming nobody is a 400
     rather than a quiet ok — see the same note in /api/assistant-invite.
     A bash-quoted `-d '{"ref":"x"}'` pasted into cmd.exe reaches the server
     as the literal `'{ref:x}'`, and answering ok to that told an operator
     two emails had gone out when none had. */
  const body = await req.json().catch(() => ({}));
  const fromBody = typeof body?.ref === "string" ? body.ref : "";
  const ref = (req.nextUrl.searchParams.get("ref") || fromBody).trim().toLowerCase();
  const same = NextResponse.json({ ok: true });

  if (!ref) {
    return NextResponse.json(
      { ok: false, error: "no-ref", hint: "POST /api/hosting-account/link?ref=<client>" },
      { status: 400 },
    );
  }

  const client = clientRefFor(ref);
  if (!client?.email) return same;
  const db = supabaseAdmin();
  if (!db) return same;

  // `is_test is not true`: a founder test row is never a client's account.
  const { data: row } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("subscription_id, business")
    .eq("email", client.email)
    .in("status", ["active", "past_due"]))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle());
  if (!row?.subscription_id) return same;

  const url = await accountLinkFor(row.subscription_id, req.nextUrl.origin);
  const tpl = accountLinkEmail({ url, siteLabel: client.label, lang: client.lang ?? "en" });

  /* THE ANSWER TO THE BROWSER CANNOT SAY WHETHER THIS SENT — it is the same
     "ok" for every ref, so a stranger cannot learn which businesses are
     clients — so it has to be said somewhere. Telegram is that somewhere.
     Without this line an operator triggering it had no way at all to tell a
     delivered email from a silent Resend failure, which is exactly how two
     invites that never left were read as two successes. */
  const sent = await sendEmail(client.email, tpl.subject, tpl.html).catch(() => false);
  sendTelegramMessage(
    `🔗 *Service-page link ${sent ? "sent" : "FAILED"}* — ${client.label}` +
    (sent ? `\nTo ${client.email} · ${(client.lang ?? "en").toUpperCase()}` : "\nResend refused it — try again."),
  ).catch(() => {});
  return same;
}
