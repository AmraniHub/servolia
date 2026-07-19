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
import { isDentalNiche, DENTAL_WHY_US, DENTAL_FAQS, DENTAL_AI_TONE, dentalAiGreeting } from "@/lib/niches/dental";

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

export interface ClientSiteConfig {
  slug: string;
  businessName: string;
  niche: string; // dental, aesthetic, real-estate, home-services, law-firm, ...
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
  /** Full-bleed "feature story" cards — one photo + headline per differentiator
   * (a technology, a service, a reassurance point). Purely additive; renders
   * nothing when omitted. Never populate with a stock photo captioned as a
   * specific named person — only use client-supplied photos for people. */
  highlights?: ClientHighlight[];
  /** Humanizing team section. Only ever populated with a real client's own
   * photos of their real staff — never a stock photo under a real name. */
  team?: TeamMember[];

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

  // Business economics & growth loop
  avgTreatmentValue?: number; // avg € per new client — used in the monthly ROI report
  googleReviewUrl?: string; // "leave us a review" link (g.page/r/...)
  metaPixelId?: string; // client's own Meta pixel — CAPI Lead events fire on bookings
  metaCapiToken?: string; // client's CAPI access token (paired with metaPixelId)

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

  // Servolia's beachhead niche (docs/PRINCIPLES.md P2) gets a real domain-grounded
  // default instead of generic filler — see src/lib/niches/dental.ts. Every other
  // niche keeps the fully generic fallback until it gets its own template.
  const isDental = isDentalNiche(niche);

  const whyUs = isDental
    ? DENTAL_WHY_US[lang]
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

  return {
    slug: slugify(businessName),
    businessName,
    niche,
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
    heroImageUrl: str(d.heroImageUrl),
    heroHeadline,
    heroSub,
    about,
    services,
    whyUs,
    faqs: isDental ? DENTAL_FAQS[lang] : [],
    aiTone: isDental ? DENTAL_AI_TONE[lang] : (lang === "fr" ? "chaleureux et professionnel" : "warm and professional"),
    aiGreeting: isDental
      ? dentalAiGreeting(businessName, lang)
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
    // dentairemonplaisir.fr. Every fact below is real; no price is invented.
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
    heroHeadline: "Des implants dentaires, sans l'appréhension.",
    heroSub: "Cabinet spécialisé en implantologie à Lyon Monplaisir. Notre assistant répond à vos questions et prend vos coordonnées à tout moment — jour et nuit.",
    about: "Le Dr Nicolas Metay exerce à Monplaisir depuis 2009 et se consacre à l'implantologie : 15 ans d'expérience, des centaines d'implants posés, et une veille technologique constante (imagerie 3D, chirurgie guidée, empreinte numérique). L'équipe — Nadia, formée à l'hypnose ericksonienne, et Sabrina — accompagne aussi les patients les plus anxieux.",
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
