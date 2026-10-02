import { isIP } from "node:net";
import { registrar, readDomainRecord, domainInTeam } from "@/lib/domainSales";
import { readOwnedDomainNote } from "@/lib/ownedDomain";
import { readExtraDomains } from "@/lib/extraDomains";

/**
 * DNS for the domains a client bought through us, managed from their own
 * account page — the "I own this domain" feeling GoDaddy gives, on a domain
 * that actually lives in our Vercel team.
 *
 * WHAT A CLIENT CAN TOUCH, AND WHY THE REST IS LOCKED.
 *  - Records Vercel created itself (creator "system": the apex and wildcard
 *    ALIAS that keep the site online, and the CAA records that let its
 *    certificate renew) are shown locked. Editing one takes the site or its
 *    HTTPS down, and Vercel may rewrite them anyway.
 *  - A, AAAA and CNAME at the root, www or * are refused: those names are
 *    where the hosting answers, and a client record there either fights the
 *    ALIAS or quietly moves the site off the hosting they pay for.
 *  - CAA, NS and SRV are not offered. A wrong CAA blocks the certificate; NS
 *    is the registrar's job; SRV is rare enough to do by hand on request.
 * Everything else — mail (MX, SPF, DKIM, DMARC), verification TXT records,
 * subdomains pointing anywhere — is theirs.
 *
 * Ownership is decided here, from what our own records say they bought, and
 * re-checked against the Vercel team before any call: a domain id in a request
 * body is never trusted on its own.
 */

export const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT"] as const;
export type DnsType = (typeof DNS_TYPES)[number];

/** Names where the hosting answers (A/AAAA/CNAME there would fight it). */
export const HOSTING_NAMES = ["", "www", "*"] as const;

/**
 * Names the hosting itself writes. `_vercel` holds Vercel's domain-ownership
 * proof: a client TXT there lets ANOTHER Vercel account claim the domain off
 * the project they pay us to host. `_acme-challenge` is where certificates are
 * proven; a client record there breaks HTTPS renewal. Refused at any depth.
 */
export const RESERVED_LABELS = ["_vercel", "_acme-challenge"] as const;

export const MIN_TTL = 60;
export const MAX_TTL = 86400;
export const DEFAULT_TTL = 3600;
/** A client never needs more; a script hammering the form would. */
export const MAX_CLIENT_RECORDS = 60;

export interface DnsRecord {
  id: string;
  type: string;
  /** "" is the root (shown as @). */
  name: string;
  value: string;
  ttl: number;
  mxPriority: number | null;
  /** Created by Vercel or otherwise not ours to hand over. */
  locked: boolean;
  lockReason?: "system" | "hosting" | "type";
}

export interface DnsInput {
  type: DnsType;
  name: string;
  value: string;
  ttl: number;
  mxPriority?: number;
}

/* ── pure rules (tested in tests/client-dns.test.mjs) ─────────────────── */

const LABEL = /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/;

/** "@", "", " WWW. " -> normalised relative name, or null if not a valid one. */
export function normaliseName(raw: string, domain: string): string | null {
  let n = String(raw ?? "").trim().toLowerCase();
  if (n === "@") n = "";
  if (n.endsWith(".")) n = n.slice(0, -1);
  // A client pasting the full host ("mail.example.com") means "mail".
  const d = domain.toLowerCase();
  if (n === d) n = "";
  else if (n.endsWith(`.${d}`)) n = n.slice(0, -(d.length + 1));
  if (n === "") return "";
  if (n.length > 200) return null;
  const labels = n.split(".");
  return labels.every((l) => LABEL.test(l)) ? n : null;
}

function hostname(v: string): boolean {
  const h = v.endsWith(".") ? v.slice(0, -1) : v;
  if (!h || h.length > 253) return false;
  const labels = h.split(".");
  return labels.length >= 2 && labels.every((l) => LABEL.test(l));
}

function hasControl(s: string): boolean {
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c === 127) return true;
  }
  return false;
}

export function isHostingName(name: string): boolean {
  return (HOSTING_NAMES as readonly string[]).includes(name);
}

