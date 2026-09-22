/**
 * READ A BUSINESS'S BRAND OFF ITS OWN HOMEPAGE.
 *
 * The one input a prospect will actually give is their domain. This turns
 * that domain into {name, accent, languages, niche} so the assistant demo
 * can wear THEIR brand — which is the difference between "a chat widget"
 * and "my receptionist". It exists so the demo works for ANY client, not
 * only the ones somebody wrote a brief for: the brief still wins when one
 * exists; this is the floor under everyone else.
 *
 * Heuristics, not scraping: one page and at most one stylesheet, hard caps
 * on bytes and time, and every extractor is a pure function of the fetched
 * text so the whole thing is testable without a network.
 *
 * SSRF: the probe fetches an attacker-supplied URL from our server, so the
 * hostname is checked before every request — public names only, no IP
 * literals, no localhost/.local/.internal — and checked AGAIN on the final
 * URL after redirects.
 */

export interface BrandProbe {
  domain: string;
  name: string;
  accent: string;
  languages: ("ar" | "fr" | "en")[];
  niche: string | null;
  /** True when the site could not be read and everything but the name is a default. */
  fallback: boolean;
  /** The first tel: link on the page — how a practice's own site says "call us". */
  phone?: string | null;
  /** The page's own meta description: the one sentence the business wrote about itself. */
  description?: string | null;
  /** Where the homepage actually lives after redirects, when that differs from `domain`. */
  finalHost?: string | null;
  /** The page's visible text, capped — for server-side use only (a draft
   *  brief reads which treatments the practice itself names). Never sent to
   *  a browser: /api/assistant-preview strips it. */
  text?: string;
}

/** Visible text of a page: scripts, styles and tags out, whitespace folded. */
export function visibleText(html: string, cap = 20_000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, cap);
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 400_000;
const MAX_CSS_BYTES = 200_000;

/* ── input hygiene ─────────────────────────────────────────────────────── */

/** "https://www.Clinique-Atlas.ma/contact?x=1" → "clinique-atlas.ma"; "" when hopeless. */
export function normalizeDomainInput(input: string | null | undefined): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw || raw.length > 260) return "";
  let host = raw;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return "";
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  // A registrable name: letters/digits/hyphens with at least one dot.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return "";
  return host;
}

/** Public web hosts only — the probe must never reach into a private network. */
export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (!h || !h.includes(".")) return false;
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".home") || h.endsWith(".lan")) return false;
  if (/^\[/.test(h)) return false; // IPv6 literal
  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false; // link-local / cloud metadata
    // A public IP literal is legal but never what a business types.
    return false;
  }
  return true;
}

/* ── pure extractors ───────────────────────────────────────────────────── */

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
   .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
   .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
   .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

/** "clinique-atlas.ma" → "Clinique Atlas". The floor when the site says nothing. */
export function titleFromDomain(domain: string): string {
  const label = domain.split(".")[0] ?? domain;
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || domain;
}

