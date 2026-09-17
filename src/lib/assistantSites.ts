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
  /* In French, like the rest of this brief: the owner reads French, edits
     this field on his own settings page, and the model follows an
     instruction in any language. Mirrors GoodsCoChina's — ask the three
     things the advisor needs, and never name a figure the agency has not
     agreed to. Tuition is the trap here: the site quotes none, and an
     assistant that invented one would cost him a family. */
  ownerInstructions:
    "Demandez toujours trois choses : la filière souhaitée, le pays visé, et le niveau actuel de l'étudiant " +
    "(année de bac, bachelier, licence ou master). Ce sont les trois réponses dont le conseiller a besoin pour " +
    "évaluer le dossier. Ne donnez JAMAIS de montant : ni frais de scolarité, ni budget total, ni prix de service. " +
    "Dites que cela dépend de l'université, de la filière et du pays, et qu'un conseiller envoie une estimation " +
    "précise et gratuite sous 24 heures après l'inscription. Proposez WhatsApp (+212 660 095 616) pour toute " +
    "question urgente. Quand le budget inquiète l'étudiant, mentionnez que l'agence aide à obtenir des bourses " +
    "complètes ou partielles, notamment en Chine. Rappelez que l'inscription est gratuite et sans engagement.",
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

/**
 * GoodsCoChina — Yiwu sourcing agent, buyers worldwide, English.
 *
 * SHE IS A SERVOLIA HOSTING CLIENT (Website hosting · Complete, since
 * 2026-09-11), which is what makes a Servolia assistant coherent on her
 * site: the servolia.com script tag in her page source belongs to the
 * company that already hosts and bills her.
 *
 * WHY THE ASSISTANT NEVER QUOTES A PRICE OR AN MOQ. Her whole offer is
 * "tell us what you need and we come back with verified factory options,
 * pricing and a timeline — free". The number depends on the factory, the
 * quantity and the destination. An assistant that guessed one would lose
 * her a deal and lose us the client, so it captures the enquiry and
 * promises exactly what her own page promises: options within 24 hours,
 * every factory audited on site before any deposit.
 */
const GOODSCOCHINA: ClientSiteConfig = {
  slug: "goodscochina",
  businessName: "GoodsCoChina",
  niche: "sourcing",
  language: "en",
  // Her buyers are importers and retailers worldwide and her site is
  // English-only; a French or Arabic tab would promise a language she
  // cannot follow up in.
  languages: ["en"],
  // The navy her own stylesheet leads with — the brand probe reads the same.
  accent: "#111c74",
  city: "Yiwu",
  country: "China",
  address: "Yiwu, Zhejiang, China",
  phone: "+86 147 0589 7898",
  whatsapp: "8614705897898",
  email: "info@goodscochina.com",
  hours: "Replies within 24 hours, Monday to Saturday (China time)",
  timezone: "Asia/Shanghai",
  bookingUrl: "https://goodscochina.com/sourcing.html",

  assistantOnly: true,
  hostingEmail: "samiramousa77@hotmail.com",
  domains: ["goodscochina.com"],
  widgetPosition: "right",

  heroHeadline: "Your trusted sourcing partner in China",
  heroSub: "Source quality products, verify reliable factories and deliver with confidence, from China to the world.",
  about:
    "GoodsCoChina (Yiwu GoodsCo International Trade Co., Ltd.) is a sourcing partner based in Yiwu, " +
    "Zhejiang. It helps importers, retailers and e-commerce brands find and verify Chinese factories, " +
    "control quality at every stage and ship worldwide — over 10 years of experience, 1000+ verified " +
    "factories and buyers in 80+ countries.",
  services: [
    { name: "Product sourcing", description: "Tell us the product and we come back with verified factory options, pricing and a timeline — free." },
    { name: "Factory verification and audit", description: "Every factory is audited on site before you pay any deposit." },
    { name: "Quality control", description: "Strict inspection at every stage, with photo and video inspection before anything ships." },
    { name: "Low MOQ orders", description: "Flexible order quantities, so a smaller business can still buy well." },
    { name: "Worldwide delivery", description: "On-time delivery to 80+ countries, shipping arranged end to end." },
    { name: "Ongoing support", description: "Responsive help throughout the order, not only before it." },
  ],
  whyUs: [
    "Over 10 years sourcing from China, 1000+ verified factories",
    "Verified factory options within 48 hours, free of charge",
    "Every factory audited on site before you pay a deposit",
    "Photo and video inspection before anything ships",
    "Buyers served in 80+ countries",
  ],
  faqs: [
    {
      q: "How does sourcing with you work?",
      a: "Four steps: you send the enquiry with your product and requirements, we find and shortlist the best factories, " +
         "we audit the factory before production, and we handle quality control and delivery to your door.",
    },
    {
      q: "How much does it cost?",
      a: "It depends on the product, the quantity and where it ships, so we do not quote a standard price. " +
         "Tell us what you need and the team sends verified factory options with pricing and a timeline within 24 hours — free, with no obligation.",
    },
    {
      q: "What is the minimum order quantity?",
      a: "It varies by factory and product. We work with flexible quantities and will tell you the realistic minimum for your specific item — just ask.",
    },
    {
      q: "How do I know the factory is genuine?",
      a: "Every factory is audited on site before you pay a deposit, and you get photo and video inspection of the goods before anything ships.",
    },
    {
      q: "Which countries do you ship to?",
      a: "Buyers in more than 80 countries. Tell us the destination and we include shipping in the plan we send you.",
    },
    {
      q: "How quickly do you reply?",
      a: "Within 24 hours, and usually sooner. Verified factory options normally come back within 48 hours.",
    },
    {
      q: "Where are you based?",
      a: "Yiwu, Zhejiang, China — the world's largest small-commodities market, which is why we can compare factories quickly.",
    },
  ],
  aiTone: "warm, direct and businesslike — like a trusted sourcing agent who answers plainly",
  ownerInstructions:
    "Always ask what product, roughly what quantity, and which country it ships to — those three answers are what the team needs " +
    "to build a sourcing plan. Never give a unit price, a total, or a minimum order quantity: say it depends on the factory and " +
    "the quantity, and that the team will send verified options with pricing within 24 hours, free. Offer WhatsApp " +
    "(+86 147 0589 7898) for anything urgent. Mention that every factory is audited on site before any deposit — it is the main " +
    "reason buyers choose us.",
  greetings: {
    en: "Welcome to GoodsCoChina 👋 Tell me what you are looking to source and I'll get you verified factory options. How can I help?",
  },
  quickReplies: {
    en: ["I need a sourcing quote", "Can you verify a factory?", "Do you ship to my country?"],
  },
  status: "draft",
};

export const ASSISTANT_SITES: Record<string, ClientSiteConfig> = {
  [EXCELLENCE_AGENCY.slug]: EXCELLENCE_AGENCY,
  [GOODSCOCHINA.slug]: GOODSCOCHINA,
  [DEMO_STUDY_ABROAD.slug]: DEMO_STUDY_ABROAD,
};
