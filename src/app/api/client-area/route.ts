import { NextRequest, NextResponse } from "next/server";
import { readUpgradeToken } from "@/lib/upgrade";
import { rowForSubscription, refForEmail, saveNotes } from "@/lib/hostingRow";
import { editableSite } from "@/lib/siteEditor";
import { hashPassword, writeStoredHash, passwordProblem } from "@/lib/siteEditorPassword";
import { sendTelegramMessage } from "@/lib/telegram";
import { collectSiteFiles } from "@/lib/clientFiles";
import { makeZip } from "@/lib/zip";
import { readCopyRequest, writeCopyRequest, copyState, COPY_WINDOW_DAYS } from "@/lib/clientCopy";
import { identify, createClientSession, clientSession, CLIENT_COOKIE, CLIENT_SESSION_SECONDS } from "@/lib/clientAreaAuth";

export const runtime = "nodejs";
/* Fetching a few hundred blobs and zipping them is slower than a page render
   and much faster than the ceiling. */
export const maxDuration = 60;

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

/**
 * Whose page this request is about.
 *
 * Either credential is enough and neither is preferred: the emailed link for
 * a client who still has the email, the signed-in session for one who does
 * not. Both resolve to a subscription id and nothing downstream can tell
 * which was used, so there is one path to get wrong instead of two.
 */
async function rowFor(token: string) {
  const subId = (await readUpgradeToken(token)) || (await clientSession());
  if (!subId) return null;
  const row = await rowForSubscription(subId);
  /* The reference comes from the email, not from a column: hosting_clients has
     no client_ref. Without a reference there is no site to edit and no
     password to set, so there is nothing this request can mean. */
  const ref = refForEmail(row?.email);
  if (!row || !ref) return null;
  return { row, ref, email: row.email, notes: row.notes, subId };
}

export async function POST(req: NextRequest) {
  const doing = req.nextUrl.searchParams.get("do");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = String(body.t ?? "");

  if (doing === "signin") {
    const who = await identify(String(body.email ?? ""), String(body.password ?? ""));
    if (!who) {
      /* One message for a wrong password, an unknown address and a client with
         no password yet. Anything more specific turns this form into a way to
         ask whether a business is one of ours. */
      return NextResponse.json(
        { ok: false, error: "That email and password do not match an account." },
        { status: 401 },
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(CLIENT_COOKIE, await createClientSession(who), {
      httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: CLIENT_SESSION_SECONDS,
    });
    return res;
  }

  if (doing === "signout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(CLIENT_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const found = await rowFor(token);
  if (!found) {
    return NextResponse.json(
      { ok: false, error: "This link has expired. Reply to any email from us and we will send a fresh one." },
      { status: 401 },
    );
  }
  const { row, ref, email, notes } = found;

  if (doing === "set-password") {
    const site = editableSite(ref);
    if (!site) {
      return NextResponse.json({ ok: false, error: "There is no page editor on this website yet." }, { status: 400 });
    }
    const password = String(body.password ?? "");
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });

    const error = await saveNotes(row, writeStoredHash(notes, hashPassword(ref, password), new Date().toISOString()));
    if (error) {
      console.error("[client-area] password not saved:", error);
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
    const already = readCopyRequest(notes);
    const state = copyState(already);
    /* Asking again while it is still live must not reset the clock or fire a
       second alert — a client who sees no instant answer presses again. */
    if (state === "ready" || state === "waiting") return NextResponse.json({ ok: true, state });

    const error = await saveNotes(row, writeCopyRequest(notes, { requested: new Date().toISOString() }));
    if (error) {
      console.error("[client-area] copy request not saved:", error);
      return NextResponse.json({ ok: false, error: "That did not go through. Please try again." }, { status: 502 });
    }

    await sendTelegramMessage(
      `📦 *${ref}* asked for a copy of their website.\n` +
        `${email ?? "(no email on the row)"}\n\n` +
        `Approve and a download button appears on their own page for ${COPY_WINDOW_DAYS} days. ` +
        `Nothing is emailed either way.`,
      [[
        { text: "Approve", callback_data: `copy_ok:${ref}` },
        { text: "Not now", callback_data: `copy_no:${ref}` },
      ]],
    );
    return NextResponse.json({ ok: true, state: "waiting" });
  }

  return NextResponse.json({ ok: false, error: "unknown-action" }, { status: 400 });
}

/**
 * The download itself, once he has approved it.
 *
 * A GET so the browser can save it like any other file. The token is in the
 * query because that is how a link works — and it is the same token that
 * opened the page, carrying no more authority here than it does there.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("do") !== "download") {
    return NextResponse.json({ ok: false, error: "unknown-action" }, { status: 400 });
  }
  const found = await rowFor(req.nextUrl.searchParams.get("t") ?? "");
  if (!found) return NextResponse.json({ ok: false, error: "expired-link" }, { status: 401 });

  const state = copyState(readCopyRequest(found.notes));
  if (state !== "ready") {
    /* Deliberately the same answer for "never asked", "still waiting" and
       "expired". Whoever is holding this link, the file is not theirs to have
       until it has been approved, and the state of someone else's request is
       not something to narrate. */
    return NextResponse.json({ ok: false, error: "not-approved" }, { status: 403 });
  }

  try {
    const files = await collectSiteFiles(found.ref);
    if (!files.length) throw new Error("no files");
    const zip = makeZip(files);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${found.ref}-website.zip"`,
        "Content-Length": String(zip.length),
        // Their own site, behind an approval: nothing caches this anywhere.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[client-area] copy failed:", err);
    return NextResponse.json({ ok: false, error: "could-not-build" }, { status: 502 });
  }
}
