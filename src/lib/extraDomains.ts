/**
 * DOMAINS A CLIENT BOUGHT AFTER THEIR PLAN.
 *
 * `servolia-domain:` holds ONE record — the domain that came with the plan. It
 * is a single line by design: the checkout writes it, the account page reads
 * it, and the billing cron charges it. A client buying a second domain cannot
 * go in there without erasing the first.
 *
 * So each add-on gets its own line, and there may be as many as they buy.
 *
 * WHY THEY CARRY THEIR OWN RENEWAL DATE. The plan's domain renews with the
 * plan — a client on an annual plan pays for both in one charge. An add-on
 * bought in March does not line up with a plan that renews in September, so
 * every one of these carries the date it is next charged and the cron reads
 * that rather than inferring anything from the subscription.
 */

const MARKER = "servolia-extra-domain:";

export interface ExtraDomain {
  domain: string;
  /** What the client pays each year, and was quoted at the time. */
  retailUsd: number;
  /** ISO date. The registrar order, once it succeeded. */
  boughtAt?: string;
  orderId?: string;
  /** ISO date the next yearly charge goes on their invoice. */
  nextChargeAt?: string;
  /** Set when the registrar refused, so it is visible rather than silent. */
  failed?: string;
}

function parse(line: string): ExtraDomain | null {
  const kv: Record<string, string> = {};
  for (const part of line.slice(MARKER.length).split("|")) {
    const i = part.indexOf(":");
    if (i > 0) kv[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const price = Number(kv.retail);
  if (!kv.domain || !Number.isFinite(price)) return null;
  return {
    domain: kv.domain,
    retailUsd: price,
    ...(kv.bought ? { boughtAt: kv.bought } : {}),
    ...(kv.order ? { orderId: kv.order } : {}),
    ...(kv.next ? { nextChargeAt: kv.next } : {}),
    ...(kv.failed ? { failed: kv.failed } : {}),
  };
}

export function readExtraDomains(notes: string | null | undefined): ExtraDomain[] {
  return (notes ?? "")
    .split("\n")
    .filter((l) => l.startsWith(MARKER))
    .map(parse)
    .filter((d): d is ExtraDomain => d !== null);
}

function render(d: ExtraDomain): string {
  const parts = [`domain: ${d.domain}`, `retail: ${d.retailUsd}`];
  if (d.boughtAt) parts.push(`bought: ${d.boughtAt}`);
  if (d.orderId) parts.push(`order: ${d.orderId}`);
  if (d.nextChargeAt) parts.push(`next: ${d.nextChargeAt}`);
  if (d.failed) parts.push(`failed: ${d.failed}`);
  return `${MARKER} ${parts.join(" | ")}`;
}

/**
 * Add or update one add-on domain, leaving the others and every other marker
 * alone. Matching is on the domain name, so the webhook can be delivered twice
 * — Stripe does that — without the client owning two of the same thing.
 */
export function writeExtraDomain(notes: string | null | undefined, rec: ExtraDomain): string {
  const keep = (notes ?? "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .filter((l) => !(l.startsWith(MARKER) && parse(l)?.domain === rec.domain));
  return [...keep, render(rec)].join("\n");
}

export function hasExtraDomain(notes: string | null | undefined, domain: string): boolean {
  return readExtraDomains(notes).some((d) => d.domain === domain.toLowerCase());
}
