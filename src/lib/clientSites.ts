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

export interface ClientService {
  name: string;
  description?: string;
  price?: string; // e.g. "From €90" — optional
}

export interface ClientFaq {
  q: string;
  a: string;
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

  const whyUs =
    lang === "fr"
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
    bookingUrl: str(d.bookingUrl) ?? str(d.doctolibUrl),
    logoUrl: str(d.logoUrl),
    heroHeadline,
    heroSub,
    about,
    services,
    whyUs,
    faqs: [],
    aiTone: lang === "fr" ? "chaleureux et professionnel" : "warm and professional",
    aiGreeting:
      lang === "fr"
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
