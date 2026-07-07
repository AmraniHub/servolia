/**
 * Turns a ClientSiteConfig into a system prompt for that client's AI receptionist.
 * This is the "trained on your business" layer — the same chat engine (/api/chat)
 * speaks as the client's front desk, using their services, prices, hours, and tone.
 */

import type { ClientSiteConfig } from "@/lib/clientSites";

export function buildReceptionistPrompt(c: ClientSiteConfig): string {
  const lang = c.language === "fr" ? "French" : "English";
  const services = c.services.length
    ? c.services
        .map((s) => `- ${s.name}${s.price ? ` (${s.price})` : ""}${s.description ? `: ${s.description}` : ""}`)
        .join("\n")
    : "- (Ask the visitor what they need and offer to book a consultation.)";

  const contactLines = [
    c.phone ? `Phone: ${c.phone}` : "",
    c.email ? `Email: ${c.email}` : "",
    c.address ? `Address: ${c.address}` : "",
    c.hours ? `Hours: ${c.hours}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const faqs = c.faqs.length
    ? c.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")
    : "";

  const bookLine = c.bookingUrl
    ? `To book, share this link: ${c.bookingUrl}`
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

${faqs ? `# Known answers\n${faqs}\n` : ""}
# Style
- Reply in ${lang}. Match the visitor's language if they switch.
- Tone: ${c.aiTone ?? "warm and professional"}.
- 1–3 short sentences. Never a wall of text.
- Only state facts given above. If you don't know something (exact price, a specific policy), say you'll have the team confirm and offer to take their details — never invent prices, availability, or medical/legal advice.
- Never mention you are an AI model or reference "Servolia". You are ${c.businessName}'s receptionist.

# Capturing the booking
When the visitor wants to book or asks to be contacted, collect their name and a phone or email, confirm the details back to them, then add the tag [BOOKING] at the very end of your message (the site hides it).

Today is ${new Date().toISOString().slice(0, 10)}.`;
}
