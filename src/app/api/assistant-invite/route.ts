import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { clientRefFor } from "@/lib/clientRefs";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { HOSTING_TIERS, CLIENT_PRODUCTS } from "@/lib/hosting";
import { mintUpgradeToken } from "@/lib/upgrade";
import { sendEmail, assistantBuiltEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

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
  const body = await req.json().catch(() => ({}));
  const ref = typeof body?.ref === "string" ? body.ref.trim().toLowerCase() : "";
  const same = NextResponse.json({ ok: true });

  const client = clientRefFor(ref);
  const brief = ASSISTANT_SITES[ref];
  if (!client?.email || !brief) return same;
  const db = supabaseAdmin();
  if (!db) return same;

  const { data: row } = await db
    .from("hosting_clients")
    .select("subscription_id, plan")
    .ilike("email", client.email)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false });
  const hosting = (row ?? []).find((r) => HOSTING_TIERS.includes(String(r.plan).toLowerCase()) && r.subscription_id);
  if (!hosting?.subscription_id) return same;

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
  sendTelegramMessage(`📨 *Assistant invite ${sent ? "sent" : "FAILED"}* — ${brief.businessName} (${client.label})`).catch(() => {});
  return same;
}
