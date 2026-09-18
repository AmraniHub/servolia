/**
 * THE PAGE EDITOR — a client changing their own site's words, safely.
 *
 * Samira asked for "full control, I want to add and remove contents, I need to
 * do things myself manually" (2026-09-18). Her site is static HTML generated
 * once from a dead CMS, so there was no content layer to edit and no login to
 * give her. This is that layer.
 *
 * WHY FIELDS AND NOT HTML. She edits the text inside marked regions, never
 * markup. A client who can edit HTML can delete a closing tag and take their
 * own shop down on a Friday night, and the person they will call is us. Every
 * saved value is escaped, so nothing she types can become markup — not a
 * `<script>`, not a stray `<`, not a broken `<div>`.
 *
 * WHY GIT AND NOT A DATABASE. Every save is a commit to the client's own repo,
 * which their Vercel project already deploys from. That buys three things a
 * database would not: the page stays genuinely static (no flash of old text,
 * nothing for search engines to miss), the history is complete, and anything
 * she breaks is one revert away.
 *
 * WHAT MAKES A REGION EDITABLE. `data-edit="key"` on an element whose content
 * is PLAIN TEXT. Deliberately not "any element": a region containing nested
 * markup cannot be replaced by a regex without risking the page, so this
 * refuses those rather than guessing. See readRegion().
 */

export interface EditableField {
  /** The `data-edit` key, e.g. "hero.title" — or a dictionary key when `lang` is set. */
  key: string;
  /** What the client sees above the box. Their words, not ours. */
  label: string;
  /** Which page file it lives in, relative to the site root. */
  file: string;
  /** A longer box for paragraphs. */
  multiline?: boolean;
  /** Refused above this length, so one field cannot become a whole page. */
  max?: number;
  /**
   * Set when this field is a DICTIONARY entry rather than a region of HTML.
   *
   * Excellence Agency's site paints from js/i18n.js: every element carries a
   * data-i18n key and the script replaces its text on load. Editing their HTML
   * would change the file and nothing a visitor sees. So for a site like
   * theirs the field names a language (`ar`, `fr`) and the value is written
   * into that block of the dictionary instead.
   */
  lang?: string;
  /**
   * Which tab this belongs under. Defaults to the file, which is right when
   * one page is one file — but a dictionary holds every page's words in a
   * single file, and 26 boxes under one tab called "js/i18n.js" is not
   * something to hand a client.
   */
  page?: string;
}

export interface EditableSite {
  /** The client reference, which is also the URL: /admin on their domain. */
  ref: string;
  businessName: string;
  repo: string;
  branch: string;
  /** Folder inside the repo that the host deploys, e.g. "web". */
  siteRoot: string | null;
  /** The client's own brand colour. The editor wears it, not ours — this is
   *  their tool on their domain, and Servolia green would announce whose
   *  software it really is on the one screen that should feel like theirs. */
  accent: string;
  /** The page behind it. Servolia's warm cream is as much a signature as the
   *  green, so it is set per client too. */
  surface: string;
  /** Box and card borders. Servolia's are sage-tinted; a client's are not. */
  line: string;
  /**
   * Where the editor actually answers on their own domain, once their host is
   * rewriting /admin to it. UNSET UNTIL THAT IS DEPLOYED, and deliberately not
   * derived from the domain: the client's own page links here, and a link to a
   * rewrite that does not exist yet is a 404 with our name on it, sent to the
   * one person we are trying to convince this is a real service.
   */
  adminUrl?: string;
  /**
   * A second language served by swapping recognised English strings, and the
   * file holding that dictionary. Where this is set, a save reports which
   * edited lines that language can no longer render — see siteEditorI18n.
   */
  translations?: { file: string; language: string };
  /** What the pages are called, for the page picker. `id` defaults to `file`. */
  pages: { file: string; label: string; id?: string }[];
  fields: EditableField[];
  /**
   * The language the editor itself speaks. Handing a French-speaking client a
   * tool labelled "Save changes to my website" undoes most of the work of
   * putting it on their own domain in their own colours.
   */
  uiLang?: "en" | "fr";
}

