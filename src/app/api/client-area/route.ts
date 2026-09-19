import { NextRequest, NextResponse } from "next/server";
import { readUpgradeToken } from "@/lib/upgrade";
import { rowForSubscription, refForEmail, saveNotes } from "@/lib/hostingRow";
import { editableSite } from "@/lib/siteEditor";
import { hashPassword, writeStoredHash, passwordProblem } from "@/lib/siteEditorPassword";
import { sendTelegramMessage } from "@/lib/telegram";
import { collectSiteFiles, putSiteFile } from "@/lib/clientFiles";
import { uploadProblem, safeTarget } from "@/lib/siteUpload";
import { makeZip } from "@/lib/zip";
import { readCopyRequest, writeCopyRequest, copyState, COPY_WINDOW_DAYS } from "@/lib/clientCopy";
import { readDomainRequest, writeDomainRequest, domainRequestState } from "@/lib/domainRequest";
import { domainQuote, isDomainSalesConfigured, normalizeDomain, canBuyDomains } from "@/lib/domainSales";
import { hasExtraDomain } from "@/lib/extraDomains";
import { readDismissed, writeDismissed } from "@/lib/clientNotices";
import { domainCheckoutUrl } from "@/lib/domainCheckout";
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

  /* An upload arrives as multipart, not JSON — a 3.5 MB photo base64'd into a
     JSON body is 4.7 MB, which is over this host's request limit, so the file
     would be refused by the platform with a message nobody can read. */
  if (doing === "upload") return handleUpload(req);

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
    /* NOT GATED ON HAVING AN EDITOR ANY MORE.
       This is the same credential as the sign-in on the service page, so a
       client who can sign in must be able to change it — refusing because
       their pages happen to be edited for them left them holding a password
       they could not rotate. `ref` alone is the requirement, and rowFor()
       above has already established it. The editor entry is still read, for
       the business name in the alert. */
    const site = editableSite(ref);
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
      `🔑 *${site?.businessName ?? ref}* changed their password (portal sign-in${site ? " and editor" : ""}).\n` +
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

  if (doing === "buy-domain") {
    if (!isDomainSalesConfigured() || !canBuyDomains()) {
      return NextResponse.json({ ok: false, error: "Domains are not on sale at the moment." }, { status: 400 });
    }
    const name = normalizeDomain(String(body.domain ?? ""));
    if (!name) return NextResponse.json({ ok: false, error: "That does not look like a domain name." }, { status: 400 });
    if (hasExtraDomain(notes, name)) {
      return NextResponse.json({ ok: false, error: "You already have that one." }, { status: 409 });
    }

    /* PRICED HERE, NOT IN THE BROWSER. The page showed a figure and the
       browser can post any figure it likes; the registrar's answer at this
       moment is the only one allowed to become a charge. */
    const q = await domainQuote(name);
    if (!q.sellable) {
      return NextResponse.json(
        { ok: false, error: q.reason === "taken" ? "That domain has just been taken." : "That ending is not one we can offer." },
        { status: 409 },
      );
    }

    const url = await domainCheckoutUrl({
      subscriptionId: found.subId,
      domain: q.domain,
      retailUsd: q.yearlyUsd,
      ref,
      email,
      origin: req.nextUrl.origin,
    });
    if (!url) {
      return NextResponse.json({ ok: false, error: "We could not open the payment page. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, url });
  }

  if (doing === "support") {
    const text = String(body.message ?? "").trim();
    if (text.length < 10) {
      return NextResponse.json({ ok: false, error: "Tell us a little more so we can actually help." }, { status: 400 });
    }
    /* Trimmed, not truncated silently: a client who writes an essay should be
       told it was long, and Telegram refuses a message over ~4096 characters
       outright — which would look to them like nothing sent. */
    const clipped = text.length > 1500 ? `${text.slice(0, 1500)}\n\n[…trimmed, ${text.length} characters in all]` : text;

    const sent = await sendTelegramMessage(
      `💬 *${ref}* wrote from their panel:\n\n${clipped}\n\n— ${email ?? "(no email on the row)"}`,
      undefined,
      // Plain: a client's own words must not be re-interpreted as Markdown,
      // where a stray underscore or asterisk silently eats half the message.
      { plain: true },
    );
    if (!sent) {
      return NextResponse.json(
        { ok: false, error: "That did not send. Email hello@servolia.com and we will pick it up there." },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (doing === "dismiss-notice") {
    const id = String(body.id ?? "").trim().slice(0, 80);
    if (!id) return NextResponse.json({ ok: false, error: "no id" }, { status: 400 });
    /* Read, add, write. The set is re-read here rather than trusted from the
       browser, so two tabs dismissing different notices cannot erase each
       other's. */
    const ids = readDismissed(notes);
    ids.add(id);
    const error = await saveNotes(row, writeDismissed(notes, ids));
    if (error) {
      console.error("[client-area] notice not dismissed:", error);
      return NextResponse.json({ ok: false, error: "not-saved" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (doing === "cancel-copy") {
    /* Their own request, so they can withdraw it. Without this a client who
       pressed the button once is told "we will confirm shortly" forever, with
       no way back to the button — which is how a helpful screen becomes a
       dead end nobody can explain. Clearing it also clears a refusal, so the
       ask is available again. */
    const error = await saveNotes(row, writeCopyRequest(notes, {}));
    if (error) {
      console.error("[client-area] copy request not cleared:", error);
      return NextResponse.json({ ok: false, error: "That did not go through. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (doing === "request-domain") {
    if (!isDomainSalesConfigured()) {
      return NextResponse.json({ ok: false, error: "Domains are not on sale at the moment." }, { status: 400 });
    }
    // Asking twice while one is outstanding is one request, not two.
    if (domainRequestState(readDomainRequest(notes)) === "waiting") return NextResponse.json({ ok: true });

    const name = normalizeDomain(String(body.domain ?? ""));
    if (!name) return NextResponse.json({ ok: false, error: "That does not look like a domain name." }, { status: 400 });

    /* Quoted again HERE. The browser showed a price and the browser can post
       any figure it likes; the registrar's answer at this moment is the only
       one that decides what the client will be asked to pay. */
    const q = await domainQuote(name);
    if (!q.sellable) {
      return NextResponse.json(
        { ok: false, error: q.reason === "taken" ? "That domain has just been taken." : "That ending is not one we can offer." },
        { status: 409 },
      );
    }

    const error = await saveNotes(row, writeDomainRequest(notes, {
      domain: q.domain, yearlyUsd: q.yearlyUsd, requested: new Date().toISOString(),
    }));
    if (error) {
      console.error("[client-area] domain request not saved:", error);
      return NextResponse.json({ ok: false, error: "That did not go through. Please try again." }, { status: 502 });
    }

    /* Told, not bought. A domain is taken from the registrar the instant it is
       ordered and cannot be given back, so the one irreversible thing on this
       page is the one thing that goes past a person first. */
    await sendTelegramMessage(
      `*${ref}* wants to add *${q.domain}* — $${q.yearlyUsd}/year.\n` +
        `${email ?? "(no email on the row)"}\n\n` +
        `Nothing is bought yet. Register it from the admin and it goes on their invoice.`,
      [[{ text: "Not now", callback_data: `dom_no:${ref}` }]],
    );
    return NextResponse.json({ ok: true });
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

/**
 * A CLIENT PUTTING A FILE ON THEIR OWN LIVE WEBSITE.
 *
 * This is the one action here that changes what the public sees, so the checks
 * are in front of the write, not after it:
 *
 *  - the credential decides WHOSE site, never the form. A path or a client
 *    reference in the body would be a way to write into somebody else's repo;
 *  - the file type is checked against a short allow-list, and SVG is refused
 *    for the reason that makes it dangerous rather than for being unusual;
 *  - the destination folder is resolved against the site root and anything
 *    that climbs out of it is refused;
 *  - the name is reduced to its last segment, so a path inside the FILE NAME
 *    cannot choose the folder either.
 *
 * Every upload is announced on Telegram. A client changing their own photo is
 * unremarkable; a photo appearing that the owner did not upload is the thing
 * worth knowing within minutes.
 */
async function handleUpload(req: NextRequest): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "That upload did not arrive in one piece. Try again." }, { status: 400 });
  }

  const found = await rowFor(String(form.get("t") ?? ""));
  if (!found) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }
  const { ref, email } = found;

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file was chosen." }, { status: 400 });
  }
  const problem = uploadProblem(file.name, file.size);
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });

  const replace = String(form.get("replace") ?? "") === "1";
  const folder = String(form.get("folder") ?? "");
  const target = safeTarget(folder, file.name);
  if (!target) {
    return NextResponse.json({ ok: false, error: "That is not a folder on your site." }, { status: 400 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  /* Checked again on the bytes we actually received, not on what the browser
     declared: `size` is a claim until the body is in hand. */
  const realProblem = uploadProblem(file.name, data.length);
  if (realProblem) return NextResponse.json({ ok: false, error: realProblem }, { status: 400 });

  const out = await putSiteFile(ref, target, data, email ?? ref, { replace });
  if (!out.ok) {
    console.error("[client-area] upload failed:", out.reason);
    return NextResponse.json(
      { ok: false, error: "That could not be saved just now. Nothing on your site was changed — please try again." },
      { status: 502 },
    );
  }

  await sendTelegramMessage(
    `*${ref}* ${replace ? "replaced" : "uploaded"} *${out.path}* on their site.\n${email ?? ""}`,
  );
  return NextResponse.json({ ok: true, path: out.path, renamed: out.path !== target });
}
