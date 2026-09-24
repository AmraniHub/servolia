import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { clientRefFor } from "@/lib/clientRefs";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { HOSTING_TIERS, CLIENT_PRODUCTS } from "@/lib/hosting";
import { mintUpgradeToken } from "@/lib/upgrade";
import { sendEmail, assistantBuiltEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { excludeTest } from "@/lib/testContext";

export const runtime = "nodejs";

/**
 * POST /api/assistant-invite?ref=<client> — "we built your assistant", from
 * Servolia to one of its own hosting clients. ADMIN ONLY.
 *
 * WHY IT IS LOCKED. It sends marketing email, in Servolia's name, to a real
 * client, and a ref is guessable from a domain name — so unauthenticated it
 * was a way for a stranger to spam a client under our brand. It is an
 * operator action and now sits behind the same login as the rest of /admin.
 *
 * BECAUSE IT IS LOCKED, IT CAN TELL THE TRUTH. The sibling endpoint
 * /api/hosting-account/link answers the same "ok" for every ref so that a
 * stranger cannot learn which businesses are clients. There is no stranger
 * here, and a uniform answer to the one person who needs to know is how an
 * earlier version reported two sends that never happened. Every outcome is
 * named, and the button on the admin page prints it.
 *
 * It sends ONCE per client, ever: "we built your assistant" is a one-time
 * thing to say, and the mark (in the row's notes, like the fulfilment and
 * trial markers) is written only after Resend accepts — so a real failure
 * can still be retried.
 */

const INVITED = "servolia-invited:";

function readInvited(notes: string | null | undefined): string | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(INVITED));
  return line ? line.slice(INVITED.length).trim() : null;
}

function writeInvited(notes: string | null | undefined): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(INVITED) && l.trim() !== "");
  return [...kept, `${INVITED} ${new Date().toISOString()}`].join("\n");
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  /* The ref may come from the query string, and that is the form to use: a
     JSON body typed at a Windows prompt is a trap, because cmd.exe does not
     treat single quotes as quotes and `-d '{"ref":"x"}'` arrives as the
     literal `'{ref:x}'`. */
  const body = await req.json().catch(() => ({}));
  const fromBody = typeof body?.ref === "string" ? body.ref : "";
  const ref = (req.nextUrl.searchParams.get("ref") || fromBody).trim().toLowerCase();
  if (!ref) {
    return NextResponse.json(
      { ok: false, error: "no-ref", hint: "POST /api/assistant-invite?ref=<client>" },
      { status: 400 },
    );
  }

  const client = clientRefFor(ref);
  if (!client?.email) {
    return NextResponse.json({ ok: false, error: "unknown-client", ref }, { status: 404 });
  }
  const brief = ASSISTANT_SITES[ref];
  if (!brief) {
    return NextResponse.json(
      { ok: false, error: "no-brief", detail: "Write their brief in assistantSites.ts first — there is nothing to invite them to." },
      { status: 409 },
    );
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 });

  // `is_test is not true`: a founder test row is never this client's hosting.
  const { data: rows } = await excludeTest(db, (live) => live(db
    .from("hosting_clients")
    .select("id, subscription_id, plan, notes")
    .ilike("email", client.email!) // narrowed above; lost inside the closure
    .in("status", ["active", "past_due"]))
    .order("created_at", { ascending: false }));
  const hosting = (rows ?? []).find(
    (r) => HOSTING_TIERS.includes(String(r.plan).toLowerCase()) && r.subscription_id,
  );
  if (!hosting?.subscription_id) {
    return NextResponse.json(
      { ok: false, error: "not-hosting-client", detail: "No active hosting subscription for that address." },
      { status: 409 },
    );
  }

  const already = readInvited(hosting.notes);
  if (already) {
    return NextResponse.json({ ok: true, status: "already-sent", at: already, to: client.email });
  }

  const origin = req.nextUrl.origin;
  const lang = client.lang ?? "en";
  const token = await mintUpgradeToken(hosting.subscription_id);
  const tpl = assistantBuiltEmail({
    business: brief.businessName,
    siteLabel: client.label,
    /* The showroom carries their token too, so the free week can be started
       from the page where they were convinced rather than by coming back to
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
    await db.from("hosting_clients").update({ notes: writeInvited(hosting.notes) }).eq("id", hosting.id);
  }
  sendTelegramMessage(
    `📨 *Assistant invite ${sent ? "sent" : "FAILED"}* — ${brief.businessName} (${client.label})` +
    (sent ? `\nTo ${client.email} · ${lang.toUpperCase()}` : "\nResend refused it. Nothing was recorded, so sending again is safe."),
  ).catch(() => {});

  if (!sent) {
    return NextResponse.json(
      { ok: false, error: "send-failed", detail: "Resend refused it. Nothing was recorded — safe to try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, status: "sent", to: client.email, lang, subject: tpl.subject });
}
