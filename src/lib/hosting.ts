/**
 * CLIENT SERVICES — a separate line of business from the Servolia subscription.
 *
 * Deliberately NOT added to PLANS in pricing.ts. Two reasons:
 *
 *  1. PLAN_ORDER drives the public pricing page. Anything in PLANS is a
 *     candidate to render on servolia.com, and these are not Servolia products
 *     for the French market.
 *  2. Every SubscriptionPlan carries `conversations` (the AI-receptionist
 *     quota) and an implied installation fee. These have neither, so they
 *     would have to fake both.
 *
 * Priced in USD. Servolia's plans are EUR — keeping the two apart avoids a
 * currency field on shared code that would have to be handled at every call
 * site.
 */

/**
 * Everything about a product that changes with language.
 *
 * Split out so a translation is a complete object rather than a scattering of
 * optional fields — a half-translated product then fails to compile instead of
 * shipping a French page with three English bullets in the middle of it.
 */
/**
 * A price as a person writes it: 88 stays "88", 5.39 stays "5.39".
 *
 * Every price used to be a whole dollar, so five call sites reached for
 * Math.round and were correct by luck. The moment a plan is priced at 5.39
 * those same lines quietly render "$5" on the client's own service page and
 * "Save $6" against a real saving of 5.68 -- wrong in the direction that looks
 * deliberate. Rounding money for display is never right; do it here, once.
 */
