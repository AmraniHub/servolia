import { NextRequest, NextResponse } from "next/server";
import {
  draftReceptionist, loadReceptionist, receptionistPhase, readReceptionistToken, receptionistLinkFor,
  startReceptionistTrial, updateReceptionistDetails, checkReceptionistInstall, receptionistSnippet, canTakeOver,
  type Practice, type ReceptionistDetails,
} from "@/lib/receptionistTrial";
import { sendEmail, receptionistConfirmEmail, receptionistStartedEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/receptionist-trial { action, ... } — every step of the public
 * trial a practice walks through (src/lib/receptionistTrial.ts).
 *
 *   draft    { domain, practice, lang }   → read her homepage, make the
 *            showroom receptionist. Public, rate-limited per IP.
 *   request  { slug, email, lang }        → email her the confirm link. Writes
 *            nothing: the address is only trusted once she clicks the link.
 *   start    { token, details }           → her click. Seven days begin.
 *   details  { token, details }           → she corrects what it says.
 *   check    { token }                    → is her line on her homepage?
 *
 * Everything after `request` is authorised by the signed token mailed to the
 * address it names, so no step can be taken on a practice's behalf by
 * someone who only knows its domain.
 */

const buckets = new Map<string, { n: number; at: number }>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || now - e.at > windowMs) {
    buckets.set(key, { n: 1, at: now });
    if (buckets.size > 5000) buckets.clear();
    return false;
  }
  e.n += 1;
  return e.n > max;
}

const EMAIL_RE = /^[^\s@<>"']{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;

function details(v: unknown): ReceptionistDetails {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string).slice(0, 1600) : undefined);
  return { phone: s("phone"), hours: s("hours"), address: s("address"), bookingUrl: s("bookingUrl"), instructions: s("instructions") };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const lang: "fr" | "en" = body.lang === "en" ? "en" : "fr";
  const origin = req.nextUrl.origin;

  if (action === "draft") {
    if (limited(`draft:${ip}`, 8, 60_000)) return NextResponse.json({ ok: false, reason: "rate" }, { status: 429 });
    const practice: Practice = body.practice === "aesthetic" ? "aesthetic" : "dental";
    const out = await draftReceptionist(String(body.domain ?? ""), practice, lang);
    return NextResponse.json(out, { status: out.ok ? 200 : out.reason === "invalid-domain" || out.reason === "shared-platform" ? 400 : 500 });
  }

  if (action === "request") {
    // A bot fills every field; a person never sees this one.
    if (typeof body.company === "string" && body.company.trim()) return NextResponse.json({ ok: true });
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, reason: "invalid-email" }, { status: 400 });
    /* This sends mail from servolia.com to an address the requester typed, so
       it is capped four ways: per IP, per address, per site, and in total per
       instance per hour. The caps are in memory (per serverless instance), so
       they bound a burst rather than enforce a quota — enough to keep the
       domain that carries our receipts from being used as a mailer. */
    const slugKey = String(body.slug ?? "").slice(0, 60);
    if (limited(`request:${ip}`, 5, 10 * 60_000) || limited(`request:${email}`, 3, 60 * 60_000)
      || limited(`request-site:${slugKey}`, 4, 60 * 60_000) || limited("request:all", 40, 60 * 60_000)) {
      return NextResponse.json({ ok: false, reason: "rate" }, { status: 429 });
    }
    const row = await loadReceptionist(slugKey);
    if (!row) return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
    const r = row.config.receptionist!;
    const mine = r.email?.toLowerCase() === email;
    if (receptionistPhase(r) !== "draft" && !mine && !canTakeOver(r, Date.now())) {
      return NextResponse.json({ ok: false, reason: "taken" }, { status: 409 });
    }
    const link = await receptionistLinkFor({ slug: row.slug, email, lang }, origin);
    const tpl = receptionistConfirmEmail({ business: row.config.businessName, domain: r.domain, link, lang });
    const sent = await sendEmail(email, tpl.subject, tpl.html).catch(() => false);
    if (!sent) return NextResponse.json({ ok: false, reason: "send-failed" }, { status: 502 });
    sendTelegramMessage(
      `Trial link requested - ${row.config.businessName}\n${r.domain} · ${email}\nThey have the confirm email; nothing starts until they click.`,
      undefined, { plain: true, silent: true },
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const claim = await readReceptionistToken(typeof body.token === "string" ? body.token.slice(0, 2000) : "");
  if (!claim) return NextResponse.json({ ok: false, reason: "invalid-link" }, { status: 400 });

  if (action === "start") {
    const out = await startReceptionistTrial(claim, details(body.details));
    if (!out.ok) return NextResponse.json(out, { status: out.reason === "write-failed" || out.reason === "no-db" ? 500 : 409 });
    if (!out.already) {
      const link = await receptionistLinkFor(claim, origin);
      const tpl = receptionistStartedEmail({
        business: out.business, domain: out.domain, snippet: receptionistSnippet(out.slug), untilIso: out.until, link, lang: out.lang,
      });
      sendEmail(claim.email, tpl.subject, tpl.html).catch(() => {});
      sendTelegramMessage(
        `Receptionist trial STARTED - ${out.business}\n${out.domain} · ${claim.email}\n` +
        `Until ${out.until.slice(0, 10)} (moves to install + 7 days when we first see the line).\n` +
        `Today's list will show it until the line is on their site.`,
        undefined, { plain: true },
      ).catch(() => {});
    }
    return NextResponse.json(out);
  }

  if (action === "details") {
    const ok = await updateReceptionistDetails(claim, details(body.details));
    return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
  }

  if (action === "check") {
    if (limited(`check:${claim.slug}`, 4, 60_000)) return NextResponse.json({ ok: false, reason: "rate" }, { status: 429 });
    const row = await loadReceptionist(claim.slug);
    if (!row || row.config.receptionist?.email?.toLowerCase() !== claim.email.toLowerCase()) {
      return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
    }
    const out = await checkReceptionistInstall(claim.slug);
    if (out.ok && out.restarted) {
      sendTelegramMessage(
        `Receptionist INSTALLED - ${row.config.businessName}\n${row.config.receptionist!.domain}\nTheir 7 days now run to ${out.until?.slice(0, 10)}.`,
        undefined, { plain: true },
      ).catch(() => {});
    }
    return NextResponse.json(out);
  }

  return NextResponse.json({ ok: false, reason: "unknown-action" }, { status: 400 });
}
