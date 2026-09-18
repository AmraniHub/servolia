import { editableSite } from "@/lib/siteEditor";
import { CLIENT_REFS } from "@/lib/clientRefs";

/**
 * A CLIENT LOOKING AT THEIR OWN WEBSITE'S FILES.
 *
 * Samira asked for the admin of her site and then for full manual control.
 * Underneath both questions is one she has not asked in those words: is this
 * actually mine, or am I renting it from someone who could keep it?
 *
 * A list of her own files, by name and size, answers that better than any
 * sentence on a page can. It is also the honest answer to "can I have a copy" —
 * yes, here is exactly what there is.
 *
 * WHAT IS DELIBERATELY NOT LISTED. Only the folder their host actually serves.
 * The rest of the repository is our plumbing — the hosting gate, build scripts,
 * workflow files — and listing it would answer a question she did not ask with
 * a pile of things that look alarming and are not hers to maintain. Dotfiles go
 * too: nothing good comes of putting `.env.example` in front of a client who
 * will reasonably wonder what secret of theirs is in it.
 */

export interface SiteFile {
  name: string;
  /** Bytes, as GitHub reports them. Folders have none. */
  size: number | null;
  kind: "page" | "image" | "style" | "script" | "font" | "folder" | "other";
}

export interface SiteFiles {
  files: SiteFile[];
  /** Total bytes of the files listed, for "your website is about X". */
  bytes: number;
  /** True when the repository could not be read at all. */
  unavailable: boolean;
}

const HIDDEN = new Set(["node_modules", "api", "google-apps-script"]);

/**
 * Files that are ours, not the client's — hidden from the list AND the archive.
 *
 * `site-status.js` and `middleware.js` are the hosting gate: the switch that
 * takes a site down when an invoice goes unpaid. `build.py` and the README are
 * the notes of the person who built it. `vercel.json` and `package.json` are
 * deployment config no client will ever open on purpose.
 *
 * The first version of this filtered only the archive, so a client's own page
 * listed the gate by name — shown to the one person who should never have to
 * think about it, on the page whose whole job is to make the service feel like
 * theirs.
 */
const NOT_THEIRS = new Set([
  "site-status.js", "middleware.js", "promo.js", "promo-config.json",
  "build.py", "vercel.json", "package.json", "package-lock.json",
]);

export function isOurs(rel: string): boolean {
  const name = rel.split("/").pop() ?? "";
  return NOT_THEIRS.has(name) || /\.(md|py)$/i.test(name);
}

function kindOf(name: string, isDir: boolean): SiteFile["kind"] {
  if (isDir) return "folder";
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (["html", "htm"].includes(ext)) return "page";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "avif"].includes(ext)) return "image";
  if (ext === "css") return "style";
  if (["js", "mjs", "ts"].includes(ext)) return "script";
  if (["woff", "woff2", "ttf", "otf", "eot"].includes(ext)) return "font";
  return "other";
}

/** Which repository and folder a client's site is served from, if we know. */
export function siteSourceFor(ref: string): { repo: string; branch: string; root: string | null } | null {
  const editable = editableSite(ref);
  if (editable) return { repo: editable.repo, branch: editable.branch, root: editable.siteRoot };
  const known = CLIENT_REFS[ref];
  if (known?.repo) return { repo: known.repo, branch: known.branch ?? "main", root: known.siteRoot ?? null };
  return null;
}

/**
 * The files of a client's site, as a client would want to see them.
 *
 * Never throws: this renders inside their service page, and a GitHub hiccup
 * must cost the file list, not the page that tells them what they are paying
 * for.
 */
