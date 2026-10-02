/**
 * MANAGED ADD-ON SUBSCRIPTIONS, RECORDED (an extra mailbox at EUR 12/month...).
 *
 * Until 2026-10-02 an add-on purchase was provisioned and forgotten: nothing
 * stored its subscription id, so a redelivered event asked the owner to
 * create the mailboxes a second time, a declined renewal matched no client,
 * and a cancellation alert said "Unknown client".
 *
 * Each add-on is now one line on the client's `clients.notes`, keyed by its
 * Stripe subscription id, in the same one-line format as top-ups
 * (conversationCap.ts) and extra domains (extraDomains.ts) — no migration:
 *
 *   servolia-addon: sub: sub_123 | addon: email | since: 2026-10-02 | session: cs_... | amount: 12
 *   ... | cancelled: 2026-11-02            (once Stripe ends it)
 *
 * The webhook writes it on checkout.session.completed (a replay finds it and
 * stops), names the client from it on invoice.payment_failed and on
 * customer.subscription.deleted, and the daily billing check counts these
 * subscriptions as known.
 */

export const ADDON_MARKER = "servolia-addon:";

export interface AddonRecord {
  subscription: string;
  addon: string;
  since: string;
  session?: string;
  amountEur?: number;
  siteSlug?: string;
  cancelled?: string;
}

function parse(line: string): AddonRecord | null {
  const kv: Record<string, string> = {};
  for (const part of line.slice(ADDON_MARKER.length).split("|")) {
    const i = part.indexOf(":");
    if (i > 0) kv[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  if (!kv.sub || !kv.sub.startsWith("sub_")) return null;
  const amount = Number(kv.amount);
  return {
    subscription: kv.sub,
    addon: kv.addon || "unknown",
    since: kv.since || "",
    ...(kv.session ? { session: kv.session } : {}),
    ...(kv.amount && Number.isFinite(amount) ? { amountEur: amount } : {}),
    ...(kv.site ? { siteSlug: kv.site } : {}),
    ...(kv.cancelled ? { cancelled: kv.cancelled } : {}),
  };
}

function render(r: AddonRecord): string {
  const clean = (s: string) => s.replace(/[|\n]/g, "/").trim();
  const parts = [`sub: ${r.subscription}`, `addon: ${clean(r.addon)}`, `since: ${r.since}`];
  if (r.session) parts.push(`session: ${r.session}`);
  if (r.amountEur !== undefined) parts.push(`amount: ${r.amountEur}`);
  if (r.siteSlug) parts.push(`site: ${clean(r.siteSlug)}`);
  if (r.cancelled) parts.push(`cancelled: ${r.cancelled}`);
  return `${ADDON_MARKER} ${parts.join(" | ")}`;
}

export function readAddons(notes: string | null | undefined): AddonRecord[] {
  return (notes ?? "")
    .split("\n")
    .filter((l) => l.startsWith(ADDON_MARKER))
    .map(parse)
    .filter((r): r is AddonRecord => r !== null);
}

/** The add-on recorded under this subscription id, or null. Exact match. */
export function addonFor(notes: string | null | undefined, subscriptionId: string | null | undefined): AddonRecord | null {
  if (!subscriptionId) return null;
  return readAddons(notes).find((r) => r.subscription === subscriptionId) ?? null;
}

/** Add (or replace) the line for this subscription, every other line kept. */
export function writeAddon(notes: string | null | undefined, rec: AddonRecord): string {
  const kept = (notes ?? "").split("\n").filter((l) => {
    if (l.trim() === "") return false;
    if (!l.startsWith(ADDON_MARKER)) return true;
    return parse(l)?.subscription !== rec.subscription;
  });
  return [...kept, render(rec)].join("\n");
}

/** Stamp the cancellation date once; null when there is no such add-on. */
export function markAddonCancelled(notes: string | null | undefined, subscriptionId: string, onIso: string): string | null {
  const rec = addonFor(notes, subscriptionId);
  if (!rec) return null;
  if (rec.cancelled) return notes ?? "";
  return writeAddon(notes, { ...rec, cancelled: onIso });
}
