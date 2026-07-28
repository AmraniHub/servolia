import type {
  ClientFaq, ClientSiteConfig, ClientStep, ClientValue, ClientAdvice,
} from "@/lib/clientSites";

/**
 * Home services niche template (HVAC, plumbing, electrical, roofing, general
 * contracting...) — has its own marketing page (/niches/home-services) but
 * fell back to fully generic filler at generation time until this shipped.
 * Grounds all three generation touchpoints in real domain knowledge instead
 * of generic AI improvisation each time:
 *   1. configFromIntake()   — mechanical draft defaults (clientSites.ts)
 *   2. aiEnrichConfig()     — Claude's copywriting prompt (generateSiteCopy.ts)
 *   3. buildReceptionistPrompt() — the live chatbot's behavior (clientPrompt.ts)
 *
 * SAFETY: nothing here is ever a real price. Service names/descriptions/FAQs
 * are reference material for grounding tone and structure — actual prices
 * only ever come from a specific client's own intake answers.
 */

export function isHomeServicesNiche(niche?: string | null): boolean {
  return /home-?service|hvac|hpe|plumb|plomb|electric|electrici|roof|toiture|contractor|artisan|chauffag/i.test(niche ?? "");
}

interface Bilingual<T> { en: T; fr: T }

export const HOME_SERVICES_SERVICE_NAMES: Bilingual<string[]> = {
  en: ["Emergency Repairs", "Installation & Replacement", "Maintenance Plans", "Free On-Site Quote", "Inspection & Diagnostics", "Renovation Work"],
  fr: ["Dépannage d'urgence", "Installation et remplacement", "Contrat d'entretien", "Devis gratuit sur place", "Diagnostic et inspection", "Travaux de rénovation"],
};

export const HOME_SERVICES_WHY_US: Bilingual<string[]> = {
  en: [
    "Same-day emergency callouts",
    "Upfront, transparent quotes — no surprise fees",
    "Online booking + reminders — no phone tag",
    "Licensed, insured, and background-checked technicians",
  ],
  fr: [
    "Interventions d'urgence le jour même",
    "Devis transparents à l'avance — sans frais cachés",
    "Réservation en ligne + rappels — plus d'attente au téléphone",
    "Techniciens agréés, assurés et vérifiés",
  ],
};

export const HOME_SERVICES_FAQS: Bilingual<ClientFaq[]> = {
  en: [
    { q: "Do you offer emergency callouts?", a: "Yes — we keep same-day slots open for urgent issues. Message the assistant or call, and we'll prioritise based on how urgent it is." },
    { q: "How much will the job cost?", a: "It depends on the job — our team gives you a clear quote after seeing the issue (in person or via photos), never a guess over chat." },
    { q: "Are you licensed and insured?", a: "Yes — our technicians are licensed and fully insured for the work we do." },
    { q: "Do you offer maintenance plans?", a: "Yes, for recurring upkeep we offer maintenance plans — ask the assistant or the team for details." },
    { q: "What areas do you cover?", a: "Our team can confirm whether your address is in our service area — just share your location." },
  ],
  fr: [
    { q: "Intervenez-vous en urgence ?", a: "Oui — nous gardons des créneaux le jour même pour les urgences. Écrivez à l'assistant ou appelez, nous priorisons selon l'urgence." },
    { q: "Combien coûtera l'intervention ?", a: "Cela dépend du chantier — notre équipe vous donne un devis clair après avoir vu le problème (sur place ou par photos), jamais une estimation à l'aveugle par chat." },
    { q: "Êtes-vous agréés et assurés ?", a: "Oui — nos techniciens sont agréés et pleinement assurés pour les interventions réalisées." },
    { q: "Proposez-vous des contrats d'entretien ?", a: "Oui, pour l'entretien récurrent nous proposons des contrats dédiés — demandez à l'assistant ou à l'équipe." },
    { q: "Quelles zones couvrez-vous ?", a: "Notre équipe peut confirmer si votre adresse est dans notre zone d'intervention — partagez simplement votre localisation." },
  ],
};