/** Why a record from Vercel may not be edited by the client, or null. */
export function lockReasonFor(rec: { type: string; name: string; creator?: string | null }): DnsRecord["lockReason"] | null {
  if ((rec.creator ?? "") === "system") return "system";
  if (rec.name.split(".").some((l) => (RESERVED_LABELS as readonly string[]).includes(l))) return "system";
  const t = rec.type.toUpperCase();
  if (!(DNS_TYPES as readonly string[]).includes(t)) return "type";
  if ((t === "A" || t === "AAAA" || t === "CNAME") && isHostingName(rec.name)) return "hosting";
  return null;
}

/** Validate and normalise what the client typed. Error messages are shown to them. */
export function validateDnsInput(
  raw: Record<string, unknown>,
  domain: string,
): { ok: true; value: DnsInput } | { ok: false; error: string } {
  const type = String(raw.type ?? "").trim().toUpperCase();
  if (!(DNS_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: `Record type must be one of ${DNS_TYPES.join(", ")}.` };
  }
  // Before normalising: "*" is not a valid label, and the reason deserves its own words.
  if (String(raw.name ?? "").includes("*")) return { ok: false, error: "Wildcard records are managed by the hosting." };
  const name = normaliseName(String(raw.name ?? ""), domain);
  if (name === null) return { ok: false, error: "That name is not valid. Use @ for the root, or letters, digits and hyphens (for example: mail, shop, _dmarc)." };
  if (name.split(".").some((l) => (RESERVED_LABELS as readonly string[]).includes(l))) {
    return { ok: false, error: `${name} is used by the hosting itself (domain ownership and certificates), so it is managed for you.` };
  }
  if ((type === "A" || type === "AAAA" || type === "CNAME") && isHostingName(name)) {
    return { ok: false, error: `${name === "" ? "The root (@)" : name} is where your website is hosted, so its ${type} record is managed for you. Use a subdomain instead (for example: shop).` };
  }
  let value = String(raw.value ?? "").trim();
  if (!value) return { ok: false, error: "The value is empty." };
  if (hasControl(value)) return { ok: false, error: "The value contains characters that cannot go in DNS." };

  if (type === "A") {
    if (isIP(value) !== 4) return { ok: false, error: "An A record needs an IPv4 address, like 192.0.2.10." };
  } else if (type === "AAAA") {
    if (isIP(value) !== 6) return { ok: false, error: "An AAAA record needs an IPv6 address." };
  } else if (type === "CNAME" || type === "MX") {
    value = value.toLowerCase();
    if (!hostname(value)) return { ok: false, error: `A ${type} record needs a host name, like mail.example.net.` };
  } else if (type === "TXT") {
    // Pasted with the quotes some providers show: Vercel adds its own.
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.length > 2048) return { ok: false, error: "That TXT value is too long (2048 characters at most)." };
  }

  const ttlRaw = raw.ttl === undefined || raw.ttl === "" ? DEFAULT_TTL : Number(raw.ttl);
  if (!Number.isInteger(ttlRaw) || ttlRaw < MIN_TTL || ttlRaw > MAX_TTL) {
    return { ok: false, error: `TTL must be between ${MIN_TTL} and ${MAX_TTL} seconds.` };
  }
  const out: DnsInput = { type: type as DnsType, name, value, ttl: ttlRaw };
  if (type === "MX") {
    const p = Number(raw.mxPriority ?? raw.priority ?? 10);
    if (!Number.isInteger(p) || p < 0 || p > 65535) return { ok: false, error: "MX priority must be a whole number from 0 to 65535." };
    out.mxPriority = p;
  }
  return { ok: true, value: out };
}

/**
 * A domain-only order (src/lib/domainOrders.ts) has no row of its own, so it
 * is joined to a hosting client BY THE FOUNDER, never automatically: matching
 * on email alone let anyone who typed a client's address at a hosting checkout
 * take over that client's DNS. /api/admin/hosting/dns-link writes this marker
 * after checking the order's email matches the row.
 */
export const LINKED_DOMAIN_NOTE = "servolia-dns-domain:";

export function writeLinkedDomain(notes: string | null | undefined, domain: string): string {
  const d = domain.trim().toLowerCase();
  const lines = (notes ?? "").split(NL).filter((l) => l.trim() && l !== `${LINKED_DOMAIN_NOTE}${d}`);
  return [...lines, `${LINKED_DOMAIN_NOTE}${d}`].join(NL);
}

