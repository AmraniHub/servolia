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
  /** The `data-edit` key, e.g. "hero.title". */
  key: string;
  /** What the client sees above the box. Their words, not ours. */
  label: string;
  /** Which page file it lives in, relative to the site root. */
  file: string;
  /** A longer box for paragraphs. */
  multiline?: boolean;
  /** Refused above this length, so one field cannot become a whole page. */
  max?: number;
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
   *  green, so it is set per client too — a faint tint of their own colour. */
  surface: string;
  /** What the pages are called, for the page picker. */
  pages: { file: string; label: string }[];
  fields: EditableField[];
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
export const EDITABLE_SITES: Record<string, EditableSite> = {
  goodscochina: {
    ref: "goodscochina",
    businessName: "GoodsCoChina",
    repo: "AmraniHub/yiwugoodsco-com",
    branch: "main",
    siteRoot: "web",
    // The navy her own stylesheet leads with; the brand probe reads the same.
    accent: "#111C74",
    surface: "#F6F7FC", // that navy at a few per cent — hers, not our cream

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
    ],
  },
};

export function editableSite(ref: string | null | undefined): EditableSite | undefined {
  return EDITABLE_SITES[(ref ?? "").trim().toLowerCase()];
}

/** The fields that belong to one page, in the order the client reads them. */
export function fieldsFor(site: EditableSite, file: string): EditableField[] {
  return site.fields.filter((f) => f.file === file);
}
