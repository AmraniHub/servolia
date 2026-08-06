import { supabaseAdmin } from "@/lib/supabase";

/**
 * CLIENT DOMAINS — Servolia manages them; the client owns them.
 *
 * THE MODEL, and why it is the way it is. An agency holding a client's domain
 * buys lock-in and pays for it twice over:
 *   - the beachhead is 200–500 dentists who all know each other, so one story
 *     of "they wouldn't release my domain" travels the whole niche;
 *   - Servolia is one person, so owning every client's domain means one
 *     unreachable founder takes down every clinic's website AND email at once,
 *     which for a medical practice is not an inconvenience.
 * The real moat is the bundle — leaving means losing site, receptionist,
 * hosting, email and lead history together. That is earned switching cost.
 * Domain hostage adds almost nothing to it and risks the referral network.
 *
 * So: the CLIENT is always the registrant (CGV 7 bis). Servolia holds the
 * technical keys and runs DNS. This file is the machinery for that.
 *
 * CLOUDFLARE REGISTRAR API — verified against the docs 2026-08-01, beta:
 *   search    GET  /accounts/{id}/registrar/domain-search?q=
 *   check     POST /accounts/{id}/registrar/domain-check
 *   register  POST /accounts/{id}/registrar/registrations
 * Contacts CAN be supplied at registration, which is what makes the
 * client-as-registrant model possible at all.
 *
 * WHAT THE API CANNOT DO YET (all three matter):
 *   - RENEW. So expiry is tracked here and alarmed by a cron. A missed
 *     renewal kills a clinic's site and email — this is the single most
 *     damaging thing that can go wrong in the whole product.
 *   - TRANSFER. A client leaving is a dashboard operation, done by hand.
 *   - UPDATE CONTACTS. Registrant details are effectively one-shot, so they
 *     must be right at registration; getContactFromClient() is deliberate
 *     about refusing to guess.
 */

const CF_API = "https://api.cloudflare.com/client/v4";

/** Days before expiry at which the watchdog starts shouting. */
export const RENEWAL_WARN_DAYS = 45;
export const RENEWAL_URGENT_DAYS = 14;

export interface DomainRow {
  id: string;
  client_id: string | null;
  build_id: string | null;
  email: string | null;
  domain: string;
  registrar: string;
  registrant_name: string | null;
  registrant_org: string | null;
  registrant_email: string | null;
  status: "active" | "pending" | "expired" | "transferred_out";
  registered_at: string | null;
  expires_at: string | null;
  auto_renew: boolean;
  notes: string | null;
}

/** The registrant — the legal owner. Always the client, never Servolia. */
export interface Registrant {
  name: string;
  organization?: string;
  email: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** ISO-3166 alpha-2, e.g. "FR". */
  countryCode: string;
}

function cfConfigured(): { accountId: string; token: string } | null {
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  const token = (process.env.CLOUDFLARE_API_TOKEN ?? "").trim();
  return accountId && token ? { accountId, token } : null;
}