export function usd(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export interface ClientProductCopy {
  /** Short tier name for a side-by-side comparison, e.g. "Essential". */
  tier?: string;
  /** Shown as the card heading on the payment page. */
  heading: string;
  /** The name written mid-sentence: "hosting", "assistant IA". */
  sentenceName: string;
  /** One sentence under the heading. */
  blurb: string;
  /** Line items on the card. */
  includes: string[];
  /** Sent to Stripe as the product description. */
  description: string;
  /** Who this tier is for, in one line, for the comparison table. */
  bestFor?: string;
  /**
   * What an `includes` line means in plain words, keyed by that exact line.
   * Shown under the label in the comparison, where a reader is deciding
   * rather than skimming. A restatement, never a promise the line does not
   * already make.
   */
  explain?: Record<string, string>;
}

/** Shared by the hosting tiers: the same line means the same thing on each. */
const HOSTING_EXPLAIN = {
  en: {
    "Hosting on a global CDN, with SSL":
      "Your pages are served from servers close to your visitors, over https.",
    "Contact and quote forms kept connected":
      "The forms on your site keep reaching you; if one breaks, we fix it.",
    "Uptime watched — you hear it from us first":
      "The site is monitored; if it goes down, we tell you rather than a customer.",
    "Domain renewal and DNS managed":
      "We renew your domain on time and keep its records correct.",
    "Tracking and analytics kept connected":
      "Your Meta Pixel, Google tags and analytics keep working after changes.",
    "Business email on your domain — 1 mailbox included":
      "An address like you@yourdomain.com, working on your phone and computer. Extra mailboxes are $2/month each — just ask.",
    "Email deliverability set up (SPF, DKIM, DMARC)":
      "The records that make your emails land in inboxes rather than spam.",
  },
  fr: {
    "Hébergement sur un réseau mondial, avec SSL":
      "Vos pages sont servies depuis des serveurs proches de vos visiteurs, en https.",
    "Formulaires de contact et de devis maintenus":
      "Les formulaires de votre site continuent de vous parvenir ; s'ils cassent, nous réparons.",
    "Disponibilité surveillée — vous l'apprenez par nous en premier":
      "Le site est surveillé ; s'il tombe, c'est nous qui vous prévenons, pas un client.",
    "Renouvellement du domaine et DNS gérés":
      "Nous renouvelons votre domaine à temps et gardons ses enregistrements corrects.",
    "Suivi et statistiques maintenus":
      "Votre pixel Meta, vos balises Google et vos statistiques continuent de fonctionner après les modifications.",
    "Messagerie professionnelle à votre domaine — 1 boîte incluse":
      "Une adresse comme vous@votredomaine.com, qui fonctionne sur téléphone et ordinateur. Chaque boîte supplémentaire est à 2 $/mois — il suffit de demander.",
    "Délivrabilité configurée (SPF, DKIM, DMARC)":
      "Les enregistrements qui font arriver vos emails dans la boîte de réception, pas dans les spams.",
  },
} satisfies Record<"en" | "fr", Record<string, string>>;

/**
 * A product, in English, with its French copy alongside.
 *
 * `sentenceName` is held explicitly on both because the obvious shortcut —
 * lowercasing `heading` — produces "your ai assistant", and doing nothing
 * produces "your Website hosting". An acronym and a sentence-case phrase
 * cannot both be handled by a case transform, so each product says what it is
 * called in prose, in each language.
 */
export interface ClientProduct extends ClientProductCopy {
  key: string;
  name: string;
  /** French copy. English lives on the product itself. */
  fr: ClientProductCopy;
  /** USD per month. Prices do not change with language. */
  monthlyUsd: number;
  /** USD per year when prepaid. */
  annualUsd: number;
  /**
   * A one-time charge on the first invoice, for work the plan's monthly
   * price cannot carry. Business: three mailboxes plus SPF/DKIM/DMARC is
   * about an hour at the cost floor, against +$3/month over Complete --
   * twelve months to recover without this line.
   */
  setupUsd?: number;
  /**
   * Bought ONCE, not subscribed to.
   *
   * Multilingual search is the first of these: the work is declaring each
   * language to search engines, writing a sitemap per language and the
   * structured data. It is done, and then it is done — a monthly charge for it
   * would be rent on a finished job, and the first client to ask what this
   * month's payment bought would be right to.
   *
   * Where this is set it is the ONLY price. monthlyUsd and annualUsd are not
   * read for such a product, and the checkout takes a payment rather than
   * opening a subscription.
   */
  oneOffUsd?: number;
}

/**
 * Monthly rates come from the agency price list (hosting $8, AI assistant $12).
 *
 * ANNUAL PRICING IS NOT CONSISTENT BETWEEN THE TWO, on purpose:
 *
 *  - hosting  $88 = 11 x monthly — one month free, 8.3% off. Chosen over a
 *    literal 7% ($89.28) because "one month free" is an offer a client can
 *    repeat back, and over the 10x house rule ($80) because at $8/month the
 *    margin is already thin: infra plus even ten minutes of support a month
 *    costs close to $10, so a deeper cut would sell the year at a loss.
 *  - chatbot  $120 = 10 x monthly, the house rule elsewhere in this codebase
 *    (pay 10, get 12). The old dashboard used 12 x fee less 19% = $116.64,
 *    which is the same idea with an uglier number.
 *
 * If a consistent rule is wanted, change one line here rather than in a page.
 */
export const CLIENT_PRODUCTS: Record<string, ClientProduct> = {
  /**
   * ESSENTIAL — the same hosting without the domain.
   *
   * The difference between the tiers is deliberately ONE thing a client can
   * check rather than a wall of asterisks: who renews the domain. That is also
   * the only line with a hard cash cost attached (a .com renewal at the
   * registrar), which is exactly why the cheaper tier can exist at all. A
   * cheaper tier that differed only in wording would be a discount pretending
   * to be a plan.
   *
   * 66/year is 11 x monthly, the same "one month free" rule as the other
   * tiers, so a client comparing them is comparing like with like.
   */
  hosting_lite: {
    key: "hosting_lite",
    name: "Hosting Essential",
    tier: "Essential",
    bestFor: "A site whose domain you already manage yourself.",
    explain: HOSTING_EXPLAIN.en,
    heading: "Website hosting · Essential",
    sentenceName: "hosting",
    blurb:
      "Your site stays online, fast and secure, and your forms keep working. You keep your domain wherever it is today.",
    monthlyUsd: 6,
    annualUsd: 66,
    includes: [
      "Hosting on a global CDN, with SSL",
      "Contact and quote forms kept connected",
      "Uptime watched — you hear it from us first",
    ],
    description:
      "Hosting, SSL and a global CDN, with the site's contact and quote forms " +
      "kept connected. Your domain stays with your own registrar. Content " +
      "changes and new pages are quoted separately.",
    fr: {
      tier: "Essentiel",
      bestFor: "Un site dont vous gérez déjà le domaine vous-même.",
      explain: HOSTING_EXPLAIN.fr,
      heading: "Hébergement du site · Essentiel",
      sentenceName: "hébergement",
      blurb:
        "Votre site reste en ligne, rapide et sécurisé, et vos formulaires continuent de fonctionner. Vous gardez votre domaine là où il est aujourd'hui.",
      includes: [
        "Hébergement sur un réseau mondial, avec SSL",
        "Formulaires de contact et de devis maintenus",
        "Disponibilité surveillée — vous l'apprenez par nous en premier",
      ],
      description:
        "Hébergement, SSL et réseau mondial, avec les formulaires de contact " +
        "et de devis maintenus. Votre domaine reste chez votre registrar. Les " +
        "modifications de contenu et les nouvelles pages sont devisées séparément.",
    },
  },
  hosting: {
    key: "hosting",
    name: "Hosting",
    tier: "Complete",
    bestFor: "Most business sites — one provider for everything.",
    explain: HOSTING_EXPLAIN.en,
    // Named like its siblings, so the tier a client chose is the tier every
    // later screen -- Stripe, the receipt, the service page -- calls it.
    heading: "Website hosting · Complete",
    sentenceName: "hosting",
    blurb:
      "Your site stays online, fast and secure — and the forms that bring you enquiries keep working.",
    monthlyUsd: 8,
    annualUsd: 88,
    includes: [
      "Hosting on a global CDN, with SSL",
      "Domain renewal and DNS managed",
      "Contact and quote forms kept connected",
      "Tracking and analytics kept connected",
      "Uptime watched — you hear it from us first",
    ],
    description:
      "Hosting, SSL, domain renewal, DNS, and keeping the site's forms and " +
      "tracking connected. Content changes and new pages are quoted separately.",
    fr: {
      tier: "Complet",
      bestFor: "La plupart des sites d'entreprise — un seul prestataire pour tout.",
      explain: HOSTING_EXPLAIN.fr,
      heading: "Hébergement du site · Complet",
      sentenceName: "hébergement",
      blurb:
        "Votre site reste en ligne, rapide et sécurisé — et les formulaires qui vous apportent des demandes continuent de fonctionner.",
      includes: [
        "Hébergement sur un réseau mondial, avec SSL",
        "Renouvellement du domaine et DNS gérés",
        "Formulaires de contact et de devis maintenus",
        "Suivi et statistiques maintenus",
        "Disponibilité surveillée — vous l'apprenez par nous en premier",
      ],
      description:
        "Hébergement, SSL, renouvellement du domaine, DNS, et maintien des " +
        "formulaires et du suivi du site. Les modifications de contenu et les " +
        "nouvelles pages sont devisées séparément.",
    },
  },
  /**
   * BUSINESS — Complete plus email on the client's own domain.
   *
   * The added lines: one Zoho mailbox on their domain and the SPF/DKIM/DMARC
   * records that decide whether that mail lands in an inbox or a spam folder.
   * Both are things a small business genuinely cannot do for itself and would
   * otherwise pay a registrar ~100/yr for.
   *
   * THE MAILBOX HAS A RECURRING COST AND THE TIER MUST CLEAR IT. This was first
   * priced on Zoho's free plan ("covers five, so three is comfortably inside
   * it"). That plan is not offered in the EU data centre a Moroccan signup
   * lands in, and has no forwarding or IMAP, so the real unit is Mail Lite at
   * about USD 12 per mailbox per year. Three included mailboxes cost USD 36
   * against a USD 33 annual gap to Complete -- negative before any labour. One
   * mailbox included, USD 2/month each after, is what makes the tier honest.
   *
   * IT IS ALSO THE FIRST TIER THAT COMMITS US TO DOING SOMETHING PER CLIENT
   * rather than to a switch being on. Selling it means actually creating the
   * mailbox and the DNS records; if that is not done, the client has paid for
   * an address that bounces, which is worse than not offering it. Do not sell
   * this tier to someone you are not going to set up this week.
   *
   * 121/year is 11 x monthly, the same rule as the other two.
   */
  hosting_business: {
    key: "hosting_business",
    name: "Hosting Business",
    tier: "Business",
    bestFor: "Companies that want email at their own domain.",
    explain: HOSTING_EXPLAIN.en,
    heading: "Website hosting · Business",
    sentenceName: "hosting",
    blurb:
      "Everything in Complete, plus email on your own domain — so you write to customers from your business, not from a free mailbox.",
    monthlyUsd: 11,
    annualUsd: 121,
    setupUsd: 39,
    includes: [
      "Hosting on a global CDN, with SSL",
      "Domain renewal and DNS managed",
      "Contact and quote forms kept connected",
      "Tracking and analytics kept connected",
      "Uptime watched — you hear it from us first",
      "Business email on your domain — 1 mailbox included",
      "Email deliverability set up (SPF, DKIM, DMARC)",
    ],
    description:
      "Hosting, SSL, domain renewal, DNS, forms and tracking kept connected, " +
      "plus business email on your own domain with deliverability configured. " +
      "Content changes and new pages are quoted separately.",
    fr: {
      tier: "Business",
      bestFor: "Les entreprises qui veulent une messagerie à leur nom de domaine.",
      explain: HOSTING_EXPLAIN.fr,
      heading: "Hébergement du site · Business",
      sentenceName: "hébergement",
      blurb:
        "Tout le Complet, plus une messagerie à votre nom de domaine — pour écrire à vos clients depuis votre entreprise, pas depuis une adresse gratuite.",
      includes: [
        "Hébergement sur un réseau mondial, avec SSL",
        "Renouvellement du domaine et DNS gérés",
        "Formulaires de contact et de devis maintenus",
        "Suivi et statistiques maintenus",
        "Disponibilité surveillée — vous l'apprenez par nous en premier",
        "Messagerie professionnelle à votre domaine — 1 boîte incluse",
        "Délivrabilité configurée (SPF, DKIM, DMARC)",
      ],
      description:
        "Hébergement, SSL, renouvellement du domaine, DNS, formulaires et suivi " +
        "maintenus, plus une messagerie professionnelle à votre domaine avec la " +
        "délivrabilité configurée. Les modifications de contenu et les nouvelles " +
        "pages sont devisées séparément.",
    },
  },
  chatbot: {
    key: "chatbot",
    name: "AI Assistant",
    heading: "AI assistant",
    sentenceName: "AI assistant",
    blurb:
      "Built for your website and trained on it — it answers your customers day and night, in their language, so an enquiry at 2am is still an enquiry you win.",
    monthlyUsd: 12,
    annualUsd: 120,
    /* SIX LINES, AND EACH ONE IS KEPT BY CODE. "Built for your site" is the
       accent + name the widget pulls from the brief; "trained on" is the
       brief built from their own pages; "your instructions" is the free-text
       field on /hosting/assistant; the settings page is that page itself.
       This list renders on the pay card, in the receipt and on the service
       page, so a line nothing performs would be read three times. */
    includes: [
      "Replies instantly, 24 hours a day",
      "Answers in Arabic, French and English",
      "Built for your site — your name, your colours, your pages",
      "Trained on your services, your policies and your instructions",
      "Every enquiry sent to you, with a one-tap WhatsApp reply",
      "Your own settings page — change what it says, anytime",
    ],
    description:
      "An AI assistant built for your website — your name, your colours, " +
      "trained on your services — answering customers around the clock and " +
      "passing every enquiry to you. Refine what it says anytime from your " +
      "own settings page.",
    fr: {
      heading: "Assistant IA",
      sentenceName: "assistant IA",
      blurb:
        "Conçu pour votre site et formé sur lui — il répond à vos clients jour et nuit, dans leur langue : une question à 2h du matin reste une vente que vous gagnez.",
      includes: [
        "Répond instantanément, 24h/24",
        "Répond en arabe, en français et en anglais",
        "Conçu pour votre site — votre nom, vos couleurs, vos pages",
        "Formé sur vos services, vos conditions et vos consignes",
        "Chaque demande vous parvient, avec réponse WhatsApp en un clic",
        "Votre page de réglages — modifiez ses réponses à tout moment",
      ],
      description:
        "Un assistant IA conçu pour votre site — votre nom, vos couleurs, " +
        "formé sur vos services — qui répond à vos clients 24h/24 et vous " +
        "transmet chaque demande. Ajustez ses réponses à tout moment depuis " +
        "votre page de réglages.",
    },
  },

  /* MULTILINGUAL SEARCH — the one SEO line Servolia sells.
   *
   * Why this and not "SEO": a Servolia client is typically a service business
   * whose site runs in two or three languages, and the thing that is actually
   * broken is always the same — no hreflang, no per-language sitemap, no
   * robots.txt, no structured data. Excellence Agency serves Arabic, French
   * and English and carries none of the four. A generic SEO retainer promises
   * rankings, which is a promise nobody can keep; this promises a specific
   * technical state, which can be verified the day it is delivered.
   *
   * PRICING, 2026-09-16, against the measured floor of USD 35.10/billable hour:
   *  - setup  345 = 4 honest hours (audit, hreflang matrix, sitemaps, robots,
   *    JSON-LD, Search Console per language, verify indexation) at 1.97x cost.
   *    Four hours assumes a site we built and host. On a stranger's codebase it
   *    is seven, and the setup should be 490 -- quote that, do not absorb it.
   *  - monthly 45 = 0.5 h/month of indexation checks and regression fixes at
   *    2.4x cost to serve. Dearer than hosting because it is human minutes
   *    every month, not disk.
   *  - annual  450 = 10 x monthly, the chatbot's house rule rather than
   *    hosting's 11x. At 45/month the margin carries a two-month discount;
   *    at 8/month it did not, which is why the two differ.
   *
   * The FRENCH MARKET pays far more for SEO -- freelances EUR 300-1,500/month,
   * PME median EUR 980/month (checked 2026-09-16). This is deliberately not
   * that product. Selling retainer money would mean promising retainer work. */
  seo_multilingual: {
    key: "seo_multilingual",
    /* ONE PAYMENT, NOT A SUBSCRIPTION (2026-09-18). The work is finite —
       hreflang declared, a sitemap per language, the structured data written —
       so it is charged once. The $345 setup and $45/month it replaces are
       left in the fields below unread rather than deleted, because they are
       what earlier quotes were built on. */
    oneOffUsd: 145,
    name: "Multilingual search",
    tier: "Search",
    bestFor: "A site in more than one language that Google indexes as though it were one.",
    heading: "Multilingual search",
    sentenceName: "multilingual search",
    blurb:
      "Your site is in several languages — this is what tells Google which one to show to whom, so the right visitor lands on the right version.",
    monthlyUsd: 45,
    annualUsd: 450,
    setupUsd: 345,
    includes: [
      "Each language declared to Google (hreflang), so versions stop competing",
      "A sitemap per language, and a robots file that lets them be found",
      "Your company described in the format search engines read",
      "Google Search Console set up, with every language submitted to it",
      /* NOT "checked every month". This is one payment (oneOffUsd above), and a
         bullet promising ongoing monthly work for it is a commitment with no
         revenue behind it that a client can hold us to for years. */
      "Verified once it is live, so you can see each language being indexed",
    ],
    explain: {
      "Each language declared to Google (hreflang), so versions stop competing":
        "Without it Google may treat your French and Arabic pages as duplicates of each other, and show the wrong one — or neither.",
    },
    description:
      "Multilingual search setup: hreflang, per-language sitemaps, robots and " +
      "structured data, with Search Console configured for each language and " +
      "verified once it is live.",
    fr: {
      tier: "Recherche",
      bestFor: "Un site en plusieurs langues que Google indexe comme s'il n'en avait qu'une.",
      heading: "Recherche multilingue",
      sentenceName: "recherche multilingue",
      blurb:
        "Votre site existe en plusieurs langues — voici ce qui indique à Google laquelle montrer à qui, pour que le bon visiteur arrive sur la bonne version.",
      includes: [
        "Chaque langue déclarée à Google (hreflang), pour qu'elles cessent de se concurrencer",
        "Un sitemap par langue, et un fichier robots qui les rend trouvables",
        "Votre entreprise décrite dans le format que lisent les moteurs de recherche",
        "Google Search Console configuré, avec chaque langue soumise",
        "Vérifié une fois en ligne, pour voir chaque langue s'indexer",
      ],
      explain: {
        "Chaque langue déclarée à Google (hreflang), pour qu'elles cessent de se concurrencer":
          "Sans cela, Google peut traiter vos pages françaises et arabes comme des doublons l'une de l'autre, et afficher la mauvaise — ou aucune.",
      },
      description:
        "Mise en place de la recherche multilingue : hreflang, sitemaps par " +
        "langue, robots et données structurées, avec Search Console configuré " +
        "pour chaque langue et vérifié une fois en ligne.",
    },
  },
};

/** Back-compat: the original single-product export. */
export const HOSTING_PLANS = CLIENT_PRODUCTS;

/**
 * The three tiers the /hosting comparison table shows. Everything else in
 * CLIENT_PRODUCTS is an ADD-ON: a thing an existing client buys on top of
 * hosting, not instead of it.
 *
 * The distinction is load-bearing. A client who already pays for hosting is
 * shown "your hosting is active" and can never reach a pay page from /hosting
 * — which is right for a tier and wrong for an add-on, and is why the AI
 * assistant sat in this file for months with no way to sell it.
 */
export const HOSTING_TIERS: readonly string[] = ["hosting_lite", "hosting", "hosting_business"];

/** True for a product sold on top of hosting rather than as a tier of it. */
export function isAddOn(key?: string | null): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  // hasOwn for the same reason resolveHostingPlan uses it: `constructor`
  // must not resolve to Object's, and then read as a sellable product.
  return Object.hasOwn(CLIENT_PRODUCTS, k) && !HOSTING_TIERS.includes(k);
}

