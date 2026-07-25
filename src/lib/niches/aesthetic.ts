import type {
  ClientFaq, ClientSiteConfig, ClientStep, ClientValue, ClientAdvice,
} from "@/lib/clientSites";

/**
 * Aesthetic clinic / med-spa niche template — expansion ladder rung 2
 * (docs/PRINCIPLES.md P2, Planity-native market). Grounds all three
 * generation touchpoints in real aesthetic-clinic domain knowledge instead of
 * generic AI improvisation each time:
 *   1. configFromIntake()   — mechanical draft defaults (clientSites.ts)
 *   2. aiEnrichConfig()     — Claude's copywriting prompt (generateSiteCopy.ts)
 *   3. buildReceptionistPrompt() — the live chatbot's behavior (clientPrompt.ts)
 *
 * SAFETY: nothing here is ever a real price. Service names/descriptions/FAQs
 * are reference material for grounding tone and structure — actual prices
 * only ever come from a specific client's own intake answers. Keeping price
 * out of this template is deliberate, not an oversight. Same rule as dental.ts
 * for anything sounding like medical advice: this niche covers non-physician-
 * run aesthetic/med-spa businesses, not cosmetic surgery — never suggest a
 * treatment is medically necessary or diagnose a skin condition.
 */

export function isAestheticNiche(niche?: string | null): boolean {
  return /aesthetic|med-?spa|beaut[eé]|esth[ée]tique|cosm[ée]tique|skin\s?clinic/i.test(niche ?? "");
}

interface Bilingual<T> { en: T; fr: T }

export const AESTHETIC_SERVICE_NAMES: Bilingual<string[]> = {
  en: ["Botox / Wrinkle Relaxers", "Dermal Fillers", "Laser Hair Removal", "Skin Peels", "HydraFacial", "Microneedling", "Body Contouring", "Skin Consultation"],
  fr: ["Toxine botulique (Botox)", "Acide hyaluronique", "Épilation laser", "Peeling du visage", "HydraFacial", "Microneedling", "Remodelage corporel", "Bilan de peau"],
};

export const AESTHETIC_WHY_US: Bilingual<string[]> = {
  en: [
    "Consultation before any treatment — never sold on the spot",
    "Transparent pricing, quoted up front",
    "Online booking + reminders — no phone tag",
    "A calm, judgement-free environment",
  ],
  fr: [
    "Un bilan avant tout soin — jamais de vente à chaud",
    "Tarifs transparents, annoncés à l'avance",
    "Réservation en ligne + rappels — plus d'attente au téléphone",
    "Un cadre serein, sans jugement",
  ],
};

export const AESTHETIC_FAQS: Bilingual<ClientFaq[]> = {
  en: [
    { q: "Do you take new clients?", a: "Yes — we're welcoming new clients. Book your first consultation online in under a minute." },
    { q: "Is the first visit a consultation or a treatment?", a: "A consultation — we assess your skin and goals and explain what's realistic before any treatment is booked." },
    { q: "How many sessions will I need?", a: "It depends on the treatment and your goals — our team gives you a personalised plan at your consultation, never a generic number." },
    { q: "Do treatments hurt?", a: "Most of our treatments are minimally invasive with little to no downtime — our assistant or team can walk you through what to expect for a specific treatment." },
    { q: "Do you offer payment plans?", a: "For higher-value treatment plans, staged payments are often available — ask our assistant or the team for details." },
  ],
  fr: [
    { q: "Prenez-vous de nouveaux clients ?", a: "Oui — nous accueillons de nouveaux clients. Réservez votre premier bilan en ligne en moins d'une minute." },
    { q: "La première visite est-elle un soin ou un bilan ?", a: "Un bilan — nous évaluons votre peau et vos objectifs, et vous expliquons ce qui est réaliste avant de programmer un soin." },
    { q: "Combien de séances seront nécessaires ?", a: "Cela dépend du soin et de vos objectifs — notre équipe vous propose un plan personnalisé lors du bilan, jamais un chiffre générique." },
    { q: "Les soins sont-ils douloureux ?", a: "La plupart de nos soins sont peu invasifs avec peu ou pas d'éviction sociale — l'assistant ou l'équipe peut vous détailler ce à quoi vous attendre pour un soin précis." },
    { q: "Proposez-vous des facilités de paiement ?", a: "Pour les plans de traitement les plus importants, un paiement échelonné est souvent possible. Demandez à l'assistant ou à l'équipe." },
  ],
};

export const AESTHETIC_AI_TONE: Bilingual<string> = {
  en: "warm, discreet, non-judgemental",
  fr: "chaleureux, discret, sans jugement",
};

/* ─────────────────── Rich-layout defaults (multi-page sites) ─────────────────── */

const U = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

