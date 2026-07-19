import type { ClientSiteConfig } from "@/lib/clientSites";
import { isAdminAuthed } from "@/lib/auth";

/**
 * Client-site visibility gate. A generated site starts as a `draft` and is
 * PRIVATE — only an authenticated admin can preview it — until the admin clicks
 * Publish in the admin panel (set-site-status → "published"). This is what makes
 * generation require the founder's explicit approval before anything goes live.
 *
 * Returns true when the current viewer must NOT see this site (→ notFound()).
 */
export async function isHiddenDraft(config: ClientSiteConfig): Promise<boolean> {
  if (!config.status || config.status === "published") return false;
  return !(await isAdminAuthed());
}

/** Slim ribbon shown to an admin previewing an unpublished draft. */
export function DraftPreviewRibbon({ lang }: { lang: "en" | "fr" }) {
  const msg = lang === "fr"
    ? "BROUILLON — visible uniquement par vous. Publiez-le dans l'admin pour le mettre en ligne."
    : "DRAFT — visible only to you. Publish it in the admin panel to go live.";
  return <div className="bg-[#92400E] text-white text-xs font-bold text-center py-2 px-4">{msg}</div>;
}