export function resolveHostingPlan(key?: string | null): ClientProduct | undefined {
  if (!key) return undefined;
  const k = key.toLowerCase();
  // hasOwn, not a bare index: plan=constructor would resolve to Object's
  // constructor, and the checkout would send Stripe a NaN amount.
  return Object.hasOwn(CLIENT_PRODUCTS, k) ? CLIENT_PRODUCTS[k] : undefined;
}

/**
 * The product's copy in one language.
 *
 * Returns the whole block rather than a field at a time, so a call site cannot
 * accidentally mix a French heading with an English bullet list.
 */
export function productCopy(plan: ClientProduct, lang: "en" | "fr"): ClientProductCopy {
  return lang === "fr" ? plan.fr : plan;
}

/** Amount in cents for Stripe, for the chosen billing period. */
export function hostingAmountCents(
  plan: ClientProduct,
  period: "monthly" | "annual",
): number {
  // A one-off costs the same whichever period the page happened to be showing.
  if (plan.oneOffUsd) return Math.round(plan.oneOffUsd * 100);
  const usd = period === "annual" ? plan.annualUsd : plan.monthlyUsd;
  return Math.round(usd * 100);
}

/**
 * Marks a Stripe subscription as belonging to the client-services line, so the
 * webhook writes it to hosting_clients instead of `clients`. Which product it
 * is travels separately in metadata.plan — without this marker the payment
 * would land in Servolia's EUR MRR.
 */
export const HOSTING_METADATA_KIND = "hosting";

/**
 * When Stripe will charge this subscription again.
 *
 * Worked out here rather than read from Stripe because the
 * checkout.session.completed payload does not carry a period end, and fetching
 * the subscription would put a second network call inside the webhook — where a
 * slow response risks a timeout, a Stripe retry, and the client being emailed
 * twice.
 *
 * CLAMPED TO THE END OF THE MONTH, which is the part that is easy to get wrong.
 * JavaScript rolls an overflowing date forward: setUTCMonth on 31 January
 * gives 3 March. Stripe does the opposite and bills on 28 February. Left
 * unclamped, every client who paid on the 29th, 30th or 31st would be told a
 * renewal date two or three days after the money actually leaves their account.
 *
 * The annual path needs the same clamp, which is less obvious: 29 February
 * plus a year overflows to 1 March in three years out of four. Both periods
 * therefore go through one code path rather than the year taking a shortcut.
 */
export function nextChargeDate(from: Date, period: "monthly" | "annual"): Date {
  const day = from.getUTCDate();
  const d = new Date(from.getTime());
  d.setUTCDate(1);                          // park on a day every month has
  if (period === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
