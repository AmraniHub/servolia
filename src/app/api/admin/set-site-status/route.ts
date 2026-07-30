import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { archiveSite } from "@/lib/siteArchive";
import { sendEmail, liveEmail } from "@/lib/email";
import type { ClientSiteConfig } from "@/lib/clientSites";

export const runtime = "nodejs";

/** Toggle a client site between draft and published. POST { slug, status }. Admin-only. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { slug, status } = (await req.json().catch(() => ({}))) as { slug?: string; status?: string };
  if (!slug || (status !== "draft" && status !== "published")) {
    return NextResponse.json({ error: "slug and valid status required" }, { status: 400 });
  }

  // Read the site BEFORE flipping it, so we can tell a first publish from a
  // re-publish and only congratulate the client once.
  const { data: before } = await db.from("client_sites")
    .select("status, config, build_id, business").eq("slug", slug).maybeSingle();
  const wasPublished = (before as { status?: string } | null)?.status === "published";

  await db.from("client_sites").update({ status }).eq("slug", slug);

  // Publishing = delivery → snapshot the site to the GitHub archive.
  // Fire-and-forget: archiving must never block or fail a publish.
  if (status === "published") {
    archiveSite(slug).then((r) => {
      if (!r.ok) console.warn(`Archive on publish skipped for ${slug}: ${r.reason}`);
    }).catch(() => {});
  }

  // ── Go-live email: the moment the client has been waiting for ──────────
  // Only on the FIRST publish (a re-publish after an edit is not a launch),
  // never for demo sites, and never without a real recipient. Fire-and-forget
  // for the same reason as the archive: a mail outage must not fail a launch.
  let goLiveEmailed = false;
  if (status === "published" && !wasPublished && before) {
    const row = before as { config?: ClientSiteConfig; build_id?: string | null; business?: string | null };
    const cfg = row.config;
    if (!cfg?.isDemo) {
      let to = cfg?.email ?? null;
      if (!to && row.build_id) {
        const { data: build } = await db.from("builds").select("email").eq("id", row.build_id).maybeSingle();
        to = (build as { email?: string | null } | null)?.email ?? null;
      }
      if (to) {
        const firstName = (cfg?.businessName ?? row.business ?? to.split("@")[0]).split(" ")[0];
        const lang = cfg?.language === "fr" ? "fr" : "en";
        const tpl = liveEmail(firstName, `https://servolia.com/sites/${slug}`, lang);
        sendEmail(to, tpl.subject, tpl.html).catch(() => {});
        goLiveEmailed = true;
      }
    }
  }

  return NextResponse.json({ ok: true, slug, status, goLiveEmailed });
}
