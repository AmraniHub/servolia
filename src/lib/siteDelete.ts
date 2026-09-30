/**
 * Deleting a client site from /admin/sites -- drafts nobody is paying for only.
 *
 * Until this existed there was no way to remove a site at all, so test drafts
 * (a walk's leftover after the test-records cleanup) and abandoned drafts sat
 * in the list for good. Deleting is allowed only where nothing real can be
 * lost, and every delete is snapshotted to the GitHub archive first (the same
 * sites/<slug>.json that publishing writes), so "Restore" can bring it back.
 * If that snapshot fails, nothing is deleted.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveSite } from "@/lib/siteArchive";

export type SiteForDelete = {
  slug: string;
  status: string;
  build_id: string | null;
  config: {
    customDomain?: unknown;
    receptionist?: unknown;
    isDemo?: unknown;
    assistantOnly?: unknown;
  } | null;
};

/** Why this site must not be deleted, or null when it may be. */
export function deleteRefusal(site: SiteForDelete | null, build: { is_test?: boolean | null } | null): string | null {
  if (!site) return "No such site.";
  if (site.status !== "draft") return "Only drafts can be deleted. This site is live.";
  const c = site.config ?? {};
  if (c.customDomain) return "It has a domain attached. Detach the domain first.";
  if (c.receptionist) return "It carries an AI receptionist (a trial or a paying plan). Not deleted.";
  if (c.isDemo || c.assistantOnly) return "Demo and assistant-only sites are not deleted from here.";
  if (site.build_id && build && build.is_test !== true) return "It belongs to a real client's build. Not deleted.";
  return null;
}

export async function deleteDraftSite(db: SupabaseClient, slug: string): Promise<{ ok: true; archiveUrl: string } | { ok: false; reason: string; status: number }> {
  const { data: site, error } = await db.from("client_sites")
    .select("slug, status, build_id, config").eq("slug", slug).maybeSingle();
  if (error) return { ok: false, reason: "Could not read the site.", status: 500 };

  let build: { is_test?: boolean | null } | null = null;
  if (site?.build_id) {
    const { data, error: bErr } = await db.from("builds").select("is_test").eq("id", site.build_id).maybeSingle();
    if (bErr) return { ok: false, reason: "Could not read its build.", status: 500 };
    build = data;
  }
  const refusal = deleteRefusal(site as SiteForDelete | null, build);
  if (refusal) return { ok: false, reason: refusal, status: site ? 409 : 404 };

  const snap = await archiveSite(slug);
  if (!snap.ok) return { ok: false, reason: `Not deleted: the archive snapshot failed (${snap.reason}).`, status: 502 };

  // Still a draft at the moment of deletion: a publish in between wins.
  const { data: gone, error: dErr } = await db.from("client_sites")
    .delete().eq("slug", slug).eq("status", "draft").select("slug");
  if (dErr) return { ok: false, reason: "The delete failed. The archive snapshot was kept.", status: 500 };
  if (!gone?.length) return { ok: false, reason: "It changed while deleting (published?). Nothing was deleted.", status: 409 };
  return { ok: true, archiveUrl: snap.url };
}
