import { Resolver } from "node:dns/promises";
import dns from "node:dns";
import https from "node:https";
import tls from "node:tls";
import { registrar } from "@/lib/domainSales";
import { dnsLinesFrom, isApexDomain } from "@/lib/siteDomain";
import { isPublicHost, normalizeDomainInput } from "@/lib/brandProbe";
import type { Probe, RecordCheck } from "@/lib/hostingSetup";

/**
 * THE LIVE CHECKS BEHIND THE SETUP CHECKLIST: DNS, CERTIFICATE, HTTP.
 *
 * Hosting clients are served by Vercel (the /hosting/terms page names it, and
 * the admin records each client's Vercel project). So "pointed to us" means
 * the address answers from Vercel, measured three independent ways:
 *
 *  - the nameservers are Vercel's (a domain registered through us, or a
 *    client who delegated DNS) — then there is nothing for anyone to add;
 *  - the A records are Vercel's addresses;
 *  - the CNAME is a vercel-dns name.
 *
 * VERCEL ANSWERS FROM MORE THAN ONE ADDRESS. The documented A record is
 * 76.76.21.21, but measured on 2026-09-25 servolia.com, openx24.com and
 * goodscochina.com (all on Vercel) resolve to 216.150.1.x / 216.150.16.x, and
 * cname.vercel-dns.com itself to 66.33.60.x and 76.76.21.x. A single-IP check
 * would call every one of our own sites "not pointed". So the check accepts
 * Vercel's known ranges plus whatever cname.vercel-dns.com answers today.
 *
 * WHAT IS FETCHED, AND WHERE IT MAY GO. Nothing is fetched and no TLS
 * handshake is made until DNS points the address at Vercel. Every connection
 * then goes through publicOnlyLookup: the name is resolved once, by us, and
 * the connection refused if any answer (A or AAAA) is not public — so a DNS
 * server that answers differently the second time has no second time.
 * Redirects are never followed blindly: at most two hops, each https, port
 * 443 and on the same registrable domain, each hop pinned the same way, or
 * the fetch stops where it is. A redirect to 169.254.169.254, localhost,
 * plain http or another domain is reported as "stopped", never visited.
 */

const VERCEL_PREFIXES = ["76.76.21.", "66.33.60.", "216.150.1.", "216.150.16.", "216.198.79.", "64.29.17."];
const VERCEL_NAME = /(^|\.)vercel-dns(-\d+)?\.com$/i;

export function isVercelName(name: string): boolean {
  return VERCEL_NAME.test(name.trim().replace(/\.$/, ""));
}

export function isVercelIp(ip: string, extra: readonly string[] = []): boolean {
  return extra.includes(ip) || VERCEL_PREFIXES.some((p) => ip.startsWith(p));
}

/** A routable public IPv4 address (not private, loopback, link-local, CGNAT, multicast). */
export function isPublicIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([m[1], m[2], m[3], m[4]].some((x) => Number(x) > 255)) return false;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

/** The IPv4 address carried in the last 32 bits of an IPv6 address written
 *  "…:d896:1001" or "…:216.150.16.1"; null if it cannot be read. */
