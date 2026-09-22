/**
 * THE TRIAL FOR A STRANGER — the front door the ads land on.
 *
 * A dentist in Lyon has never heard of Servolia. She types her website, and
 * the receptionist that appears already wears her practice's name and colour
 * and knows the treatments her own homepage names. She talks to it on our
 * page. If she wants it on her site, she confirms her address; one click
 * starts seven free days; she pastes one line into her site; every enquiry
 * it takes lands in her inbox. On day five she hears what it did. On day
 * seven it goes quiet by itself unless she keeps it on an EUR plan — and the
 * €690 installation is waived, because the trial already installed it.
 *
 * WHY NOT the hosting trial (assistantTrial.ts): that one is a perk for a
 * client we already bill in USD, keyed on a hosting_clients row, with a repo
 * we can commit the tag into. Its day-5 and day-7 crons read EVERY trial row
 * in that table and sell the USD 12 add-on — a dentist's trial parked there
 * would be emailed the wrong price in the wrong currency. So this trial lives
 * on its own client_sites row (config.receptionist), which no hosting code
 * reads, and on payment it becomes an ordinary EUR client: a clients row, a
 * finished build, the conversation meter, the portal, the monthly report.
 *
 * FOUR RULES, each one a promise the pages make:
 *  1. Nothing on her site changes without her. We cannot write to a
 *     stranger's site and would not: she pastes the line herself.
 *  2. Her week starts when it can work. The seven days are counted from the
 *     first day we SEE the line on her homepage (checked when she asks, and
 *     every morning), so a webmaster who takes three days does not eat three
 *     of her seven. It moves once, forward only.
 *  3. Every fact it speaks is hers. Name, colour, phone and description come
 *     off her own homepage; treatments only when her homepage names them;
 *     never a price. Anything else, it says the practice will confirm.
 *  4. One trial per site and per address, ever. A second week is a discount
 *     nobody asked for.
 *
 * The row is marked `servolia-receptionist:` in notes so the daily pass can
 * find it with a plain LIKE, and the widget's on/off lives in
 * assistantAccess.ts (receptionistOn) so every page asks one question.
 */
import { SignJWT, jwtVerify } from "jose";
import { supabaseAdmin } from "@/lib/supabase";
import { tokenSecret } from "@/lib/upgrade";
import { slugify, getClientSite, type ClientSiteConfig, type ReceptionistState } from "@/lib/clientSites";
import { probeBrand, fetchPublic, normalizeDomainInput, type BrandProbe } from "@/lib/brandProbe";
import { conversationCount } from "@/lib/assistantAccess";
import { resolvePlan, planAmountCents, SETUP_PLAN } from "@/lib/pricing";

export const RECEPTIONIST_TRIAL_DAYS = 7;
/** The day-5 note: two days before the end. */
export const RECEPTIONIST_NUDGE_BEFORE_DAYS = 2;
export const RECEPTIONIST_MARKER = "servolia-receptionist:";
const DAY = 86_400_000;
const TOKEN_ROLE = "receptionist-trial";
const TOKEN_DAYS = 45;

export type Practice = "dental" | "aesthetic";

/* ── the link she holds ────────────────────────────────────────────────── */

export interface ReceptionistClaim {
  slug: string;
  email: string;
  lang: "fr" | "en";
}

/** The key to her trial: start it, check the install, keep it. Mailed only
 *  to the address it names, so holding it proves the address. */
export async function mintReceptionistToken(c: ReceptionistClaim, days = TOKEN_DAYS): Promise<string> {
  return new SignJWT({ role: TOKEN_ROLE, slug: c.slug, email: c.email.toLowerCase(), lang: c.lang })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(tokenSecret());
}

/** Null for anything forged, expired or minted for another purpose. */
export async function readReceptionistToken(token: string | null | undefined): Promise<ReceptionistClaim | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, tokenSecret());
    if (payload.role !== TOKEN_ROLE) return null;
    const slug = typeof payload.slug === "string" ? payload.slug : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    const lang = payload.lang === "en" ? "en" : "fr";
    return slug && email ? { slug, email, lang } : null;
  } catch {
    return null;
  }
}

