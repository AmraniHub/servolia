/**
 * WHAT A PAYING PRACTICE HAS BEEN PROMISED AND NOT YET GIVEN (2026-09-23).
 *
 * Every plan page promised hosting, a domain and a pro email as included,
 * and no code delivered or even tracked the last two. The promise now reads exactly
 * what is done (her own domain connected, or a new one Servolia registers,
 * fees included; ONE professional address on it), and this file keeps it:
 * /admin/today lists every active plan whose site is live without either,
 * until the internet itself says it is done.
 *
 *   domain   done when her site answers at her own domain (C2 stamps
 *            config.domainLiveAt the first time it does);
 *   mailbox  done when that domain publishes MX records. A practice that
 *            already had email at her domain is done on day one, which is
 *            right: she has her professional address.
 *
 * Only generated sites. A receptionist-only client (assistantOnly) came with
 * her own site, domain and mail; nothing here was ever hers to be owed.
 */

export type MailState = { state: "ready"; hosts: string[] } | { state: "none" } | { state: "unknown" };

export interface OwedSite {
  slug: string;
  status: string;
  config: {
    businessName?: string;
    customDomain?: string;
    domainLiveAt?: string;
    assistantOnly?: boolean;
    isDemo?: boolean;
  } | null;
}

export type Owed =
  | { kind: "domain-owed" }
  | { kind: "mailbox-owed"; domain: string }
  | { kind: "mailbox-unchecked"; domain: string }
  | null;

const apex = (d: string) => d.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

/** The domain whose mail must be checked, or null when there is none to check yet. */
export function mailDomainFor(site: OwedSite): string | null {
  const c = site.config;
  if (!c || c.assistantOnly || c.isDemo || site.status !== "published") return null;
  return c.customDomain && c.domainLiveAt ? apex(c.customDomain) : null;
}

export function whatIsOwed(site: OwedSite, mail?: MailState): Owed {
  const c = site.config;
  if (!c || c.assistantOnly || c.isDemo || site.status !== "published") return null;
  if (!c.customDomain) return { kind: "domain-owed" };
  // Attached but not answering yet: the C2 "domain-waiting" row already says so.
  if (!c.domainLiveAt) return null;
  const domain = apex(c.customDomain);
  if (!mail || mail.state === "unknown") return { kind: "mailbox-unchecked", domain };
  return mail.state === "none" ? { kind: "mailbox-owed", domain } : null;
}

/**
 * The domain's MX hosts, asked fresh (no cache: the row must clear the same
 * morning the mailbox is created). A failed lookup is "unknown", never "none"
 * — telling him a practice has no email when the resolver merely timed out
 * would send him to fix something that works.
 */
export async function mailState(domain: string, timeoutMs = 4000): Promise<MailState> {
  const d = apex(domain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return { state: "unknown" };
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(d)}&type=MX`, {
      headers: { Accept: "application/dns-json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { state: "unknown" };
    const j = (await r.json()) as { Status?: number; Answer?: { type: number; data: string }[] };
    if (j.Status !== 0 && j.Status !== 3) return { state: "unknown" }; // SERVFAIL and friends
    const hosts = (j.Answer ?? [])
      .filter((a) => a.type === 15)
      .map((a) => a.data.replace(/^\d+\s+/, "").trim())
      // RFC 7505 "0 ." is a domain declaring it takes NO mail.
      .filter((h) => h && h !== ".");
    return hosts.length ? { state: "ready", hosts } : { state: "none" };
  } catch {
    return { state: "unknown" };
  }
}
