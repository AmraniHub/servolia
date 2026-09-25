import { Resolver } from "node:dns/promises";
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
 * The certificate and HTTP checks run ONLY once DNS points to Vercel: a valid
 * certificate on the client's old host is not our secure connection, and it
 * keeps this code from ever connecting to an address a client typed that
 * resolves somewhere private.
 */

const VERCEL_PREFIXES = ["76.76.21.", "66.33.60.", "216.150.1.", "216.150.16.", "216.198.79.", "64.29.17."];
const VERCEL_NAME = /(^|\.)vercel-dns(-\d+)?\.com$/i;

export function isVercelName(name: string): boolean {
  return VERCEL_NAME.test(name.trim().replace(/\.$/, ""));
}

export function isVercelIp(ip: string, extra: readonly string[] = []): boolean {
  return extra.includes(ip) || VERCEL_PREFIXES.some((p) => ip.startsWith(p));
}

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

async function gatherDns(expected: ExpectedRecord[]): Promise<DnsAnswers> {
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
  const apex = registrableOf(expected[0]?.host ?? "");
  const hosts = [...new Set(expected.map((e) => e.host))];
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
      const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: timeoutMs }, () => {
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

/** Is this host on the Vercel project recorded for the client? Null when it cannot be asked. */
async function attachedTo(project: string | null, host: string): Promise<boolean | null> {
  if (!project) return null;
  const res = await registrar<{ verified?: boolean }>(
    `/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(host)}`,
  );
  if (res.ok) return res.data?.verified !== false;
  if (res.status === 404) return false;
  return null; // not configured, test mode, network: unknown, never "no"
}

async function checkHttp(host: string, project: string | null, timeoutMs = 8000): Promise<NonNullable<Probe["http"]>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://${host}/`, {
      redirect: "follow",
      signal: ctl.signal,
      cache: "no-store",
      headers: { "User-Agent": "Servolia-setup-check/1.0 (+https://servolia.com/hosting/terms)" },
    });
    res.body?.cancel().catch(() => {});
    const servedByUs = /vercel/i.test(res.headers.get("server") ?? "") || res.headers.has("x-vercel-id");
    let finalHost: string | null = null;
    try { finalHost = new URL(res.url).hostname.toLowerCase(); } catch { finalHost = null; }
    return { status: res.status, servedByUs, attached: await attachedTo(project, host), finalHost };
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause?.code;
    return { status: null, servedByUs: false, attached: null, finalHost: null, error: cause ?? (e instanceof Error ? e.name : "error") };
  } finally {
    clearTimeout(timer);
  }
}

async function vercelConfig(host: string, project: string | null): Promise<Record<string, unknown> | null> {
  if (!project) return null;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 4000));
  const ask = registrar<Record<string, unknown>>(
    `/v6/domains/${encodeURIComponent(registrableOf(host))}/config?projectIdOrName=${encodeURIComponent(project)}`,
  ).then((res) => (res.ok ? res.data : null), () => null);
  return Promise.race([ask, timeout]);
}

/**
 * Every live check for one host. Never throws; a check that could not run
 * leaves its step open and says so, it never passes it.
 */
export async function probeHost(target: { host: string; vercelProject: string | null }, now = new Date()): Promise<Probe> {
  const at = now.toISOString();
  const host = hostFrom(target.host);
  if (!host) {
    return { at, host: target.host, dns: { pointed: false, viaNameservers: false, records: [], error: "not-a-public-domain" }, tls: null, http: null };
  }
  const expected = expectedRecords(host, await vercelConfig(host, target.vercelProject));
  const dns = judgeDns(expected, await gatherDns(expected));
  if (!dns.pointed) return { at, host, dns, tls: null, http: null };
  const tlsResult = await checkTls(host);
  const http = tlsResult.ok ? await checkHttp(host, target.vercelProject) : null;
  return { at, host, dns, tls: tlsResult, http };
}
