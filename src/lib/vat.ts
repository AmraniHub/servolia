/**
 * B2B VAT — REVERSE CHARGE (autoliquidation).
 *
 * Servolia LLC (Wyoming, USA) sells to businesses, mostly French. When the
 * buyer gives an EU VAT number at checkout (tax_id_collection, see
 * src/lib/stripeCustomer.ts businessTaxFields) and their billing address is
 * in the EU, no VAT is charged and the BUYER accounts for it. Their documents
 * must say so. Stripe's invoice carries it through the footer the owner sets
 * in the dashboard (roadmap: Settings > Billing > Invoices); our own receipt
 * emails carry it here.
 *
 * Nothing here charges, computes or removes VAT: no automatic_tax, no
 * Managed Payments. A buyer with no VAT number is not changed in any way.
 */

/** EU member states (ISO 3166-1 alpha-2; Greece is "GR" in addresses). */
const EU = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

/* Which law is cited depends on the BUYER'S country (review, 2026-10-02):
   a French business is pointed at its own code (CGI art. 283-2); any other EU
   business at the Directive (art. 196), which every member state transposes.
   Each in the receipt's language. */
export const REVERSE_CHARGE = {
  directive: {
    en: "Reverse charge — VAT to be accounted for by the customer (Article 196, Directive 2006/112/EC).",
    fr: "Autoliquidation — TVA due par le preneur (article 196 de la directive 2006/112/CE).",
  },
  cgi: {
    en: "Reverse charge — VAT due by the customer (Article 283-2 of the French General Tax Code, CGI).",
    fr: "Autoliquidation — TVA due par le preneur (article 283-2 du CGI).",
  },
} as const;

/** The mention for this buyer's country and this receipt's language. */
export function reverseChargeText(country: string | null | undefined, lang: "en" | "fr"): string {
  return REVERSE_CHARGE[(country ?? "").toUpperCase() === "FR" ? "cgi" : "directive"][lang];
}

type TaxId = { type?: string | null; value?: string | null };
type Details = {
  tax_ids?: TaxId[] | null;
  address?: { country?: string | null } | null;
} | null | undefined;

/** The buyer's EU VAT number, when reverse charge applies; else null.
 *  Needs an `eu_vat` id AND an EU billing country (never the US). */
export function reverseChargeVat(details: Details): string | null {
  const country = (details?.address?.country ?? "").toUpperCase();
  if (!EU.has(country)) return null;
  const vat = (details?.tax_ids ?? []).find((t) => t?.type === "eu_vat" && typeof t.value === "string" && t.value.trim());
  return vat ? String(vat.value).trim().toUpperCase() : null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The paragraph our receipt emails add for a reverse-charge buyer. */
export function reverseChargeHtml(vat: string, lang: "en" | "fr", country: string | null | undefined): string {
  const label = lang === "fr" ? "N° de TVA du client" : "Customer VAT number";
  return `<p style="margin:12px 0 0;font-size:11px;line-height:1.6;color:#71717A;">${esc(reverseChargeText(country, lang))} ${label} : ${esc(vat)}.</p>`;
}

/**
 * A receipt email, with the reverse-charge mention when it applies, and
 * unchanged otherwise. Inserted at the end of the footer (every template
 * shares src/lib/email.ts's wrapper), or before </body> if that changes.
 */
export function withReverseCharge<T extends { subject: string; html: string }>(tpl: T, details: Details, lang: "en" | "fr"): T {
  const vat = reverseChargeVat(details);
  if (!vat) return tpl;
  const p = reverseChargeHtml(vat, lang, details?.address?.country);
  const anchor = "Servolia LLC &middot; Wyoming, USA\n      </p>";
  const html = tpl.html.includes(anchor)
    ? tpl.html.replace(anchor, `${anchor}\n      ${p}`)
    : tpl.html.includes("</body>") ? tpl.html.replace("</body>", `${p}</body>`) : `${tpl.html}${p}`;
  return { ...tpl, html };
}

const VAT_MARKER = "servolia-vat:";

/** The buyer's VAT number on a row's notes (one line, replaced on change);
 *  the notes unchanged when reverse charge does not apply. */
export function writeVatNote(notes: string | null | undefined, details: Details): string | null {
  const vat = reverseChargeVat(details);
  if (!vat) return notes ?? null;
  const country = (details?.address?.country ?? "").toUpperCase();
  const line = `${VAT_MARKER} ${vat} | country: ${country}`;
  const kept = (notes ?? "").split("\n").filter((l) => l.trim() !== "" && !l.startsWith(VAT_MARKER));
  return [...kept, line].join("\n");
}

export function readVatNote(notes: string | null | undefined): string | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(VAT_MARKER));
  return line ? line.slice(VAT_MARKER.length).split("|")[0].trim() || null : null;
}