/* Built, not typed: a backslash-n in this file has already been eaten once by a shell patch. */
const NL = String.fromCharCode(10);

/** The domains our own records say this client bought from us, from their row's notes. */
export function domainsFromNotes(notes: string | null | undefined): string[] {
  const out = new Set<string>();
  const plan = readDomainRecord(notes);
  if (plan && plan.status === "bought") out.add(plan.domain.toLowerCase());
  const owned = readOwnedDomainNote(notes);
  if (owned?.domain) out.add(owned.domain.toLowerCase());
  for (const d of readExtraDomains(notes)) {
    if (!d.failed && d.boughtAt) out.add(d.domain.toLowerCase());
  }
  for (const line of (notes ?? "").split(NL)) {
    if (line.startsWith(LINKED_DOMAIN_NOTE)) {
      const d = line.slice(LINKED_DOMAIN_NOTE.length).trim().toLowerCase();
      if (d) out.add(d);
    }
  }
  return [...out];
}

/* ── the calls ────────────────────────────────────────────────────────── */

/**
 * Every domain this client may manage: the ones their own row's notes record
 * (written only by our checkout, webhook and admin), each kept only if it was
 * bought through our Vercel team.
 */
export async function clientDomains(row: { notes: string | null }): Promise<string[]> {
  const found = domainsFromNotes(row.notes);
  const checked = await Promise.all(found.map(async (d) => ((await domainInTeam(d)).inTeam === true ? d : null)));
  return checked.filter((d): d is string => Boolean(d)).sort();
}

interface VercelRecord {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl?: number;
  mxPriority?: number | null;
  creator?: string | null;
}

export async function listDnsRecords(domain: string): Promise<{ ok: true; records: DnsRecord[] } | { ok: false; error: string }> {
  const res = await registrar<{ records?: VercelRecord[] }>(`/v4/domains/${encodeURIComponent(domain)}/records?limit=100`);
  if (!res.ok) return { ok: false, error: apiError(res) };
  const records = (res.data.records ?? []).map((r) => {
    const reason = lockReasonFor(r);
    return {
      id: r.id,
      type: r.type,
      name: r.name ?? "",
      value: r.value,
      ttl: r.ttl ?? DEFAULT_TTL,
      mxPriority: r.mxPriority ?? null,
      locked: Boolean(reason),
      ...(reason ? { lockReason: reason } : {}),
    } satisfies DnsRecord;
  });
  const order = (r: DnsRecord) => (r.locked ? 1 : 0);
  records.sort((a, b) => order(a) - order(b) || a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  return { ok: true, records };
}

function body(input: DnsInput): string {
  return JSON.stringify({
    name: input.name,
    type: input.type,
    value: input.value,
    ttl: input.ttl,
    ...(input.type === "MX" ? { mxPriority: input.mxPriority ?? 10 } : {}),
  });
}

export async function createDnsRecord(domain: string, input: DnsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await registrar(`/v2/domains/${encodeURIComponent(domain)}/records`, { method: "POST", body: body(input) });
  return res.ok ? { ok: true } : { ok: false, error: apiError(res) };
}

export async function updateDnsRecord(recordId: string, input: DnsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await registrar(`/v1/domains/records/${encodeURIComponent(recordId)}`, { method: "PATCH", body: body(input) });
  return res.ok ? { ok: true } : { ok: false, error: apiError(res) };
}

export async function deleteDnsRecord(domain: string, recordId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await registrar(`/v2/domains/${encodeURIComponent(domain)}/records/${encodeURIComponent(recordId)}`, { method: "DELETE" });
  return res.ok ? { ok: true } : { ok: false, error: apiError(res) };
}

function apiError(res: { status: number; code?: string; message?: string }): string {
  if (res.code === "test_mode") return "Test mode: DNS is not changed.";
  if (res.code === "not_configured") return "DNS management is not available right now.";
  if (res.status === 0) return "Could not reach the DNS service. Please try again in a minute.";
  // Vercel's own wording is specific and safe to show ("A record with that name already exists").
  return res.message ? `DNS refused the change: ${res.message}` : `DNS refused the change (HTTP ${res.status}).`;
}