/** Generic, illustrative aesthetic-clinic/spa stock (Unsplash License). Used
 *  until a client supplies their own photos. Never captioned as a specific
 *  named person. */
export const AESTHETIC_IMAGES = {
  reception: U("photo-1540555700478-4be289fbecef"),
  treatmentRoom: U("photo-1512290923902-8a9f81dc236c"),
  facial: U("photo-1571019613454-1cb2f99b2d8b"),
  skincare: U("photo-1570172619644-dfd03ed5d881"),
  laser: U("photo-1596178065887-1198b6148b2b"),
  productShelf: U("photo-1595476108010-b4d1f102b3b1"),
};

/** Hero slider (2 clinic interiors that gently crossfade). */
export const AESTHETIC_HERO_IMAGES: string[] = [AESTHETIC_IMAGES.reception, AESTHETIC_IMAGES.treatmentRoom];

/** Per-sub-page banner photos (crossfade sliders). */
export const AESTHETIC_PAGE_BANNERS = {
  cabinet: [AESTHETIC_IMAGES.reception, AESTHETIC_IMAGES.productShelf],
  expertise: [AESTHETIC_IMAGES.laser, AESTHETIC_IMAGES.treatmentRoom],
  conseils: [AESTHETIC_IMAGES.facial, AESTHETIC_IMAGES.skincare],
};

/** Illustrative images the AI-written highlights / expertise blocks draw from,
 *  in order. Kept separate so generation just picks by index. */
export const AESTHETIC_HIGHLIGHT_IMAGES: string[] = [AESTHETIC_IMAGES.laser, AESTHETIC_IMAGES.treatmentRoom, AESTHETIC_IMAGES.facial];
export const AESTHETIC_EXPERTISE_IMAGES: string[] = [AESTHETIC_IMAGES.skincare, AESTHETIC_IMAGES.laser];

/** Generic consultation journey — true for any aesthetic clinic, no invented durations. */
export const AESTHETIC_PROCESS: Bilingual<ClientStep[]> = {
  en: [
    { title: "First consultation", body: "We assess your skin, goals and medical history — no treatment is booked on this visit." },
    { title: "Personalised plan", body: "A clear treatment plan and a quote, tailored to your goals and realistic timeline." },
    { title: "Treatment & follow-up", body: "Treatment at your own pace, with aftercare guidance and support between sessions." },
  ],
  fr: [
    { title: "Premier bilan", body: "On évalue votre peau, vos objectifs et vos antécédents — aucun soin n'est réservé lors de cette visite." },
    { title: "Plan personnalisé", body: "Un plan de traitement clair et un devis, adaptés à vos objectifs et à un calendrier réaliste." },
    { title: "Soin & suivi", body: "Une prise en charge à votre rythme, avec des conseils d'entretien entre les séances." },
  ],
};

/** Generic clinic commitments — universally true for an aesthetic clinic. */
export const AESTHETIC_VALUES: Bilingual<ClientValue[]> = {
  en: [
    { title: "Consultation-first", body: "We take the time to understand your goals and skin before recommending anything — never a treatment sold on the spot." },
    { title: "Modern, minimally invasive techniques", body: "Proven treatments chosen for natural-looking results and minimal downtime." },
    { title: "A safe, hygienic environment", body: "Strict sterilisation and hygiene protocols, with full traceability of every treatment." },
    { title: "Clear and honest", body: "A written treatment plan and a quote up front — no surprise upsells." },
  ],
  fr: [
    { title: "Le bilan avant tout", body: "On prend le temps de comprendre vos objectifs et votre peau avant toute recommandation — jamais de soin vendu à chaud." },
    { title: "Des techniques modernes et peu invasives", body: "Des soins éprouvés, choisis pour un résultat naturel et une éviction sociale minimale." },
    { title: "Un environnement sûr et hygiénique", body: "Stérilisation et hygiène rigoureusement contrôlées, avec une traçabilité complète des soins." },
    { title: "Clair et transparent", body: "Un plan de traitement écrit et un devis à l'avance — aucune vente surprise." },
  ],
};

