import type { ClientFaq, ClientSiteConfig } from "@/lib/clientSites";

/**
 * Dental/implant clinic niche template — Servolia's beachhead (docs/PRINCIPLES.md P2).
 * Grounds all three generation touchpoints in real French dental-practice
 * knowledge instead of generic AI improvisation each time:
 *   1. configFromIntake()   — mechanical draft defaults (clientSites.ts)
 *   2. aiEnrichConfig()     — Claude's copywriting prompt (generateSiteCopy.ts)
 *   3. buildReceptionistPrompt() — the live chatbot's behavior (clientPrompt.ts)
 *
 * SAFETY: nothing here is ever a real price. Service names/descriptions/FAQs
 * are reference material for grounding tone and structure — actual prices
 * only ever come from a specific client's own intake answers. Keeping price
 * out of this template is deliberate, not an oversight.
 */

export function isDentalNiche(niche?: string | null): boolean {
  return /dental|dentist|dentaire|implant/i.test(niche ?? "");
}

interface Bilingual<T> { en: T; fr: T }

export const DENTAL_SERVICE_NAMES: Bilingual<string[]> = {
  en: ["Check-up & Cleaning", "Teeth Whitening", "Dental Implants", "Invisible Aligners", "Emergency Care", "Crowns & Bridges", "Root Canal Treatment", "Wisdom Tooth Extraction"],
  fr: ["Bilan et détartrage", "Blanchiment dentaire", "Implants dentaires", "Gouttières invisibles", "Urgences dentaires", "Couronnes et bridges", "Traitement de canal", "Extraction de dents de sagesse"],
};

export const DENTAL_WHY_US: Bilingual<string[]> = {
  en: [
    "Same-day emergency appointments",
    "Transparent pricing, quoted up front",
    "Online booking + reminders — no phone tag",
    "Gentle, anxiety-friendly approach",
  ],
  fr: [
    "Rendez-vous d'urgence le jour même",
    "Tarifs transparents, annoncés à l'avance",
    "Réservation en ligne + rappels — plus d'attente au téléphone",
    "Approche douce, pensée pour les patients anxieux",
  ],
};

export const DENTAL_FAQS: Bilingual<ClientFaq[]> = {
  en: [
    { q: "Do you take new patients?", a: "Yes — we're welcoming new patients. You can book your first visit online in under a minute." },
    { q: "Do you accept my mutuelle / insurance?", a: "Coverage depends on your plan and the treatment — our team confirms your exact reimbursement during your visit." },
    { q: "What if I have a dental emergency?", a: "Call us or message the assistant — we keep same-day slots open for pain, swelling, or trauma." },
    { q: "Do you offer payment plans?", a: "Yes, for treatments like implants and aligners we offer staged payment plans. Ask our assistant or the team for details." },
    { q: "What happens at my first visit?", a: "A full check-up and a conversation about your goals — no treatment starts without your OK on the plan and price." },
  ],
  fr: [
    { q: "Prenez-vous de nouveaux patients ?", a: "Oui — nous accueillons de nouveaux patients. Réservez votre première visite en ligne en moins d'une minute." },
    { q: "Acceptez-vous ma mutuelle ?", a: "La prise en charge dépend de votre contrat et du soin — notre équipe confirme le remboursement exact lors de votre visite." },
    { q: "Que faire en cas d'urgence dentaire ?", a: "Appelez-nous ou écrivez à l'assistant — nous gardons des créneaux le jour même pour la douleur, un gonflement ou un traumatisme." },
    { q: "Proposez-vous des facilités de paiement ?", a: "Oui, pour les implants et gouttières notamment, un paiement échelonné est possible. Demandez à l'assistant ou à l'équipe." },
    { q: "Comment se passe la première visite ?", a: "Un bilan complet et un échange sur vos objectifs — aucun soin ne démarre sans votre accord sur le plan et le tarif." },
  ],
};

export const DENTAL_AI_TONE: Bilingual<string> = {
  en: "warm, calm, reassuring",
  fr: "chaleureux, calme, rassurant",
};

export function dentalAiGreeting(businessName: string, lang: "en" | "fr"): string {
  return lang === "fr"
    ? `Bonjour 👋 Bienvenue chez ${businessName}. Êtes-vous un nouveau patient ou déjà suivi(e) chez nous ?`
    : `Hi 👋 Welcome to ${businessName}. Are you a new or returning patient?`;
}

/**
 * Appended to the Claude copywriting prompt (generateSiteCopy.ts) only when
 * niche is dental — real domain grounding instead of generic knowledge, with
 * an explicit guard against inventing prices.
 */
export function dentalCopyPlaybook(lang: "en" | "fr"): string {
  const names = DENTAL_SERVICE_NAMES[lang].join(", ");
  return `
DENTAL NICHE REFERENCE (ground your writing in this — it is NOT this client's data, never state any of it as their actual price or fact):
- Common French dental/implant clinic services patients recognize: ${names}.
- Common FAQ topics for this niche: new-patient acceptance, mutuelle/insurance coverage (always "depends on your plan, we confirm at your visit" — never claim a specific insurer), emergency/urgence handling, payment plans for implants/aligners, what the first visit involves.
- Tone that works well for this niche: ${DENTAL_AI_TONE[lang]}.
- Never invent a price for implants, aligners, whitening, or any treatment — omit the price key entirely unless the intake states one.`;
}

/**
 * Appended to buildReceptionistPrompt() (clientPrompt.ts) only when niche is
 * dental — real-time behavioral guardrails for the live chatbot.
 */
export const DENTAL_RECEPTIONIST_GUIDANCE = `
# Dental-specific guidance
- Pain, swelling, bleeding, trauma, or "urgence"/"emergency": treat as urgent. Show empathy, prioritize the soonest slot, and if it sounds severe (heavy bleeding, facial swelling, trauma), tell them to call now rather than wait for a chat reply.
- Insurance/mutuelle/tiers-payant questions: coverage depends on their specific plan and the treatment — say the team confirms exact reimbursement at the visit. Never state that a specific insurer covers something.
- Never diagnose or tell someone what treatment they need — only a dentist can determine that after examination. Redirect to booking a consultation.
- For implants, aligners, whitening, or other elective work: be encouraging, but always route to a consultation for a personalized quote — never invent or estimate a price yourself.`;

/** A fully fleshed-out reference config — copy/adapt when hand-building a real dental client's site fast. */
export const DENTAL_TEMPLATE_EXAMPLE: ClientSiteConfig = {
  slug: "template-dental",
  businessName: "Your Dental Clinic",
  niche: "dental",
  language: "fr",
  accent: "#0E7C86",
  heroHeadline: "Une dentisterie plus sereine.",
  heroSub: "Réservez en ligne à tout moment — notre assistant répond à vos questions et prend votre rendez-vous en quelques secondes.",
  about: "Notre cabinet propose des soins modernes et sans stress, du contrôle de routine aux implants. Notre assistant en ligne vous répond à tout moment, sans attente téléphonique.",
  services: DENTAL_SERVICE_NAMES.fr.slice(0, 6).map((name) => ({ name })),
  whyUs: DENTAL_WHY_US.fr,
  faqs: DENTAL_FAQS.fr,
  aiTone: DENTAL_AI_TONE.fr,
  aiGreeting: dentalAiGreeting("Your Dental Clinic", "fr"),
  status: "draft",
};