/** One page, which speaks the language in the token. */
export async function receptionistLinkFor(c: ReceptionistClaim, origin = "https://servolia.com"): Promise<string> {
  return `${origin}/fr/essai/confirmer?t=${encodeURIComponent(await mintReceptionistToken(c))}`;
}

/* ── pure: what her receptionist knows ─────────────────────────────────── */

/**
 * Treatments, each with the words a French or English practice site uses
 * for it. A treatment is listed only when her own homepage says one of them.
 */
const PRACTICE_SERVICES: Record<Practice, { fr: string; en: string; words: RegExp }[]> = {
  dental: [
    { fr: "Bilan et détartrage", en: "Check-up and scaling", words: /d[ée]tartrage|bilan bucco|contr[ôo]le|check-?up|scaling|hygi[èe]ne/i },
    { fr: "Soins des caries", en: "Fillings", words: /carie|soins conservateurs|obturation|filling/i },
    { fr: "Implants dentaires", en: "Dental implants", words: /implant/i },
    { fr: "Blanchiment dentaire", en: "Teeth whitening", words: /blanchiment|whitening/i },
    { fr: "Orthodontie", en: "Orthodontics", words: /orthodon|aligneur|goutti[èe]re|invisalign|aligner/i },
    { fr: "Couronnes et bridges", en: "Crowns and bridges", words: /couronne|bridge|crown/i },
    { fr: "Parodontologie", en: "Gum care", words: /parodont|periodont|gencive/i },
    { fr: "Pédodontie (enfants)", en: "Children's dentistry", words: /p[ée]dodont|dentisterie p[ée]diatrique|paediatric|pediatric/i },
    { fr: "Urgences dentaires", en: "Dental emergencies", words: /urgence|emergenc/i },
    { fr: "Prothèses dentaires", en: "Dentures", words: /proth[èe]se|denture/i },
    { fr: "Esthétique du sourire", en: "Cosmetic dentistry", words: /facette|veneer|esth[ée]tique du sourire|cosmetic dentistry/i },
  ],
  aesthetic: [
    { fr: "Injections d'acide hyaluronique", en: "Hyaluronic acid fillers", words: /hyaluronique|filler|comblement/i },
    { fr: "Toxine botulique", en: "Botulinum toxin", words: /botox|toxine botulique|botulinum/i },
    { fr: "Épilation laser", en: "Laser hair removal", words: /[ée]pilation laser|laser hair/i },
    { fr: "Peeling", en: "Chemical peels", words: /peeling|peel\b/i },
    { fr: "HydraFacial", en: "HydraFacial", words: /hydrafacial/i },
    { fr: "Microneedling", en: "Microneedling", words: /microneedling|micro-?aiguill/i },
    { fr: "Mésothérapie", en: "Mesotherapy", words: /m[ée]soth[ée]rapie|mesotherap/i },
    { fr: "Soins du visage", en: "Facial treatments", words: /soins? du visage|facial/i },
    { fr: "Remodelage de la silhouette", en: "Body contouring", words: /cryolipolyse|remodelage|body contour/i },
  ],
};

export function servicesSeenIn(text: string | null | undefined, practice: Practice, lang: "fr" | "en"): { name: string }[] {
  const t = text ?? "";
  if (!t) return [];
  return PRACTICE_SERVICES[practice].filter((s) => s.words.test(t)).map((s) => ({ name: s[lang] }));
}

/** The standing order every trial receptionist carries under her own. */
export function safetyLine(lang: "fr" | "en"): string {
  return lang === "fr"
    ? "Ne donne jamais de prix ni d'avis médical. Pour toute question précise, propose de prendre le nom et le téléphone du patient pour que le cabinet le rappelle."
    : "Never give a price or medical advice. For any specific question, offer to take the patient's name and phone so the practice can call back.";
}

/** "clinique-atlas.fr" → "clinique-atlas-fr": the slug her snippet carries. */
export function receptionistSlug(domain: string): string {
  return slugify(domain);
}

/**
 * Her receptionist's first brief, from nothing but her homepage. Every field
 * is either read off her site or a statement the practice can stand behind
 * without having told us anything ("the practice will confirm").
 */