export async function listSiteFiles(ref: string): Promise<SiteFiles> {
  const src = siteSourceFor(ref);
  const token = process.env.GH_TOKEN;
  if (!src || !token) return { files: [], bytes: 0, unavailable: true };

  const path = src.root ? `/${src.root.replace(/^\/+|\/+$/g, "")}` : "";
  const url = `https://api.github.com/repos/${src.repo}/contents${path}?ref=${encodeURIComponent(src.branch)}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "servolia-client-area",
      },
      // Their own files, on their own page: a minute stale is fine, and it
      // keeps a reloaded page off GitHub's rate limit.
      next: { revalidate: 60 },
    });
    if (!r.ok) return { files: [], bytes: 0, unavailable: true };
    const raw = (await r.json()) as { name: string; size?: number; type: string }[];
    if (!Array.isArray(raw)) return { files: [], bytes: 0, unavailable: true };

    const files = raw
      .filter((e) => !e.name.startsWith(".") && !HIDDEN.has(e.name) && !isOurs(e.name))
      .map((e) => ({
        name: e.name,
        size: e.type === "dir" ? null : (e.size ?? 0),
        kind: kindOf(e.name, e.type === "dir"),
      }))
      // Pages first — they are the part a client recognises as their website.
      .sort((a, b) => {
        const rank = (f: SiteFile) => (f.kind === "page" ? 0 : f.kind === "folder" ? 2 : 1);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });

    return { files, bytes: files.reduce((n, f) => n + (f.size ?? 0), 0), unavailable: false };
  } catch {
    return { files: [], bytes: 0, unavailable: true };
  }
}

/** "1.2 MB" — for a person, not a developer. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── the whole site, for a client who asked for a copy ──────────────────── */

/** Caps. A client's site is a few megabytes; anything past this is a bug. */
const MAX_FILES = 300;
const MAX_BYTES = 40 * 1024 * 1024;

/**
 * One GitHub read, retried.
 *
 * An archive is dozens of calls and ALL of them have to land — one dropped
 * connection two thirds of the way through is not a slow download, it is a
 * failed one, and the client sees an error on a button they were told to press.
 * Building this from a 4G line made that obvious: the same code fetched 46
 * files for one client and timed out on the seventh for the other, twice.
 *
 * Only the connection is retried, never a refusal. A 404 or a 403 means the
 * answer is no, and asking again three times does not change it.
 */
async function ghJson<T>(path: string, token: string, tries = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const r = await fetch(`https://api.github.com${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "servolia-client-area",
        },
        cache: "no-store",
      });
      if (r.status >= 400 && r.status < 500) throw new Error(`GitHub ${r.status} on ${path}`);
      if (!r.ok) { last = new Error(`GitHub ${r.status} on ${path}`); }
      else return (await r.json()) as T;
    } catch (err) {
      if (err instanceof Error && /GitHub 4\d\d/.test(err.message)) throw err;
      last = err;
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw last instanceof Error ? last : new Error(`GitHub unreachable for ${path}`);
}

export async function collectSiteFiles(ref: string): Promise<{ path: string; data: Buffer }[]> {
  const src = siteSourceFor(ref);
  const token = process.env.GH_TOKEN;
  if (!src || !token) throw new Error("no source or no token");

  const head = await ghJson<{ object: { sha: string } }>(
    `/repos/${src.repo}/git/ref/heads/${encodeURIComponent(src.branch)}`, token);
  const commit = await ghJson<{ tree: { sha: string } }>(
    `/repos/${src.repo}/git/commits/${head.object.sha}`, token);
  const tree = await ghJson<{ tree: { path: string; type: string; sha: string; size?: number }[]; truncated?: boolean }>(
    `/repos/${src.repo}/git/trees/${commit.tree.sha}?recursive=1`, token);

  const root = src.root ? `${src.root.replace(/^\/+|\/+$/g, "")}/` : "";
  const wanted = tree.tree.filter((e) => {
    if (e.type !== "blob") return false;
    if (root && !e.path.startsWith(root)) return false;
    const rel = root ? e.path.slice(root.length) : e.path;
    if (!rel || rel.split("/").some((p) => p.startsWith("."))) return false;
    if (rel.split("/").some((p) => HIDDEN.has(p))) return false;
    return !isOurs(rel);
  });

  if (wanted.length > MAX_FILES) throw new Error(`${wanted.length} files is more than this was built for`);
  const total = wanted.reduce((n, e) => n + (e.size ?? 0), 0);
  if (total > MAX_BYTES) throw new Error(`${total} bytes is more than this was built for`);

  /* Eight at a time. One at a time is slow enough to hit a function timeout on
     a site with a hundred images; all at once is how GitHub starts refusing. */
  const out: { path: string; data: Buffer }[] = [];
  for (let i = 0; i < wanted.length; i += 8) {
    const batch = await Promise.all(wanted.slice(i, i + 8).map(async (e) => {
      const blob = await ghJson<{ content: string; encoding: string }>(
        `/repos/${src.repo}/git/blobs/${e.sha}`, token);
      return {
        path: root ? e.path.slice(root.length) : e.path,
        data: Buffer.from(blob.content, (blob.encoding as BufferEncoding) || "base64"),
      };
    }));
    out.push(...batch);
  }
  return out;
}

/* ── putting a file on their live site ──────────────────────────────────── */

/**
 * Write one file into a client's site and commit it.
 *
 * The same blobs → tree → commit → move-the-ref sequence the page editor uses,
 * so an upload is one commit and their host rebuilds once. `force: false` on
 * the ref: if anything else moved the branch since we read it — the editor,
 * another upload, us — this fails rather than overwriting a change nobody saw.
 *
 * Returns the path it wrote, which is not always the path asked for: a file
 * whose name collides with something else gets a number, because silently
 * replacing a photo a client did not mean to replace is worse than an
 * unexpected filename.
 */
