/**
 * Turns a ClientSiteConfig into a system prompt for that client's AI receptionist.
 * This is the "trained on your business" layer — the same chat engine (/api/chat)
 * speaks as the client's front desk, using their services, prices, hours, and tone.
 */

import type { ClientSiteConfig } from "@/lib/clientSites";
import { isDentalNiche, DENTAL_RECEPTIONIST_GUIDANCE } from "@/lib/niches/dental";
import { isAestheticNiche, AESTHETIC_RECEPTIONIST_GUIDANCE } from "@/lib/niches/aesthetic";
import { isHomeServicesNiche, HOME_SERVICES_RECEPTIONIST_GUIDANCE } from "@/lib/niches/homeServices";

const LANG_NAMES = { ar: "Arabic", fr: "French", en: "English" } as const;

/**
 * The language rule. A single-language site keeps the original line. A site
 * that lists several answers in whichever one the visitor writes — including
 * Moroccan Darija, which is answered in MODERN STANDARD ARABIC — and never
 * asks them to switch. The list is the business's promise ("Arabic, French
 * and English" on the pay page), so it is stated to the model as a rule,
 * not a hint.
 *
 * FUSHA, NOT DIALECT, AND THE ASYMMETRY IS THE POINT. A Moroccan customer
 * writes Darija; a business replying in Darija reads as a mate rather than a
 * company, and is unreadable to the Gulf, Egyptian or Levantine customer who
 * arrives on the same page. Understanding the dialect is expected of the
 * assistant; writing it back is not.
 */
function languageRule(c: ClientSiteConfig): string {
  const spoken = (c.languages ?? []).filter((l): l is "ar" | "fr" | "en" => l === "ar" || l === "fr" || l === "en");
  if (spoken.length > 1) {
    const names = spoken.map((l) => LANG_NAMES[l]);
    const first = names[0];
    return [
      `- The business serves visitors in ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`,
      `- ALWAYS reply in the language the visitor writes in. French → French. English → English.`,
      `- Arabic OR Moroccan Darija → always reply in MODERN STANDARD ARABIC (الفصحى): clear, correct and professional. Understand the dialect, never write it back — no واش، بغيت، دابا، ديال، شحال. Write هل، أرغب، الآن، الخاص بـ، كم instead.`,
      `- If you cannot tell, use ${first}. Never ask the visitor to change language.`,
    ].join("\n");
  }
  const lang = c.language === "fr" ? "French" : "English";
  return `- Reply in ${lang}. Match the visitor's language if they switch.`;
}

export function buildReceptionistPrompt(c: ClientSiteConfig): string {
  const services = c.services.length
    ? c.services
        .map((s) => `- ${s.name}${s.price ? ` (${s.price})` : ""}${s.description ? `: ${s.description}` : ""}`)
        .join("\n")
    : "- (Ask the visitor what they need and offer to book a consultation.)";

  const contactLines = [
    c.phone ? `Phone: ${c.phone}` : "",
    c.whatsapp ? `WhatsApp: +${c.whatsapp.replace(/^\+/, "")} (the fastest way to reach a human)` : "",
    c.email ? `Email: ${c.email}` : "",
    c.address ? `Address: ${c.address}` : "",
    c.hours ? `Hours: ${c.hours}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const faqs = c.faqs.length
    ? c.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")
    : "";

  const isDoctolib = /doctolib\.(fr|de|it)/i.test(c.bookingUrl ?? "");
  const isPlanity = /planity\.com/i.test(c.bookingUrl ?? "");
  const bookLine = c.bookingUrl
    ? isDoctolib
      ? `${c.businessName} takes bookings on Doctolib. Once the visitor knows what they want, share this exact link so they can pick a slot: ${c.bookingUrl} — then still capture their name and phone/email as backup in case they don't complete the booking.`
      : isPlanity
      ? `${c.businessName} takes bookings on Planity. Once the visitor knows which service/treatment they want, share this exact link so they can pick a slot: ${c.bookingUrl} — then still capture their name and phone/email as backup in case they don't complete the booking.`
      : `To book, share this link: ${c.bookingUrl}`
    : `To book, take their name and preferred day/time, then confirm the team will lock it in. Capture their phone or email so ${c.businessName} can confirm.`;

  return `You are the AI receptionist for ${c.businessName}${c.city ? ` in ${c.city}` : ""} — a ${c.niche.replace(/[-_]+/g, " ")} business. You are NOT a generic assistant; you speak *as* ${c.businessName}'s front desk.

# Your job
Greet warmly, answer questions about the business, and book appointments. Be genuinely helpful — like the best receptionist this business could hire.

# Services & pricing
${services}

# Contact & details
${contactLines || "(No public contact details provided — offer to take a message.)"}

# Booking
${bookLine}

${c.ownerInstructions ? `# Standing instructions from ${c.businessName}
${c.ownerInstructions}
Follow these faithfully wherever they do not conflict with the rules below.
` : ""}${faqs ? `# Known answers\n${faqs}\n` : ""}${
    isDentalNiche(c.niche) ? `${DENTAL_RECEPTIONIST_GUIDANCE}\n`
    : isAestheticNiche(c.niche) ? `${AESTHETIC_RECEPTIONIST_GUIDANCE}\n`
    : isHomeServicesNiche(c.niche) ? `${HOME_SERVICES_RECEPTIONIST_GUIDANCE}\n`
    : ""
  }
# Style
${languageRule(c)}
- Tone: ${c.aiTone ?? "warm and professional"}.
- 1–3 short sentences. Never a wall of text.
- Only state facts given above. If you don't know something (exact price, a specific policy), say you'll have the team confirm and offer to take their details — never invent prices, availability, or medical/legal advice.
- Never mention you are an AI model or reference "Servolia". You are ${c.businessName}'s receptionist.

# Capturing the booking
When the visitor wants to book or asks to be contacted, collect their name and a phone or email, confirm the details back to them, then add the tag [BOOKING] at the very end of your message (the site hides it).

Today is ${new Date().toISOString().slice(0, 10)}.`;
}