export function draftReceptionistConfig(
  probe: BrandProbe,
  practice: Practice,
  lang: "fr" | "en",
  now = new Date(),
  slug = receptionistSlug(probe.domain),
): ClientSiteConfig {
  const fr = lang === "fr";
  const name = probe.name || probe.domain;
  const languages = (probe.languages.length ? probe.languages : [lang]).includes(lang)
    ? probe.languages
    : [lang, ...probe.languages];
  const domains = [probe.domain, ...(probe.finalHost ? [probe.finalHost] : [])];
  const about = probe.description
    ?? (fr
      ? `${name} est un ${practice === "dental" ? "cabinet dentaire" : "cabinet de médecine esthétique"}.`
      : `${name} is a ${practice === "dental" ? "dental practice" : "medical aesthetics clinic"}.`);
  const receptionist: ReceptionistState = { domain: probe.domain, practice, lang, createdAt: now.toISOString() };
  return {
    slug,
    businessName: name,
    niche: practice === "dental" ? "dental" : "aesthetic",
    language: lang,
    languages: languages.length ? languages : [lang],
    accent: probe.accent,
    phone: probe.phone ?? undefined,
    heroHeadline: name,
    heroSub: about.slice(0, 160),
    about,
    services: servicesSeenIn(probe.text, practice, lang),
    whyUs: [],
    faqs: [
      fr
        ? { q: "Quels sont vos tarifs ?", a: "Les tarifs dépendent du bilan de chaque patient : le cabinet les confirme lors du rendez-vous ou en vous rappelant." }
        : { q: "How much does it cost?", a: "Prices depend on each patient's assessment: the practice confirms them at the appointment or when it calls you back." },
    ],
    ownerInstructions: safetyLine(lang),
    assistantOnly: true,
    domains,
    widgetPosition: "right",
    isDemo: false,
    features: { chat: true },
    status: "draft",
    receptionist,
  };
}

/** What she may correct on the start form. Each field cleaned and capped;
 *  an empty field leaves what the homepage gave us. */
export interface ReceptionistDetails {
  phone?: string;
  hours?: string;
  address?: string;
  bookingUrl?: string;
  instructions?: string;
}

const cleanText = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function applyDetails(config: ClientSiteConfig, d: ReceptionistDetails): ClientSiteConfig {
  const phone = cleanText(d.phone, 40).replace(/[^\d+().\-\s]/g, "");
  const booking = cleanText(d.bookingUrl, 300);
  const instructions = cleanText(d.instructions, 800);
  return {
    ...config,
    phone: phone.replace(/\D/g, "").length >= 8 ? phone : config.phone,
    hours: cleanText(d.hours, 160) || config.hours,
    address: cleanText(d.address, 200) || config.address,
    bookingUrl: /^https:\/\/\S+$/i.test(booking) ? booking : config.bookingUrl,
    // Her words FIRST, our safety line after: she can add, never remove it.
    ownerInstructions: instructions
      ? `${instructions}\n${config.ownerInstructions ?? ""}`.trim().slice(0, 1500)
      : config.ownerInstructions,
  };
}

/* ── pure: where a trial stands ────────────────────────────────────────── */

export type ReceptionistPhase = "draft" | "running" | "ended" | "paid";

export function receptionistPhase(r: ReceptionistState | undefined, now = Date.now()): ReceptionistPhase {
  if (!r) return "draft";
  if (r.paidAt) return "paid";
  if (!r.started || !r.until) return "draft";
  return Date.parse(r.until) > now ? "running" : "ended";
}

/** The first sighting of her tag restarts the clock at seven days from that
 *  sighting — once, forward only, and only while the trial is still on. */
export function withInstallSeen(r: ReceptionistState, seenAt: Date): ReceptionistState {
  if (r.installedAt || !r.started || !r.until) return r;
  const until = Date.parse(r.until);
  if (!(until > seenAt.getTime())) return r;
  const fromInstall = seenAt.getTime() + RECEPTIONIST_TRIAL_DAYS * DAY;
  const next: ReceptionistState = { ...r, installedAt: seenAt.toISOString(), until: new Date(Math.max(until, fromInstall)).toISOString() };
  // A day-5 note already sent named the OLD end date: send one for the new end.
  if (next.until !== r.until) delete next.nudged;
  return next;
}

