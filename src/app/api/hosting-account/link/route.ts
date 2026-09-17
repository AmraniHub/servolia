import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clientRefFor } from "@/lib/clientRefs";
import { accountLinkFor } from "@/lib/upgrade";
import { sendEmail, accountLinkEmail } from "@/lib/email";

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

  const { data: row } = await db
    .from("hosting_clients")
    .select("subscription_id, business")
    .eq("email", client.email)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row?.subscription_id) return same;

  const url = await accountLinkFor(row.subscription_id, req.nextUrl.origin);
  const tpl = accountLinkEmail({ url, siteLabel: client.label, lang: client.lang ?? "en" });
  sendEmail(client.email, tpl.subject, tpl.html).catch(() => {});
  return same;
}
