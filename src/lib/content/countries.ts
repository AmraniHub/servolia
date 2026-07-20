/**
 * Francophone country landing pages — /fr/pays/[pays].
 * Same product, same French copy engine, localized proof points only.
 * Keep new entries here in sync with docs/PRINCIPLES.md P2 ladder.
 */

export interface CountryContent {
  slug: string;
  name: string;              // display name, French
  adjective: string;         // plural, e.g. "cabinets suisses"
  adjectiveSingular: string; // singular, e.g. "votre cabinet suisse"
  cities: string[];
  platformNote: string;  // which booking platform / regulator we speak natively
  tier: "rung" | "side-lane"; // side-lane = hand-picked outreach only, not systematized
}

export const COUNTRIES: Record<string, CountryContent> = {
  suisse: {
    slug: "suisse",
    name: "Suisse",
    adjective: "suisses",
    adjectiveSingular: "suisse",
    cities: ["Genève", "Lausanne", "Fribourg", "Neuchâtel"],
    platformNote: "Nous connaissons les usages des cabinets romands — RGPD et nLPD suisse.",
    tier: "rung",
  },
  belgique: {
    slug: "belgique",
    name: "Belgique",
    adjective: "belges",
    adjectiveSingular: "belge",
    cities: ["Bruxelles", "Liège", "Namur", "Charleroi"],
    platformNote: "Compatible avec les cabinets utilisant DentAdmin et Doctena.",
    tier: "rung",
  },
  luxembourg: {
    slug: "luxembourg",
    name: "Luxembourg",
    adjective: "luxembourgeois",
    adjectiveSingular: "luxembourgeois",
    cities: ["Luxembourg-Ville", "Esch-sur-Alzette"],
    platformNote: "Conforme RGPD pour les cabinets luxembourgeois.",
    tier: "rung",
  },
  monaco: {
    slug: "monaco",
    name: "Monaco",
    adjective: "monégasques",
    adjectiveSingular: "monégasque",
    cities: ["Monaco"],
    platformNote: "Accompagnement sur-mesure pour cabinets et cliniques de la Principauté.",
    tier: "side-lane",
  },
};

export const COUNTRY_SLUGS = Object.keys(COUNTRIES);
