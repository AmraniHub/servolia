/**
 * Client Site System — the productized engine.
 *
 * One ClientSiteConfig = a full live client website + a trained AI receptionist.
 * A config can be authored by hand, generated from a build's intake form
 * (configFromIntake), and stored in Supabase (client_sites). The public route
 * /sites/[slug] renders it, and /api/chat uses buildReceptionistPrompt() so the
 * AI speaks for THAT business — its services, prices, hours, and tone.
 *
 * This mirrors the proven pages.ts → MarketingPage.tsx pattern, generalized so a
 * single data entry produces a client's entire site with zero bespoke code.
 */

import { supabaseAdmin } from "@/lib/supabase";
import {
  isDentalNiche, DENTAL_WHY_US, DENTAL_FAQS, DENTAL_AI_TONE, dentalAiGreeting,
  DENTAL_HERO_IMAGES, DENTAL_PAGE_BANNERS, DENTAL_PROCESS, DENTAL_VALUES, DENTAL_ADVICE, dentalTagline,
  DENTAL_EMERGENCY_NOTE, DENTAL_PRACTICAL_INFO,
} from "@/lib/niches/dental";
import {
  isAestheticNiche, AESTHETIC_WHY_US, AESTHETIC_FAQS, AESTHETIC_AI_TONE, aestheticAiGreeting,
  AESTHETIC_HERO_IMAGES, AESTHETIC_PAGE_BANNERS, AESTHETIC_PROCESS, AESTHETIC_VALUES, AESTHETIC_ADVICE, aestheticTagline,
  AESTHETIC_PRACTICAL_INFO,
} from "@/lib/niches/aesthetic";
import {
  isHomeServicesNiche, HOME_SERVICES_WHY_US, HOME_SERVICES_FAQS, HOME_SERVICES_AI_TONE, homeServicesAiGreeting,
  HOME_SERVICES_HERO_IMAGES, HOME_SERVICES_PAGE_BANNERS, HOME_SERVICES_PROCESS, HOME_SERVICES_VALUES, HOME_SERVICES_ADVICE, homeServicesTagline,
  HOME_SERVICES_EMERGENCY_NOTE, HOME_SERVICES_PRACTICAL_INFO,
} from "@/lib/niches/homeServices";

export interface ClientService {
  name: string;
  description?: string;
  price?: string; // e.g. "From €90" — optional
}

export interface ClientFaq {
  q: string;
  a: string;
}

export interface TeamMember {
  name: string;
  role: string;
  photoUrl?: string;
  bio?: string;
}

export interface ClientHighlight {
  title: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string; // defaults to the page's "book" label if omitted
}

/** A single trust/proof stat, e.g. { value: "15 ans", label: "d'expérience" }. */
export interface ClientStat {
  value: string;
  label: string;
}

/** A numbered process/consultation step. */
export interface ClientStep {
  title: string;
  body: string;
  meta?: string; // e.g. duration "45 min"
}

/** A rich, in-depth feature block for the Expertise page (alternating rows). */
export interface ClientExpertiseBlock {
  eyebrow?: string; // small label above the title
  title: string;
  body: string;
  bullets?: string[]; // optional supporting points
  imageUrl?: string;
}

/** A treatment/solution card (Expertise page grid). */
export interface ClientSolution {
  title: string;
  body?: string;
}

/** A clinic value / reassurance point (Cabinet page). */
export interface ClientValue {
  title: string;
  body: string;
}

/** A short advice/blog teaser card (Conseils page). */
export interface ClientAdvice {
  title: string;
  body: string;
}

export interface ClientSiteConfig {
  slug: string;
  businessName: string;
  niche: string; // dental, aesthetic, med-spa, home-services, ...
  language: "en" | "fr";
  accent: string; // brand hex, e.g. "#36671E"

  // Contact / location
  city?: string;
  country?: string;
  address?: string;
  phone?: string;
  whatsapp?: string; // digits only
  email?: string;
  hours?: string; // "Mon–Fri, 9am–6pm"
  bookingUrl?: string; // external booking link; defaults to on-page contact

  // Brand assets
  logoUrl?: string;
  /** Real photo for a photo-driven hero. Optional — falls back to the flat
   * gradient hero when not supplied (most clients won't have one yet). */
  heroImageUrl?: string;
  /** Optional hero slider — 1–2 images that gently crossfade behind the
   * homepage hero. Takes precedence over heroImageUrl when set. */
  heroImages?: string[];
  /** Optional banner background photo(s) per sub-page (1 = static photo,
   * 2 = gentle crossfade slider). Without it the sub-page banner is the flat
   * gradient. Purely additive. */
  pageBanners?: { cabinet?: string[]; expertise?: string[]; services?: string[]; conseils?: string[] };
  /** Full-bleed "feature story" cards — one photo + headline per differentiator
   * (a technology, a service, a reassurance point). Purely additive; renders
   * nothing when omitted. Never populate with a stock photo captioned as a
   * specific named person — only use client-supplied photos for people. */
  highlights?: ClientHighlight[];
  /** Humanizing team section. Only ever populated with a real client's own
   * photos of their real staff — never a stock photo under a real name. */
  team?: TeamMember[];
  /** Short subtitle under the business name in the header, e.g. "Cabinet
   * d'implantologie à Lyon". Only shown when expandedHeader is on. */
  tagline?: string;
  /** Opt-in richer header/footer: top info bar (address/phone/socials) +
   * horizontal section nav + footer nav/social row. Off by default so every
   * existing site renders exactly as before — purely additive. */
  expandedHeader?: boolean;
  /** Opt-in multi-page site: nav items link to real /sites/[slug]/[page]
   * routes (cabinet, services, conseils) instead of in-page anchors. Off by
   * default — existing single-page sites are unaffected. */
  multiPage?: boolean;
  /** Links to the client's own real social profiles. */
  socialLinks?: { platform: "facebook" | "instagram" | "linkedin" | "x" | "tiktok" | "youtube"; url: string }[];

  // Rich content blocks — all optional, purely additive. Render only when present.
  /** Trust/proof band (years, implants placed, guarantee...). */
  stats?: ClientStat[];
  /** In-depth expertise blocks (alternating image/text) for the Expertise page. */
  expertise?: ClientExpertiseBlock[];
  /** Short lead-in shown at the top of the Expertise page. */
  expertiseIntro?: string;
  /** Treatment/solution grid on the Expertise page. */
  solutions?: ClientSolution[];
  /** Numbered consultation/treatment steps. */
  process?: ClientStep[];
  /** Clinic values / reassurance cards on the Cabinet page. */
  values?: ClientValue[];
  /** Advice/blog teaser cards on the Conseils page. */
  advice?: ClientAdvice[];

  // Copy
  heroHeadline: string;
  heroSub: string;
  about: string;
  services: ClientService[];
  whyUs: string[];
  faqs: ClientFaq[];

  // AI receptionist
  aiTone?: string; // "warm, professional"
  aiGreeting?: string; // first message the widget shows

  // Prospect demo mode — a pre-sale site built for a clinic that hasn't paid.
  // Renders a conversion banner ("this is your AI receptionist — book a call").
  isDemo?: boolean;
  demoContactUrl?: string; // where the demo's "Book a call / Get this" CTA points

  // Plan template — which pricing tier this site was generated under, and the
  // feature switches that tier grants (see planFeatures()). Absent = all-on.
  planKey?: string;
  features?: { chat?: boolean };

