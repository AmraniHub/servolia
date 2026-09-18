import { NextRequest, NextResponse } from "next/server";
import { readUpgradeToken } from "@/lib/upgrade";
import { supabaseAdmin } from "@/lib/supabase";
import { editableSite } from "@/lib/siteEditor";
import { hashPassword, writeStoredHash, passwordProblem } from "@/lib/siteEditorPassword";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * THE THINGS A HOSTING CLIENT CAN DO FOR THEMSELVES.
 *
 *   POST ?do=set-password   { t, password }   choose their own editor password
 *   POST ?do=request-copy   { t }             ask for a copy of their website
 *
 * WHAT THE SIGNED LINK PROVES. It was minted for one subscription and emailed
 * to the address on it, so holding it means holding that mailbox. That is the
 * same standard as every "reset your password" email on the internet, and it
 * is deliberately the only credential here: a client who has forgotten her
 * editor password is exactly the person who needs this page, so demanding the
 * old one would lock out the only case that matters.
 *
 * WHAT IT DOES NOT PROVE, AND WHAT FOLLOWS. A forwarded link is a forwarded
 * key. So every password change is announced on Telegram the moment it
 * happens, which is how a change nobody meant to make gets noticed within
 * minutes rather than when the site text goes strange. Nothing here can spend
 * money, cancel anything, or reach another client's site.
 */

async function rowFor(token: string) {
  const subId = await readUpgradeToken(token);
  if (!subId) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("hosting_clients")
    .select("client_ref, email, notes")
    .eq("subscription_id", subId)
    .maybeSingle();
  const row = data as { client_ref?: string; email?: string; notes?: string | null } | null;
  if (!row?.client_ref) return null;
  return { ...row, client_ref: row.client_ref.toLowerCase(), subId, db };
}

export async function POST(req: NextRequest) {
  const doing = req.nextUrl.searchParams.get("do");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = String(body.t ?? "");

  const found = await rowFor(token);
  if (!found) {
    return NextResponse.json(
      { ok: false, error: "This link has expired. Reply to any email from us and we will send a fresh one." },
      { status: 401 },
    );
  }
  const { client_ref: ref, email, notes, db } = found;

  if (doing === "set-password") {
    const site = editableSite(ref);
    if (!site) {
      return NextResponse.json({ ok: false, error: "There is no page editor on this website yet." }, { status: 400 });
    }
    const password = String(body.password ?? "");
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });

    const { error } = await db
      .from("hosting_clients")
      .update({ notes: writeStoredHash(notes, hashPassword(ref, password), new Date().toISOString()) })
      .eq("client_ref", ref);
    if (error) {
      console.error("[client-area] password not saved:", error.message);
      return NextResponse.json(
        { ok: false, error: "That could not be saved just now. Your old password still works — please try again." },
        { status: 502 },
      );
    }

    /* Announced, not logged. A password change the owner did not make is the
       one event on this page worth interrupting someone for. */
    await sendTelegramMessage(
      `🔑 *${site.businessName}* changed their website editor password.\n` +
        `Client: ${email ?? ref}\nIf they did not do this, set ${`EDITOR_PW_${ref.toUpperCase()}`} to a fresh hash.`,
    );
    return NextResponse.json({ ok: true });
  }

  if (doing === "request-copy") {
    await sendTelegramMessage(
      `📦 *${ref}* asked for a copy of their website files.\n` +
        `Send to: ${email ?? "(no email on the row)"}`,
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown-action" }, { status: 400 });
}
