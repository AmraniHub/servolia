import { SignJWT, jwtVerify } from "jose";
import { tokenSecret } from "@/lib/upgrade";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, draftReadyEmail } from "@/lib/email";
import type { ClientSiteConfig } from "@/lib/clientSites";

/**
 * THE DRAFT REACHES THE CLIENT.
 *
 * Until 2026-09-20 a generated site sat as `draft` — a 404 to everyone but
 * an admin — from the moment Claude finished writing it until a human clicked
 * Publish. The client who had just paid and answered the intake saw nothing
 * in between. That silence is where a payment starts to feel like a mistake.
 *
 * This module gives the client a link to their own draft the moment it
 * exists, and sends it by the same code path that generated the draft — so
 * it cannot depend on anyone remembering.
 *
 * THE TOKEN. A signed claim on ONE slug, minted only into an email sent to
 * the address on the build, so possession of the link is possession of the
 * inbox — the same reasoning as the hosting-upgrade token it borrows its
 * secret from. It grants exactly one thing: viewing an unpublished draft. It
 * cannot publish, edit, or open any other site. Ninety days, because a
 * client may come back to the link weeks later and "your link has expired"
 * is the wrong first thing to read.
 *
 * THE COOKIE. A draft can be several pages, and a query-string token dies on
 * the first click to /services. So the emailed link lands on
 * /api/draft-preview, which turns the token into a cookie scoped to /sites
 * and redirects to the draft. Every page under /sites then reads the cookie.
 *
 * ONCE PER SITE. The send is recorded on client_sites.notes in the same
 * one-line marker style fulfilment.ts and assistantTrial.ts use — no
 * migration. A re-submitted intake regenerates the draft and sends nothing
 * twice. The marker is written AFTER a successful send, so a crash between
 * the two can at worst repeat the email; the reverse order could lose it.
 */

const ROLE = "draft-preview";
export const PREVIEW_TTL_DAYS = 90;
export const PREVIEW_COOKIE = "sv_draft_preview";

export interface PreviewClaim {
  slug: string;
  buildId: string;
}

export async function mintPreviewToken(slug: string, buildId: string, days = PREVIEW_TTL_DAYS): Promise<string> {
  return new SignJWT({ role: ROLE, slug, build_id: buildId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(tokenSecret());
}

/** The slug and build this token is about, or null for anything else — a
 *  forged, expired, or differently-purposed token all read as "no". */
export async function readPreviewToken(token: string | null | undefined): Promise<PreviewClaim | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, tokenSecret());
    if (payload.role !== ROLE) return null;
    const slug = typeof payload.slug === "string" ? payload.slug : "";
    const buildId = typeof payload.build_id === "string" ? payload.build_id : "";
    return slug && buildId ? { slug, buildId } : null;
  } catch {
    return null;
  }
}

/** The link that goes in the email. Lands on the cookie-setting route, not
 *  the page, so the token survives the client clicking around. */
export async function previewLinkFor(slug: string, buildId: string, origin = "https://servolia.com"): Promise<string> {
  return `${origin}/api/draft-preview?t=${encodeURIComponent(await mintPreviewToken(slug, buildId))}`;
}

/**
 * Does this token let its holder see this site? Only an unpublished draft,
 * only the slug the token names. Pure apart from the signature check, so it
 * is testable without a request; draftGate.tsx composes it with the admin
 * session and the cookie.
 */
export async function previewGrantsView(
  config: { slug: string; status?: string },
  token: string | null | undefined,
): Promise<boolean> {
  if (!config.status || config.status === "published") return false; // nothing to grant
  const claim = await readPreviewToken(token);
  return Boolean(claim && claim.slug === config.slug);
}

/* ── the once-per-site marker, on client_sites.notes ─────────────────────── */

const MARKER = "servolia-draft-emailed:";

export interface DraftEmailRecord {
  at: string;
  to: string;
}

export function readDraftEmailed(notes: string | null | undefined): DraftEmailRecord | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(MARKER));
  if (!line) return null;
  const kv: Record<string, string> = {};
  for (const p of line.slice(MARKER.length).split(" | ")) {
    const i = p.indexOf(":");
    if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return kv.at && kv.to ? { at: kv.at, to: kv.to } : null;
}

export function writeDraftEmailed(notes: string | null | undefined, rec: DraftEmailRecord): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(MARKER) && l.trim() !== "");
  return [...kept, `${MARKER} at: ${rec.at} | to: ${rec.to}`].join("\n");
}

/* ── what the client should still send us ────────────────────────────────── */

/**
 * The facts a real site needs that the intake did not give. Named in the
 * email in plain words, so "still needed" is a sentence the client can act
 * on rather than a surprise on day three. Never invented — an absent phone
 * stays absent until they send one.
 */
export function draftMissing(config: Pick<ClientSiteConfig, "language" | "phone" | "whatsapp" | "hours" | "services" | "city">): string[] {
  const fr = config.language === "fr";
  const out: string[] = [];
  if (!config.phone && !config.whatsapp) out.push(fr ? "un numéro de téléphone ou WhatsApp" : "a phone number or WhatsApp");
  if (!config.hours) out.push(fr ? "vos horaires d'ouverture" : "your opening hours");
  if (!Array.isArray(config.services) || config.services.length === 0) out.push(fr ? "la liste de vos prestations" : "the list of your services");
  if (!config.city) out.push(fr ? "votre ville" : "your city");
  return out;
}

/* ── the one place the email is sent from ────────────────────────────────── */

export type NotifyOutcome =
  | { sent: true; to: string; previewUrl: string }
  | { sent: false; reason: "no-db" | "no-email" | "already" | "send-failed"; to?: string };

/**
 * Tell the client their draft exists. Called by the intake path the moment
 * generation finishes, and by the admin's Regenerate button — the same
 * function, so the founder pressing the button is also how the email is
 * verified. Once per site; never throws.
 */
export async function notifyDraftReady(args: {
  buildId: string;
  slug: string;
  config: ClientSiteConfig;
  ai: boolean;
  origin?: string;
}): Promise<NotifyOutcome> {
  const db = supabaseAdmin();
  if (!db) return { sent: false, reason: "no-db" };

  const { data: build } = await db.from("builds").select("email").eq("id", args.buildId).maybeSingle();
  const to = (build as { email?: string | null } | null)?.email?.trim() ?? "";
  if (!to) return { sent: false, reason: "no-email" };

  const { data: site } = await db.from("client_sites").select("id, notes").eq("slug", args.slug).maybeSingle();
  const row = site as { id: string; notes: string | null } | null;
  if (row && readDraftEmailed(row.notes)) return { sent: false, reason: "already", to };

  const previewUrl = await previewLinkFor(args.slug, args.buildId, args.origin ?? "https://servolia.com");
  const tpl = draftReadyEmail({
    businessName: args.config.businessName,
    previewUrl,
    missing: draftMissing(args.config),
    aiWritten: args.ai,
    lang: args.config.language === "fr" ? "fr" : "en",
  });
  const ok = await sendEmail(to, tpl.subject, tpl.html).catch(() => false);
  if (!ok) return { sent: false, reason: "send-failed", to };

  if (row) {
    await db.from("client_sites")
      .update({ notes: writeDraftEmailed(row.notes, { at: new Date().toISOString(), to }) })
      .eq("id", row.id);
  }
  return { sent: true, to, previewUrl };
}