  // Per-client Google Sheets CRM sync (Booking System promise): an Apps
  // Script webhook URL — every captured lead is POSTed there as a JSON row.
  // Set it in the site config when a client asks for their sheet.
  sheetsWebhookUrl?: string;

  // "Infos pratiques" block — the practical-information section every French
  // practice site has (Carte Vitale / mutuelles, payment methods, access &
  // parking, PMR accessibility). Rendered on the home page when present.
  practicalInfo?: { title: string; body: string }[];
  // Urgent-care strip under the header (e.g. "Urgence dentaire ? Des créneaux
  // sont réservés chaque jour."). Pairs with the site's phone for one-tap call.
  emergencyNote?: string;

  // Business economics & growth loop
  avgTreatmentValue?: number; // avg € per new client — used in the monthly ROI report
  googleReviewUrl?: string; // "leave us a review" link (g.page/r/...)
  /** The client's REAL Google rating, shown as a trust row on every page.
   *  Reviews are the third local-credibility signal (with hours and address)
   *  and the one our own audit engine scores clinics on — without these
   *  fields a client with 4.9 stars had no way to show it.
   *  NEVER populate these on a demo: the showcase sites carry a deliberate
   *  no-invented-review-counts rule. Real numbers, taken from the client's
   *  Google Business Profile at build time, or nothing at all. */
  googleRating?: number;   // e.g. 4.9
  reviewCount?: number;    // e.g. 127
  metaPixelId?: string; // client's own Meta pixel — CAPI Lead events fire on bookings
  metaCapiToken?: string; // client's CAPI access token (paired with metaPixelId)
  /** The client's OWN GA4 Measurement ID (G-XXXXXXXX), collected at intake.
   *  Servolia's property never fires on a client site — see Analytics.tsx. */
  ga4Id?: string;

  // Meta
  status?: "draft" | "published";
}

/* ───────────────────────── helpers ───────────────────────── */

export function slugify(input: string): string {
  return (input || "client")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "client";
}

function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v.trim());
}

