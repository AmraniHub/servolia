import { withAssistantTag, hasAssistantTag } from "@/lib/assistant";
import { sitePath } from "@/lib/hostingGate";

/**
 * PUT THE ASSISTANT ON A SITE WE HOST, WITHOUT A HUMAN IN THE LOOP.
 *
 * For a client whose repository we already write to (the suspension gate
 * lives there), "nothing to install" can be literally true: one commit adds
 * the script tag to every HTML page at the site root, Vercel redeploys, and
 * the assistant is answering within a minute or two of the payment.
 *
 * Done through the Git Data API rather than the Contents API so twelve pages
 * become ONE commit — the client's history shows "Add the site assistant"
 * once, not twelve times, and a redeploy is triggered once.
 *
 * Idempotent by construction: a page that already carries the tag is left
 * untouched, and if no page needs it the function returns changed=0 with no
 * commit. That is what lets a replayed webhook call this safely.
 *
 * Only top-level *.html files at the site root are touched. Sub-folders are
 * assets or generated output on every site we host; a page that lives in one
 * can be added by hand. Never a JS or template file — this is for static
 * sites, which is what the hosting line hosts.
 */

const GITHUB_API = "https://api.github.com";

export interface InstallTarget {
  repo: string;
  branch?: string | null;
  siteRoot?: string | null;
}

export type InstallOutcome =
  | { ok: true; changed: number; skipped: number; files: string[]; commit?: string }
  | { ok: false; reason: "no-token" | "no-pages" | "error"; detail?: string };

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is not set");
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = res.status === 404 ? " (private repo the token cannot read, or wrong path?)" : "";
    throw new Error(`GitHub ${res.status}${hint}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface TreeEntry { path: string; mode: string; type: "blob" | "tree" | "commit"; sha: string }

/** The tree that holds the site's pages: the root, or the siteRoot folder inside it. */
async function siteTree(repo: string, rootTreeSha: string, siteRoot: string | null | undefined) {
  const root = (siteRoot ?? "").replace(/^\/+|\/+$/g, "");
  let sha = rootTreeSha;
  for (const part of root ? root.split("/") : []) {
    const t = await gh<{ tree: TreeEntry[] }>(`/repos/${repo}/git/trees/${sha}`);
    const dir = t.tree.find((e) => e.type === "tree" && e.path === part);
    if (!dir) throw new Error(`site root "${root}" not found in ${repo}`);
    sha = dir.sha;
  }
  const t = await gh<{ tree: TreeEntry[] }>(`/repos/${repo}/git/trees/${sha}`);
  return { sha, entries: t.tree, prefix: root ? `${root}/` : "" };
}

export async function installAssistantTag(
  target: InstallTarget,
  slug: string,
  position: "left" | "right" = "right",
  opts: { dryRun?: boolean } = {},
): Promise<InstallOutcome> {
  if (!process.env.GH_TOKEN) return { ok: false, reason: "no-token" };
  const branch = target.branch || "main";
  try {
    const ref = await gh<{ object: { sha: string } }>(`/repos/${target.repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const headSha = ref.object.sha;
    const head = await gh<{ tree: { sha: string } }>(`/repos/${target.repo}/git/commits/${headSha}`);
    const { entries, prefix } = await siteTree(target.repo, head.tree.sha, target.siteRoot);

    const pages = entries.filter((e) => e.type === "blob" && /\.html?$/i.test(e.path));
    if (!pages.length) return { ok: false, reason: "no-pages", detail: `${prefix || "/"}` };

    const changed: { path: string; content: string }[] = [];
    const files: string[] = [];
    let skipped = 0;
    for (const page of pages) {
      const blob = await gh<{ content: string; encoding: string }>(`/repos/${target.repo}/git/blobs/${page.sha}`);
      const html = Buffer.from(blob.content, blob.encoding === "base64" ? "base64" : "utf8").toString("utf8");
      if (hasAssistantTag(html)) { skipped++; continue; }
      const next = withAssistantTag(html, slug, position);
      if (next === html) { skipped++; continue; } // no </body> to hook — a fragment, not a page
      changed.push({ path: `${prefix}${page.path}`, content: next });
      files.push(page.path);
    }

    if (!changed.length || opts.dryRun) {
      return { ok: true, changed: changed.length, skipped, files };
    }

    // One commit: blobs → tree on top of HEAD's tree → commit → move the branch.
    const treeEntries: TreeEntry[] = [];
    for (const c of changed) {
      const b = await gh<{ sha: string }>(`/repos/${target.repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: c.content, encoding: "utf-8" }),
      });
      treeEntries.push({ path: c.path, mode: "100644", type: "blob", sha: b.sha });
    }
    const tree = await gh<{ sha: string }>(`/repos/${target.repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: head.tree.sha, tree: treeEntries }),
    });
    const commit = await gh<{ sha: string }>(`/repos/${target.repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: `Add the site assistant to ${changed.length} page${changed.length === 1 ? "" : "s"}`,
        tree: tree.sha,
        parents: [headSha],
      }),
    });
    await gh(`/repos/${target.repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return { ok: true, changed: changed.length, skipped, files, commit: commit.sha };
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Is the tag on the home page? Reads one file, writes nothing. Used by the
 * admin page and the client's own assistant page to say "installed" only
 * when it is, rather than because a webhook once reported success.
 */
export async function assistantInstalled(target: InstallTarget): Promise<boolean | null> {
  if (!process.env.GH_TOKEN) return null;
  const branch = target.branch || "main";
  const path = sitePath(target.siteRoot, "index.html");
  try {
    const file = await gh<{ content: string }>(
      `/repos/${target.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    );
    return hasAssistantTag(Buffer.from(file.content, "base64").toString("utf8"));
  } catch {
    return null;
  }
}
