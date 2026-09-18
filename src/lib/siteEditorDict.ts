/**
 * EDITING A SITE WHOSE WORDS LIVE IN A DICTIONARY, NOT IN ITS HTML.
 *
 * Excellence Agency's site is built the other way round from GoodsCoChina's.
 * Every element carries `data-i18n="key"` and js/i18n.js replaces its text on
 * load from an `ar` and an `fr` block. The HTML is only the first paint.
 *
 * That matters because the obvious thing is silently useless: editing the text
 * in their index.html changes what the file says and nothing a visitor ever
 * sees, because the script overwrites it a moment later. The dictionary is the
 * page. So for a site like theirs, the dictionary is what the editor edits.
 *
 * It is also better for them. One key has an Arabic value and a French one, so
 * the client gets a box per language and can keep both in step themselves —
 * which is exactly what GoodsCoChina's English-keyed dictionary cannot offer.
 *
 * WHY A SCANNER AND NOT A REGEX FOR THE BLOCKS. A `}` inside a translated
 * sentence would end the block early for a brace-counting regex, and the write
 * would land in the wrong place. The scanner below tracks whether it is inside
 * a string literal, so punctuation in Arabic prose cannot move a boundary.
 *
 * WHY THE FILE IS NEVER EXECUTED. It is fetched from a client repository over
 * the network. Reading it must not mean running it.
 */

export type DictResult =
  | { ok: true; value: string }
  | { ok: false; reason: "no-language" | "not-found" | "not-a-plain-string" };

/** The body of `<lang>: { … }`, as [start, end) offsets into the source. */
function languageBlock(source: string, lang: string): [number, number] | null {
  const head = new RegExp(`(^|[\\s{,])${lang}\\s*:\\s*\\{`, "m").exec(source);
  if (!head) return null;
  const open = source.indexOf("{", head.index + head[0].length - 1);
  if (open < 0) return null;

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return [open + 1, i];
    }
  }
  return null;
}

/** `"key": "value"` inside one language block — the literal, with its quotes. */
function entry(source: string, lang: string, key: string): { at: number; end: number; raw: string } | null {
  const block = languageBlock(source, lang);
  if (!block) return null;
  const [from, to] = block;
  const body = source.slice(from, to);
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /* The value must be ONE double-quoted literal. A template literal or two
     concatenated strings is a shape this cannot rewrite safely, and those are
     refused rather than guessed at. */
  const m = new RegExp(`(["'])${k}\\1\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(body);
  if (!m) return null;
  const at = from + m.index + m[0].indexOf(m[2]);
  return { at, end: at + m[2].length, raw: m[2] };
}

export function readDictValue(source: string, lang: string, key: string): DictResult {
  if (!languageBlock(source, lang)) return { ok: false, reason: "no-language" };
  const e = entry(source, lang, key);
  if (!e) return { ok: false, reason: "not-found" };
  try {
    const parsed = JSON.parse(e.raw) as unknown;
    if (typeof parsed !== "string") return { ok: false, reason: "not-a-plain-string" };
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, reason: "not-a-plain-string" };
  }
}

/**
 * Replace one value, leaving every byte of the rest of the file alone.
 *
 * JSON.stringify writes the literal: it escapes quotes, backslashes and
 * control characters correctly and leaves Arabic and accented French as they
 * are. Hand-rolled escaping is how a client's apostrophe ends up breaking a
 * script tag, and there is no reason to hand-roll it here.
 */
export function writeDictValue(
  source: string,
  lang: string,
  key: string,
  value: string,
): { source: string; changed: boolean } {
  const current = readDictValue(source, lang, key);
  if (!current.ok) return { source, changed: false };
  if (current.value === value.trim()) return { source, changed: false };
  const e = entry(source, lang, key)!;
  return { source: source.slice(0, e.at) + JSON.stringify(value.trim()) + source.slice(e.end), changed: true };
}

/** Every key a language block defines — for checking a config against reality. */
export function dictKeys(source: string, lang: string): string[] {
  const block = languageBlock(source, lang);
  if (!block) return [];
  const body = source.slice(block[0], block[1]);
  return [...body.matchAll(/(["'])((?:[^"'\\]|\\.)+)\1\s*:\s*"/g)].map((m) => m[2]);
}
