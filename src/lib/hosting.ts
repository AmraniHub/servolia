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
}

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
    heading: "Website hosting — Essential",
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
      heading: "Hébergement du site — Essentiel",
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
    heading: "Website hosting",
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
      heading: "Hébergement du site",
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
   * The added lines are one-time work with no recurring cost: a Zoho mailbox
   * on their domain (their free tier covers five, so three is comfortably
   * inside it) and the SPF/DKIM/DMARC records that decide whether that mail
   * lands in an inbox or a spam folder. Both are things a small business
   * genuinely cannot do for itself and would otherwise pay a registrar ~100/yr
   * for.
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
    heading: "Website hosting — Business",
    sentenceName: "hosting",
    blurb:
      "Everything in Complete, plus email on your own domain — so you write to customers from your business, not from a free mailbox.",
    monthlyUsd: 11,
    annualUsd: 121,
    includes: [
      "Hosting on a global CDN, with SSL",
      "Domain renewal and DNS managed",
      "Contact and quote forms kept connected",
      "Tracking and analytics kept connected",
      "Uptime watched — you hear it from us first",
      "Business email on your domain — up to 3 mailboxes",
      "Email deliverability set up (SPF, DKIM, DMARC)",
    ],
    description:
      "Hosting, SSL, domain renewal, DNS, forms and tracking kept connected, " +
      "plus business email on your own domain with deliverability configured. " +
      "Content changes and new pages are quoted separately.",
    fr: {
      tier: "Business",
      heading: "Hébergement du site — Business",
      sentenceName: "hébergement",
      blurb:
        "Tout le Complet, plus une messagerie à votre nom de domaine — pour écrire à vos clients depuis votre entreprise, pas depuis une adresse gratuite.",
      includes: [
        "Hébergement sur un réseau mondial, avec SSL",
        "Renouvellement du domaine et DNS gérés",
        "Formulaires de contact et de devis maintenus",
        "Suivi et statistiques maintenus",
        "Disponibilité surveillée — vous l'apprenez par nous en premier",
        "Messagerie professionnelle à votre domaine — jusqu'à 3 boîtes",
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
      "Answers your customers day and night, in their language, so an enquiry at 2am is still an enquiry you win.",
    monthlyUsd: 12,
    annualUsd: 120,
    includes: [
      "Replies instantly, 24 hours a day",
      "Answers in Arabic, French and English",
      "Trained on your products and policies",
      "Hands over to you when a human is needed",
      "Kept updated as your catalogue changes",
    ],
    description:
      "An AI assistant on your site that answers customer questions around the " +
      "clock and passes real enquiries to you.",
    fr: {
      heading: "Assistant IA",
      sentenceName: "assistant IA",
      blurb:
        "Répond à vos clients jour et nuit, dans leur langue — une question à 2h du matin reste une vente que vous gagnez.",
      includes: [
        "Répond instantanément, 24h/24",
        "Répond en arabe, en français et en anglais",
        "Formé sur vos produits et vos conditions",
        "Vous passe le relais quand un humain est nécessaire",
        "Mis à jour au fil de votre catalogue",
      ],
      description:
        "Un assistant IA sur votre site qui répond aux questions de vos clients " +
        "24h/24 et vous transmet les vraies demandes.",
    },
  },
};

/** Back-compat: the original single-product export. */
export const HOSTING_PLANS = CLIENT_PRODUCTS;

export function resolveHostingPlan(key?: string | null): ClientProduct | undefined {
  if (!key) return undefined;
  return CLIENT_PRODUCTS[key.toLowerCase()];
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
