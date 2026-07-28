/**
 * Draft site generation — the single generation path shared by the admin
 * "Generate" button (/api/admin/generate-site) and the intake auto-wire
 * (/api/contact, type "intake"): load the build + its lead's niche, draft
 * the config mechanically (configFromIntake), let Claude write the real
 * site copy (aiEnrichConfig — falls back to the mechanical draft if the AI
 * call fails), resolve slug collisions, then upsert client_sites by
 * build_id with status "draft".
 *
 * Best-effort by contract: returns null (never throws) when Supabase is
 * not configured, the build is missing, or anything else goes wrong —
 * callers treat generation as optional and must keep working without it.
 */

import { supabaseAdmin, type Build, type Lead } from "@/lib/supabase";
import { configFromIntake, slugify, type ClientSiteConfig } from "@/lib/clientSites";
import { aiEnrichConfig } from "@/lib/generateSiteCopy";

export async function generateSiteForBuild(
  buildId: string,
): Promise<{ slug: string; config: ClientSiteConfig; ai: boolean } | null> {
  try {
    const db = supabaseAdmin();
    if (!db) return null;

    // Load the build + its lead (for niche)
    const { data: build } = await db.from("builds").select("*").eq("id", buildId).maybeSingle();
    if (!build) return null;
    const b = build as Build;

    let niche: string | null = null;
    if (b.lead_id) {
      const { data: lead } = await db.from("leads").select("niche").eq("id", b.lead_id).maybeSingle();
      niche = (lead as Pick<Lead, "niche"> | null)?.niche ?? null;
    }

    // Draft the config from intake, then let Claude write the real copy
    const draft: ClientSiteConfig = configFromIntake({
      intake: b.intake_data ?? null,
      business: b.business,
      niche,
      email: b.email,
      plan: b.plan, // selects the plan template (feature set) — see planFeatures()
    });
    const { config, ai } = await aiEnrichConfig(draft, b.intake_data ?? {});

    // Ensure a unique slug (append short suffix on collision with a *different* build)
    let slug = config.slug;
    const { data: clash } = await db.from("client_sites").select("id, build_id").eq("slug", slug).maybeSingle();
    if (clash && (clash as { build_id?: string }).build_id !== buildId) {
      slug = `${slug}-${slugify(buildId).slice(0, 4)}`;
    }
    config.slug = slug;

    // Upsert by build_id so re-running updates the same site
    const { data: existing } = await db.from("client_sites").select("id").eq("build_id", buildId).maybeSingle();
    const row = {
      slug,
      build_id: buildId,
      business: config.businessName,
      niche: config.niche,
      config,
      status: "draft" as const,
    };

    // supabase-js reports write failures via { error }, it does not throw —
    // without this check a failed write (RLS, constraint, missing column)
    // would still report "draft ready" to the founder for a row that was
    // never persisted.
    const { error: writeError } = existing
      ? await db.from("client_sites").update(row).eq("id", (existing as { id: string }).id)
      : await db.from("client_sites").insert(row);
    if (writeError) {
      console.error("generateSiteForBuild write failed:", writeError);
      return null;
    }

    return { slug, config, ai };
  } catch (err) {
    console.error("generateSiteForBuild failed:", err);
    return null;
  }
}