/** Universal aesthetic-clinic aftercare advice topics — true for any clinic. */
export const AESTHETIC_ADVICE: Bilingual<ClientAdvice[]> = {
  en: [
    { title: "Before your appointment", body: "Sun exposure, retinoids and blood thinners to avoid in the days before most treatments." },
    { title: "After injectables", body: "The right reflexes in the first 24–48 hours: no massage, no intense heat, staying upright." },
    { title: "After a laser or peel session", body: "Sun protection and skin care to protect the results and avoid irritation." },
    { title: "Building a daily skincare routine", body: "The basics that make in-clinic results last longer between sessions." },
    { title: "What 'downtime' really means", body: "What to expect and plan around after a typical in-clinic treatment." },
    { title: "When to get in touch", body: "The signs that mean you should contact the clinic after a treatment." },
  ],
  fr: [
    { title: "Avant votre rendez-vous", body: "Exposition au soleil, rétinoïdes et anticoagulants à éviter dans les jours précédant la plupart des soins." },
    { title: "Après une injection", body: "Les bons réflexes dans les 24 à 48 heures : pas de massage, pas de chaleur intense, rester en position verticale." },
    { title: "Après un laser ou un peeling", body: "Protection solaire et soins adaptés pour préserver le résultat et éviter les irritations." },
    { title: "Construire une routine de soin quotidienne", body: "Les bases qui prolongent les résultats obtenus en cabinet entre les séances." },
    { title: "Ce que signifie vraiment l'éviction sociale", body: "À quoi s'attendre et comment s'organiser après un soin classique en cabinet." },
    { title: "Quand nous recontacter", body: "Les signes qui doivent vous amener à contacter le cabinet après un soin." },
  ],
};

/** Short descriptive subtitle under the business name in the header. */
export function aestheticTagline(city: string | undefined, lang: "en" | "fr"): string {
  const base = lang === "fr" ? "Clinique esthétique" : "Aesthetic clinic";
  return city ? `${base} · ${city}` : base;
}

export function aestheticAiGreeting(businessName: string, lang: "en" | "fr"): string {
  return lang === "fr"
    ? `Bonjour 👋 Bienvenue chez ${businessName}. Souhaitez-vous réserver un bilan ou avez-vous une question sur un soin ?`
    : `Hi 👋 Welcome to ${businessName}. Would you like to book a consultation, or do you have a question about a treatment?`;
}

/**
 * Appended to the Claude copywriting prompt (generateSiteCopy.ts) only when
 * niche is aesthetic — real domain grounding instead of generic knowledge,
 * with an explicit guard against inventing prices or giving medical claims.
 */
export function aestheticCopyPlaybook(lang: "en" | "fr"): string {
  const names = AESTHETIC_SERVICE_NAMES[lang].join(", ");
  return `
AESTHETIC CLINIC NICHE REFERENCE (ground your writing in this — it is NOT this client's data, never state any of it as their actual price or fact):
- Common aesthetic/med-spa treatments clients recognize: ${names}.
- Common FAQ topics for this niche: new-client acceptance, consultation-before-treatment expectations, number of sessions needed (always "personalised at consultation" — never claim a fixed number), downtime/pain expectations, payment plans for higher-value plans.
- Tone that works well for this niche: ${AESTHETIC_AI_TONE[lang]}.
- Never invent a price for any treatment — omit the price key entirely unless the intake states one. Never claim a treatment is medically necessary or diagnose a skin condition.`;
}

/**
 * Appended to buildReceptionistPrompt() (clientPrompt.ts) only when niche is
 * aesthetic — real-time behavioral guardrails for the live chatbot.
 */
export const AESTHETIC_RECEPTIONIST_GUIDANCE = `
# Aesthetic-clinic-specific guidance
- Always route to a consultation before discussing what treatment someone "needs" — only the clinic's practitioner can assess skin/goals in person. Never diagnose a skin condition or claim a treatment is medically necessary.
- Never invent or estimate a price for Botox, fillers, laser, peels, or any other treatment — always route to a consultation for a personalized quote.
- If asked about pain, downtime or number of sessions: give general, honest expectations (e.g. "most clients feel minimal discomfort") but avoid guarantees — individual results vary and the practitioner confirms specifics at consultation.
- Be warm and discreet — many clients feel self-conscious asking about aesthetic treatments. Never make assumptions about why someone wants a treatment.`;

/** A fully fleshed-out reference config — copy/adapt when hand-building a real aesthetic client's site fast. */
export const AESTHETIC_TEMPLATE_EXAMPLE: ClientSiteConfig = {
  slug: "template-aesthetic",
  businessName: "Your Aesthetic Clinic",
  niche: "aesthetic",
  language: "fr",
  accent: "#B4739E",
  heroHeadline: "Une esthétique plus sereine.",
  heroSub: "Réservez votre bilan en ligne à tout moment — notre assistant répond à vos questions et prend votre rendez-vous en quelques secondes.",
  about: "Notre clinique propose des soins esthétiques modernes et peu invasifs, du bilan de peau aux injections. Notre assistant en ligne vous répond à tout moment, sans attente téléphonique.",
  services: AESTHETIC_SERVICE_NAMES.fr.slice(0, 6).map((name) => ({ name })),
  whyUs: AESTHETIC_WHY_US.fr,
  faqs: AESTHETIC_FAQS.fr,
  aiTone: AESTHETIC_AI_TONE.fr,
  aiGreeting: aestheticAiGreeting("Your Aesthetic Clinic", "fr"),
  status: "draft",
};