function embeddedIpv4(a: string): string | null {
  const dotted = a.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];
  const hex = a.match(/:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const hi = parseInt(hex[1], 16);
  const lo = parseInt(hex[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/**
 * A routable public IPv6 address: global unicast (2000::/3), not the
 * documentation range. Loopback, link-local, unique-local and multicast are
 * not. IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::/96) addresses carry
 * an IPv4 address and are judged BY it: a DNS64 resolver (measured on this
 * workstation's 4G link, 2026-09-25) answers every name with such AAAA records
 * next to the real A records, and refusing the whole prefix would refuse every
 * site — while 64:ff9b::7f00:1 is still loopback and still refused.
 */
export function isPublicIpv6(ip: string): boolean {
  const a = ip.toLowerCase().split("%")[0];
  if (!a.includes(":")) return false;
  if (a.startsWith("::ffff:") || a.startsWith("64:ff9b::")) {
    const v4 = embeddedIpv4(a);
    return v4 ? isPublicIpv4(v4) : false;
  }
  if (a.startsWith("2001:db8:")) return false;
  const first = a.startsWith("::") ? 0 : parseInt(a.split(":")[0] || "0", 16);
  return first >= 0x2000 && first <= 0x3fff;
}

export function isPublicIp(ip: string): boolean {
  return ip.includes(":") ? isPublicIpv6(ip) : isPublicIpv4(ip);
}

type LookupAll = (hostname: string, options: dns.LookupAllOptions, cb: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) => void;

/**
 * DNS PINNING. A `lookup` for node's https/tls that resolves the name ITSELF
 * and refuses to connect when any answer — A or AAAA — is not public. The
 * address checked is the address connected to: there is no second lookup a
 * rebinding DNS server could answer differently. Used for the first request,
 * every redirect hop, and the certificate check.
 */
export function publicOnlyLookup(resolve: LookupAll = dns.lookup as unknown as LookupAll) {
  return (hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void): void => {
    resolve(hostname, { family: options.family, hints: options.hints, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = Array.isArray(addresses) ? addresses : [];
      if (!list.length || list.some((x) => !isPublicIp(x.address))) {
        return callback(Object.assign(new Error(`refused: ${hostname} resolves to a non-public address`), { code: "ENOTPUBLIC" }));
      }
      if (options.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}

/**
 * GET without following redirects, over node's https with the pinned lookup.
 * Resolves to a bodiless Response carrying the status and headers; the body
 * is never read. `resolve` is a test seam for the DNS answer.
 */
export function makePinnedFetch(resolve?: LookupAll): FetchLike {
  return (url, init) => new Promise<Response>((done, fail) => {
    const req = https.request(url, {
      method: "GET",
      headers: Object.fromEntries(new Headers(init.headers ?? {}).entries()),
      lookup: publicOnlyLookup(resolve) as unknown as https.RequestOptions["lookup"],
      signal: init.signal ?? undefined,
    }, (res) => {
      const headers = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
      const status = res.statusCode ?? 0;
      res.destroy();
      if (status < 200 || status > 599) return fail(Object.assign(new Error(`status ${status}`), { code: "EBADSTATUS" }));
      done(new Response(null, { status, headers }));
    });
    req.on("error", fail);
    req.end();
  });
}

export const pinnedFetch: FetchLike = makePinnedFetch();

/** "shop.cabinet.co.uk" -> "cabinet.co.uk"; an apex returns itself. */
export function registrableOf(host: string): string {
  const labels = host.toLowerCase().split(".").filter(Boolean);
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join(".");
    if (isApexDomain(candidate)) return candidate;
  }
  return host.toLowerCase();
}

/**
 * The host to check for a client, from what they gave us. "https://www.x.com/a"
 * checks x.com (the apex serves, www redirects to it, as attachDomainToProject
 * sets it up). Null for anything that is not a public domain name.
 */
export function hostFrom(input: string | null | undefined): string | null {
  const h = normalizeDomainInput(input);
  return h && isPublicHost(h) ? h : null;
}

export interface ExpectedRecord { type: "A" | "CNAME"; name: string; host: string; value: string }

/**
 * The records the host needs, from Vercel's recommendation where it answered
 * (GET /v6/domains/{d}/config) and Vercel's documented defaults otherwise —
 * the same source src/lib/siteDomain.ts gives a practice for her domain.
 */
export function expectedRecords(host: string, vercelConfig: Record<string, unknown> | null): ExpectedRecord[] {
  const apex = registrableOf(host);
  const lines = dnsLinesFrom(apex, vercelConfig).filter((l) => l.type !== "TXT");
  const a = lines.find((l) => l.type === "A")?.value ?? "76.76.21.21";
  const cname = lines.find((l) => l.type === "CNAME")?.value ?? "cname.vercel-dns.com";
  if (host === apex) {
    return [
      { type: "A", name: "@", host: apex, value: a },
      { type: "CNAME", name: "www", host: `www.${apex}`, value: cname },
    ];
  }
  return [{ type: "CNAME", name: host.slice(0, -(apex.length + 1)), host, value: cname }];
}

export interface DnsAnswers {
  ns: string[];
  a: Record<string, string[]>;
  cname: Record<string, string[]>;
  /** What cname.vercel-dns.com resolves to right now. */
  vercelIps: string[];
  error?: string;
}

/** Pure: do these answers point every required record at Vercel? */
export function judgeDns(expected: ExpectedRecord[], answers: DnsAnswers): Probe["dns"] {
  const records: RecordCheck[] = expected.map((r) => {
    const cnames = answers.cname[r.host] ?? [];
    const addrs = answers.a[r.host] ?? [];
    const ok = cnames.some(isVercelName) || (addrs.length > 0 && addrs.every((ip) => isVercelIp(ip, answers.vercelIps)));
    const found = r.type === "CNAME" && cnames.length ? cnames : addrs.length ? addrs : cnames;
    return { ...r, ok, found };
  });
  const viaNameservers = answers.ns.length > 0 && answers.ns.every(isVercelName);
  return {
    pointed: records.length > 0 && records.every((r) => r.ok),
    viaNameservers,
    records,
    ...(answers.error ? { error: answers.error } : {}),
  };
}

const NOT_THERE = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN", "ENONAME"]);

async function gatherDns(expected: ExpectedRecord[], checkHost: string): Promise<DnsAnswers> {
  const r = new Resolver({ timeout: 2500, tries: 2 });
  let error: string | undefined;
  const ask = async (fn: () => Promise<string[]>): Promise<string[]> => {
    try {
      return (await fn()).map((x) => x.replace(/\.$/, "").toLowerCase());
    } catch (e) {
      const code = (e as { code?: string }).code ?? "error";
      if (!NOT_THERE.has(code)) error = error ?? code;
      return [];
    }
  };
  const apex = registrableOf(expected[0]?.host ?? checkHost);
  const hosts = [...new Set([checkHost, ...expected.map((e) => e.host)])];
  const [ns, vercelIps, ...perHost] = await Promise.all([
    ask(() => r.resolveNs(apex)),
    ask(() => r.resolve4("cname.vercel-dns.com")),
    ...hosts.map(async (h) => ({ h, a: await ask(() => r.resolve4(h)), c: await ask(() => r.resolveCname(h)) })),
  ]) as [string[], string[], ...{ h: string; a: string[]; c: string[] }[]];
  const a: Record<string, string[]> = {};
  const cname: Record<string, string[]> = {};
  for (const x of perHost) { a[x.h] = x.a; cname[x.h] = x.c; }
  return { ns, a, cname, vercelIps, ...(error ? { error } : {}) };
}

/** A TLS handshake with name and chain verification. Never throws. */
export function checkTls(host: string, timeoutMs = 6000): Promise<NonNullable<Probe["tls"]>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: NonNullable<Probe["tls"]>) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const socket = tls.connect({
        host, port: 443, servername: host, rejectUnauthorized: false, timeout: timeoutMs,
        lookup: publicOnlyLookup() as unknown as tls.ConnectionOptions["lookup"],
      }, () => {
        const cert = socket.getPeerCertificate();
        const ok = socket.authorized === true;
        finish({
          ok,
          validTo: cert?.valid_to ? new Date(cert.valid_to).toISOString() : undefined,
          issuer: typeof cert?.issuer?.O === "string" ? cert.issuer.O : undefined,
          ...(ok ? {} : { error: String(socket.authorizationError ?? "unverified") }),
        });
        socket.end();
      });
      socket.on("error", (e: NodeJS.ErrnoException) => finish({ ok: false, error: e.code ?? e.message }));
      socket.on("timeout", () => { socket.destroy(); finish({ ok: false, error: "timeout" }); });
    } catch (e) {
      finish({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}

const within = <T>(ms: number, p: Promise<T>, fallback: T): Promise<T> =>
  Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

/** Is this host on the Vercel project recorded for the client? Null when it cannot be asked. */
async function attachedTo(project: string | null, host: string, timeoutMs = 4000): Promise<boolean | null> {
  if (!project) return null;
  return within(timeoutMs, registrar<{ verified?: boolean }>(
    `/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(host)}`,
  ).then((res) => {
    if (res.ok) return res.data?.verified !== false;
    if (res.status === 404) return false;
    return null; // not configured, test mode, network: unknown, never "no"
  }), null);
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface SafeFetchResult {
  status: number | null;
  headers: Headers | null;
  /** The last URL actually requested. */
  finalUrl: string;
  /** Why a redirect was not followed, or why nothing answered. */
  stopped?: string;
}

/**
 * GET https://<host>/ following at most `maxHops` redirects, each of which
 * must be https and on the same registrable domain as the start. Anything
 * else stops the fetch where it stands and says why; the refused target is
 * never requested.
 */
export async function safeFetch(startUrl: string, fetchImpl: FetchLike = pinnedFetch, opts: { maxHops?: number; timeoutMs?: number } = {}): Promise<SafeFetchResult> {
  const maxHops = opts.maxHops ?? 2;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 8000);
  const home = registrableOf(new URL(startUrl).hostname);
  let url = startUrl;
  try {
    for (let hop = 0; ; hop++) {
      const res = await fetchImpl(url, {
        redirect: "manual",
        signal: ctl.signal,
        cache: "no-store",
        headers: { "User-Agent": "Servolia-setup-check/1.0 (+https://servolia.com/hosting/terms)" },
      });
      res.body?.cancel().catch(() => {});
      const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!location) return { status: res.status, headers: res.headers, finalUrl: url };
      const stop = (why: string): SafeFetchResult => ({ status: res.status, headers: res.headers, finalUrl: url, stopped: why });
      if (hop >= maxHops) return stop("too-many-redirects");
      let next: URL;
      try { next = new URL(location, url); } catch { return stop("bad-location"); }
      if (next.protocol !== "https:") return stop("redirect-not-https");
      if (next.port && next.port !== "443") return stop("redirect-odd-port");
      if (!isPublicHost(next.hostname)) return stop("redirect-not-public");
      if (registrableOf(next.hostname) !== home) return stop("redirect-other-domain");
      url = next.href;
    }
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return { status: null, headers: null, finalUrl: url, stopped: err.code ?? err.cause?.code ?? (e instanceof Error ? e.name : "error") };
  } finally {
    clearTimeout(timer);
  }
}

async function checkHttp(host: string, project: string | null, pointed: boolean): Promise<NonNullable<Probe["http"]>> {
  const r = await safeFetch(`https://${host}/`);
  const servedByUs = Boolean(r.headers && (/vercel/i.test(r.headers.get("server") ?? "") || r.headers.has("x-vercel-id")));
  let finalHost: string | null = null;
  try { finalHost = new URL(r.finalUrl).hostname.toLowerCase(); } catch { finalHost = null; }
  return {
    status: r.status,
    servedByUs,
    // Asked only when it can matter: the address points to Vercel.
    attached: pointed ? await attachedTo(project, host) : null,
    finalHost,
    ...(r.stopped ? { error: r.stopped } : {}),
  };
}

async function vercelConfig(host: string, project: string | null): Promise<Record<string, unknown> | null> {
  if (!project) return null;
  return within(4000, registrar<Record<string, unknown>>(
    `/v6/domains/${encodeURIComponent(registrableOf(host))}/config?projectIdOrName=${encodeURIComponent(project)}`,
  ).then((res) => (res.ok ? res.data : null)), null);
}

/**
 * Every live check for one host. Never throws; a check that could not run
 * leaves its step open and says so, it never passes it.
 */
export async function probeHost(
  target: { host: string; vercelProject: string | null },
  now = new Date(),
  /** Test seams: the DNS answers, and the two network checks. */
  seams: {
    gather?: (expected: ExpectedRecord[], host: string) => Promise<DnsAnswers>;
    tls?: typeof checkTls;
    http?: typeof checkHttp;
  } = {},
): Promise<Probe> {
  const gather = seams.gather ?? gatherDns;
  const tlsCheck = seams.tls ?? checkTls;
  const httpCheck = seams.http ?? checkHttp;
  const at = now.toISOString();
  const host = hostFrom(target.host);
  if (!host) {
    return { at, host: target.host, dns: { pointed: false, viaNameservers: false, records: [], error: "not-a-public-domain" }, tls: null, http: null };
  }
  const expected = expectedRecords(host, await vercelConfig(host, target.vercelProject));
  const dnsResult = judgeDns(expected, await gather(expected, host));
  // Not one connection to a client's host until it points at Vercel: before
  // that it is their old host (or anywhere they typed), and nothing we would
  // learn from it is used.
  if (!dnsResult.pointed) return { at, host, dns: dnsResult, tls: null, http: null };
  const [tlsResult, http] = await Promise.all([
    tlsCheck(host),
    httpCheck(host, target.vercelProject, true),
  ]);
  return { at, host, dns: dnsResult, tls: tlsResult, http };
}
