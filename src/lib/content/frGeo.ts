/**
 * FR Geo-SEO surface — city × niche landing pages at /fr/[niche]/[ville].
 *
 * Two intents at once:
 *   1. Geo-SEO — rank on google.fr for queries like "site web dentiste Lyon",
 *      "chatbot clinique esthétique Paris" — high-intent local searches from
 *      clinic owners.
 *   2. GEO (generative engine optimization) — the pages are structured with
 *      FAQPage JSON-LD and canonical Q&A blocks so ChatGPT / Perplexity /
 *      Google's AI overviews can lift Servolia into answers about local
 *      clinic tech providers.
 *
 * KEEP THIS FILE SMALL AND HONEST. Every city gets ONE genuine local hook
 * (population, region, a real local platform note) — no invented case studies,
 * no fake local review counts. Google penalises near-duplicate "doorway" pages
 * and LLMs downweight content that reads as templated filler.
 *
 * SLUGS NOTE: niche slugs are SINGULAR (dentiste, clinique-esthetique) to
 * avoid colliding with the existing static /fr/dentistes/ route (plural).
 *
 * PRICES: interpolated from src/lib/pricing.ts, never typed as literals. These
 * answers are also served as FAQPage JSON-LD, so a stale number here is a
 * stale number inside Google and LLM overviews for months.
 */
import { SETUP_PLAN, PLANS, PAY_PER_BOOKING } from "@/lib/pricing";

export interface FrCity {
  slug: string;
  name: string;              // "Lyon"
  nameWithArticle: string;   // "à Lyon" / "au Havre" — for natural sentences
  region: string;            // "Auvergne-Rhône-Alpes"
  population: number;        // rough, most recent census
  hook: string;              // one FR sentence — local fact worth reading
}

export interface FrGeoNiche {
  slug: string;              // singular, URL-safe
  labelSingular: string;     // "dentiste"
  labelPlural: string;       // "cabinets dentaires"
  clientNoun: string;        // "patients"
  demoUrl: string;           // the niche's live showcase demo — the strongest element on the page
  problemSlug: string;       // "les patients ne peuvent pas prendre rendez-vous en dehors des horaires"
  seoTitle: (city: string) => string;
  seoDesc: (city: string) => string;
  h1: (city: string) => string;
  subline: (city: string) => string;
  faqs: (city: string) => { q: string; a: string }[];
}

