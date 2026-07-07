/**
 * WhatsApp click-to-chat helpers.
 *
 * BUSINESS_WHATSAPP is the number CLIENTS message you on (founder/business line).
 * Set it once here, or override per-environment with NEXT_PUBLIC_WHATSAPP_NUMBER.
 * Format: full international number, digits only — e.g. "212600112233" (Morocco) or "33612345678" (France).
 */

const DEFAULT_BUSINESS_WHATSAPP = ""; // ← set your business WhatsApp number here, digits only (e.g. "2126...")

export const BUSINESS_WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || DEFAULT_BUSINESS_WHATSAPP).replace(/[^\d]/g, "");

function digits(n: string): string {
  return n.replace(/[^\d]/g, "");
}

/** wa.me link to message a given client's phone number. Returns null if the number is missing/invalid. */
export function waLink(phone?: string | null, text?: string): string | null {
  if (!phone) return null;
  const d = digits(phone);
  if (d.length < 8) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** wa.me link clients use to message the business. Returns null if BUSINESS_WHATSAPP isn't configured. */
export function businessWaLink(text?: string): string | null {
  if (!BUSINESS_WHATSAPP || BUSINESS_WHATSAPP.length < 8) return null;
  return `https://wa.me/${BUSINESS_WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