export function receptionistNudgeDue(r: ReceptionistState | undefined, now: number): boolean {
  if (!r || r.nudged || r.paidAt || !r.until) return false;
  const until = Date.parse(r.until);
  if (!Number.isFinite(until) || now >= until) return false;
  return now >= until - RECEPTIONIST_NUDGE_BEFORE_DAYS * DAY;
}

export function receptionistExpiryDue(r: ReceptionistState | undefined, now: number): boolean {
  if (!r || r.ended || r.paidAt || !r.started || !r.until) return false;
  return Date.parse(r.until) <= now;
}

/**
 * Is her line on this page? Any <script> tag that loads assistant.js and
 * names her slug — whatever order the attributes come in, and whatever a
 * WordPress plugin appended to the src (?ver=…).
 */
export function snippetPresent(html: string, slug: string): boolean {
  for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/assistant\.js/i.test(tag)) continue;
    const site = tag.match(/data-site=["']?([a-z0-9-]+)/i)?.[1]?.toLowerCase();
    if (site === slug) return true;
  }
  return false;
}

/** The one line she pastes. Absolute: her host proxies nothing of ours. */
export function receptionistSnippet(slug: string): string {
  return `<script defer src="https://servolia.com/assistant.js" data-site="${slug}"></script>`;
}

/**
 * Platforms where many businesses share one hostname (a Doctolib profile, a
 * Google Sites page, a Facebook page). The hostname is all we key on, so two
 * practices there would share one receptionist — refused, with a message
 * asking for their own site.
 */
const SHARED_HOSTS = [
  "google.com", "doctolib.fr", "doctolib.de", "doctolib.it", "planity.com", "facebook.com", "instagram.com",
  "linktr.ee", "pagesjaunes.fr", "linkedin.com", "tiktok.com", "youtube.com", "x.com", "twitter.com",
  "wa.me", "whatsapp.com", "calendly.com", "etsy.com", "amazon.fr", "amazon.com", "maiia.com", "keldoc.com",
];
export function isSharedPlatform(domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www[.]/, "");
  return SHARED_HOSTS.some((h) => d === h || d.endsWith(`.${h}`));
}

/** Hours a started trial holds its domain before it must prove itself by an install. */
export const CLAIM_HOLD_HOURS = 48;

/**
 * May another confirmed address take this domain's trial? Only when the
 * holder never proved they run the site: no line seen on it, nothing paid,
 * and 48 hours gone. Whoever can paste the line is the owner; somebody who
 * merely typed a competitor's domain first cannot lock the practice out.
 */
export function canTakeOver(r: ReceptionistState, now: number): boolean {
  if (!r.started || r.installedAt || r.paidAt) return false;
  return now - Date.parse(r.started) >= CLAIM_HOLD_HOURS * 3_600_000;
}

/** canTakeOver at this moment — for pages, which must not read the clock
 *  during render themselves (react-hooks/purity). */
export function takeoverOpen(r: ReceptionistState | undefined): boolean {
  return Boolean(r && canTakeOver(r, Date.now()));
}

/* ── the row ───────────────────────────────────────────────────────────── */

interface Row {
  id: string;
  slug: string;
  config: ClientSiteConfig;
  notes: string | null;
  build_id: string | null;
}

export async function loadReceptionist(slug: string): Promise<Row | null> {
  const db = supabaseAdmin();
  if (!db || !slug) return null;
  const { data, error } = await db.from("client_sites")
    .select("id, slug, config, notes, build_id").eq("slug", slugify(slug)).maybeSingle();
  if (error || !data) return null;
  const row = data as Row;
  return row.config?.receptionist ? row : null;
}

async function saveConfig(row: Row, config: ClientSiteConfig, extra: Record<string, unknown> = {}): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("client_sites")
    .update({ config, business: config.businessName, ...extra }).eq("id", row.id);
  if (error) console.error("[receptionist] save failed:", error.message);
  return !error;
}

const markerLine = (r: ReceptionistState) =>
  `${RECEPTIONIST_MARKER} ${r.domain}${r.email ? ` | email: ${r.email}` : ""}`;

export type DraftResult =
  | { ok: true; slug: string; name: string; accent: string; fallback: boolean; phase: ReceptionistPhase }
  | { ok: false; reason: "invalid-domain" | "shared-platform" | "no-db" | "write-failed" };

