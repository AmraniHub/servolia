/**
 * THE AI ASSISTANT AS A PRODUCT A CLIENT CAN ACTUALLY RECEIVE.
 *
 * Until 2026-09-16 the assistant was sold on /hosting?plan=chatbot with the
 * line "answers customers on your site — nothing to install", and after
 * payment nothing put anything on the client's site. The engine (/api/chat +
 * buildReceptionistPrompt) only ever served Servolia's own pages: there was no
 * embed script, no CORS, and no config row for a hosting client. The promise
 * was a page, not a program.
 *
 * This module is the seam that makes it a program. It deliberately imports
 * NOTHING from the rest of the app (no `@/` aliases) so that Node can run it
 * directly for tests — every function here is pure, or takes its data as an
 * argument.
 *
 *   assistantSlugFor()      which config a paying client's widget loads
 *   defaultGreeting()       what the widget says first, per language
 *   publicAssistantConfig() the subset of a config the browser may see
 *   originAllowed()         which websites may call the API for a slug
 *   installSnippet()        the one line a client (or our installer) adds
 *
 * Nothing here decides whether an assistant is PAID FOR — that lives in
 * assistantEnabled() in assistantAccess.ts, which needs the database.
 */

export type AssistantLang = "ar" | "fr" | "en";

export const ASSISTANT_LANGS: readonly AssistantLang[] = ["ar", "fr", "en"];

/** Where the script and the API live. The apex, never www: servolia.com
 *  308s www to the apex, and a CORS preflight may not be redirected. */
export const ASSISTANT_ORIGIN = "https://servolia.com";

/**
 * The slice of a ClientSiteConfig the assistant needs. Declared here rather
 * than imported so this file stays alias-free; ClientSiteConfig satisfies it.
 */
export interface AssistantConfigLike {
  slug: string;
  businessName: string;
  accent?: string;
  language?: string;
  /** What the assistant speaks. Absent = the config's single `language`. */
  languages?: AssistantLang[];
  /** Per-language first message. Absent = defaultGreeting(). */
  greetings?: Partial<Record<AssistantLang, string>>;
  /** Per-language chips under the greeting. Absent = defaultQuickReplies(). */
  quickReplies?: Partial<Record<AssistantLang, string[]>>;
  /** Hostnames allowed to embed this assistant, e.g. ["example.com"]. */
  domains?: string[];
  /** Which corner the launcher sits in. Default right. */
  widgetPosition?: "left" | "right";
  /** Set on a config that exists only for the assistant add-on. */
  assistantOnly?: boolean;
  isDemo?: boolean;
  features?: { chat?: boolean };
}

/* ── the slug ────────────────────────────────────────────────────────────── */

/**
 * The config a client's widget loads. A known client's ref IS the slug, so
 * the entry in CLIENT_REFS, the row in hosting_clients and the assistant's
 * config all answer to one name. A self-serve buyer has no ref: their slug is
 * their domain, which they typed at checkout and which is stable.
 */
export function assistantSlugFor(ref: string | null | undefined, business: string | null | undefined): string {
  const r = (ref ?? "").trim().toLowerCase();
  if (r && /^[a-z0-9][a-z0-9-]{0,47}$/.test(r)) return r;
  return slugifyHost(business ?? "");
}

/** "https://www.Example.com/path" → "example-com". Deterministic, url-safe. */
export function slugifyHost(input: string): string {
  const host = hostnameOf(input) || input;
  return (host || "client")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "client";
}

/** The hostname inside a URL or a bare domain, lowercased; "" if none. */
export function hostnameOf(input: string | null | undefined): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname;
  } catch {
    return "";
  }
}

/* ── language ────────────────────────────────────────────────────────────── */

export function isAssistantLang(v: unknown): v is AssistantLang {
  return v === "ar" || v === "fr" || v === "en";
}

/** The languages a config speaks, always at least one, in the order given. */
export function assistantLanguages(c: AssistantConfigLike): AssistantLang[] {
  const listed = (c.languages ?? []).filter(isAssistantLang);
  if (listed.length) return Array.from(new Set(listed));
  return [isAssistantLang(c.language) ? c.language : "en"];
}