function meta(html: string, key: string, attr: "name" | "property"): string | null {
  // content before or after the name — both orders exist in the wild.
  const re1 = new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${key}["']`, "i");
  const m = html.match(re1) ?? html.match(re2);
  return m ? decode(m[1]) : null;
}

/**
 * The business's name, best effort:
 * og:site_name → application-name → the brand side of <title> → the domain.
 * A <title> is usually "Brand | tagline" or "Page — Brand": the side with
 * fewer words is almost always the brand, ties broken toward the first.
 */
export function extractName(html: string, domain: string): string {
  const clean = (s: string) => decode(s).replace(/\s+/g, " ").trim().slice(0, 40).trim();
  const site = meta(html, "og:site_name", "property") ?? meta(html, "application-name", "name");
  if (site) return clean(site);
  const t = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  if (t) {
    const whole = decode(t[1]).replace(/\s+/g, " ").trim();
    const parts = whole.split(/\s*(?:\||–|—|::|·)\s*|\s+-\s+/).map((p) => p.trim()).filter((p) => p.length > 1);
    if (parts.length === 1) return clean(parts[0]);
    if (parts.length > 1) {
      const scored = parts.map((p, i) => ({ p, words: p.split(/\s+/).length, i }));
      scored.sort((a, b) => a.words - b.words || a.i - b.i);
      return clean(scored[0].p);
    }
  }
  return titleFromDomain(domain);
}

/**
 * Which of the assistant's three languages the site actually serves.
 * Signals, in rough order of trust: <html lang>, hreflang links, visible
 * Arabic script, a language switcher (data-lang / hrefs like /fr/), and
 * plain stop-word counts for fr/en. Multilingual sites that render only one
 * language server-side (the common case) are caught by the switcher.
 */
export function extractLanguages(html: string): ("ar" | "fr" | "en")[] {
  const found = new Set<"ar" | "fr" | "en">();
  const add = (v: string | null | undefined) => {
    const two = (v ?? "").slice(0, 2).toLowerCase();
    if (two === "ar" || two === "fr" || two === "en") found.add(two);
  };
  add(html.match(/<html[^>]*\slang=["']([a-zA-Z-]+)["']/i)?.[1]);
  for (const m of html.matchAll(/hreflang=["']([a-zA-Z-]+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/data-lang=["']([a-zA-Z-]+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/href=["'][^"']*[/.](ar|fr|en)(?:\/|\.html?|["'])/gi)) add(m[1]);
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  if ((text.match(/[؀-ۿ]/g) ?? []).length > 40) found.add("ar");
  const frHits = (text.match(/\b(les|des|vous|nous|être|é?tudes?|nos|votre)\b/gi) ?? []).length
    + (text.match(/[éèêàçù]/g) ?? []).length / 4;
  const enHits = (text.match(/\b(the|and|your|with|our|from)\b/gi) ?? []).length;
  if (frHits > 15) found.add("fr");
  if (enHits > 15) found.add("en");
  const order: ("ar" | "fr" | "en")[] = ["ar", "fr", "en"];
  const out = order.filter((l) => found.has(l));
  return out.length ? out : ["fr", "en"];
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A colour worth being a brand: saturated enough, and neither white nor black. */
function isBrandy(hex: string): boolean {
  const rgb = hexToRgb(hex);
  const spread = Math.max(...rgb) - Math.min(...rgb);
  const lum = luminance(rgb);
  return spread >= 40 && lum >= 0.03 && lum <= 0.82;
}

/** White text must stay readable on it — darken a too-light pick. */
function ensureContrast(hex: string): string {
  const rgb = hexToRgb(hex);
  if (luminance(rgb) <= 0.6) return hex;
  const [r, g, b] = rgb.map((c) => Math.round(c * 0.55));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The site's accent colour: theme-color meta, else the first saturated hex
 * declared as a CSS custom property (a stylesheet leads with its palette —
 * `--navy:#16255c` before `--gold`), else the most frequent saturated hex
 * anywhere, else Servolia's green.
 */
export function extractAccent(html: string, css: string): string {
  const theme = meta(html, "theme-color", "name");
  if (theme && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(theme.trim()) && isBrandy(theme.trim())) {
    return ensureContrast(theme.trim().toLowerCase());
  }
  const all = css + "\n" + html;
  for (const m of all.matchAll(/--[\w-]+\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\b/g)) {
    const hex = m[1].toLowerCase();
    if (isBrandy(hex)) return ensureContrast(hex.length === 4 ? "#" + hex.slice(1).split("").map((c) => c + c).join("") : hex);
  }
  const counts = new Map<string, number>();
  for (const m of all.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const hex = "#" + m[1].toLowerCase();
    if (isBrandy(hex)) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? ensureContrast(best[0]) : "#36671E";
}

/** Only the niches the demo has a script for. Two independent hits required. */
export function detectNiche(html: string): string | null {
  const text = html.toLowerCase();
  const hits = (words: string[]) => words.filter((w) => text.includes(w)).length;
  // Tuned against the real excellence-agency.org homepage: its Arabic render
  // carries none of the French/English phrases, so the Arabic stems that are
  // actually on such pages (visa, universities, scholarship) do the work.
  if (hits(["study abroad", "étudier à l'étranger", "études à l'étranger", "الدراسة في الخارج",
            "student visa", "visa étudiant", "تأشيرة", "جامعات", "جامعة",
            "scholarship", "bourse d'étude", "منحة", "الطلبة"]) >= 2) {
    return "study-abroad";
  }
  return null;
}

/**
 * The practice's phone, from the first tel: link. Only digits, spaces, dots,
 * dashes, parentheses and a leading + survive — a tel: href is page content
 * and ends up read aloud by the receptionist, so nothing else gets through.
 * Too short or too long to be a real number is no number.
 */
export function extractPhone(html: string): string | null {
  for (const m of html.matchAll(/href=["']tel:([^"']{4,40})["']/gi)) {
    let raw = m[1];
    try { raw = decodeURIComponent(raw); } catch { /* keep as typed */ }
    const clean = raw.replace(/[^\d+().\-\s]/g, "").replace(/\s+/g, " ").trim();
    const digits = clean.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) return clean;
  }
  return null;
}

/** The site's own one-line description, trimmed to what a brief can hold. */
export function extractDescription(html: string): string | null {
  const d = meta(html, "description", "name") ?? meta(html, "og:description", "property");
  if (!d) return null;
  const clean = d.replace(/\s+/g, " ").trim();
  return clean.length >= 20 ? clean.slice(0, 300) : null;
}

/* ── the probe itself ──────────────────────────────────────────────────── */

async function readCapped(res: Response, cap: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, cap);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= cap) { reader.cancel().catch(() => {}); break; }
  }
  const buf = new Uint8Array(Math.min(total, cap));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, buf.length - off);
    buf.set(c.subarray(0, take), off);
    off += take;
    if (off >= buf.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export async function fetchPublic(url: string, cap: number, timeoutMs: number): Promise<{ text: string; finalUrl: string } | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ServoliaPreview/1; +https://servolia.com)" },
    });
    // Redirects may have moved us — the LANDING host must be public too.
    if (!isPublicHost(new URL(res.url).hostname)) return null;
    if (!res.ok) return null;
    return { text: await readCapped(res, cap), finalUrl: res.url };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * The site's OWN first stylesheet — the one that holds the palette.
 *
 * Same host as the page only (www-insensitive): the first <link> on a small
 * business site is very often Google Fonts, and a fonts CSS carries weights
 * and glyph ranges, never the brand navy. Excellence Agency's homepage is
 * exactly that shape, which is how this rule was found.
 */
export function firstStylesheetHref(html: string, baseUrl: string): string | null {
  const pageHost = (() => {
    try { return new URL(baseUrl).hostname.replace(/^www\./, ""); } catch { return ""; }
  })();
  for (const m of html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || /^data:/i.test(href)) continue;
    try {
      const u = new URL(href, baseUrl);
      if (!isPublicHost(u.hostname)) continue;
      if (u.hostname.replace(/^www\./, "") !== pageHost) continue;
      return u.href;
    } catch { /* next */ }
  }
  return null;
}

/* One probe per domain per instance for a while: the pay page and the demo
   page both ask, and a prospect retyping their domain must not make us
   hammer their site. */
const cache = new Map<string, { at: number; value: BrandProbe }>();
const CACHE_MS = 10 * 60 * 1000;

export async function probeBrand(input: string): Promise<BrandProbe | null> {
  const domain = normalizeDomainInput(input);
  if (!domain || !isPublicHost(domain)) return null;

  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let page: { text: string; finalUrl: string } | null = null;
  for (const url of [`https://${domain}/`, `https://www.${domain}/`, `http://${domain}/`]) {
    page = await fetchPublic(url, MAX_HTML_BYTES, FETCH_TIMEOUT_MS);
    if (page) break;
  }

  let value: BrandProbe;
  if (!page) {
    // Unreachable is not a dead end: the name still comes from the domain,
    // so the demo is personal even when the site is down or blocks robots.
    value = { domain, name: titleFromDomain(domain), accent: "#36671E", languages: ["fr", "en"], niche: null, fallback: true };
  } else {
    let css = "";
    const cssHref = firstStylesheetHref(page.text, page.finalUrl);
    if (cssHref) {
      const sheet = await fetchPublic(cssHref, MAX_CSS_BYTES, 4000);
      css = sheet?.text ?? "";
    }
    value = {
      domain,
      name: extractName(page.text, domain),
      accent: extractAccent(page.text, css),
      languages: extractLanguages(page.text),
      niche: detectNiche(page.text),
      fallback: false,
      phone: extractPhone(page.text),
      description: extractDescription(page.text),
      text: visibleText(page.text),
      finalHost: (() => {
        try {
          const h = new URL(page.finalUrl).hostname.toLowerCase().replace(/^www\./, "");
          return h !== domain ? h : null;
        } catch { return null; }
      })(),
    };
  }

  if (cache.size > 500) cache.clear();
  cache.set(domain, { at: Date.now(), value });
  return value;
}
