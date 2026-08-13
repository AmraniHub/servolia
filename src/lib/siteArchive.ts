import { supabaseAdmin } from "@/lib/supabase";

/**
 * Per-client site archive on GitHub — every delivered (published) site gets a
 * versioned JSON snapshot committed to a private repo, so any client's site
 * can be inspected, reused as a starting template, or restored after a bad
 * edit or data loss. GitHub's commit history gives version history for free.
 *
 * Needs two env vars (see /admin/settings/integrations → Core):
 *   GITHUB_ARCHIVE_TOKEN — fine-grained PAT with Contents read/write on the repo
 *   GITHUB_ARCHIVE_REPO  — "owner/repo", e.g. "AmraniHub/servolia-client-archive"
 *                          (create it PRIVATE — client configs contain contact data)
 *
 * Layout in the repo: sites/{slug}.json — one file per site, updated in place;
 * history = git log of that file.
 */

const API = "https://api.github.com";

function creds(): { token: string; repo: string } | null {
  const token = process.env.GITHUB_ARCHIVE_TOKEN;
  const repo = process.env.GITHUB_ARCHIVE_REPO;
  if (!token || !repo || !repo.includes("/")) return null;
  return { token, repo };
}

function gh(token: string, path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
}

export const archiveConfigured = (): boolean => creds() !== null;

/** Snapshot one client site to the archive repo. Returns commit URL or an error string. */
export async function archiveSite(slug: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const c = creds();
  if (!c) return { ok: false, reason: "GITHUB_ARCHIVE_TOKEN / GITHUB_ARCHIVE_REPO not set" };

  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "Supabase not configured" };
  const { data: row } = await db.from("client_sites")
    .select("slug, business, niche, config, status, build_id, updated_at")
    .eq("slug", slug).maybeSingle();
  if (!row) return { ok: false, reason: `No client_sites row for '${slug}'` };

  const snapshot = { archived_at: new Date().toISOString(), ...row };
  const content = Buffer.from(JSON.stringify(snapshot, null, 2), "utf8").toString("base64");
  const path = `/repos/${c.repo}/contents/sites/${encodeURIComponent(slug)}.json`;

  // Contents API needs the current sha to update an existing file.
  let sha: string | undefined;
  const head = await gh(c.token, path);
  if (head.ok) sha = ((await head.json()) as { sha?: string }).sha;

  const put = await gh(c.token, path, {
    method: "PUT",
    body: JSON.stringify({
      message: `archive: ${slug} (${(row as { status?: string }).status ?? "?"}) — ${new Date().toISOString().slice(0, 10)}`,
      content,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) {
    const detail = await put.text();
    console.error("Site archive failed:", put.status, detail.slice(0, 300));
    return { ok: false, reason: `GitHub ${put.status} — check token scope and that the repo exists` };
  }
  const body = (await put.json()) as { commit?: { html_url?: string } };
  return { ok: true, url: body.commit?.html_url ?? `https://github.com/${c.repo}` };
}

/** Pull a snapshot back from the archive and upsert it as a DRAFT (never auto-publishes). */
export async function restoreSite(slug: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const c = creds();
  if (!c) return { ok: false, reason: "GITHUB_ARCHIVE_TOKEN / GITHUB_ARCHIVE_REPO not set" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "Supabase not configured" };

  const res = await gh(c.token, `/repos/${c.repo}/contents/sites/${encodeURIComponent(slug)}.json`);
  if (!res.ok) return { ok: false, reason: `No archived snapshot for '${slug}' (GitHub ${res.status})` };
  const file = (await res.json()) as { content?: string };
  if (!file.content) return { ok: false, reason: "Archive file has no content" };

  let snapshot: { slug?: string; business?: string; niche?: string | null; config?: Record<string, unknown>; build_id?: string | null };
  try {
    snapshot = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  } catch {
    return { ok: false, reason: "Archived JSON is corrupt" };
  }
  if (!snapshot.slug || !snapshot.config) return { ok: false, reason: "Snapshot missing slug/config" };

  const { error } = await db.from("client_sites").upsert({
    slug: snapshot.slug,
    business: snapshot.business ?? snapshot.slug,
    niche: snapshot.niche ?? null,
    config: snapshot.config,
    build_id: snapshot.build_id ?? null,
    status: "draft", // restored sites always come back as drafts — founder republishes deliberately
    notes: `RESTORED from GitHub archive ${new Date().toISOString().slice(0, 10)}`,
  }, { onConflict: "slug" });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** List everything in the archive (slug + last update). */
export async function listArchive(): Promise<{ slug: string; size: number }[] | null> {
  const c = creds();
  if (!c) return null;
  const res = await gh(c.token, `/repos/${c.repo}/contents/sites`);
  if (!res.ok) return [];
  const files = (await res.json()) as { name: string; size: number }[];
  return files.filter((f) => f.name.endsWith(".json")).map((f) => ({ slug: f.name.replace(/\.json$/, ""), size: f.size }));
}
