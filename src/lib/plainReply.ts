/**
 * A receptionist reply as the patient will read it: plain text.
 *
 * Both chat surfaces (public/assistant.js on a practice's own site, and
 * ChatWidget on a generated site) show replies with textContent -- safe, but
 * Markdown arrives raw. Found on walk S2 (2026-09-30): a patient read
 * "votre **nom et numéro de téléphone**" with the asterisks. The prompt now
 * asks for plain text; this is the guarantee when the model writes it anyway.
 *
 * Only PAIRED markers are removed, so a visitor's jean_dupont@... or a lone
 * "*" survives, and line breaks are kept.
 */
export function plainReply(s: string): string {
  return s
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")          // **bold**
    .replace(/__([^_\n]+?)__/g, "$1")              // __bold__
    .replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?]|$)/gm, "$1$2") // *italic*
    .replace(/^#{1,6}\s+/gm, "")                   // # headings
    .replace(/^\s*[*-]\s+/gm, "• ")                // * or - bullets
    .replace(/`([^`\n]+)`/g, "$1");                // `code`
}