export function defaultGreeting(lang: AssistantLang, name: string): string {
  switch (lang) {
    case "ar": return `مرحباً بك في ${name} 👋 كيف يمكنني مساعدتك؟`;
    case "fr": return `Bienvenue chez ${name} 👋 Comment puis-je vous aider ?`;
    default: return `Welcome to ${name} 👋 How can I help?`;
  }
}

export function defaultQuickReplies(lang: AssistantLang): string[] {
  switch (lang) {
    case "ar": return ["أريد معلومات", "الأسعار", "كيف أتواصل معكم؟"];
    case "fr": return ["Je veux des informations", "Les tarifs", "Comment vous joindre ?"];
    default: return ["I'd like some information", "Prices", "How do I reach you?"];
  }
}

/** The words the widget itself needs, per language. Kept server-side so
 *  the script stays small and a wording fix does not need a client redeploy. */
export function widgetStrings(lang: AssistantLang) {
  switch (lang) {
    case "ar": return {
      online: "متصل · يجيب فوراً",
      placeholder: "اكتب رسالتك…",
      send: "إرسال",
      nudge: "💬 هل لديك سؤال؟",
      open: "افتح المحادثة",
      close: "إغلاق",
      fallbackTitle: "اترك بياناتك وسنتواصل معك سريعاً:",
      name: "الاسم",
      contact: "الهاتف أو البريد الإلكتروني",
      sendDetails: "إرسال",
      sending: "جارٍ الإرسال…",
      sent: "✓ تم الاستلام — سنتواصل معك قريباً",
      failed: "تعذر الإرسال — تواصل معنا مباشرة.",
      captured: "✓ تم تسجيل طلبك — سيتواصل معك الفريق قريباً",
      error: "عذراً، حدث خلل في الاتصال — اترك بياناتك أدناه وسنعاود الاتصال بك.",
    };
    case "fr": return {
      online: "En ligne · répond instantanément",
      placeholder: "Écrivez votre message…",
      send: "Envoyer",
      nudge: "💬 Une question ?",
      open: "Ouvrir la discussion",
      close: "Fermer",
      fallbackTitle: "Laissez vos coordonnées, on vous rappelle vite :",
      name: "Votre nom",
      contact: "Téléphone ou e-mail",
      sendDetails: "Envoyer",
      sending: "Envoi…",
      sent: "✓ Bien reçu — on revient vers vous rapidement",
      failed: "Envoi impossible — contactez-nous directement.",
      captured: "✓ C'est noté — l'équipe vous recontacte rapidement",
      error: "Désolé, petit souci de connexion — laissez vos coordonnées ci-dessous et on vous rappelle.",
    };
    default: return {
      online: "Online · replies instantly",
      placeholder: "Type a message…",
      send: "Send",
      nudge: "💬 Have a question?",
      open: "Open chat",
      close: "Close",
      fallbackTitle: "Leave your details and we'll get back to you fast:",
      name: "Your name",
      contact: "Phone or email",
      sendDetails: "Send",
      sending: "Sending…",
      sent: "✓ Got it — we'll be in touch shortly",
      failed: "Couldn't send — please contact us directly.",
      captured: "✓ Got it — the team will be in touch shortly",
      error: "Sorry, I'm having a connection issue — leave your details below and we'll get right back to you.",
    };
  }
}

/* ── what the browser may see ────────────────────────────────────────────── */

export interface PublicAssistantConfig {
  enabled: true;
  slug: string;
  name: string;
  accent: string;
  languages: AssistantLang[];
  position: "left" | "right";
  greeting: Record<AssistantLang, string>;
  quickReplies: Record<AssistantLang, string[]>;
  strings: Record<AssistantLang, ReturnType<typeof widgetStrings>>;
}

/**
 * The public face of a config: name, colour, languages, greetings. NEVER the
 * prompt, the services, the phone number the leads go to, the pixel token,
 * or the billing email — the widget does not need them and the endpoint that
 * serves this is open to anyone who knows the slug.
 */