/**
 * "Show me mine": read her homepage and make the receptionist she will talk
 * to. A draft is only a showroom — nothing is on her site, nobody is emailed
 * — so it is refreshed whenever she asks again. A receptionist that has been
 * STARTED is never touched from here: that one belongs to whoever confirmed it.
 */
export async function draftReceptionist(input: string, practice: Practice, lang: "fr" | "en"): Promise<DraftResult> {
  const domain = normalizeDomainInput(input);
  if (!domain) return { ok: false, reason: "invalid-domain" };
  if (isSharedPlatform(domain)) return { ok: false, reason: "shared-platform" };
  const probe = await probeBrand(domain);
  if (!probe) return { ok: false, reason: "invalid-domain" };
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "no-db" };

  /* The slug is the domain's — unless that slug already belongs to something
     that is not her receptionist. getClientSite, not a table query: the demos
     and the hosting briefs live in CODE, and a row with their slug would
     silently replace them (the review found `demo.lumea` → demo-lumea taking
     down the demo linked from the aesthetics pages). A `demo-` slug is never
     handed out at all. Then a suffixed one; never someone else's config. */
  const base = receptionistSlug(domain);
  let slug = "";
  for (const candidate of [base, `${base.slice(0, 45)}-rc`]) {
    if (candidate.startsWith("demo-")) continue;
    const cfg = await getClientSite(candidate);
    if (!cfg || cfg.receptionist?.domain === domain) { slug = candidate; break; }
  }
  if (!slug) return { ok: false, reason: "write-failed" };

  const existing = await loadReceptionist(slug);
  const phase = receptionistPhase(existing?.config.receptionist);
  if (existing && phase !== "draft") {
    return { ok: true, slug, name: existing.config.businessName, accent: existing.config.accent, fallback: false, phase };
  }

  const config = draftReceptionistConfig(probe, practice, lang, new Date(), slug);
  const record = {
    slug,
    build_id: null,
    business: config.businessName,
    niche: config.niche,
    config,
    status: "draft" as const,
    notes: markerLine(config.receptionist!),
  };
  const { error } = existing
    ? await db.from("client_sites").update(record).eq("id", existing.id)
    : await db.from("client_sites").insert(record);
  if (error) {
    console.error("[receptionist] draft write failed:", error.message);
    return { ok: false, reason: "write-failed" };
  }
  return { ok: true, slug, name: config.businessName, accent: config.accent, fallback: probe.fallback, phase: "draft" };
}

/** Has this address already had a trial, on any site? Null when we could
 *  not tell — the caller refuses rather than guessing "no". */
async function emailHadTrial(email: string, exceptSlug: string): Promise<boolean | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("client_sites").select("slug, config")
    .ilike("notes", `%${RECEPTIONIST_MARKER}%email: ${email.replace(/[%]/g, "")}%`);
  if (error) return null;
  return (data ?? []).some((r) => {
    const rec = (r as { slug: string; config: ClientSiteConfig }).config?.receptionist;
    return r.slug !== exceptSlug && rec?.email?.toLowerCase() === email && Boolean(rec.started);
  });
}

export type StartResult =
  | { ok: true; already: boolean; slug: string; business: string; domain: string; until: string; lang: "fr" | "en" }
  | { ok: false; reason: "not-found" | "taken" | "used" | "ended" | "no-db" | "write-failed" };

/**
 * Her click: the address in the token becomes the receptionist's owner and
 * where its enquiries go, and seven days start. Idempotent for her (a second
 * click reports the running trial); a refusal for anyone else.
 */
