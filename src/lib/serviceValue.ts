/**
 * WHAT EACH SERVICE CHANGES FOR THE CLIENT, IN ONE SENTENCE.
 *
 * The catalogue already says what a thing IS and what it includes. A client
 * reading a feature list still has to do the translation into their own
 * business, and most will not bother — so the outcome is written out here,
 * once, in their terms.
 *
 * Kept separate from CLIENT_PRODUCTS on purpose. That file is the commercial
 * record — keys, prices, what is billed — and it is edited when money changes.
 * This is persuasion, and it is edited when the argument changes. Mixing the
 * two is how a price edit quietly rewrites a promise.
 *
 * THE RULE FOR EVERY LINE BELOW: it must describe something the service
 * actually does. "Wins you more customers" is a forecast and does not belong;
 * "answers at 2am, in their language" is the mechanism, and the client can
 * decide for themselves what it is worth. Optimism that survives contact with
 * the invoice is the only kind worth writing.
 */

type Lang = "en" | "fr";

const VALUE: Record<string, Record<Lang, string>> = {
  hosting_lite: {
    en: "Your site stays online and quick, and if it ever stops you hear it from us before a customer does.",
    fr: "Votre site reste en ligne et rapide, et s'il s'arrête vous l'apprenez par nous avant vos clients.",
  },
  hosting: {
    en: "One provider for the site, the domain and the forms — so when something needs fixing there is one number to call, not three.",
    fr: "Un seul prestataire pour le site, le domaine et les formulaires — en cas de problème, un seul interlocuteur au lieu de trois.",
  },
  hosting_business: {
    en: "You write to customers from your own domain instead of a free mailbox, which is the difference between looking established and looking temporary.",
    fr: "Vous écrivez à vos clients depuis votre propre domaine plutôt qu'une boîte gratuite — la différence entre paraître établi et paraître provisoire.",
  },
  chatbot: {
    en: "An enquiry at 2am is still an enquiry you win: it answers in the visitor's own language while you are asleep, and sends you what it learned.",
    fr: "Une demande à 2h du matin reste une demande gagnée : il répond dans la langue du visiteur pendant que vous dormez, et vous transmet ce qu'il a appris.",
  },
  seo_multilingual: {
    en: "Each language reaches the people who search in it, instead of your own pages competing with each other for the same result.",
    fr: "Chaque langue atteint ceux qui cherchent dans cette langue, au lieu que vos propres pages se disputent le même résultat.",
  },
};

export function valueFor(key: string, lang: Lang): string | null {
  return VALUE[key]?.[lang] ?? null;
}

/**
 * The same idea for the panel's own tools, which a client meets without
 * anyone selling them — so the explanation has to travel with the thing.
 */
const FEATURES: Record<string, Record<Lang, string>> = {
  files: {
    en: "These are the real files your visitors download. Change one here and your website is different a minute later — no email, no waiting on us.",
    fr: "Ce sont les fichiers réels que vos visiteurs téléchargent. Changez-en un ici et votre site est différent une minute plus tard — sans email, sans nous attendre.",
  },
  domains: {
    en: "A domain is the address people type. Buying another one here puts it on the invoice you already have, and we point it at your site for you.",
    fr: "Un domaine, c'est l'adresse que les gens tapent. En acheter un ici l'ajoute à votre facture existante, et nous le dirigeons vers votre site.",
  },
  billing: {
    en: "Your card, your invoices and your renewal date, all changeable by you. Nothing here needs our permission.",
    fr: "Votre carte, vos factures et votre date de renouvellement, modifiables par vous. Rien ici ne demande notre autorisation.",
  },
  help: {
    en: "Written here, it reaches us immediately with your account attached — so nobody has to work out who you are before helping.",
    fr: "Écrit ici, cela nous parvient immédiatement avec votre compte identifié — personne n'a à chercher qui vous êtes avant de vous aider.",
  },
  website: {
    en: "Everything about the site itself: where it is edited, how your email is set up, and who looks after it.",
    fr: "Tout ce qui concerne le site : où il se modifie, comment votre email est configuré, et qui s'en occupe.",
  },
  services: {
    en: "What you have today, and the things that would add to it — each with what it costs and what it changes.",
    fr: "Ce dont vous disposez aujourd'hui, et ce qui pourrait s'y ajouter — avec le prix et ce que cela change.",
  },
  overview: {
    en: "Your site, your plan, and anything we noticed that is worth your attention.",
    fr: "Votre site, votre formule, et ce que nous avons remarqué qui mérite votre attention.",
  },
};

export function featureIntro(page: string, lang: Lang): string | null {
  return FEATURES[page]?.[lang] ?? null;
}
