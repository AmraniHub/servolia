import type { ClientSiteConfig } from "@/lib/clientSites";

/**
 * ASSISTANT BRIEFS KEPT IN CODE — one per hosting client we know.
 *
 * Why in code and not only in the database: a known client's assistant has
 * to be ready the moment their payment lands. The webhook installs the script
 * on their site within a minute of the charge; if the brief lived only in a
 * row somebody had to create first, the first thing a visitor would meet is
 * an assistant that knows nothing about the business it speaks for. Written
 * here, from the client's own website, it is reviewed like any other change
 * and cannot be missing on the day.
 *
 * A row in client_sites with the same slug OVERRIDES this (getClientSite
 * reads the database first). That row is what the client writes through
 * /hosting/assistant, so their corrections win over our first draft.
 *
 * Every fact below is taken from the client's live site or its lead form.
 * Nothing is invented — in particular NO tuition figures, because the site
 * quotes none, and an assistant that names a price the agency never agreed
 * to is worse than one that says "an advisor will confirm".
 */

const EXCELLENCE_AGENCY: ClientSiteConfig = {
  slug: "excellenceagency",
  businessName: "Excellence Agency",
  niche: "study-abroad",
  // The OWNER reads French (see CLIENT_REFS). The assistant speaks all three.
  language: "fr",
  languages: ["ar", "fr", "en"],
  // The site's navy; its second colour is a red that would read as an alert.
  accent: "#16255c",
  city: "Casablanca",
  country: "Morocco",
  address: "Casablanca, Maroc",
  phone: "+212 660 095 616",
  whatsapp: "212660095616",
  email: "Contact@excellencestudyagency.com",
  hours: "Lundi – Samedi : 9h – 19h",
  timezone: "Africa/Casablanca",
  // The site's own registration form, in the language the visitor is on.
  bookingUrl: "https://excellence-agency.org/apply.html",

  assistantOnly: true,
  hostingEmail: "transferhos@gmail.com",
  domains: ["excellence-agency.org", "excellenceagency.ma"],
  // Their WhatsApp button sits bottom-LEFT, so the assistant takes the right.
  widgetPosition: "right",

  heroHeadline: "Réalisez votre rêve et étudiez à l'étranger",
  heroSub: "De la première consultation jusqu'à votre arrivée à l'université — en Lituanie, Russie, Pologne, Espagne et Chine.",
  about:
    "Excellence Agency (ESA) accompagne les étudiants marocains vers les meilleures universités d'Europe et d'Asie : " +
    "plus de cinq ans d'expérience, plus de 500 familles accompagnées, des conseils académiques personnalisés et un suivi " +
    "complet de l'admission jusqu'à l'installation. L'agence aide aussi à obtenir des bourses complètes ou partielles.",
  services: [
    { name: "Admission universitaire", description: "Choix de l'université, dépôt du dossier et admission garantie." },
    { name: "Visa d'études", description: "Préparation complète du dossier de visa et suivi avec l'ambassade, étape par étape." },
    { name: "Logement étudiant", description: "Des options de logement sûres et adaptées près de l'université, dès le premier jour." },
    { name: "Assurance étudiante", description: "Aide à l'obtention de l'assurance santé exigée pour étudier à l'étranger." },
    { name: "Communauté d'étudiants", description: "Mise en relation avec les étudiants marocains déjà sur place." },
    { name: "Accompagnement continu", description: "Une équipe disponible pour répondre aux questions et suivre le dossier." },
  ],
  whyUs: [
    "Plus de 5 ans d'expérience et plus de 500 familles accompagnées",
    "Consultation gratuite sous 24 heures après l'inscription",
    "Aide aux bourses complètes et partielles",
    "Suivi du visa jusqu'à son obtention, puis accompagnement à l'arrivée",
  ],
  faqs: [
    {
      q: "Quelles destinations proposez-vous ?",
      a: "La Lituanie (la plus demandée : médecine, pharmacie, ingénierie, informatique, coûts modérés, universités reconnues), " +
         "la Russie (médecine, ingénierie, sciences, coûts bas), la Pologne (Union européenne, médecine, pharmacie, business, ingénierie), " +
         "l'Espagne (arts, design, business, tourisme) et la Chine (bourses complètes et partielles, ingénierie, médecine, management). D'autres pays sont possibles selon le profil.",
    },
    {
      q: "Combien coûtent les études ?",
      a: "Les frais dépendent de l'université, de la filière et du pays. L'agence ne communique pas de tarif standard : un conseiller " +
         "établit une estimation précise et gratuite à partir du dossier de l'étudiant (niveau, filière, budget, destination).",
    },
    {
      q: "Comment se passe la première étape ?",
      a: "Inscription gratuite via le formulaire du site (ou par WhatsApp), puis un conseiller spécialisé rappelle sous 24 heures pour évaluer " +
         "le dossier et proposer les meilleures options. Ensuite : admission et visa, puis voyage et installation.",
    },
    {
      q: "Quel niveau faut-il avoir ?",
      a: "L'agence accompagne les élèves en année de baccalauréat, les bacheliers, et les étudiants en licence ou en master. Le niveau exact " +
         "requis dépend de l'université visée — le conseiller le précise lors de la consultation.",
    },
    {
      q: "Quand peut-on commencer ?",
      a: "Les principales rentrées sont septembre et février. Il est conseillé de s'inscrire plusieurs mois à l'avance pour laisser le temps " +
         "à l'admission et au visa.",
    },
    {
      q: "Y a-t-il des bourses ?",
      a: "Oui, l'agence aide à obtenir des bourses complètes ou partielles, notamment en Chine, selon le profil de l'étudiant.",
    },
    {
      q: "Que se passe-t-il après l'arrivée ?",
      a: "L'accompagnement continue sur place : logement, installation, démarrages universitaires, et une communauté d'étudiants marocains dans le même pays.",
    },
  ],
  aiTone: "warm, encouraging and professional — like a caring advisor who has helped hundreds of students",
  greetings: {
    ar: "مرحباً بك في Excellence Agency 👋 أنا هنا لأجيب عن أسئلتك حول الدراسة في الخارج. كيف يمكنني مساعدتك؟",
    fr: "Bienvenue chez Excellence Agency 👋 Je réponds à vos questions sur les études à l'étranger. Comment puis-je vous aider ?",
    en: "Welcome to Excellence Agency 👋 I'm here to answer your questions about studying abroad. How can I help?",
  },
  quickReplies: {
    ar: ["أريد أن أدرس الطب", "ما هي الوجهات المتاحة؟", "كيف أسجّل؟"],
    fr: ["Je veux étudier la médecine", "Quelles destinations ?", "Comment m'inscrire ?"],
    en: ["I want to study medicine", "Which destinations?", "How do I register?"],
  },
  status: "draft",
};

