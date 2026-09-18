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
      .filter((e) => !e.name.startsWith(".") && !HIDDEN.has(e.name))
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
