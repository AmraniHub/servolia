import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clientRefFor } from "@/lib/clientRefs";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { HOSTING_TIERS, CLIENT_PRODUCTS } from "@/lib/hosting";
import { mintUpgradeToken } from "@/lib/upgrade";
import { sendEmail, assistantBuiltEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

/* One line in the row's notes, in the same style as the fulfilment and trial
   markers, so this needs no migration either. */
const INVITED = "servolia-invited:";

function readInvited(notes: string | null | undefined): string | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(INVITED));
  return line ? line.slice(INVITED.length).trim() : null;
}

function writeInvited(notes: string | null | undefined): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(INVITED) && l.trim() !== "");
  return [...kept, `${INVITED} ${new Date().toISOString()}`].join("\n");
}

/**
 * POST /api/assistant-invite { ref } — "we built your assistant", from
 * Servolia to one of its own hosting clients.
 *
 * Same shape and same rule as /api/hosting-account/link: the mail goes ONLY
 * to the address on file for that ref, it needs a brief in code (there is
 * nothing to invite anyone to otherwise) and an active hosting row (the
 * showroom is a hosting customer's perk), and the response is identical
 * whether or not anything was sent, because the ref is guessable and a
 * different answer would tell a stranger which businesses are clients.
 *
 * The four links inside are all minted here from the HOSTING subscription:
 * the showroom (public, by slug), the settings page and the trial page (both
 * signed with their hosting token), and the pay page. Sent by hand, one
 * client at a time — this is not a campaign.
 */
export async function POST(req: NextRequest) {
  /* THE REF MAY COME FROM THE QUERY STRING, and that is the form to use.
     A JSON body typed at a Windows prompt is a trap: cmd.exe does not treat
     single quotes as quotes, so the bash-shaped `-d '{"ref":"x"}'` arrives
     as the literal `'{ref:x}'`, fails to parse, and USED TO ANSWER ok — the
     operator saw {"ok":true} twice and reasonably believed two clients had
     been emailed when nothing had been sent. A ref is a public slug (it is
     already in every /hosting?ref= link), never an address, so carrying it
     in the URL leaks nothing. */
  const body = await req.json().catch(() => ({}));
  const fromBody = typeof body?.ref === "string" ? body.ref : "";
  const ref = (req.nextUrl.searchParams.get("ref") || fromBody).trim().toLowerCase();
  const same = NextResponse.json({ ok: true });

  /* A MALFORMED REQUEST IS NOT A QUIET SUCCESS. The identical answer for
     every ref exists so a stranger cannot learn which businesses are
     clients — it was never meant to swallow a request that named nobody at
     all, which says nothing about any client and everything about the
     command that was typed. */
  if (!ref) {
    return NextResponse.json(
      { ok: false, error: "no-ref", hint: "POST /api/assistant-invite?ref=<client>" },
      { status: 400 },
    );
  }

  const client = clientRefFor(ref);
  const brief = ASSISTANT_SITES[ref];
  if (!client?.email || !brief) return same;
  const db = supabaseAdmin();
  if (!db) return same;

  const { data: row } = await db
    .from("hosting_clients")
    .select("id, subscription_id, plan, notes")
    .ilike("email", client.email)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false });
  const hosting = (row ?? []).find((r) => HOSTING_TIERS.includes(String(r.plan).toLowerCase()) && r.subscription_id);
  if (!hosting?.subscription_id) return same;

  /* ONCE PER CLIENT, EVER. "We built your assistant" is a one-time thing to
     say, so recording that it has been said costs nothing and buys two
     things: the operator cannot double-send by re-running a command he is
     unsure about, and — since this route has no authentication and a ref is
     guessable from a domain name — a stranger who found it can cause at
     most one email that was going to be sent anyway, rather than spamming a
     client under Servolia's name. The mark is written only after Resend
     accepts, so a genuine failure can be retried. */
  if (readInvited(hosting.notes)) {
    sendTelegramMessage(`📨 *Assistant invite already sent* — ${brief.businessName}; nothing sent again.`).catch(() => {});
    return same;
  }

  const origin = req.nextUrl.origin;
  const lang = client.lang ?? "en";
  const token = await mintUpgradeToken(hosting.subscription_id);
  const tpl = assistantBuiltEmail({
    business: brief.businessName,
    siteLabel: client.label,
    /* The showroom carries their token too, so the free week can be started
       from the page where they were convinced rather than by going back to
       this email. The token decides what a click starts, never the ?site=. */
    tryUrl: `${origin}/hosting/assistant/try?site=${encodeURIComponent(ref)}${lang === "fr" ? "&lang=fr" : ""}&t=${encodeURIComponent(token)}`,
    settingsUrl: `${origin}/hosting/assistant?t=${encodeURIComponent(token)}`,
    trialUrl: `${origin}/hosting/assistant/trial?t=${encodeURIComponent(token)}`,
    payUrl: `${origin}/hosting?plan=chatbot&ref=${encodeURIComponent(ref)}`,
    monthlyUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd,
    annualUsd: CLIENT_PRODUCTS.chatbot.annualUsd,
    lang,
  });
  const sent = await sendEmail(client.email, tpl.subject, tpl.html).catch(() => false);
  if (sent) {
    await db.from("hosting_clients")
      .update({ notes: writeInvited(hosting.notes) })
      .eq("id", hosting.id);
  }
  sendTelegramMessage(
    `📨 *Assistant invite ${sent ? "sent" : "FAILED"}* — ${brief.businessName} (${client.label})` +
    (sent ? "" : "\nResend refused it. Nothing was recorded, so running it again is safe."),
  ).catch(() => {});
  return same;
}