async function cf<T>(path: string, init?: RequestInit): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const cfg = cfConfigured();
  if (!cfg) return { ok: false, error: "Cloudflare not configured — set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Registrar write)." };
  try {
    const res = await fetch(`${CF_API}/accounts/${cfg.accountId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json()) as { success?: boolean; result?: T; errors?: { message: string }[] };
    if (!res.ok || json.success === false) {
      return { ok: false, error: json.errors?.map((e) => e.message).join("; ") || `Cloudflare returned ${res.status}` };
    }
    return { ok: true, result: json.result as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error reaching Cloudflare" };
  }
}

export interface AvailabilityResult {
  domain: string;
  available: boolean;
  priceEur?: number | null;
}

/** Is this exact domain free, and what does it cost? */
export async function checkDomain(domain: string) {
  return cf<AvailabilityResult[]>("/registrar/domain-check", {
    method: "POST",
    body: JSON.stringify({ domain_names: [domain.trim().toLowerCase()] }),
  });
}

/** Suggestions around a query — used when the client's first choice is taken. */
export async function searchDomains(query: string, limit = 10) {
  const q = encodeURIComponent(query.trim().toLowerCase());
  return cf<AvailabilityResult[]>(`/registrar/domain-search?q=${q}&limit=${limit}`);
}

/**
 * Register a domain WITH THE CLIENT AS REGISTRANT.
 *
 * The contact block is not optional in practice: omitting it makes Cloudflare
 * use the account default, which would put Servolia's details on the WHOIS
 * record — the exact outcome the whole model exists to avoid. And since the
 * beta API cannot update contacts afterwards, getting it wrong here is not
 * cheaply fixable. So a missing registrant is refused rather than defaulted.
 */
export async function registerDomain(domain: string, registrant: Registrant, years = 1) {
  if (!registrant?.name?.trim() || !registrant?.email?.trim() || !registrant?.countryCode?.trim()) {
    return {
      ok: false as const,
      error: "Registrant name, email and country are required — Servolia must never be the registrant on a client domain (CGV 7 bis), and Cloudflare's beta API cannot change contacts after registration.",
    };
  }

  return cf<{ domain_name: string; expires_at?: string; status?: string }>("/registrar/registrations", {
    method: "POST",
    body: JSON.stringify({
      domain_name: domain.trim().toLowerCase(),
      years,
      contact: {
        email: registrant.email.trim(),
        phone: registrant.phone?.trim(),
        postal_info: {
          name: registrant.name.trim(),
          organization: registrant.organization?.trim(),
          address: {
            street: registrant.street?.trim(),
            city: registrant.city?.trim(),
            state: registrant.state?.trim(),
            postal_code: registrant.postalCode?.trim(),
            country_code: registrant.countryCode.trim().toUpperCase(),
          },
        },
      },
    }),
  });
}

/* ─────────────────────────── storage + renewals ─────────────────────────── */

/** Record a domain against a client. Also used for domains registered by hand. */
export async function recordDomain(row: Partial<DomainRow> & { domain: string }) {
  const db = supabaseAdmin();
  if (!db) return { ok: false as const, error: "Supabase not configured" };
  const { error } = await db.from("client_domains").upsert(
    { ...row, domain: row.domain.trim().toLowerCase(), updated_at: new Date().toISOString() },
    { onConflict: "domain" },
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/** The domain shown to a client in their portal, if any. */
export async function domainForEmail(email: string): Promise<DomainRow | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  try {
    const { data } = await db.from("client_domains").select("*").eq("email", email)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return (data as DomainRow) ?? null;
  } catch {
    return null; // table not created yet — the panel simply doesn't render
  }
}

export interface RenewalAlert {
  domain: string;
  email: string | null;
  daysLeft: number;
  urgent: boolean;
}

/**
 * Domains approaching expiry. Cloudflare's API cannot renew, so this exists
 * to make sure a human does — before a clinic's site and email disappear.
 */
export async function renewalsDue(): Promise<RenewalAlert[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const cutoff = new Date(Date.now() + RENEWAL_WARN_DAYS * 864e5).toISOString();
    const { data, error } = await db.from("client_domains")
      .select("domain, email, expires_at, status")
      .lte("expires_at", cutoff)
      .neq("status", "transferred_out")
      .order("expires_at", { ascending: true });
    if (error || !data) return [];

    return (data as Pick<DomainRow, "domain" | "email" | "expires_at" | "status">[])
      .filter((d) => d.expires_at)
      .map((d) => {
        const daysLeft = Math.ceil((new Date(d.expires_at as string).getTime() - Date.now()) / 864e5);
        return { domain: d.domain, email: d.email, daysLeft, urgent: daysLeft <= RENEWAL_URGENT_DAYS };
      });
  } catch {
    return [];
  }
}
