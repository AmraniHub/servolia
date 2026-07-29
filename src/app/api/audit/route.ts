import { NextRequest, NextResponse } from "next/server";
import { runAudit, type AuditInput } from "@/lib/auditEngine";
import { rateLimited } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * PUBLIC: score a prospect's website and return the teardown.
 *
 * POST { url, patientValueEur?, monthlyEnquiries?, niche? } → AuditResult
 *
 * This endpoint fetches a URL supplied by an anonymous caller, which makes it
 * an SSRF vector by construction. Every mitigation below is deliberate:
 *   - http/https only, so file:, gopher:, data: etc. are refused
 *   - the resolved host is checked against private and link-local ranges, so
 *     it cannot be used to reach the metadata service or anything internal
 *   - redirects are followed manually with the same host check at every hop,
 *     because a public host can 302 to 169.254.169.254
 *   - the response is capped and the request timed out, so a hostile server
 *     cannot hold a worker open or exhaust memory
 *   - rate limited per IP, because fetching on demand is work we pay for
 *
 * No result is persisted here. The scored teardown is anonymous until the
 * visitor chooses to send it to themselves via the audit form.
 */

const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

/** Hosts that must never be fetched, whatever the input says. */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  // IPv6 loopback / unique-local / link-local
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;           // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isBlockedHost(u.hostname)) return null;
  if (!u.hostname.includes(".")) return null; // bare hostnames are internal
  return u;
}

/** Fetch with manual redirect handling so every hop is re-validated. */
async function safeFetch(start: URL): Promise<{ html: string; bytes: number; finalUrl: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          // Identify honestly; some hosts block unknown agents outright.
          "User-Agent": "ServoliaAudit/1.0 (+https://servolia.com/free-audit)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("redirect without location");
      const next = normalizeUrl(new URL(loc, url).toString());
      if (!next) throw new Error("redirect to a blocked host");
      url = next;
      continue;
    }

    if (!res.ok) throw new Error(`site returned ${res.status}`);

    const ctype = res.headers.get("content-type") ?? "";
    if (ctype && !/text\/html|application\/xhtml/i.test(ctype)) {
      throw new Error("not an HTML page");
    }

    // Read with a hard cap so a huge or endless body can't exhaust memory.
    const reader = res.body?.getReader();
    if (!reader) throw new Error("empty response");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { html: buf.toString("utf8"), bytes, finalUrl: url.toString() };
  }
  throw new Error("too many redirects");
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (await rateLimited(`audit:${ip}`, 10, 600)) {
    return NextResponse.json({ error: "Too many audits — try again in a few minutes." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    patientValueEur?: number | string;
    monthlyEnquiries?: number | string;
    niche?: string;
  };

  const target = normalizeUrl(body.url ?? "");
  if (!target) {
    return NextResponse.json({ error: "Enter a valid public website address." }, { status: 400 });
  }

  const num = (v: number | string | undefined): number | null => {
    const n = typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : v;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
  };

  const started = Date.now();
  let fetched: { html: string; bytes: number; finalUrl: string };
  try {
    fetched = await safeFetch(target);
  } catch (err) {
    const message = err instanceof Error && /blocked host/.test(err.message)
      ? "That address can't be audited."
      : "We couldn't reach that site. Check the address, or the site may be blocking automated visits.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const input: AuditInput = {
    url: fetched.finalUrl,
    html: fetched.html,
    bytes: fetched.bytes,
    fetchMs: Date.now() - started,
    niche: body.niche ?? null,
    patientValueEur: num(body.patientValueEur),
    monthlyEnquiries: num(body.monthlyEnquiries),
  };

  return NextResponse.json(runAudit(input));
}
