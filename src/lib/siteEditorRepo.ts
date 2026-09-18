/**
 * Reading and writing a client's pages on GitHub, for the page editor.
 *
 * The same blobs → tree → commit → move-the-ref sequence assistantInstall.ts
 * uses, for the same reason: ONE commit whatever it touches, so a client's
 * site is never briefly half-saved, and their host rebuilds once rather than
 * once per file.
 *
 * The token never leaves the server. The client is editing their own website
 * and has no idea GitHub is involved, which is the point — they asked for
 * control of their pages, not an account somewhere else.
 */
import type { EditableSite, EditableField } from "@/lib/siteEditor";
import { readRegion, writeRegion } from "@/lib/siteEditor";

const GITHUB_API = "https://api.github.com";

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
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function pathFor(site: EditableSite, file: string): string {
  return site.siteRoot ? `${site.siteRoot.replace(/^\/+|\/+$/g, "")}/${file}` : file;
}

async function readFile(site: EditableSite, file: string): Promise<string> {
  const p = encodeURI(pathFor(site, file));
  const r = await gh<{ content: string; encoding: string }>(
    `/repos/${site.repo}/contents/${p}?ref=${encodeURIComponent(site.branch)}`,
  );
  return Buffer.from(r.content, (r.encoding as BufferEncoding) || "base64").toString("utf8");
}

export interface CurrentValue {
  key: string;
  value: string;
  /** Set when the marker is missing or sits on a container full of markup. */
  problem?: "not-found" | "has-markup" | "unbalanced";
}

/** What the client currently has on one page, field by field. */
export async function readCurrent(site: EditableSite, fields: EditableField[]): Promise<CurrentValue[]> {
  const byFile = new Map<string, EditableField[]>();
  for (const f of fields) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);

  const out: CurrentValue[] = [];
  for (const [file, fs] of byFile) {
    const html = await readFile(site, file);
    for (const f of fs) {
      const r = readRegion(html, f.key);
      out.push(r.ok ? { key: f.key, value: r.value } : { key: f.key, value: "", problem: r.reason });
    }
  }
  return out;
}

export type SaveOutcome =
  | { ok: true; changed: string[]; commit: string; skipped: string[] }
  | { ok: true; changed: []; commit: null; skipped: string[] }
  | { ok: false; reason: "no-token" | "error"; detail?: string };

/**
 * Apply the client's edits and commit them as ONE change.
 *
 * Nothing is written when nothing actually differs: opening the editor and
 * pressing Save without typing must not rebuild their site, and must not put
 * an empty commit in their history.
 */
export async function saveEdits(
  site: EditableSite,
  fields: EditableField[],
  values: Record<string, string>,
  who: string,
): Promise<SaveOutcome> {
  if (!process.env.GH_TOKEN) return { ok: false, reason: "no-token" };
  try {
    const wanted = fields.filter((f) => typeof values[f.key] === "string");
    const byFile = new Map<string, EditableField[]>();
    for (const f of wanted) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);

    const changedFiles: { path: string; content: string }[] = [];
    const changed: string[] = [];
    const skipped: string[] = [];

    for (const [file, fs] of byFile) {
      let html = await readFile(site, file);
      let touched = false;
      for (const f of fs) {
        const res = writeRegion(html, f.key, values[f.key]);
        if (res.changed) { html = res.html; touched = true; changed.push(f.key); }
        else if (readRegion(html, f.key).ok === false) skipped.push(f.key);
      }
      if (touched) changedFiles.push({ path: pathFor(site, file), content: html });
    }

    if (!changedFiles.length) return { ok: true, changed: [], commit: null, skipped };

    const branch = site.branch;
    const ref = await gh<{ object: { sha: string } }>(
      `/repos/${site.repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    const headSha = ref.object.sha;
    const head = await gh<{ tree: { sha: string } }>(`/repos/${site.repo}/git/commits/${headSha}`);

    const tree: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];
    for (const f of changedFiles) {
      const b = await gh<{ sha: string }>(`/repos/${site.repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
      });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: b.sha });
    }
    const newTree = await gh<{ sha: string }>(`/repos/${site.repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: head.tree.sha, tree }),
    });
    const commit = await gh<{ sha: string }>(`/repos/${site.repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        /* Named so the history reads as the client's own edits, not ours —
           it is their site and their change, and a revert should be obvious. */
        message: `${site.businessName}: edited ${changed.length} item${changed.length === 1 ? "" : "s"} from the page editor\n\nFields: ${changed.join(", ")}\nBy: ${who}`,
        tree: newTree.sha,
        parents: [headSha],
      }),
    });
    /* force:false — if anything else moved the branch since we read it, this
       fails rather than overwriting a change we never saw. */
    await gh(`/repos/${site.repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    return { ok: true, changed, commit: commit.sha, skipped };
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}