export function publicAssistantConfig(c: AssistantConfigLike): PublicAssistantConfig {
  const languages = assistantLanguages(c);
  const name = (c.businessName || "").trim() || "Assistant";
  const rec = <T,>(f: (l: AssistantLang) => T) =>
    Object.fromEntries(ASSISTANT_LANGS.map((l) => [l, f(l)])) as Record<AssistantLang, T>;
  return {
    enabled: true,
    slug: c.slug,
    name,
    accent: /^#[0-9a-fA-F]{6}$/.test(c.accent ?? "") ? (c.accent as string) : "#36671E",
    languages,
    position: c.widgetPosition === "left" ? "left" : "right",
    greeting: rec((l) => (c.greetings?.[l] ?? "").trim() || defaultGreeting(l, name)),
    quickReplies: rec((l) => {
      const own = (c.quickReplies?.[l] ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 4);
      return own.length ? own : defaultQuickReplies(l);
    }),
    strings: rec(widgetStrings),
  };
}

/* ── which websites may call the API for a slug ──────────────────────────── */

/**
 * True when a browser on `origin` may talk to this slug's assistant.
 *
 * Servolia's own pages always may (the demo, the admin preview). A client's
 * config lists its hostnames; `www.` is implied. A site with NO domains listed
 * is open — that is the pre-existing behaviour for Servolia-built sites, which
 * live on servolia.com anyway. An assistant-only config with no domains is
 * refused from every foreign origin, because "we forgot to list them" must
 * not become "anyone can put our client's assistant on their page".
 *
 * A request with no Origin header is not a browser cross-site call and is
 * allowed through; it is rate-limited and capped elsewhere.
 */
export function originAllowed(origin: string | null | undefined, c: AssistantConfigLike): boolean {
  if (!origin) return true;
  const host = hostnameOf(origin);
  if (!host) return false;
  if (host === "servolia.com" || host.endsWith(".servolia.com") || host === "localhost" || host === "127.0.0.1") return true;
  const domains = (c.domains ?? []).map((d) => hostnameOf(d)).filter(Boolean);
  if (!domains.length) return !c.assistantOnly;
  return domains.some((d) => host === d || host === `www.${d}` || `www.${host}` === d);
}

/** The CORS headers for a response to `origin`, once originAllowed() said yes. */
export function corsHeaders(origin: string | null | undefined): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/* ── the install line ────────────────────────────────────────────────────── */

/**
 * The one line a site adds. `defer` so it never blocks the page; `data-site`
 * rather than a query string so the script URL is identical for every client
 * and caches once.
 */
export function installSnippet(slug: string, position: "left" | "right" = "right"): string {
  const pos = position === "left" ? ` data-position="left"` : "";
  return `<script defer src="${ASSISTANT_ORIGIN}/assistant.js" data-site="${slug}"${pos}></script>`;
}

/** True when an HTML document already carries the assistant. */
export function hasAssistantTag(html: string): boolean {
  return /<script[^>]+src=["']https:\/\/servolia\.com\/assistant\.js["']/i.test(html);
}

/**
 * Insert the snippet before the LAST </body>. Returns the input unchanged if
 * the tag is already there or there is no body to add it to — the caller
 * reads "unchanged" as "nothing to commit", which is how an installer stays
 * idempotent across a Stripe retry.
 */
export function withAssistantTag(html: string, slug: string, position: "left" | "right" = "right"): string {
  if (hasAssistantTag(html)) return html;
  const i = html.toLowerCase().lastIndexOf("</body>");
  if (i < 0) return html;
  // Match the file's own line ending so the diff is one line, not a rewrite.
  const nl = html.includes("\r\n") ? "\r\n" : "\n";
  return `${html.slice(0, i)}${installSnippet(slug, position)}${nl}${html.slice(i)}`;
}

/* ── caps the API enforces ───────────────────────────────────────────────── */

export const CHAT_MAX_MESSAGES = 12;
export const CHAT_MAX_MESSAGE_CHARS = 2000;

/**
 * Shape-check a conversation from the browser. Keeps only the last N turns
 * with a valid role and non-empty content, trims each to a sane length. A
 * 200 KB "message" is not a customer question, it is someone testing whether
 * our model bill has a ceiling.
 */
export function sanitizeMessages(input: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(input)) return [];
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of input) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, CHAT_MAX_MESSAGE_CHARS);
    if (!text) continue;
    out.push({ role, content: text });
  }
  return out.slice(-CHAT_MAX_MESSAGES);
}
