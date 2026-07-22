/**
 * The value equation, as shared copy.
 *
 *   Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort)
 *
 * Every public page should raise the two numerators and lower the two
 * denominators. Keeping the four levers here (instead of retyping them per
 * page) means the promise is identical everywhere, in both languages, and a
 * change to the offer is a one-file change rather than a 20-page sweep.
 *
 * HONESTY RULES — these are load-bearing, not style preferences:
 *  1. Outcome lines are the CLIENT'S OWN arithmetic ("if you charge X and miss
 *     Y…"), never a result Servolia claims to have produced. There are no
 *     delivered clients yet, so any "we generated…" line would be invented.
 *  2. Likelihood lines may only promise what src/app/legal/refund and the CGV
 *     actually grant. The deposit is non-refundable once work begins.
 *  3. No invented statistics, and no testimonials until real ones exist.
 */

export type Lang = "en" | "fr";

export interface ValueLever {
  /** Which side of the equation this pulls. */
  kind: "outcome" | "likelihood" | "speed" | "effort";
  label: string;
  headline: string;
  body: string;
}

/** Per-niche dream outcome — the thing they actually lie awake wanting. */
const OUTCOME: Record<string, Record<Lang, { headline: string; body: string }>> = {
  default: {
    en: {
      headline: "Every enquiry answered, day or night",
      body: "Work out your own number: take what one new client is worth to you, and multiply it by the enquiries you never got back to last month. That gap is what the system is for.",
    },
    fr: {
      headline: "Chaque demande traitée, jour et nuit",
      body: "Faites votre propre calcul : prenez ce que vaut un nouveau client chez vous, multipliez-le par les demandes restées sans réponse le mois dernier. C'est cet écart que le système comble.",
    },
  },
  dental: {
    en: {
      headline: "A full chair, without chasing patients",
      body: "One implant case can be worth €2,000. Count the enquiries that came in after hours last month and never got a reply — that's the arithmetic this system is built to change.",
    },
    fr: {
      headline: "Un fauteuil rempli, sans courir après les patients",
      body: "Un cas d'implant peut valoir 2 000 €. Comptez les demandes arrivées hors horaires le mois dernier restées sans réponse — c'est ce calcul que le système change.",
    },
  },
  aesthetic: {
    en: {
      headline: "A booked calendar, not a missed-call list",
      body: "If a laser course is worth €500 and eight enquiries a month go unanswered, that's €4,000 leaving the room. Run your own numbers — the system exists to close that gap.",
    },
    fr: {
      headline: "Un agenda rempli, pas une liste d'appels manqués",
      body: "Si une cure laser vaut 500 € et que huit demandes par mois restent sans réponse, ce sont 4 000 € qui s'envolent. Faites vos calculs — le système est là pour combler cet écart.",
    },
  },
  "real-estate": {
    en: {
      headline: "Only the buyers who are genuinely ready",
      body: "One commission dwarfs the cost of the system. The assistant qualifies every enquiry first, so your hours go to the people actually ready to move.",
    },
    fr: {
      headline: "Uniquement les acheteurs réellement prêts",
      body: "Une seule commission dépasse largement le coût du système. L'assistant qualifie chaque demande en amont : votre temps va aux personnes réellement prêtes à avancer.",
    },
  },
  "home-services": {
    en: {
      headline: "Quote requests that don't go cold",
      body: "Every job you quote has a value you already know. Multiply it by the calls you missed while on site last month — that's the number this is built to recover.",
    },
    fr: {
      headline: "Des demandes de devis qui ne refroidissent pas",
      body: "Chaque chantier que vous chiffrez a une valeur que vous connaissez déjà. Multipliez-la par les appels manqués en intervention le mois dernier — c'est ce montant que le système récupère.",
    },
  },
  lawyers: {
    en: {
      headline: "Enquiries triaged before they reach you",
      body: "One retained matter is worth multiples of the system. Every enquiry gets an immediate reply and a first qualification, so your billable hours aren't spent on cases you'd decline.",
    },
    fr: {
      headline: "Des demandes triées avant d'arriver sur votre bureau",
      body: "Un seul dossier signé vaut plusieurs fois le système. Chaque demande reçoit une réponse immédiate et une première qualification : vos heures facturables ne partent plus dans des dossiers que vous refuseriez.",
    },
  },
  accountants: {
    en: {
      headline: "A full client book, without the January scramble",
      body: "An annual engagement is recurring revenue you can name. Count the enquiries that arrived outside office hours last season and never got a reply — that's the gap.",
    },
    fr: {
      headline: "Un portefeuille rempli, sans la course de janvier",
      body: "Une mission annuelle, c'est un revenu récurrent que vous savez chiffrer. Comptez les demandes arrivées hors horaires la saison dernière et restées sans réponse — voilà l'écart.",
    },
  },
  consultants: {
    en: {
      headline: "Only the calls worth taking",
      body: "One engagement covers the system many times over. Every enquiry is answered and qualified first, so the calls in your diary are the ones with a real budget behind them.",
    },
    fr: {
      headline: "Uniquement les appels qui en valent la peine",
      body: "Une seule mission couvre largement le système. Chaque demande est traitée et qualifiée en amont : les rendez-vous dans votre agenda ont un vrai budget derrière eux.",
    },
  },
};

