import type { SiteFiles } from "@/lib/clientFiles";
import type { SiteHealth } from "@/lib/siteHealth";
import { editableSite } from "@/lib/siteEditor";
import { CLIENT_PRODUCTS, usd } from "@/lib/hosting";

/**
 * WHAT TO SUGGEST TO THIS CLIENT, AND THE FACT THAT EARNED IT.
 *
 * Every recommendation here carries the measurement that produced it. That is
 * the whole design: "your home page is 346 KB, which is about four seconds on
 * a phone" is a finding, and a client can check it. "Upgrade to Business" is an
 * advert, and a client on their own account page can tell the difference
 * instantly — after which they stop reading this section and, worse, start
 * reading the rest of the panel the same way.
 *
 * So a rule that cannot state a number about THEIR site does not belong here.
 * A quiet section is the correct output for a client with nothing wrong.
 *
 * Nothing here is a promise. Each one says what we measured and what we would
 * do; the price and the buying happen on the service's own page, where the
 * detail is.
 */

export interface Recommendation {
  id: string;
  /** The measured fact. Shown first, in the client's own terms. */
  finding: string;
  /** What we would do about it. */
  action: string;
  /** "$12/month", or empty where it is a conversation rather than a product. */
  price: string;
  href: string;
  cta: string;
  /** Lower sorts first. */
  weight: number;
}

const COPY = {
  en: {
    heavyPage: (kb: number, secs: number) =>
      `Your home page is ${kb} KB — on a phone that is about ${secs} seconds before a visitor sees anything.`,
    heavyPageAction: "Most of that is images that can be shrunk without looking any different. We can do it in an afternoon.",
    heavyPageCta: "Ask us about this",
    assistant: (langs: string) =>
      `Your site is in ${langs}, and every enquiry on it asks the visitor to write to you and wait.`,
    assistantAction:
      "An assistant trained on your pages answers them in their own language, instantly, including at 2am when you are asleep.",
    assistantCta: "See what it does",
    multilingual: (langs: string) =>
      `Your site is written in ${langs}, but search engines are not told which version to show to whom.`,
    multilingualAction:
      "Declaring each language properly stops your own pages competing with each other for the same searches.",
    multilingualCta: "See what it does",
    stale: (days: number) =>
      `Nothing on your site has changed in ${days} days.`,
    staleAction:
      "You can change the words and photos yourself from this panel, in about a minute — or tell us what to change.",
    staleCta: "Open your files",
    quiet: "Nothing needs your attention. Your site is online and up to date.",
    heading: "What we noticed",
    sub: "Each of these comes from looking at your site, not from a list.",
  },
  fr: {
    heavyPage: (kb: number, secs: number) =>
      `Votre page d'accueil pèse ${kb} Ko — sur un téléphone, cela fait environ ${secs} secondes avant que le visiteur ne voie quoi que ce soit.`,
    heavyPageAction: "L'essentiel, ce sont des images que l'on peut alléger sans changer leur apparence. Une après-midi de travail.",
    heavyPageCta: "Nous en parler",
    assistant: (langs: string) =>
      `Votre site est en ${langs}, et chaque demande invite le visiteur à vous écrire puis à attendre.`,
    assistantAction:
      "Un assistant formé sur vos pages leur répond dans leur langue, immédiatement, y compris à 2h du matin.",
    assistantCta: "Voir en détail",
    multilingual: (langs: string) =>
      `Votre site est rédigé en ${langs}, mais les moteurs de recherche ne savent pas quelle version montrer à qui.`,
    multilingualAction:
      "Déclarer chaque langue correctement évite que vos propres pages se concurrencent sur les mêmes recherches.",
    multilingualCta: "Voir en détail",
    stale: (days: number) => `Rien n'a changé sur votre site depuis ${days} jours.`,
    staleAction:
      "Vous pouvez changer les textes et les photos vous-même depuis cet espace, en une minute — ou nous dire quoi changer.",
    staleCta: "Ouvrir vos fichiers",
    quiet: "Rien ne demande votre attention. Votre site est en ligne et à jour.",
    heading: "Ce que nous avons remarqué",
    sub: "Chaque point vient de l'observation de votre site, pas d'une liste toute faite.",
  },
};

export function recommendationCopy(lang: "en" | "fr") {
  return COPY[lang];
}