export async function startReceptionistTrial(claim: ReceptionistClaim, details: ReceptionistDetails, now = new Date()): Promise<StartResult> {
  const row = await loadReceptionist(claim.slug);
  if (!row) return { ok: false, reason: "not-found" };
  const r = row.config.receptionist!;
  const email = claim.email.toLowerCase();

  const mine = r.email?.toLowerCase() === email;
  if (r.started && mine) {
    const phase = receptionistPhase(r, now.getTime());
    if (phase === "ended") return { ok: false, reason: "ended" };
    return { ok: true, already: true, slug: row.slug, business: row.config.businessName, domain: r.domain, until: r.until!, lang: r.lang };
  }
  if (r.started && !canTakeOver(r, now.getTime())) return { ok: false, reason: "taken" };
  const had = await emailHadTrial(email, row.slug);
  if (had === null) return { ok: false, reason: "no-db" };
  if (had) return { ok: false, reason: "used" };

  const until = new Date(now.getTime() + RECEPTIONIST_TRIAL_DAYS * DAY).toISOString();
  // A fresh week for the new owner: nothing of an earlier holder's trial carries over.
  const next: ReceptionistState = {
    domain: r.domain, practice: r.practice, createdAt: r.createdAt,
    email, lang: claim.lang, started: now.toISOString(), until,
  };
  const config: ClientSiteConfig = {
    ...applyDetails(row.config, details),
    // Where the enquiries go, and who owns it — the confirmed address.
    email,
    hostingEmail: email,
    language: claim.lang,
    receptionist: next,
  };
  const ok = await saveConfig(row, config, { notes: markerLine(next) });
  if (!ok) return { ok: false, reason: "write-failed" };
  return { ok: true, already: false, slug: row.slug, business: config.businessName, domain: r.domain, until, lang: claim.lang };
}

/** She edits what it says, any time while it is hers. */
export async function updateReceptionistDetails(claim: ReceptionistClaim, details: ReceptionistDetails): Promise<boolean> {
  const row = await loadReceptionist(claim.slug);
  const r = row?.config.receptionist;
  if (!row || !r?.email || r.email.toLowerCase() !== claim.email.toLowerCase()) return false;
  // Rebuilt from the bare safety line, so repeated saves do not stack.
  const base: ClientSiteConfig = { ...row.config, ownerInstructions: safetyLine(r.lang) };
  return saveConfig(row, applyDetails(base, details));
}

export type InstallCheck =
  | { ok: true; found: boolean; until?: string; restarted: boolean }
  | { ok: false; reason: "not-found" | "unreachable" };

/**
 * Look at her homepage for her line. A first sighting moves the end of her
 * week to seven days from now (withInstallSeen). Only her own domains are
 * fetched — the ones on the row, which came from normalizeDomainInput and the
 * probe's public-host checks, never from the request.
 */
export async function checkReceptionistInstall(slug: string, now = new Date()): Promise<InstallCheck> {
  const row = await loadReceptionist(slug);
  if (!row) return { ok: false, reason: "not-found" };
  const r = row.config.receptionist!;
  const hosts = [...new Set([r.domain, ...(row.config.domains ?? [])])].slice(0, 2);
  let reached = false;
  for (const host of hosts) {
    for (const url of [`https://${host}/`, `https://www.${host}/`]) {
      const page = await fetchPublic(url, 600_000, 6000);
      if (!page) continue;
      reached = true;
      if (snippetPresent(page.text, row.slug)) {
        const next = withInstallSeen(r, now);
        // "Restarted" only once it is written: the page and Telegram say so.
        const restarted = next !== r && await saveConfig(row, { ...row.config, receptionist: next });
        return { ok: true, found: true, until: restarted ? next.until : r.until, restarted };
      }
    }
  }
  return reached ? { ok: true, found: false, until: r.until, restarted: false } : { ok: false, reason: "unreachable" };
}

/**
 * THE BETTER SIGNAL: her own visitors. A line added through Google Tag
 * Manager is invisible in the raw HTML, and a site behind bot protection
 * refuses our fetch — but in both cases the widget itself calls us from her
 * domain. /api/assistant and /api/chat call this when a request for a
 * receptionist not yet seen installed arrives with an Origin on one of its
 * own domains. The caller checks those two cheap conditions first, so this
 * runs once per trial, not once per page view.
 */
export async function markSeenLive(slug: string, originHost: string, now = new Date()): Promise<boolean> {
  const row = await loadReceptionist(slug);
  const r = row?.config.receptionist;
  if (!row || !r || r.installedAt || receptionistPhase(r, now.getTime()) !== "running") return false;
  const host = originHost.toLowerCase().replace(/^www[.]/, "");
  const mine = [r.domain, ...(row.config.domains ?? [])].map((d) => d.toLowerCase().replace(/^www[.]/, ""));
  if (!mine.includes(host)) return false;
  const next = withInstallSeen(r, now);
  return next !== r && saveConfig(row, { ...row.config, receptionist: next });
}

