import type {
  ClientFaq, ClientSiteConfig, ClientStep, ClientValue, ClientAdvice,
} from "@/lib/clientSites";

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

/* ─────────────────── Rich-layout defaults (multi-page sites) ───────────────────
 * These power the professional multi-page layout for dental clients. Everything
 * here is universally true for a dental practice (a patient journey, hygiene
 * values, standard aftercare advice) or is illustrative stock imagery — NEVER a
 * client-specific claim (years, counts, prices) and never a service a given
 * clinic might not offer. Client-specific richness (highlights, solutions,
 * expertise blocks, stats) is written by the AI layer from that client's own
 * intake, not hard-coded here.
 */

const U = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

/** Generic, illustrative dental stock (Unsplash License). Used until a client
 *  supplies their own photos. Never captioned as a specific named person. */
export const DENTAL_IMAGES = {
  office: U("photo-1629909613654-28e377c37b09"),
  operatory: U("photo-1629909615184-74f495363b67"),
  implant: U("photo-1593022356769-11f762e25ed9"),
  operatingRoom: U("photo-1579154491915-611e891d3a5b"),
  imaging: U("photo-1588776814546-1ffcf47267a5"),
  hygiene: U("photo-1607613009820-a29f7bb81c04"),
  smile: U("photo-1595152772835-219674b2a8a6"),
};

/** Hero slider (2 clinic interiors that gently crossfade). */
export const DENTAL_HERO_IMAGES: string[] = [DENTAL_IMAGES.office, DENTAL_IMAGES.operatory];

/** Per-sub-page banner photos (crossfade sliders). */
export const DENTAL_PAGE_BANNERS = {
  cabinet: [DENTAL_IMAGES.operatory, DENTAL_IMAGES.imaging],
  expertise: [DENTAL_IMAGES.implant, DENTAL_IMAGES.operatingRoom],
  conseils: [DENTAL_IMAGES.hygiene, DENTAL_IMAGES.smile],
};

/** Illustrative images the AI-written highlights / expertise blocks draw from,
 *  in order. Kept separate so generation just picks by index. */
export const DENTAL_HIGHLIGHT_IMAGES: string[] = [DENTAL_IMAGES.implant, DENTAL_IMAGES.operatingRoom, DENTAL_IMAGES.operatory];
export const DENTAL_EXPERTISE_IMAGES: string[] = [DENTAL_IMAGES.imaging, DENTAL_IMAGES.implant];

/** Generic patient journey — true for any dental practice, no invented durations. */
export const DENTAL_PROCESS: Bilingual<ClientStep[]> = {
  en: [
    { title: "First conversation", body: "We understand what you need and any concerns you have — no obligation." },
    { title: "Check-up & treatment plan", body: "A full examination, then a clear proposal and a quote before any treatment starts." },
    { title: "Care & follow-up", body: "Treatment at your own pace, and we stay available after your appointment." },
  ],
  fr: [
    { title: "Premier échange", body: "On comprend votre besoin et vos éventuelles craintes — sans engagement." },
    { title: "Bilan & plan de traitement", body: "Un examen complet, puis une proposition claire et un devis avant tout soin." },
    { title: "Soin & suivi", body: "Une prise en charge à votre rythme, et une équipe disponible après le rendez-vous." },
  ],
};

/** Generic clinic commitments — universally true for a dental practice. */
export const DENTAL_VALUES: Bilingual<ClientValue[]> = {
  en: [
    { title: "Personalised consultations", body: "We take the time to understand your needs, your routine and any anxiety before proposing anything." },
    { title: "Gentle, modern care", body: "Proven techniques and a careful approach to reduce discomfort and recovery time." },
    { title: "A safe environment", body: "Strict sterilisation and hygiene protocols, with full traceability of every procedure." },
    { title: "Clear and honest", body: "A written treatment plan and a quote up front — no treatment starts without your agreement." },
  ],
  fr: [
    { title: "Consultations personnalisées", body: "On prend le temps de comprendre vos besoins, votre quotidien et vos éventuelles craintes avant toute proposition." },
    { title: "Des soins doux et modernes", body: "Des techniques éprouvées et une approche attentive pour réduire la gêne et le temps de récupération." },
    { title: "Un environnement sûr", body: "Stérilisation et hygiène rigoureusement contrôlées, avec une traçabilité complète des interventions." },
    { title: "Clair et transparent", body: "Un plan de traitement écrit et un devis à l'avance — aucun soin ne démarre sans votre accord." },
  ],
};

/** Universal dental hygiene / aftercare advice topics — true for any clinic. */
export const DENTAL_ADVICE: Bilingual<ClientAdvice[]> = {
  en: [
    { title: "Brushing the right way", body: "Method, frequency and the small habits that make a real difference every day." },
    { title: "Flossing & interdental brushes", body: "How to clean the spaces a toothbrush can't reach, and pick the right size." },
    { title: "After a tooth extraction", body: "Protecting the blood clot and supporting healing, step by step." },
    { title: "After an implant is placed", body: "The right reflexes in the first days: rinsing, food and habits for good healing." },
    { title: "The day of your procedure", body: "How to prepare: meals, medication and small precautions before your appointment." },
    { title: "When to get in touch", body: "The signs that mean you should call the practice after a procedure." },
  ],
  fr: [
    { title: "Bien se brosser les dents", body: "La méthode, la fréquence et les petits gestes qui font la différence au quotidien." },
    { title: "Fil dentaire & brossettes", body: "Comment nettoyer les espaces que la brosse n'atteint pas, et choisir la bonne taille." },
    { title: "Après une extraction dentaire", body: "Préserver le caillot sanguin et favoriser la cicatrisation, étape par étape." },
    { title: "Après la pose d'un implant", body: "Les bons réflexes les premiers jours : rinçage, alimentation et habitudes pour bien cicatriser." },
    { title: "Le jour de l'intervention", body: "Comment se préparer : repas, médicaments et petites précautions avant le rendez-vous." },
    { title: "Quand nous recontacter", body: "Les signes qui doivent vous amener à appeler le cabinet après une intervention." },
  ],
};

/** Short descriptive subtitle under the business name in the header. */
export function dentalTagline(city: string | undefined, lang: "en" | "fr"): string {
  const base = lang === "fr" ? "Cabinet dentaire" : "Dental practice";
  return city ? `${base} · ${city}` : base;
}

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