/**
 * A fictitious agency with the same shape, so the study-abroad assistant can
 * be exercised end to end in production — Arabic in, Arabic out, lead
 * captured — without touching a real client's config or paying for it. Demos
 * are always enabled and never notify anyone (isDemo short-circuits both).
 */
const DEMO_STUDY_ABROAD: ClientSiteConfig = {
  ...EXCELLENCE_AGENCY,
  slug: "demo-study-abroad",
  businessName: "Atlas Study",
  isDemo: true,
  assistantOnly: true,
  hostingEmail: undefined,
  domains: [],
  email: undefined,
  phone: undefined,
  whatsapp: undefined,
  bookingUrl: undefined,
  about: "Atlas Study accompagne les étudiants marocains vers des universités en Europe et en Asie, de l'admission à l'installation.",
  greetings: {
    ar: "مرحباً بك في Atlas Study 👋 كيف يمكنني مساعدتك؟",
    fr: "Bienvenue chez Atlas Study 👋 Comment puis-je vous aider ?",
    en: "Welcome to Atlas Study 👋 How can I help?",
  },
  status: "published",
};

export const ASSISTANT_SITES: Record<string, ClientSiteConfig> = {
  [EXCELLENCE_AGENCY.slug]: EXCELLENCE_AGENCY,
  [DEMO_STUDY_ABROAD.slug]: DEMO_STUDY_ABROAD,
};