function normalizeHex(v: unknown, fallback = "#36671E"): string {
  if (!isHex(v)) return fallback;
  const s = (v as string).trim();
  return s.startsWith("#") ? s : `#${s}`;
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

/** Split a free-text services field ("Cleaning, Whitening; Implants") into structured services. */
function parseServices(raw: unknown): ClientService[] {
  const text = str(raw);
  if (!text) return [];
  return text
    .split(/[\n,;•]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 80)
    .slice(0, 8)
    .map((name) => ({ name }));
}

/* ─────────────── generator: intake → draft config ─────────────── */

export interface IntakeSource {
  intake?: Record<string, unknown> | null;
  business?: string | null;
  niche?: string | null;
  email?: string | null;
  /** The build's plan key — selects the PLAN TEMPLATE (feature set). */
  plan?: string | null;
}

/**
 * PLAN TEMPLATES — what each pricing tier actually ships on the client site.
 * Niche templates (src/lib/niches/) decide the CONTENT; this decides the
 * FEATURES, so delivery always matches what the pricing page promised.
 *   starter (€290 Website System): site + booking/contact form, NO AI chat.
 *   growth/pro/pay_per_booking:   everything incl. the AI receptionist.
 * Absent/unknown plans default to all-on (existing rows, demos — demos must
 * always show the full product, it's the pitch).
 */
export function planFeatures(plan?: string | null): { chat: boolean } {
  const p = (plan ?? "").toLowerCase();
  // Since the 2026-07-28 pricing change the AI receptionist is in EVERY plan —
  // tiers differ by included conversation volume, not by whether it exists.
  // Only the retired €290 Website System shipped without it.
  if (p === "starter" || p === "website") return { chat: false };
  return { chat: true };
}

/**
 * Turn a build's intake_data into a DRAFT ClientSiteConfig.
 * The founder reviews and polishes before publishing — this does the 90%.
 */
export function configFromIntake(src: IntakeSource): ClientSiteConfig {
  const d = src.intake ?? {};
  const businessName =
    str(d.businessName) ?? str(src.business) ?? "Your Business";
  const niche = str(src.niche) ?? str(d.niche) ?? "service";
  const city = str(d.city);
  const country = str(d.country);
  const services = parseServices(d.services);
  const targetClient = str(d.targetClient);
  const mainGoal = str(d.mainGoal);
  const lang = /fr|french|français/i.test(str(d.preferredLanguage) ?? "")
    ? "fr"
    : "en";

  const nicheLabel = niche.replace(/[-_]+/g, " ");
  const heroHeadline =
    lang === "fr"
      ? `${businessName} — pris en charge, 24h/24.`
      : `${businessName} — always here for you.`;
  const heroSub =
    lang === "fr"
      ? `Réservez en ligne à tout moment. Notre assistant répond à vos questions et prend votre rendez-vous instantanément.`
      : `Book online any time. Our assistant answers your questions and schedules your appointment in seconds.`;

  const about =
    [
      targetClient
        ? lang === "fr"
          ? `${businessName} accompagne ${targetClient}.`
          : `${businessName} helps ${targetClient}.`
        : lang === "fr"
        ? `${businessName} est un cabinet ${nicheLabel} de confiance${
            city ? ` à ${city}` : ""
          }.`
        : `${businessName} is a trusted ${nicheLabel} business${
            city ? ` in ${city}` : ""
          }.`,
      mainGoal
        ? lang === "fr"
          ? `Notre objectif : ${mainGoal}.`
          : `Our focus: ${mainGoal}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  // Servolia's beachhead + ladder-rung-2/marketed niches get a real domain-
  // grounded default instead of generic filler — see src/lib/niches/. Every
  // other niche keeps the fully generic fallback until it gets its own template.
  const nicheKind = isDentalNiche(niche)
    ? "dental"
    : isAestheticNiche(niche)
    ? "aesthetic"
    : isHomeServicesNiche(niche)
    ? "home-services"
    : null;

  const whyUs =
    nicheKind === "dental" ? DENTAL_WHY_US[lang]
    : nicheKind === "aesthetic" ? AESTHETIC_WHY_US[lang]
    : nicheKind === "home-services" ? HOME_SERVICES_WHY_US[lang]
    : lang === "fr"
      ? [
          "Réponse instantanée, jour et nuit",
          "Réservation en ligne en quelques secondes",
          "Une équipe locale à votre écoute",
        ]
      : [
          "Instant answers, day or night",
          "Book online in seconds",
          "A local team that actually responds",
        ];

  const phone = str(d.phone);
  const intakeHero = str(d.heroImageUrl);

  // Niches with a template get the full professional multi-page layout by
  // default: sub-page nav (Cabinet / Expertise / Conseils), photo banners, a
  // process journey, values and advice. All of it is generic-safe for any
  // business in that niche; the AI layer adds the client-specific richness on top.
  const nicheLayout =
    nicheKind === "dental"
      ? {
          expandedHeader: true, multiPage: true, tagline: dentalTagline(city, lang),
          heroImages: intakeHero ? undefined : DENTAL_HERO_IMAGES,
          pageBanners: DENTAL_PAGE_BANNERS, process: DENTAL_PROCESS[lang],
          values: DENTAL_VALUES[lang], advice: DENTAL_ADVICE[lang],
          emergencyNote: DENTAL_EMERGENCY_NOTE[lang], practicalInfo: DENTAL_PRACTICAL_INFO[lang],
        }
      : nicheKind === "aesthetic"
      ? {
          expandedHeader: true, multiPage: true, tagline: aestheticTagline(city, lang),
          heroImages: intakeHero ? undefined : AESTHETIC_HERO_IMAGES,
          pageBanners: AESTHETIC_PAGE_BANNERS, process: AESTHETIC_PROCESS[lang],
          values: AESTHETIC_VALUES[lang], advice: AESTHETIC_ADVICE[lang],
          practicalInfo: AESTHETIC_PRACTICAL_INFO[lang],
        }
      : nicheKind === "home-services"
      ? {
          expandedHeader: true, multiPage: true, tagline: homeServicesTagline(city, lang),
          heroImages: intakeHero ? undefined : HOME_SERVICES_HERO_IMAGES,
          pageBanners: HOME_SERVICES_PAGE_BANNERS, process: HOME_SERVICES_PROCESS[lang],
          values: HOME_SERVICES_VALUES[lang], advice: HOME_SERVICES_ADVICE[lang],
          emergencyNote: HOME_SERVICES_EMERGENCY_NOTE[lang], practicalInfo: HOME_SERVICES_PRACTICAL_INFO[lang],
        }
      : {};

  return {
    slug: slugify(businessName),
    businessName,
    niche,
    planKey: src.plan ?? undefined,
    features: planFeatures(src.plan),
    language: lang,
    accent: normalizeHex(d.primaryColor),
    city,
    country,
    address: str(d.address),
    phone,
    whatsapp: phone ? phone.replace(/[^\d]/g, "") : undefined,
    email: str(src.email) ?? undefined,
    bookingUrl: str(d.bookingUrl) ?? str(d.doctolibUrl) ?? str(d.planityUrl),
    logoUrl: str(d.logoUrl),
    // The client's own GA4 property, if they gave one at intake. Servolia's
    // property never fires on their site, so without this they simply get
    // first-party numbers in the portal instead.
    ga4Id: str(d.googleAnalyticsId),
    heroImageUrl: intakeHero,
    ...nicheLayout,
    heroHeadline,
    heroSub,
    about,
    services,
    whyUs,
    faqs:
      nicheKind === "dental" ? DENTAL_FAQS[lang]
      : nicheKind === "aesthetic" ? AESTHETIC_FAQS[lang]
      : nicheKind === "home-services" ? HOME_SERVICES_FAQS[lang]
      : [],
    aiTone:
      nicheKind === "dental" ? DENTAL_AI_TONE[lang]
      : nicheKind === "aesthetic" ? AESTHETIC_AI_TONE[lang]
      : nicheKind === "home-services" ? HOME_SERVICES_AI_TONE[lang]
      : (lang === "fr" ? "chaleureux et professionnel" : "warm and professional"),
    aiGreeting:
      nicheKind === "dental" ? dentalAiGreeting(businessName, lang)
      : nicheKind === "aesthetic" ? aestheticAiGreeting(businessName, lang)
      : nicheKind === "home-services" ? homeServicesAiGreeting(businessName, lang)
      : lang === "fr"
        ? `Bonjour 👋 Bienvenue chez ${businessName}. Comment puis-je vous aider ?`
        : `Hi 👋 Welcome to ${businessName}. How can I help you today?`,
    status: "draft",
  };
}

/* ─────────────── bundled demo (works before Supabase) ─────────────── */

const DEMO_SITES: ClientSiteConfig[] = [
  {
    slug: "demo-dental",
    businessName: "Meridian Dental Studio",
    niche: "dental",
    language: "en",
    accent: "#0E7C86",
    city: "Lyon",
    country: "France",
    address: "18 Rue de la République, 69002 Lyon",
    phone: "+33 4 00 00 00 00",
    whatsapp: "33400000000",
    email: "hello@meridiandental.example",
    hours: "Mon–Fri, 9am–7pm · Sat, 9am–1pm",
    heroHeadline: "A calmer kind of dental care.",
    heroSub:
      "Modern dentistry in the heart of Lyon. Book online any time — our assistant answers questions and schedules you in seconds.",
    about:
      "Meridian Dental Studio is a modern practice focused on gentle, unhurried care. From routine check-ups to implants and smile design, our team takes the time to get it right — and our online assistant means you never wait on hold.",
    services: [
      { name: "Check-up & Cleaning", description: "Comprehensive exam and hygiene visit.", price: "From €60" },
      { name: "Teeth Whitening", description: "Professional in-clinic whitening.", price: "From €290" },
      { name: "Dental Implants", description: "Single implants to full-arch restoration.", price: "Consultation" },
      { name: "Invisible Aligners", description: "Discreet orthodontics for adults.", price: "From €1,900" },
      { name: "Emergency Care", description: "Same-day appointments for pain or trauma.", price: "Same day" },
      { name: "Smile Design", description: "Veneers and cosmetic treatment planning.", price: "Consultation" },
    ],
    whyUs: [
      "Same-day emergency appointments",
      "Transparent pricing, quoted up front",
      "Online booking + reminders — no phone tag",
      "Gentle, anxiety-friendly approach",
    ],
    faqs: [
      { q: "Do you take new patients?", a: "Yes — we're welcoming new patients. You can book your first visit online in under a minute." },
      { q: "Do you offer payment plans?", a: "Yes, for treatments like implants and aligners we offer staged payment plans. Ask our assistant or the team for details." },
      { q: "What if I have a dental emergency?", a: "Call us or message the assistant — we keep same-day slots open for pain, swelling, or trauma." },
      { q: "Where are you located?", a: "18 Rue de la République, in central Lyon, a two-minute walk from Cordeliers metro." },
    ],
    aiTone: "warm, calm, reassuring",
    aiGreeting: "Hi 👋 Welcome to Meridian Dental Studio. Are you a new or returning patient?",
    status: "published",
  },
  {
    // Real prospect demo — built from docs/outbound/prospects-dentaire-fr.csv (HOT
    // lead: no online booking, no chat) and a direct read of their actual site,
    // dentairemonplaisir.fr. No price is invented.
    //
    // Images: generic Unsplash stock (Unsplash License — free for commercial use).
    // The team members are FICTIONAL placeholders (invented names + illustrative
    // stock portraits) so the demo shows a complete, finished-looking team without
    // captioning any stock face with a REAL person's name. A real client's build
    // would swap in their own staff. The about text is likewise kept free of real
    // individuals' names for consistency.
    slug: "demo-metay",
    businessName: "Cabinet Nicolas Metay",
    niche: "dental",
    language: "fr",
    accent: "#0E7490",
    city: "Lyon",
    country: "France",
    address: "18 Place Ambroise Courtois, 69008 Lyon",
    phone: "04 78 76 66 66",
    email: "dentistelyon8@gmail.com",
    hours: "Lun–Ven, 9h30–12h00 et 14h00–17h00 (fermé le mercredi)",
    tagline: "Cabinet d'implantologie à Lyon",
    emergencyNote: "Urgence dentaire ? Des créneaux sont réservés chaque jour pour la douleur et les traumatismes.",
    practicalInfo: [
      { title: "Carte Vitale & mutuelles", body: "Carte Vitale acceptée, feuilles de soins télétransmises. Le remboursement mutuelle dépend de votre contrat — un devis détaillé vous est remis pour votre demande de prise en charge." },
      { title: "Moyens de paiement", body: "Carte bancaire, espèces et chèques. Paiement échelonné possible pour les traitements implantaires — les modalités sont fixées avec vous avant de démarrer." },
      { title: "Accès & stationnement", body: "Métro D (Monplaisir–Lumière) à deux pas, bus et stations Vélo'v à proximité. Parking public Place Ambroise Courtois à 2 minutes à pied." },
      { title: "Accessibilité PMR", body: "Cabinet accessible aux personnes à mobilité réduite. Signalez tout besoin particulier à la prise de rendez-vous — l'accueil est adapté." },
    ],
    expandedHeader: true,
    multiPage: true,
    // Demo only: social icons keep the design's look but route back to Servolia
    // rather than the prospect's real accounts (this is our showcase, not their
    // live site). A real client's site would point these at their own profiles.
    socialLinks: [
      { platform: "facebook", url: "https://servolia.com" },
      { platform: "instagram", url: "https://servolia.com" },
      { platform: "linkedin", url: "https://servolia.com" },
      { platform: "x", url: "https://servolia.com" },
    ],
    heroImageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1600&q=80&auto=format&fit=crop",
    // Hero slider (2 clinic interiors crossfade). Each sub-page gets its own
    // themed banner photos too, so every page shows real imagery.
    heroImages: [
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1600&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1600&q=80&auto=format&fit=crop",
    ],
    pageBanners: {
      cabinet: [
        "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1600&q=80&auto=format&fit=crop",
      ],
      expertise: [
        "https://images.unsplash.com/photo-1593022356769-11f762e25ed9?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1579154491915-611e891d3a5b?w=1600&q=80&auto=format&fit=crop",
      ],
      conseils: [
        "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=1600&q=80&auto=format&fit=crop",
      ],
    },
    heroHeadline: "Des implants dentaires, sans l'appréhension.",
    heroSub: "Cabinet spécialisé en implantologie à Lyon Monplaisir. Notre assistant répond à vos questions et prend vos coordonnées à tout moment — jour et nuit.",
    about: "Notre cabinet exerce à Monplaisir depuis 2009 et se consacre à l'implantologie : 15 ans d'expérience, des centaines d'implants posés, et une veille technologique constante (imagerie 3D, chirurgie guidée, empreinte numérique). Une équipe formée à l'accompagnement des patients les plus anxieux — y compris par l'hypnose.",
    stats: [
      { value: "15 ans", label: "d'expérience en implantologie" },
      { value: "500+", label: "implants posés" },
      { value: "4 sem.", label: "premier rendez-vous garanti" },
      { value: "3D", label: "imagerie & chirurgie guidée" },
    ],
    highlights: [
      {
        title: "L'implant dentaire : solide, invisible et indispensable",
        body: "Un système implantaire éprouvé, posé dans une salle dédiée à la chirurgie. 15 ans d'expérience, chirurgie guidée et imagerie 3D pour un résultat naturel et durable.",
        imageUrl: "https://images.unsplash.com/photo-1593022356769-11f762e25ed9?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "En savoir plus",
      },
      {
        title: "Anesthésie générale : la solution pour les patients phobiques",
        body: "À la Clinique Protestante, pour vivre votre intervention sans appréhension — une option pensée pour les patients les plus anxieux.",
        imageUrl: "https://images.unsplash.com/photo-1579154491915-611e891d3a5b?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "En savoir plus",
      },
      {
        title: "Nos technologies au service de votre bien-être",
        body: "Radiographie 3D, empreinte numérique, systèmes de navigation et chirurgie guidée : un plateau technique moderne pour des interventions plus précises et plus confortables.",
        imageUrl: "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "Voir notre expertise",
      },
    ],
    expertiseIntro: "Nos technologies au service de votre bien-être. Une prise en charge complète, de la première consultation jusqu'au suivi, pensée autour du confort du patient.",
    expertise: [
      {
        eyebrow: "Une prise en charge sur mesure",
        title: "Des conseils personnalisés",
        body: "Avant tout traitement complexe, nous prenons le temps de vous connaître : votre mode de vie, votre travail, votre famille, vos activités. C'est ce qui nous permet de construire un plan de traitement réellement adapté à vous.",
        bullets: [
          "1er rendez-vous : 45 minutes pour comprendre vos besoins",
          "2e rendez-vous : 30–45 minutes de recommandations",
          "3e rendez-vous : 30 minutes pour finaliser la stratégie et le financement",
        ],
        imageUrl: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80&auto=format&fit=crop",
      },
      {
        eyebrow: "Exigence, compétence, efficacité",
        title: "L'implant dentaire, notre spécialité",
        body: "15 ans d'expérience et des centaines d'implants posés. Une formation continue et des investissements réguliers dans un plateau technique moderne, pour des interventions précises et peu invasives.",
        bullets: [
          "Radiographie 3D et empreinte numérique",
          "Systèmes de navigation et chirurgie guidée",
          "Collaboration avec un laboratoire de prothèse régional expérimenté",
          "Anesthésie générale possible à la Clinique Protestante",
        ],
        imageUrl: "https://images.unsplash.com/photo-1593022356769-11f762e25ed9?w=1200&q=80&auto=format&fit=crop",
      },
    ],
    solutions: [
      { title: "Dent unique manquante", body: "Antérieure ou postérieure, remplacée par un implant discret et durable." },
      { title: "Mâchoire complète", body: "Reconstruction d'une arcade entière avec un plan de traitement personnalisé." },
      { title: "Comblement osseux", body: "Préparation et augmentation osseuse pour poser l'implant dans les meilleures conditions." },
      { title: "Reprise d'implants", body: "Prise en charge des anciens implants nécessitant un nouveau traitement." },
      { title: "Esthétique du sourire", body: "Solutions pensées pour les dents visibles, avec un rendu naturel." },
      { title: "Anesthésie générale", body: "Une option confortable pour les patients les plus anxieux." },
    ],
    process: [
      { meta: "45 min", title: "Premier entretien", body: "On comprend vos besoins, vos craintes et votre situation — sans engagement." },
      { meta: "30–45 min", title: "Recommandations", body: "On vous présente les solutions possibles et le plan de traitement adapté." },
      { meta: "30 min", title: "Stratégie & financement", body: "On finalise ensemble la solution retenue et les modalités, avant de démarrer." },
    ],
    services: [
      { name: "Implant dentaire (dent unique)", description: "Remplacement d'une dent manquante par un implant, dans une salle dédiée à la chirurgie." },
      { name: "Implants – mâchoire complète", description: "Solution complète pour une mâchoire édentée, avec plan de traitement personnalisé." },
      { name: "Comblement osseux", description: "Préparation osseuse pour poser les implants dans les meilleures conditions." },
      { name: "Reprise d'anciens implants", description: "Prise en charge des implants existants nécessitant un nouveau traitement." },
      { name: "Chirurgie sous anesthésie générale", description: "Option à la Clinique Protestante, pensée pour les patients phobiques." },
      { name: "Bilan et plan de traitement personnalisé", description: "Jusqu'à trois entretiens pour construire ensemble la solution adaptée." },
    ],
    whyUs: [
      "15 ans d'expérience en implantologie, des centaines d'implants posés",
      "Formation continue : chirurgie guidée, imagerie 3D, empreinte numérique",
      "Option anesthésie générale pour les patients anxieux",
      "Premier rendez-vous garanti sous 4 semaines",
      "Jusqu'à 3 entretiens personnalisés avant de démarrer un traitement",
    ],
    values: [
      { title: "Consultations personnalisées", body: "Un premier rendez-vous de 45 minutes pour cerner vos attentes, votre mode de vie et vos éventuelles craintes." },
      { title: "Des soins optimaux", body: "Des systèmes implantaires éprouvés et des techniques peu invasives pour réduire la gêne et le temps de récupération." },
      { title: "Un environnement sûr", body: "Stérilisation rigoureusement contrôlée, salles dédiées à la chirurgie et traçabilité complète des interventions." },
      { title: "L'expérience qui rassure", body: "Des centaines d'implants posés en 15 ans, une maîtrise clinique sur des cas très variés." },
    ],
    advice: [
      { title: "Après la pose d'un implant", body: "Les bons réflexes les premiers jours : rinçage, alimentation, tabac — pour une cicatrisation optimale." },
      { title: "Le jour de l'intervention", body: "Comment bien se préparer : repas, médicaments et petites précautions avant votre rendez-vous." },
      { title: "Quand faut-il s'inquiéter ?", body: "Les signes qui doivent vous amener à recontacter le cabinet après une intervention." },
      { title: "Après une extraction dentaire", body: "Préserver le caillot sanguin et favoriser une bonne cicatrisation, étape par étape." },
      { title: "Bien se brosser les dents", body: "La méthode, la fréquence et les gestes qui font la différence au quotidien." },
      { title: "Brossettes interdentaires", body: "Comment choisir la bonne taille et nettoyer les espaces que le fil ne suffit pas à atteindre." },
    ],
    // Team: FICTIONAL placeholder people (invented names + illustrative stock
    // portraits). Not real staff — a real client's build would replace these
    // with their own team's names and photos.
    team: [
      { name: "Dr Julien Roche", role: "Chirurgien-dentiste", bio: "Spécialisé en implantologie, formé à la chirurgie guidée et à la régénération osseuse. Il accompagne chaque patient de la première consultation jusqu'au suivi.", photoUrl: "https://images.unsplash.com/photo-1612531386530-97286d97c2d2?w=600&q=80&auto=format&fit=crop" },
      { name: "Camille Laurent", role: "Assistante clinique", bio: "Formée à l'accompagnement des patients anxieux, notamment par l'hypnose. Elle veille à ce que chaque intervention se déroule sereinement.", photoUrl: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&q=80&auto=format&fit=crop" },
      { name: "Léa Marchand", role: "Assistante administrative", bio: "Votre premier contact au cabinet : prise de rendez-vous, questions administratives et suivi de votre dossier — toujours avec le sourire.", photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80&auto=format&fit=crop" },
    ],
    faqs: [
      { q: "Prenez-vous de nouveaux patients ?", a: "Oui — le cabinet accueille de nouveaux patients, avec un premier rendez-vous garanti sous 4 semaines maximum." },
      { q: "J'ai peur du dentiste, est-ce un problème ?", a: "Pas du tout — une anesthésie générale est possible à la Clinique Protestante, et l'équipe est formée à l'accompagnement des patients anxieux." },
      { q: "Comment se passe la première consultation ?", a: "Un premier entretien de 45 minutes pour comprendre vos besoins, suivi d'une proposition de plan de traitement adapté." },
      { q: "Mon dentiste m'a recommandé un implant, dois-je passer par vous ?", a: "Oui — nous collaborons avec de nombreux dentistes qui ne pratiquent pas l'implantologie, pour prendre en charge leurs patients dans les meilleures conditions." },
      { q: "Acceptez-vous ma mutuelle ?", a: "La prise en charge dépend de votre contrat et du soin — le cabinet confirme le remboursement exact lors de votre visite." },
    ],
    aiTone: "chaleureux, rassurant, à l'écoute des patients anxieux",
    aiGreeting: "Bonjour 👋 Bienvenue au Cabinet Nicolas Metay, spécialiste en implantologie à Lyon Monplaisir. Comment puis-je vous aider ?",
    isDemo: true,
    demoContactUrl: "https://servolia.com/call",
    status: "published",
  },
  {
    // AESTHETIC SHOWCASE — the rung-2 sales asset (and the pay-per-booking
    // pilot niche). Same rules as demo-metay: a FICTIONAL clinic ("Institut
    // Luméa"), invented team names on illustrative stock portraits, no real
    // prices, no medical claims, no invented before/after results. Social
    // icons route back to Servolia. A real client's build replaces all of it.
    slug: "demo-lumea",
    businessName: "Institut Luméa",
    niche: "aesthetic",
    language: "fr",
    accent: "#A16A8F",
    city: "Lyon",
    country: "France",
    address: "12 Rue Gasparin, 69002 Lyon",
    phone: "04 72 40 22 22",
    email: "contact@institut-lumea.fr",
    hours: "Mar–Sam, 10h00–19h00 (nocturne le jeudi jusqu'à 21h)",
    tagline: "Médecine esthétique douce · Lyon Presqu'île",
    expandedHeader: true,
    multiPage: true,
    socialLinks: [
      { platform: "instagram", url: "https://servolia.com" },
      { platform: "facebook", url: "https://servolia.com" },
      { platform: "tiktok", url: "https://servolia.com" },
    ],
    heroImageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1600&q=80&auto=format&fit=crop",
    heroImages: [
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1600&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=1600&q=80&auto=format&fit=crop",
    ],
    pageBanners: {
      cabinet: [
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1595476108010-b4d1f102b3b1?w=1600&q=80&auto=format&fit=crop",
      ],
      expertise: [
        "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=1600&q=80&auto=format&fit=crop",
      ],
      conseils: [
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1600&q=80&auto=format&fit=crop",
      ],
    },
    heroHeadline: "Une peau lumineuse, sans transformation.",
    heroSub: "Institut de médecine esthétique douce en Presqu'île de Lyon. Notre assistante répond à vos questions en toute discrétion et réserve votre bilan — même à 21h un dimanche.",
    about: "Luméa défend une esthétique du naturel : révéler votre éclat sans jamais transformer votre visage. Bilan de peau approfondi avant tout soin, protocoles peu invasifs, et un accompagnement discret et sans jugement — du premier échange jusqu'au suivi entre les séances.",
    stats: [
      { value: "Bilan", label: "systématique avant tout soin" },
      { value: "0", label: "vente à chaud — jamais" },
      { value: "48h", label: "réponse garantie à toute demande" },
      { value: "100%", label: "cabines privées" },
    ],
    highlights: [
      {
        title: "L'épilation laser, en toute confiance",
        body: "Un protocole personnalisé selon votre phototype, établi lors d'un bilan préalable offert. Matériel médical récent et cabines privées pour un parcours discret du début à la fin.",
        imageUrl: "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "En savoir plus",
      },
      {
        title: "Le soin du visage, version sur-mesure",
        body: "HydraFacial, peelings et microneedling — jamais de protocole standard : chaque plan de soin part de votre bilan de peau et de votre quotidien réel.",
        imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "En savoir plus",
      },
      {
        title: "La discrétion comme principe",
        body: "Cabines privées, informations confidentielles, et une assistante en ligne qui répond à vos questions sans que vous ayez à les poser à voix haute.",
        imageUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "Voir notre approche",
      },
    ],
    expertiseIntro: "Le naturel comme résultat, la méthode comme garantie. Un parcours en trois temps, pensé pour que vous ne réserviez jamais un soin dont vous n'êtes pas sûre.",
    expertise: [
      {
        eyebrow: "La méthode Luméa",
        title: "Le bilan avant tout",
        body: "Aucun soin n'est vendu lors d'un premier rendez-vous. Le bilan évalue votre peau, vos objectifs et votre calendrier réel — c'est lui qui décide du plan, pas l'inverse.",
        bullets: [
          "Bilan de peau approfondi en cabine privée",
          "Plan de soin écrit, avec devis détaillé",
          "Un temps de réflexion assumé — jamais de décision le jour même",
        ],
        imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&q=80&auto=format&fit=crop",
      },
      {
        eyebrow: "Exigence & sécurité",
        title: "Des protocoles peu invasifs, rigoureusement encadrés",
        body: "Des soins choisis pour un résultat naturel et une éviction sociale minimale, réalisés avec du matériel à usage unique ou stérilisé entre chaque cliente.",
        bullets: [
          "Protocoles personnalisés par phototype et type de peau",
          "Matériel médical récent, traçabilité complète",
          "Suivi entre les séances via votre assistante en ligne",
        ],
        imageUrl: "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=80&auto=format&fit=crop",
      },
    ],
    solutions: [
      { title: "Éclat du teint", body: "HydraFacial et peelings doux pour une peau visiblement plus lumineuse, sans éviction sociale." },
      { title: "Grain de peau & cicatrices", body: "Microneedling et protocoles progressifs pour lisser le grain de peau à votre rythme." },
      { title: "Épilation durable", body: "Laser adapté à votre phototype, planifié sur un calendrier réaliste établi au bilan." },
      { title: "Fermeté & contours", body: "Remodelage corporel non invasif, pensé en plan de séances avec objectifs mesurables." },
      { title: "Peaux sensibles", body: "Des protocoles spécifiquement calibrés pour les peaux réactives, testés en douceur." },
      { title: "Je ne sais pas par où commencer", body: "Le bilan de peau est fait pour ça — on part de vous, pas d'un catalogue de soins." },
    ],
    process: [
      { meta: "45 min", title: "Bilan de peau", body: "En cabine privée : votre peau, vos objectifs, votre quotidien — et zéro soin vendu ce jour-là." },
      { meta: "Sous 48h", title: "Plan personnalisé", body: "Un plan de soin écrit avec devis détaillé, à lire tranquillement chez vous." },
      { meta: "À votre rythme", title: "Soins & suivi", body: "Les séances s'enchaînent selon votre calendrier, avec conseils d'entretien entre chacune." },
    ],
    services: [
      { name: "Bilan de peau", description: "Le point de départ de tout : 45 minutes en cabine privée pour évaluer votre peau et vos objectifs." },
      { name: "HydraFacial", description: "Nettoyage profond, exfoliation et hydratation en un seul soin, sans éviction sociale." },
      { name: "Peeling du visage", description: "Des peelings doux à moyens, choisis selon votre type de peau et la saison." },
      { name: "Microneedling", description: "Stimulation naturelle du renouvellement cutané, en protocole progressif." },
      { name: "Épilation laser", description: "Protocole personnalisé par phototype, établi lors d'un bilan préalable." },
      { name: "Remodelage corporel", description: "Techniques non invasives, planifiées en séances avec objectifs définis ensemble." },
    ],
    whyUs: [
      "Un bilan systématique avant tout soin — jamais de vente à chaud",
      "Des protocoles peu invasifs pour un résultat naturel",
      "Cabines privées et discrétion totale, de la demande au suivi",
      "Un plan de soin écrit avec devis — zéro surprise",
      "Une assistante en ligne qui répond même le soir et le week-end",
    ],
    values: [
      { title: "Le naturel comme résultat", body: "Notre réussite, c'est qu'on vous dise « tu as bonne mine », pas « qu'est-ce que tu as fait ? »." },
      { title: "Jamais de vente à chaud", body: "Aucun soin n'est réservé lors du premier bilan — vous décidez chez vous, avec le devis écrit sous les yeux." },
      { title: "Une hygiène irréprochable", body: "Matériel à usage unique ou stérilisé entre chaque cliente, protocoles contrôlés et traçabilité complète." },
      { title: "La discrétion, toujours", body: "Cabines privées, données confidentielles, et une équipe formée à l'accueil sans jugement." },
    ],
    advice: [
      { title: "Avant votre rendez-vous", body: "Soleil, rétinoïdes, anticoagulants : ce qu'il faut éviter dans les jours qui précèdent la plupart des soins." },
      { title: "Après un laser ou un peeling", body: "Protection solaire et gestes adaptés pour préserver le résultat et éviter les irritations." },
      { title: "Après un microneedling", body: "Les 48 premières heures : hydratation, maquillage et exposition — les bons réflexes." },
      { title: "Construire sa routine quotidienne", body: "Les bases qui prolongent les résultats obtenus en institut, entre les séances." },
      { title: "L'éviction sociale, concrètement", body: "À quoi s'attendre et comment s'organiser après chaque type de soin." },
      { title: "Quand nous recontacter", body: "Les signes qui doivent vous amener à écrire ou appeler l'institut après un soin." },
    ],
    // Team: FICTIONAL placeholder people (invented names + illustrative stock
    // portraits) — same rule as demo-metay.
    team: [
      { name: "Dr Élise Fontanel", role: "Médecin esthétique", bio: "Formée à la médecine esthétique douce, elle défend un principe simple : le meilleur soin est celui qu'on ne remarque pas. Elle réalise tous les bilans elle-même.", photoUrl: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&q=80&auto=format&fit=crop" },
      { name: "Sarah Benali", role: "Praticienne laser & soins", bio: "Spécialiste des protocoles laser par phototype et des soins du visage. Elle assure aussi le suivi entre vos séances.", photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80&auto=format&fit=crop" },
      { name: "Chloé Vasseur", role: "Responsable accueil", bio: "Votre premier contact à l'institut : rendez-vous, questions pratiques et devis — toujours en toute discrétion.", photoUrl: "https://images.unsplash.com/photo-1612531386530-97286d97c2d2?w=600&q=80&auto=format&fit=crop" },
    ],
    faqs: [
      { q: "La première visite est-elle un soin ou un bilan ?", a: "Un bilan — 45 minutes en cabine privée pour évaluer votre peau et vos objectifs. Aucun soin n'est réservé ce jour-là : vous recevez un plan écrit sous 48h et décidez tranquillement." },
      { q: "Combien de séances seront nécessaires ?", a: "Cela dépend du soin, de votre peau et de vos objectifs — le plan personnalisé remis après le bilan vous donne un calendrier réaliste, jamais un chiffre générique." },
      { q: "Les soins sont-ils douloureux ?", a: "La plupart de nos protocoles sont peu invasifs, avec peu ou pas d'éviction sociale. L'assistante peut vous détailler ce à quoi vous attendre pour un soin précis." },
      { q: "Est-ce discret ?", a: "Totalement : cabines privées, informations confidentielles, et vous pouvez poser toutes vos questions à l'assistante en ligne sans en parler à personne." },
      { q: "Proposez-vous des facilités de paiement ?", a: "Pour les plans en plusieurs séances, un règlement séance par séance ou échelonné est généralement possible — les modalités sont confirmées avec votre devis." },
    ],
    practicalInfo: [
      { title: "Consultation privée & discrétion", body: "Chaque bilan se déroule en cabine privée, et vos informations restent strictement confidentielles." },
      { title: "Moyens de paiement", body: "Carte bancaire et espèces. Pour les plans en plusieurs séances, un règlement séance par séance ou échelonné est généralement possible — confirmé avec votre devis." },
      { title: "Accès & stationnement", body: "En Presqu'île, à 3 minutes du métro A (Bellecour). Parkings LPA Bellecour et République à proximité immédiate." },
      { title: "Votre premier rendez-vous", body: "Venez si possible sans maquillage pour un bilan de peau précis, et apportez la liste des produits que vous utilisez au quotidien." },
    ],
    aiTone: "chaleureux, discret, sans jugement",
    aiGreeting: "Bonjour 👋 Bienvenue à l'Institut Luméa. Souhaitez-vous réserver un bilan de peau, ou avez-vous une question sur un soin ? Je vous réponds en toute discrétion.",
    isDemo: true,
    demoContactUrl: "https://servolia.com/call",
    status: "published",
  },
  {
    // HOME-SERVICES SHOWCASE — completes the demo trio (dental / aesthetic /
    // artisan). Same rules as the others: a FICTIONAL business ("Bardin
    // Plomberie & Chauffage"), invented team names on illustrative stock
    // portraits, no real prices, no invented review counts. Social icons
    // route back to Servolia. A real client's build replaces all of it.
    slug: "demo-bardin",
    businessName: "Bardin Plomberie & Chauffage",
    niche: "home-services",
    language: "fr",
    accent: "#C05621",
    city: "Villeurbanne",
    country: "France",
    address: "27 Rue Anatole France, 69100 Villeurbanne",
    phone: "04 78 85 30 30",
    email: "contact@bardin-plomberie.fr",
    hours: "Lun–Ven, 8h00–18h30 · Urgences 7j/7",
    tagline: "Plombier-chauffagiste · Villeurbanne & Lyon Est",
    expandedHeader: true,
    multiPage: true,
    socialLinks: [
      { platform: "facebook", url: "https://servolia.com" },
      { platform: "instagram", url: "https://servolia.com" },
    ],
    heroImageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1600&q=80&auto=format&fit=crop",
    heroImages: [
      "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1600&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&q=80&auto=format&fit=crop",
    ],
    pageBanners: {
      cabinet: [
        "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1600&q=80&auto=format&fit=crop",
      ],
      expertise: [
        "https://images.unsplash.com/photo-1621905252472-e8de7d8b9c66?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1600&q=80&auto=format&fit=crop",
      ],
      conseils: [
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1600&q=80&auto=format&fit=crop",
      ],
    },
    heroHeadline: "Un plombier qui décroche. Même quand il est sur un chantier.",
    heroSub: "Plombier-chauffagiste à Villeurbanne et Lyon Est. Notre assistant répond à votre demande en quelques secondes, qualifie l'urgence et planifie l'intervention — pendant que l'équipe travaille.",
    about: "Bardin Plomberie & Chauffage intervient à Villeurbanne et dans l'Est lyonnais pour le dépannage, l'installation et l'entretien : fuites, chauffe-eau, chaudières, sanitaires et rénovation de salles de bain. Une entreprise familiale qui tient à deux choses : un devis écrit avant chaque intervention, et un chantier laissé propre.",
    stats: [
      { value: "7j/7", label: "urgences fuites & pannes" },
      { value: "Devis", label: "écrit avant toute intervention" },
      { value: "0", label: "frais surprise le jour J" },
      { value: "Est", label: "lyonnais couvert en entier" },
    ],
    highlights: [
      {
        title: "L'urgence, traitée comme une urgence",
        body: "Fuite, panne de chauffe-eau, chaudière en rade : l'assistant qualifie la gravité immédiatement et vous oriente vers le créneau du jour — ou vers les premiers gestes de sécurité en attendant.",
        imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "En savoir plus",
      },
      {
        title: "Le devis d'abord, toujours",
        body: "Envoyez des photos du problème via l'assistant : l'équipe chiffre plus vite et plus juste. Le devis est écrit, détaillé, et rien ne démarre sans votre accord.",
        imageUrl: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "En savoir plus",
      },
      {
        title: "Chauffage : installation & entretien",
        body: "Chaudières, chauffe-eau, radiateurs — installation, remplacement et contrats d'entretien annuels pour éviter la panne de janvier.",
        imageUrl: "https://images.unsplash.com/photo-1621905252472-e8de7d8b9c66?w=1200&q=80&auto=format&fit=crop",
        ctaLabel: "Voir notre expertise",
      },
    ],
    expertiseIntro: "Du dépannage du dimanche soir à la rénovation complète de salle de bain — une seule équipe, un seul interlocuteur, un devis écrit à chaque fois.",
    expertise: [
      {
        eyebrow: "Réactivité",
        title: "Le dépannage, notre quotidien",
        body: "Fuites, canalisations bouchées, chauffe-eau en panne : l'essentiel de notre activité, traité avec des créneaux d'urgence quotidiens et un camion équipé pour réparer du premier coup.",
        bullets: [
          "Créneaux d'urgence réservés chaque jour, 7j/7",
          "Diagnostic par photos via l'assistant pour arriver avec la bonne pièce",
          "Réparation durable privilégiée sur le remplacement systématique",
        ],
        imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&q=80&auto=format&fit=crop",
      },
      {
        eyebrow: "Confort & durabilité",
        title: "Chauffage et rénovation, en confiance",
        body: "Installation et remplacement de chaudières et chauffe-eau, contrats d'entretien annuels, et rénovation complète de salles de bain — planifiés, chiffrés et tenus dans les délais annoncés.",
        bullets: [
          "Devis écrit et détaillé avant chaque chantier",
          "Techniciens agréés et assurés pour chaque domaine",
          "Chantier protégé et laissé propre, à chaque fois",
        ],
        imageUrl: "https://images.unsplash.com/photo-1621905252472-e8de7d8b9c66?w=1200&q=80&auto=format&fit=crop",
      },
    ],
    solutions: [
      { title: "Fuite d'eau", body: "Localisation et réparation, avec les premiers gestes de sécurité expliqués dès votre message." },
      { title: "Chauffe-eau & cumulus", body: "Dépannage, remplacement et conseil sur la bonne capacité pour votre foyer." },
      { title: "Chaudière", body: "Panne, entretien annuel ou remplacement — avec un calendrier clair." },
      { title: "Canalisations bouchées", body: "Débouchage et inspection pour traiter la cause, pas seulement le symptôme." },
      { title: "Sanitaires", body: "Installation et remplacement de WC, robinetterie, éviers et douches." },
      { title: "Rénovation de salle de bain", body: "Du plan au dernier joint, avec un seul interlocuteur du début à la fin." },
    ],
    process: [
      { meta: "2 min", title: "Décrivez le problème", body: "Par message, avec des photos si possible — l'assistant signale immédiatement toute urgence." },
      { meta: "Sous 24h", title: "Devis écrit", body: "Un chiffrage clair et détaillé, établi d'après vos photos ou une visite — sans frais surprise." },
      { meta: "Au créneau annoncé", title: "Intervention", body: "L'équipe arrive équipée pour réparer du premier coup, et laisse le chantier propre." },
    ],
    services: [
      { name: "Dépannage plomberie d'urgence", description: "Fuites, ruptures, engorgements — créneaux réservés chaque jour, 7j/7." },
      { name: "Chauffe-eau & cumulus", description: "Dépannage, remplacement et installation, toutes énergies." },
      { name: "Chaudières", description: "Installation, remplacement et contrats d'entretien annuels." },
      { name: "Débouchage canalisations", description: "Débouchage et inspection caméra pour traiter la cause." },
      { name: "Robinetterie & sanitaires", description: "Installation et remplacement de WC, robinets, éviers, douches." },
      { name: "Rénovation salle de bain", description: "Rénovation complète, du plan à la pose, avec un seul interlocuteur." },
    ],
    whyUs: [
      "Des créneaux d'urgence réservés chaque jour, 7j/7",
      "Devis écrit avant toute intervention — zéro frais surprise",
      "Diagnostic par photos : on arrive avec la bonne pièce",
      "Techniciens agréés et assurés",
      "Une entreprise familiale de Villeurbanne, pas une plateforme",
    ],
    values: [
      { title: "Le devis avant les travaux", body: "Un prix écrit et détaillé avant toute intervention — jamais de surprise sur la facture." },
      { title: "La réparation d'abord", body: "Quand une réparation durable est possible, on répare — on ne pousse pas au remplacement." },
      { title: "Un chantier propre", body: "Sols protégés, gravats évacués, chantier laissé comme on l'a trouvé — en mieux." },
      { title: "Joignables, vraiment", body: "L'assistant répond à toute heure, qualifie l'urgence et vous donne l'heure d'arrivée — même quand l'équipe est sur un chantier." },
    ],
    advice: [
      { title: "Fuite d'eau : les premiers réflexes", body: "Couper l'arrivée d'eau, protéger le sol, photographier — les bons gestes avant notre arrivée." },
      { title: "Odeur de gaz : que faire", body: "Ni flamme ni interrupteur — aérez, sortez, appelez les secours d'abord. Puis nous appelez pour la suite." },
      { title: "Entretenir son chauffe-eau", body: "Les vérifications simples qui rallongent sa durée de vie et évitent la panne d'eau chaude." },
      { title: "Préparer l'hiver", body: "Purge des radiateurs, entretien chaudière, protection des canalisations extérieures — la check-list d'automne." },
      { title: "Obtenir un devis précis", body: "Les photos et informations qui permettent à l'équipe de chiffrer juste, du premier coup." },
      { title: "Réparer ou remplacer ?", body: "Les signes qui indiquent qu'un remplacement s'impose vraiment — et ceux qui ne le justifient pas." },
    ],
    // Team: FICTIONAL placeholder people (invented names + illustrative stock
    // portraits) — same rule as the other demos.
    team: [
      { name: "Marc Bardin", role: "Gérant · plombier-chauffagiste", bio: "Vingt ans de métier dans l'Est lyonnais. Il établit chaque devis lui-même et intervient sur les chantiers les plus techniques.", photoUrl: "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=600&q=80&auto=format&fit=crop" },
      { name: "Karim Haddad", role: "Technicien chauffage", bio: "Spécialiste chaudières et chauffe-eau, il assure les dépannages urgents et les entretiens annuels.", photoUrl: "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=600&q=80&auto=format&fit=crop" },
      { name: "Julie Perrin", role: "Planification & suivi", bio: "Elle coordonne les interventions et vous tient informé de l'heure d'arrivée — votre contact du devis à la fin du chantier.", photoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&q=80&auto=format&fit=crop" },
    ],
    faqs: [
      { q: "Intervenez-vous en urgence le week-end ?", a: "Oui — des créneaux d'urgence sont réservés chaque jour, 7j/7, pour les fuites, pannes de chauffe-eau et chaudières. Écrivez à l'assistant : il qualifie l'urgence et vous donne le créneau le plus proche." },
      { q: "Combien coûte une intervention ?", a: "Chaque chantier est différent — l'équipe chiffre d'après vos photos ou une visite, et vous recevez un devis écrit avant toute intervention. Jamais d'estimation à l'aveugle, jamais de frais surprise." },
      { q: "Couvrez-vous mon adresse ?", a: "Nous intervenons à Villeurbanne et dans l'Est lyonnais. Partagez votre adresse à l'assistant : il confirme en quelques secondes." },
      { q: "Êtes-vous assurés ?", a: "Oui — techniciens agréés et pleinement assurés pour chaque type d'intervention réalisé." },
      { q: "Proposez-vous des contrats d'entretien ?", a: "Oui — entretien annuel de chaudière et de chauffe-eau, avec rappel automatique à l'échéance. Demandez à l'assistant." },
    ],
    practicalInfo: [
      { title: "Devis & tarifs", body: "Un devis écrit avant toute intervention — confirmé d'après vos photos ou une visite. Aucun frais surprise le jour J." },
      { title: "Moyens de paiement", body: "Carte bancaire, virement et chèques. Les modalités exactes figurent sur votre devis écrit." },
      { title: "Zone d'intervention", body: "Villeurbanne et l'Est lyonnais (Bron, Vaulx-en-Velin, Décines, Croix-Luizet). Partagez votre adresse à l'assistant pour confirmation immédiate." },
      { title: "En cas d'urgence, les premiers réflexes", body: "Fuite : coupez l'arrivée d'eau. Danger électrique : coupez au tableau. Odeur de gaz : ni flamme ni interrupteur — aérez, sortez, appelez d'abord les secours." },
    ],
    emergencyNote: "Une urgence ? Des créneaux le jour même sont réservés aux fuites, pannes et dépannages urgents — 7j/7.",
    aiTone: "direct, fiable, rassurant dans l'urgence",
    aiGreeting: "Bonjour 👋 Ici l'assistant de Bardin Plomberie & Chauffage. Avez-vous une urgence (fuite, panne), ou souhaitez-vous un devis ?",
    isDemo: true,
    demoContactUrl: "https://servolia.com/call",
    status: "published",
  },
];

/* ───────────────────────── loaders ───────────────────────── */

interface ClientSiteRow {
  slug: string;
  config: ClientSiteConfig;
  status: string;
}

/** Load a single client site by slug — Supabase first, bundled demo as fallback. */
export async function getClientSite(slug: string): Promise<ClientSiteConfig | undefined> {
  const clean = slugify(slug);
  const db = supabaseAdmin();
  if (db) {
    try {
      const { data } = await db
        .from("client_sites")
        .select("slug, config, status")
        .eq("slug", clean)
        .maybeSingle();
      const row = data as ClientSiteRow | null;
      if (row?.config) return { ...row.config, slug: row.slug, status: (row.status as ClientSiteConfig["status"]) ?? "published" };
    } catch {
      /* table may not exist yet — fall through to demo */
    }
  }
  return DEMO_SITES.find((s) => s.slug === clean);
}

/** List all client sites for the CRM. */
export async function listClientSites(): Promise<ClientSiteConfig[]> {
  const db = supabaseAdmin();
  if (db) {
    try {
      const { data } = await db
        .from("client_sites")
        .select("slug, config, status")
        .order("created_at", { ascending: false });
      const rows = (data as ClientSiteRow[] | null) ?? [];
      if (rows.length) {
        return rows.map((r) => ({ ...r.config, slug: r.slug, status: (r.status as ClientSiteConfig["status"]) ?? "published" }));
      }
    } catch {
      /* fall through */
    }
  }
  return DEMO_SITES;
}

export const DEMO_CLIENT_SITES = DEMO_SITES;