/* ───────────────────────── cities ───────────────────────── */
/** 15 largest FR clinic-dense metros. Order matters for prioritised sitemap output. */
export const FR_CITIES: FrCity[] = [
  { slug: "paris", name: "Paris", nameWithArticle: "à Paris", region: "Île-de-France", population: 2100000, hook: "Plus de 6 000 cabinets dentaires et 1 200 cliniques esthétiques recensés — l'attention en ligne y est plus coûteuse qu'ailleurs." },
  { slug: "marseille", name: "Marseille", nameWithArticle: "à Marseille", region: "Provence-Alpes-Côte d'Azur", population: 870000, hook: "Deuxième ville de France, forte demande esthétique tirée par la clientèle méditerranéenne." },
  { slug: "lyon", name: "Lyon", nameWithArticle: "à Lyon", region: "Auvergne-Rhône-Alpes", population: 520000, hook: "Densité médicale élevée dans le 6e et le 2e — la différenciation en ligne fait toute la différence." },
  { slug: "toulouse", name: "Toulouse", nameWithArticle: "à Toulouse", region: "Occitanie", population: 500000, hook: "Métropole étudiante et technologique, cabinets ouverts à l'automatisation." },
  { slug: "nice", name: "Nice", nameWithArticle: "à Nice", region: "Provence-Alpes-Côte d'Azur", population: 340000, hook: "Clientèle internationale — un assistant IA multilingue capte les demandes anglophones et italophones qui bouncaient." },
  { slug: "nantes", name: "Nantes", nameWithArticle: "à Nantes", region: "Pays de la Loire", population: 320000, hook: "Marché en croissance, opportunité pour les cabinets qui prennent l'avance digitale les premiers." },
  { slug: "montpellier", name: "Montpellier", nameWithArticle: "à Montpellier", region: "Occitanie", population: 300000, hook: "Ville universitaire et médicale — recherches Google très locales, jusqu'au quartier." },
  { slug: "strasbourg", name: "Strasbourg", nameWithArticle: "à Strasbourg", region: "Grand Est", population: 290000, hook: "Bilinguisme fréquent (français / allemand) — l'IA gère les deux langues sans surcoût." },
  { slug: "bordeaux", name: "Bordeaux", nameWithArticle: "à Bordeaux", region: "Nouvelle-Aquitaine", population: 260000, hook: "Ville en forte croissance depuis 2015, marché premium sur l'esthétique et le dentaire." },
  { slug: "lille", name: "Lille", nameWithArticle: "à Lille", region: "Hauts-de-France", population: 235000, hook: "Métropole transfrontalière — patients français et belges, un système bilingue est un vrai avantage." },
  { slug: "rennes", name: "Rennes", nameWithArticle: "à Rennes", region: "Bretagne", population: 220000, hook: "Bassin étudiant important, forte demande de créneaux tardifs et week-end." },
  { slug: "reims", name: "Reims", nameWithArticle: "à Reims", region: "Grand Est", population: 180000, hook: "Cabinet de proximité — la réactivité en dehors des heures fait souvent la différence sur les avis Google." },
  { slug: "saint-etienne", name: "Saint-Étienne", nameWithArticle: "à Saint-Étienne", region: "Auvergne-Rhône-Alpes", population: 170000, hook: "Marché moins saturé que Lyon voisin — coût d'acquisition plus bas pour les cabinets qui structurent leur présence en ligne." },
  { slug: "toulon", name: "Toulon", nameWithArticle: "à Toulon", region: "Provence-Alpes-Côte d'Azur", population: 170000, hook: "Bassin méditerranéen, forte saisonnalité — la réservation automatisée absorbe les pics estivaux sans embaucher." },
  { slug: "grenoble", name: "Grenoble", nameWithArticle: "à Grenoble", region: "Auvergne-Rhône-Alpes", population: 160000, hook: "Écosystème tech avancé — les patients attendent une prise de rendez-vous en ligne fluide, comme sur Doctolib." },
];

export const FR_CITY_SLUGS = FR_CITIES.map((c) => c.slug);
export const FR_CITY_MAP: Record<string, FrCity> = Object.fromEntries(FR_CITIES.map((c) => [c.slug, c]));