export const HOME_SERVICES_AI_TONE: Bilingual<string> = {
  en: "direct, reliable, no-nonsense",
  fr: "direct, fiable, sans détour",
};

/* ─────────────────── Rich-layout defaults (multi-page sites) ─────────────────── */

const U = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

/** Generic, illustrative home-services stock (Unsplash License). Used until a
 *  client supplies their own photos. Never captioned as a specific named person. */
export const HOME_SERVICES_IMAGES = {
  vanExterior: U("photo-1581092160607-ee22621dd758"),
  technician: U("photo-1621905251189-08b45d6a269e"),
  toolwork: U("photo-1581092918056-0c4c3acd3789"),
  hvacUnit: U("photo-1621905252472-e8de7d8b9c66"),
  homeExterior: U("photo-1568605114967-8130f3a36994"),
  inspection: U("photo-1504328345606-18bbc8c9d7d1"),
};

/** Hero slider (2 crossfading photos). */
export const HOME_SERVICES_HERO_IMAGES: string[] = [HOME_SERVICES_IMAGES.technician, HOME_SERVICES_IMAGES.vanExterior];

/** Per-sub-page banner photos (crossfade sliders). */
export const HOME_SERVICES_PAGE_BANNERS = {
  cabinet: [HOME_SERVICES_IMAGES.vanExterior, HOME_SERVICES_IMAGES.toolwork],
  expertise: [HOME_SERVICES_IMAGES.hvacUnit, HOME_SERVICES_IMAGES.inspection],
  conseils: [HOME_SERVICES_IMAGES.homeExterior, HOME_SERVICES_IMAGES.technician],
};

/** Illustrative images the AI-written highlights / expertise blocks draw from,
 *  in order. Kept separate so generation just picks by index. */
export const HOME_SERVICES_HIGHLIGHT_IMAGES: string[] = [HOME_SERVICES_IMAGES.hvacUnit, HOME_SERVICES_IMAGES.toolwork, HOME_SERVICES_IMAGES.technician];
export const HOME_SERVICES_EXPERTISE_IMAGES: string[] = [HOME_SERVICES_IMAGES.inspection, HOME_SERVICES_IMAGES.hvacUnit];

/** Generic job journey — true for any home-services business, no invented durations. */
export const HOME_SERVICES_PROCESS: Bilingual<ClientStep[]> = {
  en: [
    { title: "Tell us the issue", body: "Describe the problem (or send photos) — no obligation, and we flag anything urgent immediately." },
    { title: "Quote & scheduling", body: "A clear, upfront quote and the soonest available slot — no surprise fees on the day." },
    { title: "Job & follow-up", body: "The work is done right the first time, and we stay reachable if anything comes up after." },
  ],
  fr: [
    { title: "Décrivez le problème", body: "Décrivez le souci (ou envoyez des photos) — sans engagement, et on signale immédiatement toute urgence." },
    { title: "Devis & planification", body: "Un devis clair et transparent, et le créneau le plus proche disponible — sans frais surprise le jour J." },
    { title: "Intervention & suivi", body: "Le travail est bien fait du premier coup, et nous restons joignables en cas de besoin après." },
  ],
};

/** Generic commitments — universally true for a home-services business. */
export const HOME_SERVICES_VALUES: Bilingual<ClientValue[]> = {
  en: [
    { title: "Upfront, honest quotes", body: "A clear price before any work starts — no surprise call-out or parts fees." },
    { title: "Licensed & insured", body: "Every technician is licensed for the work they do and fully insured on every job." },
    { title: "Reliable scheduling", body: "We show up in the window we quote, and we message if anything changes." },
    { title: "Emergency-ready", body: "Same-day slots kept open for urgent issues — a leak or an outage doesn't wait for next week." },
  ],
  fr: [
    { title: "Devis clairs et honnêtes", body: "Un prix transparent avant toute intervention — sans frais de déplacement ou de pièces surprise." },
    { title: "Agréés et assurés", body: "Chaque technicien est agréé pour son domaine et pleinement assuré sur chaque chantier." },
    { title: "Ponctualité fiable", body: "Nous respectons le créneau annoncé, et nous préveons en cas de changement." },
    { title: "Prêts pour l'urgence", body: "Des créneaux le jour même réservés aux urgences — une fuite ou une panne n'attend pas la semaine prochaine." },
  ],
};

