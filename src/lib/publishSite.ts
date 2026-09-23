import { supabaseAdmin } from "@/lib/supabase";
import { archiveSite } from "@/lib/siteArchive";
import { sendEmail, liveEmail } from "@/lib/email";
import type { ClientSiteConfig } from "@/lib/clientSites";

/**
 * PUBLISHING A GENERATED SITE — one function for both hands that can do it:
 * the founder's Publish button (/api/admin/set-site-status) and, since C3,
 * the client's own "go" on her draft (/sites/<slug>/go).
 *
 * The flip is a CONDITIONAL update (only a row that is still a draft), so two
 * clicks, or the founder and the client at the same moment, publish once and
 * announce once. A failed write is reported, never passed off as a launch.
 *
 * Go-live email, first publish only, never for a demo:
 *   - no domain of her own → "you are live" with servolia.com/sites/<slug>;
 *   - her own domain attached → nothing here: /api/cron/domain-live sends it
 *     the first time her domain serves the site, with her address in it (C2).
 * To the account holder first (the address her portal login works with),
 * then the site's public contact address.
 */
export type PublishResult =
  | { ok: true; published: boolean; goLiveEmailed: boolean; to: string | null; config: ClientSiteConfig | null; buildId: string | null }
  | { ok: false; reason: "no-db" | "not-found" | "write-failed" };

export async function publishSite(slug: string, opts: { by: "admin" | "client"; markBuildLive?: boolean } = { by: "admin" }): Promise<PublishResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "no-db" };

  const { data: before } = await db.from("client_sites")
    .select("id, status, config, build_id, business").eq("slug", slug).maybeSingle();
  const row = before as { id: string; status?: string; config?: ClientSiteConfig; build_id?: string | null; business?: string | null } | null;
  if (!row) return { ok: false, reason: "not-found" };
  const cfg = row.config ?? null;
  const buildId = row.build_id ?? null;
  if (row.status === "published") return { ok: true, published: false, goLiveEmailed: false, to: null, config: cfg, buildId };

  const { data: flipped, error } = await db.from("client_sites")
    .update({ status: "published" }).eq("id", row.id).neq("status", "published").select("id");
  if (error) return { ok: false, reason: "write-failed" };
  if (!flipped?.length) return { ok: true, published: false, goLiveEmailed: false, to: null, config: cfg, buildId }; // someone else just did

  // Publishing = delivery → snapshot the site to the GitHub archive.
  // Fire-and-forget: archiving must never block or fail a publish.
  archiveSite(slug).then((r) => {
    if (!r.ok) console.warn(`Archive on publish skipped for ${slug}: ${r.reason}`);
  }).catch(() => {});

  // Her "go" is the delivery: the build leaves the "in build" list.
  if (opts.markBuildLive && buildId) {
    await db.from("builds").update({ status: "live" }).eq("id", buildId).not("status", "in", '("live","delivered")');
  }

  let goLiveEmailed = false;
  let to: string | null = null;
  if (!cfg?.isDemo && !cfg?.customDomain) {
    if (buildId) {
      const { data: build } = await db.from("builds").select("email").eq("id", buildId).maybeSingle();
      to = (build as { email?: string | null } | null)?.email ?? null;
    }
    to = to || (cfg?.email ?? null);
    if (to) {
      const firstName = (cfg?.businessName ?? row.business ?? to.split("@")[0]).split(" ")[0];
      const lang = cfg?.language === "fr" ? "fr" : "en";
      const tpl = liveEmail(firstName, `https://servolia.com/sites/${slug}`, lang);
      goLiveEmailed = await sendEmail(to, tpl.subject, tpl.html).catch(() => false);
    }
  }
  return { ok: true, published: true, goLiveEmailed, to, config: cfg, buildId };
}