/* ───────────────────────── niches ───────────────────────── */
/** Niches available for city pages. Slugs are SINGULAR to avoid /fr/dentistes/ collision. */
export const FR_GEO_NICHES: FrGeoNiche[] = [
  {
    slug: "dentiste",
    demoUrl: "/sites/demo-metay",
    labelSingular: "cabinet dentaire",
    labelPlural: "cabinets dentaires",
    clientNoun: "patients",
    problemSlug: "les patients qui appellent en dehors des heures d'ouverture raccrochent et prennent rendez-vous ailleurs",
    seoTitle: (c) => `Site web + IA pour cabinet dentaire ${c} — Servolia`,
    seoDesc: (c) => `Site web de cabinet dentaire ${c} avec assistante IA qui répond aux patients 24 h/24 et prend leurs rendez-vous. Livré en 7 jours, prix fixe, garantie écrite.`,
    h1: (c) => `Site web + réceptionniste IA pour cabinet dentaire ${c}.`,
    subline: (c) => `Un site rapide, un assistant IA formé sur vos soins, et un système de prise de rendez-vous. Pensé pour les cabinets dentaires ${c}. Livraison en 7 jours.`,
    faqs: (c) => [
      { q: `Combien de temps prend la livraison d'un site pour un cabinet dentaire ${c} ?`,
        a: `Sept jours ouvrés à partir de la validation du devis, prix ferme et livraison garantie par écrit. Le formulaire d'intake dure environ 8 minutes, puis nous vous livrons un brouillon en Loom à valider avant la mise en ligne.` },
      { q: `L'IA parle-t-elle uniquement français ?`,
        a: `Français et anglais, nativement — les deux langues sont incluses sans surcoût. Utile ${c} pour les patients internationaux et les expatriés.` },
      { q: `Est-ce compatible avec Doctolib ou mon logiciel de cabinet ?`,
        a: `Oui — le site vit à côté de votre agenda. L'IA capture la demande, note le motif et les coordonnées, et vous laisse valider dans votre logiciel habituel. Nous ne remplaçons pas Doctolib, nous le nourrissons.` },
      { q: `Que se passe-t-il si un patient pose une question médicale ?`,
        a: `L'assistante répond aux questions administratives (soins proposés, tarifs de base, horaires, préparation à un RDV) mais renvoie systématiquement vers un praticien pour tout diagnostic ou avis médical — RGPD-friendly et conforme au code de déontologie.` },
      { q: `Combien coûte un site + assistante IA pour cabinet dentaire ${c} ?`,
        a: `Une mise en place unique de ${SETUP_PLAN.totalEur} € (site construit, IA entraînée sur vos soins, tout mis en ligne), puis une formule mensuelle : ${PLANS.essentiel.nameFr} ${PLANS.essentiel.monthlyEur} €/mois, ${PLANS.croissance.nameFr} ${PLANS.croissance.monthlyEur} €/mois (la plus choisie ${c} — elle ajoute le pipeline, les avis Google et le rapport mensuel), ${PLANS.performance.nameFr} ${PLANS.performance.monthlyEur} €/mois pour les cabinets à plusieurs praticiens. Rien n'est dû à la livraison, et en paiement annuel la mise en place est offerte avec deux mois gratuits.` },
    ],
  },
  {
    slug: "clinique-esthetique",
    demoUrl: "/sites/demo-lumea",
    labelSingular: "clinique esthétique",
    labelPlural: "cliniques esthétiques",
    clientNoun: "clientes",
    problemSlug: "les demandes Instagram et WhatsApp restent sans réponse quand la clinique tourne à plein",
    seoTitle: (c) => `Site + assistante IA pour clinique esthétique ${c} — Servolia`,
    seoDesc: (c) => `Site web de clinique esthétique ${c} avec IA qui qualifie les demandes Instagram, WhatsApp et web, et prend les rendez-vous. Livré en 7 jours.`,
    h1: (c) => `Site + assistante IA pour clinique esthétique ${c}.`,
    subline: (c) => `Un site premium, une assistante IA qui qualifie chaque demande esthétique et prend le rendez-vous. Optimisé pour les cliniques ${c} qui reçoivent beaucoup de messages Instagram.`,
    faqs: (c) => [
      { q: `Est-ce que l'IA sait parler de soins esthétiques spécifiques (botox, hydrafacial, laser…) ?`,
        a: `Oui — l'assistante est formée sur votre grille de soins réelle, vos indications, vos tarifs de base, et sait qualifier une cliente (type de peau, budget, urgence) avant de proposer un créneau. ${c}, cela filtre les demandes non qualifiées avant qu'elles n'occupent votre équipe.` },
      { q: `Récupère-t-elle les demandes Instagram et WhatsApp aussi ?`,
        a: `Le site + l'IA sur le site sont livrés dans la formule de base. La reprise des DM Instagram et WhatsApp est un module supplémentaire (auto-répondeur qualifié) qui se branche en 48 h une fois le site en ligne.` },
      { q: `Facturation à la performance possible pour une clinique esthétique ${c} ?`,
        a: `Oui — pour les cliniques esthétiques et médi-esthétiques (pas médicales / dentaires) nous proposons un modèle ${PAY_PER_BOOKING.setupEur} € de mise en place + ${PAY_PER_BOOKING.perBookingEur} € par rendez-vous honoré. Aligne notre rémunération sur votre remplissage réel.` },
      { q: `Le RGPD est-il géré ?`,
        a: `Chaque conversation est chiffrée, aucune donnée n'est vendue à un tiers, et le consentement RGPD est demandé avant toute collecte de coordonnées — obligatoire pour une clinique esthétique ${c}, et intégré par défaut.` },
      { q: `Combien de temps avant que ça produise ses premiers rendez-vous ?`,
        a: `Sept jours pour la livraison technique, puis en moyenne 5 à 15 rendez-vous supplémentaires captés le premier mois — surtout hors horaires (soirs, week-end) où votre équipe ne peut pas répondre en direct.` },
    ],
  },
  {
    slug: "services-a-domicile",
    demoUrl: "/sites/demo-bardin",
    labelSingular: "artisan / service à domicile",
    labelPlural: "artisans et services à domicile",
    clientNoun: "clients",
    problemSlug: "un appel manqué en journée = un client perdu au profit du concurrent qui décroche",
    seoTitle: (c) => `Site + IA pour artisan et service à domicile ${c} — Servolia`,
    seoDesc: (c) => `Site pro pour plombier, électricien, chauffagiste ou service à domicile ${c}, avec assistante IA qui répond aux appels manqués et qualifie l'urgence. Livré en 7 jours.`,
    h1: (c) => `Site + assistante IA pour artisan et service à domicile ${c}.`,
    subline: (c) => `Un site pro qui inspire confiance, une IA qui prend les appels quand vous êtes sur un chantier, qualifie l'urgence et pré-remplit le devis. Pensée pour les artisans ${c}.`,
    faqs: (c) => [
      { q: `L'IA peut-elle prendre un appel quand je suis sur un chantier ?`,
        a: `Oui — l'assistante répond via le formulaire du site, WhatsApp et par SMS (module optionnel). Elle qualifie l'urgence (fuite, panne, devis simple), note l'adresse ${c}, et vous ping en temps réel les demandes qui valent le déplacement.` },
      { q: `Comment ça se compare à Allo-Voisins ou StarOfService ?`,
        a: `Ces plateformes prennent 15-30 % de commission et vous mettent en concurrence avec 4-5 autres artisans sur chaque demande. Ici, chaque lead est à vous, non partagé, sans commission — vous récupérez la marge complète.` },
      { q: `Ça fonctionne pour un artisan seul ou seulement pour une entreprise ?`,
        a: `Les deux — la formule ${PLANS.essentiel.nameFr} (${PLANS.essentiel.monthlyEur} €/mois) convient à un artisan solo qui veut arrêter de perdre des appels ; ${PLANS.croissance.nameFr} (${PLANS.croissance.monthlyEur} €/mois) ajoute le pipeline, les relances et le rapport mensuel, et se justifie dès qu'on a une secrétaire à décharger.` },
      { q: `Est-ce que ça remonte bien sur Google Maps ${c} ?`,
        a: `Le site est optimisé pour le SEO local (schema LocalBusiness, avis, zones d'intervention ${c}) et se connecte à votre fiche Google Business Profile — indispensable pour être trouvé sur "plombier ${c}" ou "électricien urgence ${c}".` },
      { q: `Combien de temps avant les premiers résultats ?`,
        a: `Livraison technique en 7 jours. Premiers appels/formulaires en général sous 15 jours si votre fiche Google Business est déjà active ${c}, sinon comptez 30-45 jours le temps que le SEO local mûrisse.` },
    ],
  },
];

export const FR_GEO_NICHE_SLUGS = FR_GEO_NICHES.map((n) => n.slug);
export const FR_GEO_NICHE_MAP: Record<string, FrGeoNiche> = Object.fromEntries(FR_GEO_NICHES.map((n) => [n.slug, n]));

/** All (niche, ville) combos — used by generateStaticParams and the sitemap. */
export function allFrGeoCombos(): { niche: string; ville: string }[] {
  const combos: { niche: string; ville: string }[] = [];
  for (const n of FR_GEO_NICHES) for (const c of FR_CITIES) combos.push({ niche: n.slug, ville: c.slug });
  return combos;
}
