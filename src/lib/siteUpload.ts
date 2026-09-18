/**
 * A CLIENT PUTTING A FILE ON THEIR OWN LIVE WEBSITE.
 *
 * The page editor changes words. This changes files — a new product photo, a
 * replacement logo, an updated price list. It is the thing that makes the
 * hosting feel like hosting rather than like a bill: the place where their
 * site is actually made and kept online.
 *
 * WHAT IS ACCEPTED, AND WHY THE LIST IS SHORT.
 *
 * Images, fonts and PDFs. Not HTML, not JavaScript, not SVG.
 *
 * HTML and JavaScript are obvious: a client who can upload either can take
 * their own site down on a Friday night, and the person they will call is us.
 *
 * SVG is the one that looks safe and is not. It is markup, browsers execute
 * <script> inside it, and it is served from the client's own origin — so an
 * SVG uploaded through this form would run with the same privileges as their
 * site. That is a cross-site scripting hole with a file picker in front of it.
 * A client who needs a logo can upload a PNG.
 *
 * WHY THE SIZE CAP IS 3.5 MB AND NOT SOMETHING ROUNDER. A serverless request
 * body on this host is capped around 4.5 MB, and a multipart envelope costs a
 * little over the file itself. A limit we enforce with a clear message beats
 * the platform refusing the request with one nobody can read.
 */

export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

/** extension → the Content-Type the host should serve it as. */
const ALLOWED: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  ico: "image/x-icon",
  pdf: "application/pdf",
  woff: "font/woff",
  woff2: "font/woff2",
};

/** Deliberately named, so the refusal can say why rather than just "no". */
const REFUSED: Record<string, string> = {
  svg: "SVG files can carry code, so they are the one image type we cannot accept. A PNG or JPG of the same picture is fine.",
  html: "Pages are edited through the editor, not uploaded — that way a missing tag cannot take your site down.",
  htm: "Pages are edited through the editor, not uploaded — that way a missing tag cannot take your site down.",
  js: "Script files change how your site behaves, so those stay with us.",
  mjs: "Script files change how your site behaves, so those stay with us.",
  css: "Style files change your design, so those stay with us — tell us what you want changed.",
  php: "Your site is static, so PHP files would never run. Nothing to upload here.",
  exe: "That is a program, not part of a website.",
  zip: "Send us the zip by email and we will unpack it for you.",
};

export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const i = base.lastIndexOf(".");
  return i < 0 ? "" : base.slice(i + 1).toLowerCase();
}

export function contentTypeFor(name: string): string | null {
  return ALLOWED[extensionOf(name)] ?? null;
}

/** The human list, for the form's own help text. */
export function acceptedList(): string {
  return "PNG, JPG, WEBP, GIF, PDF";
}

/** The `accept` attribute, so the file picker shows the right files first. */
export function acceptAttribute(): string {
  return Object.keys(ALLOWED).map((e) => `.${e}`).join(",");
}

/**
 * Why this upload cannot be accepted, or null.
 *
 * Every refusal explains itself. "Unsupported file type" tells a client
 * nothing they can act on; "SVG files can carry code, a PNG is fine" tells
 * them exactly what to do next.
 */
export function uploadProblem(name: string, bytes: number): string | null {
  const base = (name.split(/[\\/]/).pop() ?? "").trim();
  if (!base) return "That file has no name.";
  if (base.startsWith(".")) return "Hidden files are not part of a website.";
  if (base.length > 80) return "That file name is too long — rename it to something shorter.";
  if (!/^[\w][\w.@ -]*$/.test(base)) {
    return "Use letters, numbers, spaces, dots and dashes in the file name — nothing else.";
  }
  if (bytes <= 0) return "That file is empty.";
  if (bytes > MAX_UPLOAD_BYTES) {
    return `That file is ${(bytes / 1024 / 1024).toFixed(1)} MB. The limit is 3.5 MB — a smaller photo loads faster for your visitors anyway.`;
  }
  const ext = extensionOf(base);
  if (REFUSED[ext]) return REFUSED[ext];
  if (!ALLOWED[ext]) return `We cannot accept a .${ext || "?"} file here. Accepted: ${acceptedList()}.`;
  return null;
}

/**
 * Where a file is allowed to land, relative to the site root.
 *
 * Returns null for anything that tries to leave it. `..` is the obvious one;
 * a leading slash and a backslash are the two that get missed, because on the
 * way to a git tree they look like ordinary characters and arrive as a path
 * outside the folder the client is allowed to touch.
 */
export function safeTarget(folder: string, name: string): string | null {
  const base = (name.split(/[\\/]/).pop() ?? "").trim();
  if (!base || base.startsWith(".")) return null;
  const dir = folder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (dir.split("/").some((p) => p === ".." || p === "." || p === "")) {
    return dir === "" ? base : null;
  }
  return `${dir}/${base}`;
}