export async function putSiteFile(
  ref: string,
  target: string,
  data: Buffer,
  who: string,
  { replace = false }: { replace?: boolean } = {},
): Promise<{ ok: true; path: string; commit: string } | { ok: false; reason: string }> {
  const src = siteSourceFor(ref);
  const token = process.env.GH_TOKEN;
  if (!src || !token) return { ok: false, reason: "no-source" };

  const root = src.root ? `${src.root.replace(/^\/+|\/+$/g, "")}/` : "";
  try {
    const head = await ghJson<{ object: { sha: string } }>(
      `/repos/${src.repo}/git/ref/heads/${encodeURIComponent(src.branch)}`, token);
    const headSha = head.object.sha;
    const commitInfo = await ghJson<{ tree: { sha: string } }>(
      `/repos/${src.repo}/git/commits/${headSha}`, token);
    const tree = await ghJson<{ tree: { path: string; type: string }[] }>(
      `/repos/${src.repo}/git/trees/${commitInfo.tree.sha}?recursive=1`, token);

    const taken = new Set(tree.tree.filter((e) => e.type === "blob").map((e) => e.path));
    let path = `${root}${target}`;
    if (!replace && taken.has(path)) {
      const dot = target.lastIndexOf(".");
      const stem = dot > 0 ? target.slice(0, dot) : target;
      const ext = dot > 0 ? target.slice(dot) : "";
      let n = 2;
      while (taken.has(`${root}${stem}-${n}${ext}`) && n < 100) n += 1;
      path = `${root}${stem}-${n}${ext}`;
    }

    const blob = await ghPost<{ sha: string }>(`/repos/${src.repo}/git/blobs`, token, {
      content: data.toString("base64"),
      encoding: "base64",
    });
    const newTree = await ghPost<{ sha: string }>(`/repos/${src.repo}/git/trees`, token, {
      base_tree: commitInfo.tree.sha,
      tree: [{ path, mode: "100644", type: "blob", sha: blob.sha }],
    });
    const commit = await ghPost<{ sha: string }>(`/repos/${src.repo}/git/commits`, token, {
      message: `${who}: ${replace ? "replaced" : "added"} ${path.slice(root.length)} from the file manager`,
      tree: newTree.sha,
      parents: [headSha],
    });
    await ghPatch(`/repos/${src.repo}/git/refs/heads/${encodeURIComponent(src.branch)}`, token, {
      sha: commit.sha,
      force: false,
    });
    return { ok: true, path: path.slice(root.length), commit: commit.sha };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function ghPost<T>(path: string, token: string, body: unknown): Promise<T> {
  return ghSend<T>(path, token, "POST", body);
}
async function ghPatch(path: string, token: string, body: unknown): Promise<unknown> {
  return ghSend(path, token, "PATCH", body);
}
async function ghSend<T>(path: string, token: string, method: string, body: unknown): Promise<T> {
  const r = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "servolia-client-area",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} on ${method} ${path}: ${(await r.text()).slice(0, 160)}`);
  return (await r.json()) as T;
}

/** Every folder of the site, so the upload form can offer a place to put it. */
export async function siteFolders(ref: string): Promise<string[]> {
  const src = siteSourceFor(ref);
  const token = process.env.GH_TOKEN;
  if (!src || !token) return [];
  try {
    const head = await ghJson<{ object: { sha: string } }>(
      `/repos/${src.repo}/git/ref/heads/${encodeURIComponent(src.branch)}`, token);
    const commitInfo = await ghJson<{ tree: { sha: string } }>(
      `/repos/${src.repo}/git/commits/${head.object.sha}`, token);
    const tree = await ghJson<{ tree: { path: string; type: string }[] }>(
      `/repos/${src.repo}/git/trees/${commitInfo.tree.sha}?recursive=1`, token);
    const root = src.root ? `${src.root.replace(/^\/+|\/+$/g, "")}/` : "";
    const out = new Set<string>([""]);
    for (const e of tree.tree) {
      if (e.type !== "tree") continue;
      if (root && !e.path.startsWith(root)) continue;
      const rel = root ? e.path.slice(root.length) : e.path;
      if (!rel || rel.split("/").some((seg) => seg.startsWith(".") || HIDDEN.has(seg))) continue;
      out.add(rel);
    }
    return [...out].sort();
  } catch {
    return [];
  }
}
