/**
 * A CLIENT ASKING FOR ANOTHER DOMAIN.
 *
 * Kept in its OWN marker, deliberately apart from `servolia-domain:`. That
 * record is the real one — it says what we bought, what it cost, when it
 * renews and which project it is attached to, and the billing cron reads it.
 * Writing a client's wish into it would put a domain nobody has purchased in
 * front of them as "being registered", and would overwrite the record of the
 * domain they already have.
 *
 * So a request is a request until he buys it, and the purchase stays where the
 * verified buttons are.
 */

const MARKER = "servolia-domain-request:";

export interface DomainRequest {
  domain: string;
  /** What the client was quoted, so nobody is surprised by the invoice. */
  yearlyUsd: number;
  requested: string;
  /** ISO, once he has said no. */
  refused?: string;
}

export function readDomainRequest(notes: string | null | undefined): DomainRequest | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(MARKER));
  if (!line) return null;
  const kv: Record<string, string> = {};
  for (const part of line.slice(MARKER.length).split("|")) {
    const i = part.indexOf(":");
    if (i > 0) kv[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const price = Number(kv.usd);
  if (!kv.domain || !Number.isFinite(price)) return null;
  return {
    domain: kv.domain,
    yearlyUsd: price,
    requested: kv.requested ?? "",
    ...(kv.refused ? { refused: kv.refused } : {}),
  };
}

export function writeDomainRequest(notes: string | null | undefined, rec: DomainRequest | null): string {
  const kept = (notes ?? "").split("\n").filter((l) => !l.startsWith(MARKER) && l.trim() !== "");
  if (!rec) return kept.join("\n");
  const parts = [
    `domain: ${rec.domain}`,
    `usd: ${rec.yearlyUsd}`,
    `requested: ${rec.requested}`,
    ...(rec.refused ? [`refused: ${rec.refused}`] : []),
  ];
  return [...kept, `${MARKER} ${parts.join(" | ")}`].join("\n");
}

/**
 * What the client's page should say about their request.
 *
 * A refusal reads as nothing, the same as the copy request: a page that
 * reports "declined" with no reason and nobody to ask is worse for them than
 * a search box they can use again.
 */
export function domainRequestState(rec: DomainRequest | null): "none" | "waiting" {
  return rec && !rec.refused ? "waiting" : "none";
}