export interface RecommendInput {
  ref: string;
  lang: "en" | "fr";
  files: SiteFiles;
  health: SiteHealth;
  /** They already pay for the assistant. */
  hasAssistant: boolean;
  /** Where the panel's own pages live, so a recommendation can link inward. */
  linkFor: (page: string) => string;
}

/** 3G-ish: 346 KB is roughly four seconds before the first paint. */
function secondsOnAPhone(bytes: number): number {
  return Math.max(1, Math.round(bytes / 90_000));
}

/** The languages we KNOW a site is in, from its own configuration. */
function languagesOf(ref: string, lang: "en" | "fr"): string | null {
  const site = editableSite(ref);
  if (!site) return null;
  const names = lang === "fr"
    ? { en: "anglais", ar: "arabe", fr: "français" }
    : { en: "English", ar: "Arabic", fr: "French" };
  /* A dictionary-driven site names its languages in the fields themselves; an
     English-keyed one names its second language in `translations`. */
  const fromFields = new Set(site.fields.map((f) => f.lang).filter(Boolean) as string[]);
  if (fromFields.size > 1) {
    return [...fromFields].map((c) => names[c as keyof typeof names] ?? c).join(lang === "fr" ? " et " : " and ");
  }
  if (site.translations) {
    const second = site.translations.language.toLowerCase();
    const secondName = second.includes("arab") ? names.ar : second.includes("fren") ? names.fr : site.translations.language;
    return `${names.en} ${lang === "fr" ? "et" : "and"} ${secondName}`;
  }
  return null;
}

export function recommendationsFor(input: RecommendInput): Recommendation[] {
  const { ref, lang, files, health, hasAssistant, linkFor } = input;
  const t = COPY[lang];
  const money = (n: number) => (lang === "fr" ? `${usd(n)} $` : `$${usd(n)}`);
  const per = lang === "fr" ? "mois" : "month";
  /* Read from the product, so a price changed once is changed here too — and
     a one-off is never rendered as a monthly charge. */
  const seo = CLIENT_PRODUCTS.seo_multilingual;
  const multilingualPrice = seo.oneOffUsd
    ? `${money(seo.oneOffUsd)} ${lang === "fr" ? "une seule fois" : "once"}`
    : `${money(seo.monthlyUsd)} / ${per}`;
  const out: Recommendation[] = [];

  /* 1. A home page heavy enough to cost a visitor real seconds. Measured from
        their own file list, so the number is theirs and checkable. */
  const home = files.files.find((f) => f.name === "index.html");
  if (home?.size && home.size > 200_000) {
    out.push({
      id: "heavy-home",
      finding: t.heavyPage(Math.round(home.size / 1024), secondsOnAPhone(home.size)),
      action: t.heavyPageAction,
      price: "",
      href: linkFor("help"),
      cta: t.heavyPageCta,
      weight: 1,
    });
  }

  const langs = languagesOf(ref, lang);

  /* 2. The assistant, only where we can say something true about their site.
        Without the language fact this is an advert, so it is skipped. */
  if (!hasAssistant && langs) {
    out.push({
      id: "assistant",
      finding: t.assistant(langs),
      action: t.assistantAction,
      price: `${money(CLIENT_PRODUCTS.chatbot.monthlyUsd)} / ${per}`,
      href: linkFor("services"),
      cta: t.assistantCta,
      weight: 2,
    });
  }

  /* 3. Multilingual search, for a site we KNOW is in more than one language. */
  if (langs) {
    out.push({
      id: "multilingual",
      finding: t.multilingual(langs),
      action: t.multilingualAction,
      price: multilingualPrice,
      href: linkFor("services"),
      cta: t.multilingualCta,
      weight: 3,
    });
  }

  /* 4. A site nobody has touched. Only when we have a date to point at —
        "we could not read your history" is not a recommendation. */
  if (health.lastChange) {
    const days = Math.floor((Date.now() - Date.parse(health.lastChange)) / 86_400_000);
    if (days >= 90) {
      out.push({
        id: "stale",
        finding: t.stale(days),
        action: t.staleAction,
        price: "",
        href: linkFor("files"),
        cta: t.staleCta,
        weight: 0,
      });
    }
  }

  return out.sort((a, b) => a.weight - b.weight);
}