/* ── the daily pass (cron/dunning) ─────────────────────────────────────── */

export interface ReceptionistEvent {
  slug: string;
  business: string;
  domain: string;
  email: string;
  lang: "fr" | "en";
  conversations: number;
  until: string;
  installed: boolean;
}

async function allReceptionists(): Promise<Row[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("client_sites")
    .select("id, slug, config, notes, build_id").like("notes", `%${RECEPTIONIST_MARKER}%`);
  if (error) return null;
  return ((data ?? []) as Row[]).filter((r) => r.config?.receptionist?.started && !r.config.receptionist.paidAt);
}

/**
 * Once a day: look for tags not yet seen, send the day-5 note, end the weeks
 * that are over. Each step marks the row BEFORE the caller emails, so a run
 * that dies halfway costs at most one missing email, never a second one.
 */
export async function receptionistDailyPass(now = Date.now(), checkBudgetMs = 30_000): Promise<{
  installed: ReceptionistEvent[]; nudged: ReceptionistEvent[]; ended: ReceptionistEvent[]; errors: string[];
}> {
  /* Fetching strangers' homepages is the slow part; it stops when the budget
     is spent, and tomorrow's run picks up where this one left off. The
     nudges and endings are cheap and always run. */
  const checksUntil = Date.now() + checkBudgetMs;
  const installed: ReceptionistEvent[] = [];
  const nudged: ReceptionistEvent[] = [];
  const ended: ReceptionistEvent[] = [];
  const errors: string[] = [];

  const rows = await allReceptionists();
  // Said out loud: a silent empty list would skip a day's nudges unnoticed.
  if (!rows) return { installed, nudged, ended, errors: ["could not read the receptionist trials"] };

  for (let row of rows) {
    const event = async (r: ReceptionistState): Promise<ReceptionistEvent> => {
      const conversations = await conversationCount(row.slug, RECEPTIONIST_TRIAL_DAYS * 2);
      return {
        slug: row.slug, business: row.config.businessName, domain: r.domain, email: r.email ?? "",
        lang: r.lang, until: r.until ?? "", conversations,
        // Conversations prove it is on her site even when we never saw the tag.
        installed: Boolean(r.installedAt) || conversations > 0,
      };
    };

    if (Date.now() < checksUntil && receptionistPhase(row.config.receptionist, now) === "running" && !row.config.receptionist!.installedAt) {
      const seen = await checkReceptionistInstall(row.slug, new Date(now)).catch(() => null);
      if (seen?.ok && seen.found) {
        const fresh = await loadReceptionist(row.slug);
        if (fresh) row = fresh;
        installed.push(await event(row.config.receptionist!));
      }
    }

    const r = row.config.receptionist!;
    if (receptionistNudgeDue(r, now)) {
      const next = { ...r, nudged: new Date(now).toISOString() };
      if (await saveConfig(row, { ...row.config, receptionist: next })) nudged.push(await event(next));
      else errors.push(`${row.slug}: nudge mark failed`);
    } else if (receptionistExpiryDue(r, now)) {
      const next = { ...r, ended: new Date(now).toISOString() };
      if (await saveConfig(row, { ...row.config, receptionist: next })) ended.push(await event(next));
      else errors.push(`${row.slug}: end mark failed`);
    }
  }
  return { installed, nudged, ended, errors };
}

/* ── payment: the trial becomes a client ───────────────────────────────── */

export type PurchaseResult =
  | {
      ok: true; already: boolean; clientId: string | null; buildId: string | null; linked: boolean;
      /** This receptionist was ALREADY paid for under another subscription. */
      duplicate: boolean;
      business: string; planName: string; monthlyEur: number;
    }
  | { ok: false; reason: string };