/** Page slugs → outcome key. Solution pages (ai-websites, …) use the default. */
const SLUG_TO_NICHE: Record<string, string> = {
  dentists: "dental", dentistes: "dental", dental: "dental",
  "aesthetic-clinics": "aesthetic", aesthetic: "aesthetic",
  "real-estate": "real-estate",
  "home-services": "home-services",
  lawyers: "lawyers", accountants: "accountants", consultants: "consultants",
};

export const nicheForSlug = (slug?: string): string =>
  (slug && SLUG_TO_NICHE[slug]) || "default";

const STATIC: Record<Exclude<ValueLever["kind"], "outcome">, Record<Lang, { label: string; headline: string; body: string }>> = {
  likelihood: {
    en: {
      label: "Certainty",
      headline: "Committed in writing before you pay",
      body: "Fixed scope, fixed price, fixed delivery date — signed off before any work starts. Miss the date and you get 10% back per day late. Can't deliver at all and your deposit is refunded in full.",
    },
    fr: {
      label: "Certitude",
      headline: "Engagé par écrit avant tout paiement",
      body: "Périmètre, prix et date de livraison fixes — validés avant le moindre travaux. Date manquée : 10 % remboursés par jour de retard. Livraison impossible : acompte intégralement remboursé.",
    },
  },
  speed: {
    en: {
      label: "Speed",
      headline: "Live in 3–7 days, not 3 months",
      body: "An agency quotes you six to twelve weeks. Your system is live this week — because the build is productized, not reinvented for every client.",
    },
    fr: {
      label: "Rapidité",
      headline: "En ligne en 3 à 7 jours, pas en 3 mois",
      body: "Une agence vous annonce six à douze semaines. Votre système est en ligne cette semaine — parce que la production est industrialisée, pas réinventée à chaque client.",
    },
  },
  effort: {
    en: {
      label: "Your effort",
      headline: "Ten minutes of your time, total",
      body: "You fill one short intake form. We write every headline, every service description, every legal page. You review and approve — that's the whole job on your side.",
    },
    fr: {
      label: "Votre effort",
      headline: "Dix minutes de votre temps, en tout",
      body: "Vous remplissez un court formulaire. Nous rédigeons chaque titre, chaque description de prestation, chaque page légale. Vous relisez et validez — c'est tout ce qu'on vous demande.",
    },
  },
};

const OUTCOME_LABEL: Record<Lang, string> = { en: "What you get", fr: "Ce que vous gagnez" };

/**
 * The four levers for a page, in order: outcome, certainty, speed, effort.
 * `niche` selects the outcome framing — unknown niches fall back to default.
 */
export function valueLevers(lang: Lang, niche = "default"): ValueLever[] {
  const outcome = (OUTCOME[niche] ?? OUTCOME.default)[lang];
  return [
    { kind: "outcome", label: OUTCOME_LABEL[lang], ...outcome },
    { kind: "likelihood", ...STATIC.likelihood[lang] },
    { kind: "speed", ...STATIC.speed[lang] },
    { kind: "effort", ...STATIC.effort[lang] },
  ];
}

/** Section heading above the levers. */
export const VALUE_HEADING: Record<Lang, { eyebrow: string; h: string; sub: string }> = {
  en: {
    eyebrow: "Why it's worth it",
    h: "More of what you want. Less of what it costs you.",
    sub: "A bigger result, a surer bet, sooner, for less of your time — that's the whole argument.",
  },
  fr: {
    eyebrow: "Pourquoi ça vaut le coup",
    h: "Plus de ce que vous voulez. Moins de ce que ça vous coûte.",
    sub: "Un meilleur résultat, un pari plus sûr, plus vite, pour moins de votre temps — c'est tout l'argument.",
  },
};
