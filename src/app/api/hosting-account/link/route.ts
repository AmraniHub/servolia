import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clientRefFor, refKeyForEmail } from "@/lib/clientRefs";
import { accountLinkFor, subscriptionContext } from "@/lib/upgrade";
import { sendEmail, accountLinkEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { excludeTest, runAsTest } from "@/lib/testContext";
import { founderTestBrowser } from "@/lib/testMode";
import { clientIp } from "@/lib/security";
import { atomicLimit } from "@/lib/atomicLimit";
import { bounded, alert } from "@/lib/notify";
import { normalizeEmail, emailKey, sendLinkForEmail, type LinkRow } from "@/lib/accountLinkByEmail";

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
 *
 * TWO WAYS IN (2026-09-25): `ref` as before, or `email` from the sign-in
 * screen on /hosting/account — for a self-serve buyer who has no ref and no
 * password. The email mode is rate-limited before any lookup and does its
 * lookup and send after the response, so the answer is identical in body AND
 * timing for a client and a stranger (src/lib/accountLinkByEmail.ts).
 */
export async function POST(req: NextRequest) {
  /* `?ref=` as well as a JSON body, and a request naming nobody is a 400
     rather than a quiet ok — see the same note in /api/assistant-invite.
     A bash-quoted `-d '{"ref":"x"}'` pasted into cmd.exe reaches the server
     as the literal `'{ref:x}'`, and answering ok to that told an operator
     two emails had gone out when none had. */
  const body = await req.json().catch(() => ({}));
  const same = NextResponse.json({ ok: true });

  if (typeof body?.email === "string") return byEmail(req, body.email, same);

  const fromBody = typeof body?.ref === "string" ? body.ref : "";
  const ref = (req.nextUrl.searchParams.get("ref") || fromBody).trim().toLowerCase();

  if (!ref) {
    return NextResponse.json(
      { ok: false, error: "no-ref", hint: "POST /api/hosting-account/link?ref=<client> or { email }" },
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
  await sendTelegramMessage(
    `🔗 *Service-page link ${sent ? "sent" : "FAILED"}* — ${client.label}` +
    (sent ? `\nTo ${client.email} · ${(client.lang ?? "en").toUpperCase()}` : "\nResend refused it — try again."),
  ).catch(() => {});
  return same;
}

/** Run after the response where Next can; inline where it cannot (tests). */
function later(task: () => Promise<unknown>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => {});
  }
}

const plainLabel = (s: string | null | undefined) => String(s ?? "").replace(/[<>&"]/g, "").slice(0, 120);

async function byEmail(req: NextRequest, raw: string, same: NextResponse): Promise<NextResponse> {
  const email = normalizeEmail(raw);
  // A malformed address says so: the format is the browser's own input and
  // tells nothing about who is a client.
  if (!email) return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });

  /* ATOMIC, per IP and per address, and FAIL-CLOSED: each request is counted
     by one Postgres statement (src/lib/atomicLimit.ts), so thirty parallel
     requests cannot all read "0" and all send. If the counter cannot be
     reached, the request is refused, never waved through. Neither answer
     depends on whether the address is a client. */
  for (const [key, max] of [[`link-email-ip:${clientIp(req.headers)}`, 5], [`link-email:${emailKey(email)}`, 3]] as const) {
    const verdict = await atomicLimit(key, max, 3600);
    if (verdict === "limited") {
      return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429, headers: { "Retry-After": "3600" } });
    }
    if (verdict === "unavailable") {
      return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
    }
  }

  const origin = req.nextUrl.origin;
  const keepTest = await founderTestBrowser().catch(() => false);
  later(async () => {
    const db = supabaseAdmin();
    if (!db) return;
    const outcome = await sendLinkForEmail(email, {
      async findRows(e) {
        const pattern = e.replace(/[%_]/g, (c) => `\\${c}`);
        const { data } = await excludeTest(db, (live) => live(db
          .from("hosting_clients")
          .select("id, email, subscription_id, business, status")
          .ilike("email", pattern)
          .in("status", ["active", "past_due"]))
          .order("created_at", { ascending: false })
          .limit(5), { keepTest });
        return (data ?? []) as LinkRow[];
      },
      async send(row) {
        const test = keepTest && (await db.from("hosting_clients").select("is_test").eq("id", row.id).maybeSingle()).data?.is_test === true;
        return runAsTest(test, async () => {
          const ref = clientRefFor(refKeyForEmail(row.email));
          const lang = ref?.lang ?? (await subscriptionContext(row.subscription_id!).catch(() => null))?.lang ?? "en";
          const url = await accountLinkFor(row.subscription_id!, origin);
          const tpl = accountLinkEmail({ url, siteLabel: plainLabel(ref?.label || row.business), lang });
          const sent = (await bounded("account link email", () => sendEmail(row.email!, tpl.subject, tpl.html))) === true;
          await alert(`Service-page link ${sent ? "sent" : "FAILED"} (asked for by email) - ${plainLabel(row.business) || row.email}`, { silent: sent });
          return sent;
        });
      },
    });
    if (outcome === "failed") console.error("[hosting-account/link] email send failed");
  });
  return same;
}
