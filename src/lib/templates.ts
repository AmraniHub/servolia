/**
 * TEMPLATE REGISTRY — the catalog of ready-to-deliver client-site templates.
 *
 * One entry per niche template that is FULLY wired end-to-end: a niche module
 * in src/lib/niches/ (structure, tone, imagery), an AI copy playbook in
 * generateSiteCopy.ts, receptionist guidance in clientPrompt.ts, and a live
 * fictional showcase site the founder keeps polished.
 *
 * This file is METADATA ONLY — it never changes what a template generates.
 * (Template *defaults* live in src/lib/niches/ and configFromIntake(), and are
 * only touched on the explicit "go linda" gate.) What this registry does:
 *
 *   - /admin/templates reads it to show delivery readiness per niche.
 *   - The public examples pages (EN /examples, FR /fr/exemples) read it to
 *     show prospects the live template for THEIR niche.
 *   - The homepage showcase reads it so the proof section can never drift
 *     from the templates that actually exist.
 *
 * Adding a niche template? Ship the three wiring touchpoints + a demo site
 * first, THEN add the entry here — an entry without wiring would advertise a
 * template that generates generic filler.
 *
 * The matcher regexes below are deliberately DUPLICATED from the is*Niche()
 * functions in src/lib/niches/ (single-line regexes, trivially diffable)
 * instead of imported: this registry renders on public marketing pages and
 * the homepage, and importing the niche modules would drag their large
 * template-content arrays toward the client bundle just for three regexes.
 * If you change a regex in src/lib/niches/, mirror it here.
 */
const DENTAL_MATCH = /dental|dentist|dentaire|implant/i;
const AESTHETIC_MATCH = /aesthetic|med-?spa|beaut[eé]|esth[ée]tique|cosm[ée]tique|skin\s?clinic/i;
const HOME_SERVICES_MATCH = /home-?service|hvac|hpe|plumb|plomb|electric|electrici|roof|toiture|contractor|artisan|chauffag/i;

export interface SiteTemplate {
  /** Stable key, matches the niche module. */
  key: "dental" | "aesthetic" | "home-services";
  /** Rung on the expansion ladder (1 = beachhead). */
  rung: number;
  name: { en: string; fr: string };
  /** Who it's for, one line. */
  audience: { en: string; fr: string };
  /** The live fictional showcase built on this template. */
  demoSlug: string;
  /** Fictional business shown on the demo — always labeled as a demo. */
  demoBusiness: string;
  demoCity: string;
  emoji: string;
  /** What the generated site ships with (structure, not client facts). */
  includes: { en: string[]; fr: string[] };
  /** Returns true when a free-text niche string belongs to this template. */
  matches: (niche?: string | null) => boolean;
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    key: "dental",
    rung: 1,
    name: { en: "Dental & Implant Clinic", fr: "Cabinet dentaire & implantologie" },
    audience: {
      en: "Independent dental and implant practices that lose after-hours enquiries.",
      fr: "Cabinets dentaires et d'implantologie indépendants qui perdent les demandes hors horaires.",
    },
    demoSlug: "demo-metay",
    demoBusiness: "Cabinet Nicolas Metay",
    demoCity: "Lyon",
    emoji: "🦷",
    includes: {
      en: [
        "Multi-page site: home, practice, expertise, advice, contact",
        "AI receptionist trained on the clinic's own treatments",
        "Emergency-slot strip with one-tap call",
        "Practical info block (Carte Vitale, mutuelles, access)",
        "Booking requests captured with reason + preferred time",
        "GDPR pages and cookie consent included",
      ],
      fr: [
        "Site multi-pages : accueil, cabinet, expertise, conseils, contact",
        "Réceptionniste IA entraînée sur les soins du cabinet",
        "Bandeau urgences avec appel en un geste",
        "Bloc infos pratiques (Carte Vitale, mutuelles, accès)",
        "Demandes de RDV captées avec motif + créneau souhaité",
        "Pages RGPD et bandeau cookies inclus",
      ],
    },
    matches: (n) => DENTAL_MATCH.test(n ?? ""),
  },
  {
    key: "aesthetic",
    rung: 2,
    name: { en: "Aesthetic Clinic & Med Spa", fr: "Clinique esthétique & med spa" },
    audience: {
      en: "Aesthetic clinics whose Instagram interest never turns into consultations.",
      fr: "Cliniques esthétiques dont l'intérêt Instagram ne devient jamais des consultations.",
    },
    demoSlug: "demo-lumea",
    demoBusiness: "Institut Luméa",
    demoCity: "Lyon",
    emoji: "💉",
    includes: {
      en: [
        "Premium multi-page site with treatment showcase",
        "AI assistant that qualifies (treatment, budget, urgency) before booking",
        "Consultation process journey, step by step",
        "Practical info block (payment, access, aftercare basics)",
        "Every enquiry captured — nothing evaporates in the DMs",
        "GDPR pages and cookie consent included",
      ],
      fr: [
        "Site premium multi-pages avec vitrine des soins",
        "Assistante IA qui qualifie (soin, budget, urgence) avant le RDV",
        "Parcours de consultation étape par étape",
        "Bloc infos pratiques (paiement, accès, suites de soins)",
        "Chaque demande captée — rien ne s'évapore dans les DM",
        "Pages RGPD et bandeau cookies inclus",
      ],
    },
    matches: (n) => AESTHETIC_MATCH.test(n ?? ""),
  },
  {
    key: "home-services",
    rung: 4,
    name: { en: "Home Services & Trades", fr: "Artisans & services à domicile" },
    audience: {
      en: "Plumbers, HVAC and trades who lose jobs to voicemail while on site.",
      fr: "Plombiers, chauffagistes et artisans qui perdent des chantiers en étant sur un chantier.",
    },
    demoSlug: "demo-bardin",
    demoBusiness: "Bardin Plomberie & Chauffage",
    demoCity: "Villeurbanne",
    emoji: "🔧",
    includes: {
      en: [
        "Trust-first site: zones served, certifications, interventions",
        "AI assistant that qualifies urgency (leak, breakdown, quote)",
        "Emergency strip with one-tap call",
        "Practical info block (hours, zones, payment)",
        "Every missed-call enquiry captured with address + urgency",
        "GDPR pages and cookie consent included",
      ],
      fr: [
        "Site confiance : zones desservies, certifications, interventions",
        "Assistante IA qui qualifie l'urgence (fuite, panne, devis)",
        "Bandeau urgences avec appel en un geste",
        "Bloc infos pratiques (horaires, zones, paiement)",
        "Chaque appel manqué capté avec adresse + urgence",
        "Pages RGPD et bandeau cookies inclus",
      ],
    },
    matches: (n) => HOME_SERVICES_MATCH.test(n ?? ""),
  },
];

/** The template a free-text niche string generates with (undefined = generic). */
export function templateForNiche(niche?: string | null): SiteTemplate | undefined {
  return SITE_TEMPLATES.find((t) => t.matches(niche));
}

/** Registry entry by stable key. */
export function templateByKey(key: string): SiteTemplate | undefined {
  return SITE_TEMPLATES.find((t) => t.key === key);
}
