/**
 * HOSTING SUSPENSION GATE
 *
 * Flips a client site between served and "payment due" by committing a one-line
 * change to site-status.js in their repo, which triggers their own Vercel
 * redeploy. Nothing is fetched at request time, so a gated or ungated site
 * costs the visitor nothing and does not depend on Servolia being up.
 *
 * THE PATH BUG THIS EXISTS TO AVOID
 *
 * The original agency-dashboard scripts read `billing.json` and
 * `site-status.js` by bare relative path, assuming the site sits at the repo
 * root. That is not always true: goodscochina.com deploys from `web/`. Written
 * to the repo root, the files land somewhere Vercel never serves — the gate
 * targets nothing and the notice page shows no amount. Everything looks fine
 * and does nothing. `siteRoot` on the client row is what prevents that, and it
 * is required here rather than optional so it cannot be forgotten.
 *
 * Requires GH_TOKEN with contents:write on the client repo.
 */

const GITHUB_API = "https://api.github.com";

export interface GateTarget {
  /** e.g. "AmraniHub/yiwugoodsco-com" */
  repo: string;
  /** e.g. "main" */
  branch?: string | null;
  /** e.g. "web" — null/empty means the repo root */
  siteRoot?: string | null;
}

/** Join siteRoot and a file, tolerating null, "" and a trailing slash. */
export function sitePath(siteRoot: string | null | undefined, file: string): string {
  const root = (siteRoot ?? "").replace(/^\/+|\/+$/g, "");
  return root ? `${root}/${file}` : file;
}

/** The single line both this and the site's middleware agree on. */
const SUSPENDED_RE = /^(export const suspended = )(true|false);$/m;

function statusSource(suspended: boolean): string {
  return [
    "// Written by Servolia. Do not edit by hand — a hosting payment event",
    "// overwrites this file, and a manual edit will be silently replaced.",
    "//",
    "// The line below is matched anchored to the start of the line, so its",
    "// exact shape matters.",
    `export const suspended = ${suspended};`,
    "",
  ].join("\n");
}

async function gh(path: string, init: RequestInit = {}) {
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
    // A private repo the token cannot read is by far the most common cause,
    // and GitHub reports it as 404 rather than 403 — say so, or it reads as
    // "the file is missing".
    const hint = res.status === 404 ? " (private repo the token cannot read, or wrong path?)" : "";
    throw new Error(`GitHub ${res.status}${hint}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/* ── Shopify ────────────────────────────────────────────────────────────────
 * A Shopify theme has no site-status.js. The gate is a generated snippet that
 * renders either the live widget or its suspended twin, and flipping it is a
 * text swap on that one line.
 *
 * NOTE the storefront is never gated -- only the paid add-on. A shop turning
 * over real money loses more in a day than the invoice is worth, and blocking
 * checkout over $12 reads as sabotage rather than a reminder.
 */
const GATE_PATH = "snippets/subscription-gate.liquid";

/** Swap `render 'x-suspended'` for `render 'x'` and back. */
function flipGate(source: string, widget: string, suspend: boolean): string {
  if (suspend) {
    // `render 'chatbot'` -> `render 'chatbot-suspended'`, leaving params alone
    return source.replace(
      new RegExp(`render '${widget}'`, "g"),
      `render '${widget}-suspended'`,
    );
  }
  // `render 'chatbot-suspended', monthly: '…', balance: '…'` -> `render 'chatbot'`
  return source.replace(
    new RegExp(`render '${widget}-suspended'(?:,[^-]*?)?(?= -%\\})`, "g"),
    `render '${widget}'`,
  );
}

export async function setShopifyGate(
  target: GateTarget,
  widget: string,
  suspend: boolean,
): Promise<boolean> {
  const branch = target.branch || "main";
  const path = sitePath(target.siteRoot, GATE_PATH);

  const current = (await gh(
    `/repos/${target.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
  )) as { sha: string; content: string };

  const decoded = Buffer.from(current.content, "base64").toString("utf8");
  const next = flipGate(decoded, widget, suspend);
  if (next === decoded) return false;

  await gh(`/repos/${target.repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: suspend
        ? `Pause ${widget}: payment overdue`
        : `Restore ${widget}: payment received`,
      content: Buffer.from(next, "utf8").toString("base64"),
      sha: current.sha,
      branch,
    }),
  });
  return true;
}

/**
 * Set the gate. Returns false when the file already says what we want, so a
 * repeated webhook does not push an empty commit and trigger a pointless
 * redeploy of the client's site.
 */
export async function setSuspended(target: GateTarget, suspended: boolean): Promise<boolean> {
  const branch = target.branch || "main";
  const path = sitePath(target.siteRoot, "site-status.js");

  const current = await gh(
    `/repos/${target.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
  ) as { sha: string; content: string };

  const decoded = Buffer.from(current.content, "base64").toString("utf8");
  const match = decoded.match(SUSPENDED_RE);
  if (match && (match[2] === "true") === suspended) return false;

  await gh(`/repos/${target.repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: suspended
        ? "Suspend site: hosting payment overdue"
        : "Restore site: hosting payment received",
      content: Buffer.from(statusSource(suspended), "utf8").toString("base64"),
      sha: current.sha,
      branch,
    }),
  });
  return true;
}