/** Universal home-maintenance advice topics — true for any home-services business. */
export const HOME_SERVICES_ADVICE: Bilingual<ClientAdvice[]> = {
  en: [
    { title: "Signs you need a repair, not a replacement", body: "What to check before assuming the worst — and when it's genuinely time to replace." },
    { title: "Simple seasonal maintenance", body: "The small checks that prevent most emergency callouts." },
    { title: "What to do while you wait for us", body: "Safe first steps if you have an active leak, outage, or hazard." },
    { title: "Getting the most accurate quote", body: "What photos or details help our team quote your job precisely, faster." },
    { title: "Understanding your warranty", body: "What's typically covered after a repair or installation, and for how long." },
    { title: "When to call immediately", body: "The signs of a real emergency that shouldn't wait for a scheduled visit." },
  ],
  fr: [
    { title: "Réparer ou remplacer : les signes à connaître", body: "Ce qu'il faut vérifier avant de conclure au pire — et quand un remplacement s'impose vraiment." },
    { title: "Entretien saisonnier simple", body: "Les petites vérifications qui évitent la plupart des interventions d'urgence." },
    { title: "Que faire en attendant notre arrivée", body: "Les premiers réflexes sûrs en cas de fuite active, de panne ou de danger." },
    { title: "Obtenir un devis précis", body: "Les photos et informations qui aident notre équipe à chiffrer votre chantier plus vite." },
    { title: "Comprendre votre garantie", body: "Ce qui est généralement couvert après une réparation ou une installation, et pour combien de temps." },
    { title: "Quand appeler immédiatement", body: "Les signes d'une véritable urgence qui ne doit pas attendre un rendez-vous planifié." },
  ],
};

/** Urgent-callout strip under the header — same-day emergency work is the
 *  core of this niche's economics (a missed urgent call = a competitor's job). */
export const HOME_SERVICES_EMERGENCY_NOTE: Bilingual<string> = {
  en: "Emergency? Same-day slots are kept for leaks, outages and urgent repairs.",
  fr: "Une urgence ? Des créneaux le jour même sont réservés aux fuites, pannes et dépannages urgents.",
};

/** "Infos pratiques" defaults — generic-true for any home-services business;
 *  softened wherever a claim could vary by company. Service area and travel
 *  fees are the client's to specify — never invented here. */
export const HOME_SERVICES_PRACTICAL_INFO: Bilingual<{ title: string; body: string }[]> = {
  en: [
    { title: "Quotes & pricing", body: "A written quote before any work starts — confirmed after seeing the job, in person or from your photos. No surprise fees on the day." },
    { title: "Payment methods", body: "Card, bank transfer and cheques are commonly accepted — the exact terms are stated on your written quote." },
    { title: "Service area", body: "Share your address with the assistant and it confirms in seconds whether you're in the intervention zone." },
    { title: "In an emergency, first reflexes", body: "Active leak: shut off the water supply. Electrical hazard: cut the power at the panel. Gas smell: no flames or switches — ventilate, leave, and call emergency services first." },
  ],
  fr: [
    { title: "Devis & tarifs", body: "Un devis écrit avant toute intervention — confirmé après avoir vu le chantier, sur place ou d'après vos photos. Aucun frais surprise le jour J." },
    { title: "Moyens de paiement", body: "Carte bancaire, virement et chèques généralement acceptés — les modalités exactes figurent sur votre devis écrit." },
    { title: "Zone d'intervention", body: "Partagez votre adresse à l'assistant : il confirme en quelques secondes si vous êtes dans la zone d'intervention." },
    { title: "En cas d'urgence, les premiers réflexes", body: "Fuite active : coupez l'arrivée d'eau. Danger électrique : coupez le courant au tableau. Odeur de gaz : ni flamme ni interrupteur — aérez, sortez, et appelez d'abord les secours." },
  ],
};

