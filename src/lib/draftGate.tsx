import { cookies } from "next/headers";
import type { ClientSiteConfig } from "@/lib/clientSites";
import { isAdminAuthed } from "@/lib/auth";
import { previewGrantsView, PREVIEW_COOKIE } from "@/lib/draftPreview";

/**
 * Client-site visibility gate. A generated site starts as a `draft` and is
 * private until the admin publishes it (set-site-status → "published").
 *
 * Two people may see a draft before then: an authenticated admin, and the
 * client it was built for — through the signed preview link emailed to them
 * the moment it existed (src/lib/draftPreview.ts). The token arrives either
 * on the query string (`?preview=`) or, after /api/draft-preview has turned
 * it into a cookie, on every page under /sites. Nobody else.
 */

export type DraftAccess = "public" | "admin" | "client" | "hidden";

export async function draftAccess(config: ClientSiteConfig, previewToken?: string | null): Promise<DraftAccess> {
  if (!config.status || config.status === "published") return "public";
  if (await isAdminAuthed()) return "admin";
  let token = previewToken ?? null;
  if (!token) {
    try {
      token = (await cookies()).get(PREVIEW_COOKIE)?.value ?? null;
    } catch {
      token = null; // no request context — nothing to read, nothing to grant
    }
  }
  if (await previewGrantsView(config, token)) return "client";
  return "hidden";
}

/** True when the current viewer must NOT see this site (→ notFound()). */
export async function isHiddenDraft(config: ClientSiteConfig, previewToken?: string | null): Promise<boolean> {
  return (await draftAccess(config, previewToken)) === "hidden";
}

/**
 * The ribbon over an unpublished draft. Two audiences, two sentences: the
 * admin is told how to publish; the client is told this is theirs, that it
 * is a preview on our address, and what to do next — never "publish it in
 * the admin panel", which is not a thing they can do.
 */
export function DraftPreviewRibbon({ lang, viewer = "admin" }: { lang: "en" | "fr"; viewer?: "admin" | "client" }) {
  const msg =
    viewer === "client"
      ? lang === "fr"
        ? "VOTRE BROUILLON — un aperçu sur notre adresse. Répondez à notre email pour toute modification ; nous le mettons en ligne quand vous le dites."
        : "YOUR DRAFT — a preview on our address. Reply to our email with any changes; we take it live when you say so."
      : lang === "fr"
        ? "BROUILLON — visible uniquement par vous. Publiez-le dans l'admin pour le mettre en ligne."
        : "DRAFT — visible only to you. Publish it in the admin panel to go live.";
  return <div className="bg-[#92400E] text-white text-xs font-bold text-center py-2 px-4">{msg}</div>;
}