/**
 * The EUR subscription for a receptionist is paid. Everything a paying
 * client has, made for her in one pass:
 *   - a build, already `live` (there is nothing to deliver: it is on her site);
 *   - a clients row on that build — the conversation meter and top-ups, the
 *     portal, the invoices and the monthly report all hang off build_id;
 *   - her receptionist row pointed at that build and marked paid, which is
 *     what keeps the widget on after the trial week (receptionistOn).
 *
 * FAILURE IS A RETRY, NOT A HALF-WRITE. Any write that fails returns ok:false
 * and the webhook answers 500, so Stripe delivers the event again later:
 *   - no build → nothing written yet, the retry starts clean;
 *   - no clients row → the build just made is removed, the retry starts clean;
 *   - no link → the retry finds the clients row by subscription and links it
 *     (a replay does not just say "already": an unlinked paid receptionist
 *     would go dark at the end of its week and invite a second payment).
 * A payment whose receptionist row cannot be found is STILL recorded as a
 * client (the money is real) and reported as not linked. A second
 * subscription for a receptionist already paid for is recorded too, but not
 * linked, and flagged `duplicate` so the founder refunds one.
 */
export async function completeReceptionistPurchase(a: {
  slug: string; email: string; planKey: string; billing: "monthly" | "annual";
  customerId: string | null; subscriptionId: string | null; now?: Date;
}): Promise<PurchaseResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "no-db" };
  const plan = resolvePlan(a.planKey);
  if (!plan) return { ok: false, reason: `unknown plan ${a.planKey}` };
  const monthlyEur = planAmountCents(plan, a.billing) / 100 / (a.billing === "annual" ? 12 : 1);
  const row = await loadReceptionist(a.slug);
  const business = row?.config.businessName ?? a.email;
  const base = { business, planName: plan.name, monthlyEur };

  const link = (buildId: string) => {
    const r = row!.config.receptionist!;
    const next: ReceptionistState = { ...r, paidAt: (a.now ?? new Date()).toISOString(), plan: plan.key };
    return saveConfig(row!, { ...row!.config, status: "published", receptionist: next }, { build_id: buildId, status: "published" });
  };

  if (a.subscriptionId) {
    const { data: prior, error: priorErr } = await db.from("clients").select("id, build_id")
      .eq("subscription_id", a.subscriptionId).limit(1);
    if (priorErr) return { ok: false, reason: `clients lookup: ${priorErr.message}` };
    const p = (prior ?? [])[0] as { id: string; build_id: string | null } | undefined;
    if (p) {
      const isMine = Boolean(row && p.build_id && row.build_id === p.build_id);
      if (row && p.build_id && !isMine && !row.config.receptionist?.paidAt) {
        if (!(await link(p.build_id))) return { ok: false, reason: "link retry failed" };
        // The purchase completes NOW, so the caller sends the paid email now.
        return { ok: true, already: false, clientId: p.id, buildId: p.build_id, linked: true, duplicate: false, ...base };
      }
      return { ok: true, already: true, clientId: p.id, buildId: p.build_id, linked: isMine, duplicate: false, ...base };
    }
  }
  // Paid already, under another subscription: two tabs, or an old link.
  const duplicate = Boolean(row?.config.receptionist?.paidAt);

  const { data: build, error: buildErr } = await db.from("builds").insert({
    business,
    email: a.email,
    plan: SETUP_PLAN.key,
    plan_name: `${plan.name} — receptionist on own site`,
    total_price: 0,
    deposit_paid: 0,
    balance_due: 0,
    status: "live",
    customer_id: a.customerId,
  }).select("id").single();
  if (buildErr || !build) return { ok: false, reason: `build insert: ${buildErr?.message ?? "no row"}` };
  const buildId = (build as { id: string }).id;

  const { data: client, error: clientErr } = await db.from("clients").insert({
    build_id: buildId,
    business,
    email: a.email,
    plan: plan.key,
    monthly_amount: monthlyEur,
    status: "active",
    customer_id: a.customerId,
    subscription_id: a.subscriptionId,
  }).select("id").single();
  if (clientErr || !client) {
    await db.from("builds").delete().eq("id", buildId);
    return { ok: false, reason: `clients insert: ${clientErr?.message ?? "no row"}` };
  }
  const clientId = (client as { id: string }).id;

  if (row && !duplicate) {
    // The clients row exists now, so the retry this triggers will link it.
    if (!(await link(buildId))) return { ok: false, reason: "link failed (the retry will link it)" };
    return { ok: true, already: false, clientId, buildId, linked: true, duplicate: false, ...base };
  }
  return { ok: true, already: false, clientId, buildId, linked: false, duplicate, ...base };
}