/** Short descriptive subtitle under the business name in the header. */
export function homeServicesTagline(city: string | undefined, lang: "en" | "fr"): string {
  const base = lang === "fr" ? "Services à domicile" : "Home services";
  return city ? `${base} · ${city}` : base;
}

export function homeServicesAiGreeting(businessName: string, lang: "en" | "fr"): string {
  return lang === "fr"
    ? `Bonjour 👋 Bienvenue chez ${businessName}. Avez-vous une urgence, ou souhaitez-vous un devis ?`
    : `Hi 👋 Welcome to ${businessName}. Is this an emergency, or would you like a quote?`;
}

/**
 * Appended to the Claude copywriting prompt (generateSiteCopy.ts) only when
 * niche is home-services — real domain grounding instead of generic
 * knowledge, with an explicit guard against inventing prices.
 */
export function homeServicesCopyPlaybook(lang: "en" | "fr"): string {
  const names = HOME_SERVICES_SERVICE_NAMES[lang].join(", ");
  return `
HOME SERVICES NICHE REFERENCE (ground your writing in this — it is NOT this client's data, never state any of it as their actual price or fact):
- Common home-services offerings clients recognize: ${names}.
- Common FAQ topics for this niche: emergency/urgent callout availability, quote process (always "confirmed after seeing the job, in person or via photos" — never invent a price range), licensing/insurance, maintenance plans, service area coverage.
- Tone that works well for this niche: ${HOME_SERVICES_AI_TONE[lang]}.
- Never invent a price or a callout fee for any job — omit the price key entirely unless the intake states one.`;
}

/**
 * Appended to buildReceptionistPrompt() (clientPrompt.ts) only when niche is
 * home-services — real-time behavioral guardrails for the live chatbot.
 */
export const HOME_SERVICES_RECEPTIONIST_GUIDANCE = `
# Home-services-specific guidance
- Active leaks, gas smells, electrical hazards, no heat in freezing conditions, or anything described as dangerous: treat as urgent. Show urgency, prioritize the soonest slot, and if it sounds hazardous (gas, electrical, flooding), tell them to call now or contact emergency services rather than wait for a chat reply.
- Never invent or estimate a price or callout fee — always say the team confirms the exact price after seeing the job (in person or via photos), then route to booking a quote/visit.
- If asked about licensing/insurance, confirm the business is licensed and insured for their trade, without inventing specific certifications you don't know about.
- For scheduling, always confirm whether this is an emergency (same-day) or routine work (soonest available slot) — don't assume.`;

/** A fully fleshed-out reference config — copy/adapt when hand-building a real home-services client's site fast. */
export const HOME_SERVICES_TEMPLATE_EXAMPLE: ClientSiteConfig = {
  slug: "template-home-services",
  businessName: "Your Home Services Co.",
  niche: "home-services",
  language: "fr",
  accent: "#C05621",
  heroHeadline: "Un dépannage à domicile, sans l'attente.",
  heroSub: "Réservez en ligne à tout moment — notre assistant répond à vos questions et planifie votre intervention en quelques secondes.",
  about: "Notre équipe intervient pour le dépannage, l'installation et l'entretien à domicile. Notre assistant en ligne vous répond à tout moment, sans attente téléphonique.",
  services: HOME_SERVICES_SERVICE_NAMES.fr.slice(0, 6).map((name) => ({ name })),
  whyUs: HOME_SERVICES_WHY_US.fr,
  faqs: HOME_SERVICES_FAQS.fr,
  aiTone: HOME_SERVICES_AI_TONE.fr,
  aiGreeting: homeServicesAiGreeting("Your Home Services Co.", "fr"),
  status: "draft",
};