export const MAX_FIELD = 2000;

/* ── reading and writing one region ──────────────────────────────────────── */

/**
 * The opening tag of the element carrying `data-edit="key"`.
 *
 * Attribute order is not assumed: the marker may sit before or after class,
 * id or anything else, because these pages were written by hand and by a
 * generator and neither is consistent.
 */
function openTag(key: string): RegExp {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<([a-zA-Z][\\w-]*)((?:\\s+[^>]*?)?\\sdata-edit\\s*=\\s*["']${k}["'](?:\\s+[^>]*?)?)>`, "i");
}

export interface RegionRead {
  ok: true;
  /** The text between the tags, with entities turned back into characters. */
  value: string;
  tag: string;
}
export type RegionResult = RegionRead | { ok: false; reason: "not-found" | "has-markup" | "unbalanced" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // last: so "&amp;lt;" survives as "&lt;"
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Read one editable region out of a page.
 *
 * REFUSES A REGION THAT CONTAINS MARKUP. Replacing the inside of an element
 * with a regex is only safe while the inside is text; the moment it holds a
 * nested tag, the naive "up to the next closing tag" match ends in the wrong
 * place and writes a broken page. Rather than get that subtly wrong on a live
 * client site, a region like that is reported and skipped — the marker is in
 * the wrong place and a person should move it.
 */
export function readRegion(html: string, key: string): RegionResult {
  const open = openTag(key).exec(html);
  if (!open) return { ok: false, reason: "not-found" };
  const tag = open[1];
  const start = open.index + open[0].length;
  const close = new RegExp(`</${tag}\\s*>`, "i");
  const rest = html.slice(start);
  const end = close.exec(rest);
  if (!end) return { ok: false, reason: "unbalanced" };
  const inner = rest.slice(0, end.index);
  // Any tag at all inside means the marker is on a container, not on text.
  if (/<[a-zA-Z/!]/.test(inner)) return { ok: false, reason: "has-markup" };
  return { ok: true, value: decodeEntities(inner).trim(), tag };
}

/**
 * Put a new value into one region, escaped. Returns the page unchanged when
 * the region is missing or unsafe — a save must never half-apply.
 */
export function writeRegion(html: string, key: string, value: string): { html: string; changed: boolean } {
  const current = readRegion(html, key);
  if (!current.ok) return { html, changed: false };
  if (current.value === value.trim()) return { html, changed: false };

  const open = openTag(key).exec(html)!;
  const start = open.index + open[0].length;
  const close = new RegExp(`</${current.tag}\\s*>`, "i");
  const rest = html.slice(start);
  const end = close.exec(rest)!;
  return {
    html: html.slice(0, start) + escapeHtml(value.trim()) + rest.slice(end.index),
    changed: true,
  };
}

/** What a submitted value must satisfy before it is allowed near a page. */
export function validate(field: EditableField, value: unknown): string | null {
  if (typeof value !== "string") return "That field was not text.";
  const v = value.trim();
  if (!v) return "This cannot be empty — put a space if you really want it blank.";
  if (v.length > (field.max ?? MAX_FIELD)) return `Too long — ${field.max ?? MAX_FIELD} characters at most.`;
  if (!field.multiline && /[\r\n]/.test(v)) return "This one is a single line.";
  return null;
}

/* ── who can edit what ───────────────────────────────────────────────────── */

/**
 * GoodsCoChina. The fields are the ones a sourcing agent actually changes —
 * what she says she does, and the six service cards — not every string on the
 * page. A short list she understands beats a long one she is frightened of.
 *
 * Adding the next client is another entry here plus the `data-edit` markers
 * on their pages. Nothing else.
 */
/**
 * One dictionary key, as a box per language.
 *
 * Written as a helper rather than twenty-six hand-typed entries because the
 * pairs must not drift: a key present in French and missing in Arabic gives a
 * client a French box that saves and an Arabic one that silently does not.
 */
function bilingual(
  key: string,
  label: string,
  page: string,
  opts: { multiline?: boolean; max?: number } = {},
): EditableField[] {
  const LANGS: { code: string; name: string }[] = [
    { code: "fr", name: "français" },
    { code: "ar", name: "العربية" },
  ];
  return LANGS.map((l) => ({
    key,
    lang: l.code,
    page,
    file: "js/i18n.js",
    label: `${label} (${l.name})`,
    ...opts,
  }));
}

export const EDITABLE_SITES: Record<string, EditableSite> = {
  goodscochina: {
    ref: "goodscochina",
    businessName: "GoodsCoChina",
    repo: "AmraniHub/yiwugoodsco-com",
    branch: "main",
    siteRoot: "web",
    // Live since 2026-09-18: her web/vercel.json rewrites /admin here, and
    // /_next with it — without that second rewrite the page renders and its
    // scripts 404, so the password box appears and the button does nothing.
    adminUrl: "https://goodscochina.com/admin",
    /* Copied out of her own web/css/yg.css :root, not matched by eye —
       --yg-navy, --yg-soft and --yg-line. The editor is then built from the
       same three tokens her website is, so it looks like part of it. */
    accent: "#111C74",
    surface: "#F7F9FC",
    line: "#E7EAF1",
    /* Her site is bilingual, and the Arabic is keyed on the English wording
       rather than on markers — so editing an English line un-translates it.
       She is told which ones, every time. */
    translations: { file: "js/i18n.js", language: "Arabic" },

    pages: [
      { file: "index.html", label: "Home page" },
      { file: "sourcing.html", label: "Sourcing page" },
      { file: "contact.html", label: "Contact page" },
    ],
    /* THE HERO HEADLINE IS NOT HERE, ON PURPOSE. Her <h1> is
       `Your Trusted <span>Sourcing Partner</span> in China` — the span is the
       design's highlight, and a region holding markup is one this parser
       refuses rather than risk writing a broken page. Making it editable means
       choosing: drop the highlight and have one clean box, or keep it and give
       her three boxes for one sentence. That is her design and his call, so it
       waits for a decision instead of being quietly resolved here. */
    fields: [
      { key: "home.intro", label: "Introduction paragraph", file: "index.html", multiline: true, max: 400 },
      { key: "home.s1.title", label: "Service 1 — title", file: "index.html", max: 60 },
      { key: "home.s1.text", label: "Service 1 — description", file: "index.html", multiline: true, max: 240 },
      { key: "home.s2.title", label: "Service 2 — title", file: "index.html", max: 60 },
      { key: "home.s2.text", label: "Service 2 — description", file: "index.html", multiline: true, max: 240 },
      { key: "home.s3.title", label: "Service 3 — title", file: "index.html", max: 60 },
      { key: "home.s3.text", label: "Service 3 — description", file: "index.html", multiline: true, max: 240 },
      { key: "home.s4.title", label: "Service 4 — title", file: "index.html", max: 60 },
      { key: "home.s4.text", label: "Service 4 — description", file: "index.html", multiline: true, max: 240 },
      { key: "home.s5.title", label: "Service 5 — title", file: "index.html", max: 60 },
      { key: "home.s5.text", label: "Service 5 — description", file: "index.html", multiline: true, max: 240 },

      /* The sourcing page is her sales page, so the fields are the ones with
         money attached: what the service covers, what she guarantees, and how
         many clients she takes. That last number is the one most certain to
         change and the one she would otherwise have to ask us to edit. */
      { key: "sourcing.promise", label: "The promise under the headline", file: "sourcing.html", multiline: true, max: 220 },
      { key: "sourcing.s1.title", label: "What's covered 1 — title", file: "sourcing.html", max: 60 },
      { key: "sourcing.s1.text", label: "What's covered 1 — description", file: "sourcing.html", multiline: true, max: 200 },
      { key: "sourcing.s2.title", label: "What's covered 2 — title", file: "sourcing.html", max: 60 },
      { key: "sourcing.s2.text", label: "What's covered 2 — description", file: "sourcing.html", multiline: true, max: 200 },
      { key: "sourcing.s3.title", label: "What's covered 3 — title", file: "sourcing.html", max: 60 },
      { key: "sourcing.s3.text", label: "What's covered 3 — description", file: "sourcing.html", multiline: true, max: 200 },
      { key: "sourcing.s4.title", label: "What's covered 4 — title", file: "sourcing.html", max: 60 },
      { key: "sourcing.s4.text", label: "What's covered 4 — description", file: "sourcing.html", multiline: true, max: 200 },
      { key: "sourcing.s5.title", label: "What's covered 5 — title", file: "sourcing.html", max: 60 },
      { key: "sourcing.s5.text", label: "What's covered 5 — description", file: "sourcing.html", multiline: true, max: 200 },
      { key: "sourcing.s6.title", label: "What's covered 6 — title", file: "sourcing.html", max: 60 },
      { key: "sourcing.s6.text", label: "What's covered 6 — description", file: "sourcing.html", multiline: true, max: 200 },
      { key: "sourcing.guarantee.title", label: "Your guarantee — title", file: "sourcing.html", max: 60 },
      { key: "sourcing.guarantee.text", label: "Your guarantee — what you promise", file: "sourcing.html", multiline: true, max: 320 },
      { key: "sourcing.capacity.title", label: "How many clients you take — title", file: "sourcing.html", max: 70 },
      { key: "sourcing.capacity.text", label: "How many clients you take — why", file: "sourcing.html", multiline: true, max: 260 },

      { key: "contact.title", label: "Contact page headline", file: "contact.html", max: 70 },
      { key: "contact.intro", label: "Contact page introduction", file: "contact.html", multiline: true, max: 220 },
      /* Her email and WhatsApp number are NOT here: both are links, so the
         text and the href would drift apart the first time she changed one.
         Those stay with us until the editor can write an attribute safely. */
      { key: "contact.office", label: "Where you are", file: "contact.html", max: 80 },
      { key: "contact.response", label: "How fast you reply", file: "contact.html", max: 60 },
    ],
  },

  /**
   * EXCELLENCE AGENCY — the same editor, on a site built the opposite way.
   *
   * Nothing here points at their HTML. Their pages carry `data-i18n` keys and
   * js/i18n.js replaces every string on load from an `ar` and an `fr` block,
   * so their HTML is only the first paint: editing it would change the file
   * and nothing a visitor ever sees.
   *
   * Which turns out to suit them better. One key has both languages, so each
   * box comes in a pair and they keep Arabic and French in step themselves —
   * the thing GoodsCoChina's English-keyed dictionary cannot give her.
   *
   * THE `.html` KEYS ARE NOT HERE. hero.title.html, about.title.html and the
   * rest hold real markup — <br>, a highlight <span> — which their script
   * writes into the page as HTML. A box that puts a client's typing into
   * innerHTML is a broken layout on a good day. Those stay with us.
   */
  excellenceagency: {
    ref: "excellenceagency",
    businessName: "Excellence Agency",
    repo: "AmraniHub/excellenceagency-ma",
    branch: "master",
    siteRoot: null, // their site deploys from the repo root
    // Straight out of their css/style.css :root — --navy, --off-white, --gray-200.
    accent: "#16255C",
    surface: "#F8F9FC",
    line: "#E2E8F0",
    uiLang: "fr",
    // Live since 2026-09-18, via the same three rewrites in their vercel.json.
    adminUrl: "https://excellence-agency.org/admin",
    /* Three tabs over ONE file. Twenty-two boxes under a tab called
       "js/i18n.js" is not something to hand a client. */
    pages: [
      { id: "about", file: "js/i18n.js", label: "Qui vous êtes" },
      { id: "services", file: "js/i18n.js", label: "Ce que vous faites" },
      { id: "contact", file: "js/i18n.js", label: "Contact" },
    ],
    fields: [
      ...bilingual("about.p1", "Présentation — premier paragraphe", "about", { multiline: true, max: 600 }),
      ...bilingual("about.p2", "Présentation — second paragraphe", "about", { multiline: true, max: 600 }),
      ...bilingual("about.vision.text", "Votre vision", "about", { multiline: true, max: 400 }),
      ...bilingual("about.mission.text", "Votre mission", "about", { multiline: true, max: 400 }),

      ...bilingual("hero.tagline", "Votre slogan", "services", { max: 90 }),
      ...bilingual("about.feat1", "Ce que vous faites 1", "services", { max: 90 }),
      ...bilingual("about.feat2", "Ce que vous faites 2", "services", { max: 90 }),
      ...bilingual("about.feat3", "Ce que vous faites 3", "services", { max: 90 }),
      ...bilingual("about.feat4", "Ce que vous faites 4", "services", { max: 90 }),

      ...bilingual("home.cta.title", "Appel à l'action — titre", "contact", { max: 120 }),
      ...bilingual("home.cta.subtitle", "Appel à l'action — texte", "contact", { multiline: true, max: 300 }),
      ...bilingual("contact.address.value", "Votre adresse", "contact", { max: 120 }),
      ...bilingual("contact.hours.value", "Vos horaires", "contact", { max: 120 }),
    ],
  },
};

export function editableSite(ref: string | null | undefined): EditableSite | undefined {
  return EDITABLE_SITES[(ref ?? "").trim().toLowerCase()];
}

/**
 * The paths the editor is reached at, as the BROWSER sees them.
 *
 * This exists because of a bug the rewrite reintroduced. The editor is served
 * at goodscochina.com/admin by a proxy rewrite, so `usePathname()` returns
 * "/admin" and not "/client-editor/goodscochina" — and SiteChrome, which
 * strips Servolia's cookie banner and analytics from a client's own screen,
 * stopped recognising it. Her admin page came back with our consent banner on
 * it and our page tracker recording her private editing as our traffic.
 *
 * Deriving the list from where each editor is actually mounted means the next
 * client cannot inherit that bug by being mounted at a different path.
 */
export function editorMountPaths(): string[] {
  const out = new Set<string>();
  for (const site of Object.values(EDITABLE_SITES)) {
    if (!site.adminUrl) continue;
    try {
      out.add(new URL(site.adminUrl).pathname.replace(/\/+$/, "") || "/");
    } catch {
      // A malformed adminUrl must not take the whole site's chrome down.
    }
  }
  return [...out];
}

/**
 * The id a field is submitted under.
 *
 * A dictionary field's key is the SAME in every language — "about.p1" exists
 * once in Arabic and once in French — so the key alone cannot identify a box.
 * Prefixing the language is what stops a French edit overwriting the Arabic
 * one, silently, in the same save.
 */
export function fieldId(f: { key: string; lang?: string }): string {
  return f.lang ? `${f.lang}:${f.key}` : f.key;
}

/** A page's identity: its own id where it has one, otherwise its file. */
export function pageId(p: { file: string; id?: string }): string {
  return p.id ?? p.file;
}

/** The fields that belong to one page, in the order the client reads them. */
export function fieldsFor(site: EditableSite, page: string): EditableField[] {
  return site.fields.filter((f) => (f.page ?? f.file) === page);
}

/**
 * The pages worth offering: the ones that actually have something to edit.
 *
 * A page listed with no fields is a tab the client clicks and lands on an
 * empty screen — which reads as a broken tool, not as work still to come. A
 * page earns its tab by having a field, so adding the fields is what adds the
 * tab and the two can never disagree.
 */
export function pagesWithFields(site: EditableSite): { file: string; label: string; id?: string }[] {
  return site.pages.filter((p) => fieldsFor(site, pageId(p)).length > 0);
}
