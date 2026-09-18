/**
 * "CAN I HAVE A COPY OF MY WEBSITE?" — ASKED, APPROVED, THEN DOWNLOADED.
 *
 * The client asks on their own page; he approves from Telegram; only then does
 * a download button appear for them. Three reasons it is not simply a button
 * that works straight away:
 *
 *  - the link that opens the client page is the only credential, and a
 *    forwarded link should not silently hand someone a business's whole site;
 *  - he usually wants to know a client is thinking about leaving, or about
 *    rebuilding elsewhere, BEFORE they have the files rather than after;
 *  - an approval is a conversation. Most of these requests turn out to be
 *    "is this really mine", and the answer to that is worth more than a zip.
 *
 * The approval expires. A standing permission granted once, months ago, is not
 * an approval any more — it is a door left open on a page reached by a link
 * that has been sitting in an inbox ever since.
 */

const MARKER = "servolia-copy:";

export const COPY_WINDOW_DAYS = 7;

export interface CopyRequest {
  /** ISO, when the client asked. */
  requested?: string;
  /** ISO, when he approved. Absent means still waiting. */
  approved?: string;
  /** ISO, when approval stops working. */
  until?: string;
  /** ISO, when he said no. */
  refused?: string;
}

export function readCopyRequest(notes: string | null | undefined): CopyRequest | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(MARKER));
  if (!line) return null;
  const out: CopyRequest = {};
  for (const part of line.slice(MARKER.length).split("|")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "requested" || k === "approved" || k === "until" || k === "refused") out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function writeCopyRequest(notes: string | null | undefined, rec: CopyRequest): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(MARKER) && l.trim() !== "");
  const parts = (["requested", "approved", "until", "refused"] as const)
    .filter((k) => rec[k])
    .map((k) => `${k}: ${rec[k]}`);
  if (!parts.length) return kept.join("\n");
  return [...kept, `${MARKER} ${parts.join(" | ")}`].join("\n");
}

export type CopyState = "none" | "waiting" | "ready" | "expired" | "refused";

/**
 * Where a request stands right now.
 *
 * `refused` is deliberately NOT shown to the client as a refusal — see the
 * account page. A client who reads "your request was declined" on a screen
 * with no explanation has been given the worst possible version of a
 * conversation he intended to have himself.
 */
export function copyState(rec: CopyRequest | null, now = Date.now()): CopyState {
  if (!rec) return "none";
  if (rec.refused && !rec.approved) return "refused";
  if (!rec.approved) return rec.requested ? "waiting" : "none";
  if (rec.until && Date.parse(rec.until) < now) return "expired";
  return "ready";
}

/** The approval, valid for a week from now. */
export function approvedNow(rec: CopyRequest | null, now = new Date()): CopyRequest {
  const until = new Date(now.getTime() + COPY_WINDOW_DAYS * 86_400_000);
  return {
    ...(rec?.requested ? { requested: rec.requested } : {}),
    approved: now.toISOString(),
    until: until.toISOString(),
  };
}
