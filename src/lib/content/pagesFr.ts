import type { MarketingContent } from "@/lib/content/pages";

/**
 * French versions of the data-driven marketing pages (solutions + industries).
 * Rendered at /fr/solutions/[slug] and /fr/secteurs/[slug] by the same
 * MarketingPage component (lang="fr").
 *
 * French slugs on purpose (better French SERP display); each entry carries
 * enPath so the page can emit the hreflang pair back to the English original.
 */

export interface MarketingContentFr extends MarketingContent {
  /** Path of the English equivalent, e.g. "/solutions/ai-websites" — for hreflang + the EN/FR nav switch. */
  enPath: string;
}

/* ─────────────────────────── SOLUTIONS ─────────────────────────── */

const solutionsFr: MarketingContentFr[] = [
  {
    slug: "sites-ia",
    enPath: "/solutions/ai-websites",
    kind: "solution",
    eyebrow: "Solution · Sites web IA",
    title: "Des sites web IA qui transforment les visiteurs en",
    highlight: "clients réservés.",
    sub: "Un site pensé pour la conversion, construit autour d'une IA qui répond, qualifie et réserve — pas une brochure qui reste là. Mobile-first, conforme RGPD, en ligne en quelques jours.",
    heroBullets: ["Pensé conversion, pas décoration", "Réceptionniste IA intégrée", "RGPD & analytics dès le premier jour"],
    metaTitle: "Sites web IA pour entreprises de services — Servolia",
    metaDescription: "Servolia crée des sites web IA orientés conversion pour les entreprises de services : mobile-first, conformes RGPD, avec une réceptionniste IA qui réserve vos clients 24 h/24. Prix fixe, livraison en 7 jours.",
    withoutTitle: "Un site web classique",
    without: [
      "Joli, mais ne capte rien en dehors des horaires",
      "Aucune relance quand un visiteur repart",
      "Impossible de savoir quelle page ou pub a amené un client",
      "Lent à charger, invisible sur Google",
    ],
    withTitle: "Un site IA Servolia",
    with: [
      "L'IA répond et réserve les visiteurs 24 h/24",
      "Chaque demande captée et scorée dans votre CRM",
      "Suivi GA4 + Meta complet sur chaque action",
      "Rapide, mobile-first, conçu pour le référencement local",
    ],
    featuresTitle: "Ce que contient chaque site IA",
    features: [
      { icon: "globe", title: "Construction orientée conversion", body: "5 à 10 pages structurées autour d'un seul objectif : transformer le visiteur en demande réservée, avec des appels à l'action clairs sur chaque écran." },
      { icon: "bot", title: "Réceptionniste IA intégrée", body: "Une assistante formée sur vos services et vos tarifs, qui répond aux questions et prend les rendez-vous à toute heure." },
      { icon: "chart", title: "Suivi dès le premier jour", body: "Google Analytics 4 installé et testé — vous savez exactement ce qui génère chaque demande." },
      { icon: "shield", title: "RGPD & pages légales", body: "Politique de confidentialité, consentement cookies et conditions rédigés et inclus — conforme UE dès la livraison." },
    ],
    steps: [
      { title: "Audit gratuit", body: "Nous analysons votre site actuel et vous montrons exactement ce qui vous coûte des clients — sans frais, sans appel obligatoire." },
      { title: "Nous le construisons", body: "Périmètre, prix et délai fixés par écrit. En ligne en 3 à 5 jours, avec votre validation à chaque étape." },
      { title: "Il se met au travail", body: "Le site est en ligne, l'IA commence à réserver, et chaque demande arrive dans votre CRM avec un rapport mensuel." },
    ],
    faqs: [
      { q: "Pouvez-vous refondre mon site existant ?", a: "Oui — nous pouvons le refondre, ou ajouter la réceptionniste IA et le suivi à votre site actuel s'il vaut la peine d'être conservé. Nous recommandons la bonne option dans votre audit gratuit." },
      { q: "En combien de temps est-il en ligne ?", a: "La plupart des sites IA sont en ligne en 3 à 5 jours ouvrés à partir de la réception de votre formulaire d'intake." },
      { q: "Suis-je propriétaire du site ?", a: "Totalement. Tous les fichiers et le code vous sont transférés à la livraison — aucun verrouillage, aucun hébergement otage." },
      { q: "Vraiment mobile-first ?", a: "Oui. La majorité du trafic des entreprises de services est mobile : nous concevons d'abord pour le téléphone, puis adaptons au bureau." },
    ],
    ctaHeadline: "Prêt pour un site qui réserve vraiment des clients ?",
    ctaSub: "Commencez par un audit gratuit. Nous vous montrons exactement quoi changer pour convertir plus de visiteurs.",
  },
  {
    slug: "receptionniste-ia",
    enPath: "/solutions/ai-receptionist",
    kind: "solution",
    eyebrow: "Solution · Réceptionniste IA",
    title: "Une réceptionniste IA qui ne rate plus",
    highlight: "jamais un client.",
    sub: "Vos visiteurs obtiennent des réponses immédiates et des rendez-vous confirmés à 14 h comme à 2 h du matin — en français ou en anglais. Chaque conversation devient un lead scoré dans votre CRM.",
    heroBullets: ["Répond en quelques secondes, 24 h/24", "Réserve directement dans votre agenda", "Formée sur vos services et tarifs"],
    metaTitle: "Réceptionniste IA pour entreprises de services — Servolia",
    metaDescription: "Une réceptionniste IA qui répond aux visiteurs 24 h/24, les qualifie, prend les rendez-vous et enregistre chaque lead dans votre CRM. Formée sur vos services. Installée par Servolia en quelques jours.",
    withoutTitle: "Sans réceptionniste IA",
    without: [
      "Les appels après 18 h partent sur messagerie — et chez les concurrents",
      "Les DMs et formulaires attendent des heures avant une réponse",
      "Votre équipe perd des heures sur des questions répétitives",
      "Aucune trace de qui a demandé quoi, ni quand",
    ],
    withTitle: "Avec la réceptionniste IA Servolia",
    with: [
      "Chaque demande traitée en quelques secondes, à toute heure",
      "Qualifie et réserve pendant que vous êtes en soin",
      "Gère les questions fréquentes — votre équipe se concentre sur l'essentiel",
      "Chaque conversation enregistrée, scorée et suivie",
    ],
    featuresTitle: "Ce que fait la réceptionniste IA",
    features: [
      { icon: "message", title: "Réponses immédiates et naturelles", body: "Répond aux questions sur les services, tarifs, horaires et localisation en langage naturel — dans la langue du client." },
      { icon: "calendar", title: "Prend les rendez-vous", body: "Propose de vrais créneaux, confirme la réservation, puis envoie confirmation et rappel automatiquement." },
      { icon: "users", title: "Qualifie chaque lead", body: "Pose les bonnes questions pour séparer les demandes sérieuses des simples curieux avant qu'ils n'arrivent jusqu'à vous." },
      { icon: "dashboard", title: "Alimente votre CRM", body: "Chaque conversation devient une fiche lead avec score, source et transcription complète — rien ne passe entre les mailles." },
    ],
    steps: [
      { title: "Nous la formons sur vous", body: "Vos services, tarifs, règles et votre ton — l'IA est configurée pour parler comme votre établissement, pas comme un bot générique." },
      { title: "Elle se met en ligne sur votre site", body: "Intégrée à votre site web, prête à répondre, qualifier et réserver dès le premier jour." },
      { title: "Vous recevez les leads", body: "Les rendez-vous tombent dans votre agenda, les leads dans votre CRM, et un rapport mensuel récapitule ce qu'elle a capté." },
    ],
    faqs: [
      { q: "Parle-t-elle français ?", a: "Oui — elle répond en français ou en anglais automatiquement selon le visiteur." },
      { q: "Et si elle ne connaît pas la réponse ?", a: "Elle capture la demande, annonce qu'un humain reprendra la main, et vous notifie immédiatement — le lead n'est jamais perdu." },
      { q: "Peut-elle réserver dans mon agenda existant ?", a: "Oui, la réservation s'intègre à votre agenda et votre CRM : les rendez-vous confirmés apparaissent là où vous travaillez déjà." },
      { q: "Est-elle incluse dans les formules ?", a: "Oui — la réceptionniste IA est incluse dans chaque formule mensuelle, dès l'Essentiel." },
    ],
    ctaHeadline: "Arrêtez d'envoyer vos clients du soir sur messagerie.",
    ctaSub: "Voyez la réceptionniste IA en action, puis obtenez la vôtre formée sur votre activité en quelques jours. Commencez par un audit gratuit.",
  },
  {
    slug: "reservation-en-ligne",
    enPath: "/solutions/booking-systems",
    kind: "solution",
    eyebrow: "Solution · Réservation en ligne",
    title: "Une réservation en ligne qui remplit votre agenda",
    highlight: "pendant que vous travaillez.",
    sub: "Vos clients se réservent eux-mêmes 24 h/24, avec confirmations automatiques, rappels et relance des absents — votre agenda reste plein sans le ping-pong téléphonique.",
    heroBullets: ["Auto-réservation 24 h/24", "Rappels et relances automatiques", "Synchronisé avec votre CRM et agenda"],
    metaTitle: "Systèmes de réservation IA pour entreprises de services — Servolia",
    metaDescription: "Servolia construit des systèmes de réservation en ligne avec qualification IA, confirmations automatiques, rappels et relance des absents — synchronisés à votre CRM. Prix fixe, livraison rapide.",
    withoutTitle: "Réservation uniquement par téléphone",
    without: [
      "Les clients ne peuvent réserver que quand vous décrochez",
      "Des absences parce que personne n'a envoyé de rappel",
      "Des heures perdues en allers-retours de planification",
      "Des leads perdus quand la ligne est occupée",
    ],
    withTitle: "Un système de réservation Servolia",
    with: [
      "Les clients se réservent seuls, jour et nuit",
      "Confirmation automatique + rappel à 48 h",
      "Relance des absents intégrée",
      "Chaque réservation tracée dans votre CRM",
    ],
    featuresTitle: "Ce que contient le système de réservation",
    features: [
      { icon: "calendar", title: "Auto-réservation 24 h/24", body: "Un parcours de réservation clair sur votre site : le client choisit un vrai créneau et confirme en moins d'une minute." },
      { icon: "bot", title: "Qualification IA en amont", body: "L'IA vérifie que la demande correspond et l'oriente correctement avant qu'elle n'occupe un créneau de votre agenda." },
      { icon: "clock", title: "Rappels et relances", body: "Confirmations automatiques, rappels à 48 h et relance douce des absents gardent votre agenda plein." },
      { icon: "trending", title: "Suivi des sources", body: "Voyez quelle pub, quel post ou quelle page a généré chaque réservation, pour investir sur ce qui fonctionne." },
    ],
    steps: [
      { title: "Cartographie de vos prestations", body: "Nous configurons vos prestations, durées, disponibilités et règles pour que le parcours colle à votre réalité." },
      { title: "Connexion et automatisation", body: "Confirmations, rappels, synchronisation agenda et CRM — puis test complet du parcours de bout en bout." },
      { title: "Mise en ligne", body: "Les clients commencent à s'auto-réserver 24 h/24, avec un rapport mensuel sur les réservations, sources et taux d'absence." },
    ],
    faqs: [
      { q: "S'intègre-t-il à mon agenda ?", a: "Oui — les réservations confirmées se synchronisent avec votre agenda pour tout gérer au même endroit." },
      { q: "Peut-il gérer des acomptes ?", a: "Oui, nous pouvons ajouter une étape d'acompte via Stripe pour réduire les absences sur les rendez-vous à forte valeur." },
      { q: "Et les rappels ?", a: "Confirmations et rappels par email inclus ; les rappels SMS/WhatsApp sont disponibles en module." },
      { q: "Délai de mise en place ?", a: "Le système de réservation est généralement en ligne en 4 à 5 jours ouvrés, dans le cadre de la mise en place." },
    ],
    ctaHeadline: "Laissez vos clients réserver seuls — même à minuit.",
    ctaSub: "Obtenez un système de réservation qui remplit votre agenda sans ping-pong téléphonique. Commencez par un audit gratuit.",
  },
  {
    slug: "crm-tableaux-de-bord",
    enPath: "/solutions/crm-dashboards",
    kind: "solution",
    eyebrow: "Solution · CRM & tableaux de bord",
    title: "Un CRM qui score vos leads et vous montre",
    highlight: "ce qui fonctionne.",
    sub: "Chaque lead, chaque source, chaque étape — dans un seul tableau de bord avec scoring automatique, pipeline en glisser-déposer, alertes de suivi et rapport mensuel.",
    heroBullets: ["Scoring automatique 0–100", "Pipeline en glisser-déposer", "Rapports de performance mensuels"],
    metaTitle: "CRM et suivi des leads pour entreprises de services — Servolia",
    metaDescription: "Servolia construit des tableaux de bord CRM avec scoring automatique des leads, pipeline visuel, alertes de suivi et rapport mensuel — pour savoir exactement ce qui génère du chiffre.",
    withoutTitle: "Des leads dans un tableur",
    without: [
      "Aucune idée de quel lead appeler en premier",
      "Des demandes oubliées jusqu'à ce qu'il soit trop tard",
      "Impossible de savoir quelle source génère du chiffre",
      "Aucune trace de ce qui a été dit ou envoyé",
    ],
    withTitle: "Un tableau de bord CRM Servolia",
    with: [
      "Chaque lead scoré de 0 à 100 automatiquement",
      "Alerte dès qu'un lead prometteur refroidit",
      "Vue pipeline du premier contact à la signature",
      "Rapport mensuel sur les sources et la conversion",
    ],
    featuresTitle: "Ce que contient le tableau de bord",
    features: [
      { icon: "trending", title: "Scoring automatique des leads", body: "Chaque lead est scoré de 0 à 100 selon le secteur, l'intention et la valeur — votre équipe sait toujours qui appeler en premier." },
      { icon: "dashboard", title: "Pipeline en glisser-déposer", body: "Déplacez les leads d'étape en étape — nouveau, qualifié, réservé, gagné — sur un tableau visuel mis à jour instantanément." },
      { icon: "clock", title: "Alertes de suivi", body: "Soyez alerté dès qu'un lead prometteur n'a pas été contacté à temps — rien ne refroidit." },
      { icon: "file", title: "Rapport mensuel", body: "Un rapport clair chaque mois sur les leads, sources, conversions et l'attribution du chiffre — sans tableur." },
    ],
    steps: [
      { title: "Connexion de vos sources", body: "Site web, chatbot, publicités et formulaires alimentent un seul CRM — chaque demande arrive au même endroit." },
      { title: "Scoring et règles", body: "Nous configurons le scoring, les étapes et les règles de suivi selon votre manière de qualifier et de signer." },
      { title: "Exploitation et rapport", body: "Votre équipe travaille le pipeline au quotidien ; vous recevez un rapport mensuel sur ce qui génère réellement du chiffre." },
    ],
    faqs: [
      { q: "Le CRM est-il inclus dans une formule ?", a: "Oui — le portail client est inclus dans chaque formule mensuelle ; le pipeline de leads et le rapport mensuel arrivent à partir de la formule Croissance." },
      { q: "Mon équipe peut-elle l'utiliser ?", a: "Oui, le tableau de bord est multi-utilisateurs avec routage des leads et notifications individuelles." },
      { q: "Comment fonctionne le scoring ?", a: "Chaque lead est scoré selon le secteur, les coordonnées, l'étape, la source et la valeur estimée — entièrement automatique." },
      { q: "Puis-je exporter mes données ?", a: "Toujours. Vous pouvez exporter vos leads en CSV à tout moment — vos données vous appartiennent." },
    ],
    ctaHeadline: "Arrêtez de deviner quels leads comptent.",
    ctaSub: "Obtenez un CRM qui score vos leads et vous montre ce qui génère du chiffre. Commencez par un audit gratuit.",
  },
];

/* ─────────────────────────── SECTEURS ─────────────────────────── */

const industriesFr: MarketingContentFr[] = [
  {
    slug: "experts-comptables",
    enPath: "/niches/accountants",
    kind: "industry",
    eyebrow: "Pour les cabinets comptables",
    title: "Systèmes clients IA pour",
    highlight: "experts-comptables.",
    sub: "Transformez visiteurs et recommandations en rendez-vous découverte réservés — avec une IA qui répond aux questions de services et d'honoraires, qualifie le profil et remplit votre agenda.",
    heroBullets: ["Répond aux questions services & honoraires", "Qualifie par prestation et taille d'entreprise", "RDV découverte réservés 24 h/24"],
    metaTitle: "Systèmes clients IA pour experts-comptables — Servolia",
    metaDescription: "Servolia construit des systèmes d'acquisition clients IA pour les cabinets comptables : traitement immédiat des demandes, qualification, prise de RDV découverte et suivi CRM.",
    withoutTitle: "Comment les cabinets perdent des clients",
    without: [
      "Les demandes arrivent en période fiscale et débordent l'équipe",
      "Les prospects veulent des réponses sur les honoraires, à toute heure",
      "Les recommandations refroidissent sans suivi rapide",
      "Aucune vision claire des prestations qui attirent des clients",
    ],
    withTitle: "Avec un système Servolia",
    with: [
      "Les questions courantes traitées immédiatement, à toute heure",
      "Prospects qualifiés par prestation et taille d'entreprise",
      "RDV découverte réservés directement dans votre agenda",
      "Chaque demande scorée et suivie jusqu'à la signature",
    ],
    featuresTitle: "Conçu pour les cabinets comptables",
    features: [
      { icon: "calculator", title: "Réponses métier", body: "L'IA explique vos prestations — tenue, fiscal, paie, conseil — et répond clairement aux questions sur la structure de vos honoraires." },
      { icon: "users", title: "Qualification du bon profil", body: "Filtre les prospects par prestation recherchée, chiffre d'affaires et forme juridique — vous parlez aux clients que vous voulez vraiment." },
      { icon: "calendar", title: "Prise de RDV découverte", body: "Réserve les prospects qualifiés en rendez-vous découverte avec confirmation et rappel, sans planification manuelle." },
      { icon: "dashboard", title: "Pipeline et suivi", body: "Chaque demande devient un lead scoré avec sa source — vous savez quels canaux fonctionnent." },
    ],
    steps: [
      { title: "Audit gratuit", body: "Nous cartographions comment les prospects vous trouvent et vous contactent aujourd'hui, et où les demandes se perdent." },
      { title: "Nous construisons votre système", body: "Site, assistante IA, réservation et CRM adaptés à votre mix de prestations — prix fixe, 7 jours." },
      { title: "L'agenda se remplit", body: "Les RDV découverte qualifiés arrivent dans votre agenda et un rapport mensuel montre vos meilleures sources." },
    ],
    faqs: [
      { q: "Peut-elle expliquer mes honoraires ?", a: "Elle peut expliquer comment vos honoraires fonctionnent (forfait, mensuel, à la prestation) et qualifier le prospect — le chiffrage exact reste pour votre rendez-vous." },
      { q: "Gère-t-elle les pics saisonniers ?", a: "Oui — l'IA absorbe sans effort la clôture et la période fiscale, en qualifiant et réservant sans personnel supplémentaire." },
      { q: "S'adapte-t-elle à ma clientèle ?", a: "Que vous serviez artisans, e-commerce ou PME, l'IA est configurée autour de votre client idéal et de vos prestations." },
      { q: "Délai de livraison ?", a: "Un système complet de cabinet est généralement livré en 7 jours ouvrés." },
    ],
    ctaHeadline: "Réservez plus de RDV découverte, automatiquement.",
    ctaSub: "Obtenez un système IA qui qualifie les prospects et remplit votre agenda. Commencez par un audit gratuit.",
  },
  {
    slug: "consultants",
    enPath: "/niches/consultants",
    kind: "industry",
    eyebrow: "Pour les consultants & coachs",
    title: "Systèmes clients IA pour",
    highlight: "consultants.",
    sub: "Positionnez-vous en expert et convertissez l'intérêt en appels stratégiques réservés — avec une IA qui qualifie les prospects selon votre profil client idéal, à toute heure.",
    heroBullets: ["Qualifie selon votre client idéal", "Appels stratégiques réservés 24 h/24", "Chaque lead relancé automatiquement"],
    metaTitle: "Systèmes clients IA pour consultants & coachs — Servolia",
    metaDescription: "Servolia construit des systèmes d'acquisition clients IA pour consultants et coachs : qualification sur profil idéal, prise d'appels stratégiques, relance automatique et pipeline CRM. Prix fixe.",
    withoutTitle: "Comment les consultants perdent des missions",
    without: [
      "Les prospects intéressés réservent chez le premier qui répond",
      "Des appels découverte gaspillés sur de mauvais profils",
      "La relance dépend de votre mémoire",
      "Aucun système — un pipeline en dents de scie",
    ],
    withTitle: "Avec un système Servolia",
    with: [
      "Les prospects engagés dès l'instant où ils s'intéressent",
      "Seuls les profils idéaux atteignent votre agenda",
      "La relance automatique garde les leads tièdes au chaud",
      "Un pipeline prévisible et visible",
    ],
    featuresTitle: "Conçu pour les experts indépendants",
    features: [
      { icon: "briefcase", title: "Site orienté autorité", body: "Un site qui vous positionne en expert — résultats, preuves, et un chemin clair pour travailler avec vous." },
      { icon: "search", title: "Qualification sur profil idéal", body: "L'IA filtre les prospects selon vos critères de client idéal — vos appels découverte ne servent que les vrais bons profils." },
      { icon: "calendar", title: "Prise d'appels stratégiques", body: "Les prospects qualifiés réservent directement un appel, avec confirmations et rappels qui réduisent les absences." },
      { icon: "message", title: "Relance automatique", body: "Les leads tièdes reçoivent un suivi au bon moment, automatiquement — les opportunités ne refroidissent plus." },
    ],
    steps: [
      { title: "Audit gratuit", body: "Nous analysons comment vous attirez et convertissez vos clients aujourd'hui, et où le pipeline fuit." },
      { title: "Nous construisons votre système", body: "Site de positionnement, qualification IA, réservation et CRM construits autour de votre client idéal — prix fixe, 7 jours." },
      { title: "L'agenda se remplit", body: "Des appels stratégiques avec les bons profils arrivent dans votre agenda, et un rapport mensuel montre ce qui les génère." },
    ],
    faqs: [
      { q: "Peut-elle filtrer les mauvais profils ?", a: "Oui — c'est le principe. L'IA qualifie selon vos critères de client idéal pour que votre temps n'aille qu'aux vrais prospects." },
      { q: "Ça marche aussi pour les coachs ?", a: "Absolument — coachs, conseillers et agences utilisent le même modèle pour réserver des appels découverte qualifiés." },
      { q: "Peut-elle relancer les leads pas encore prêts ?", a: "Oui, la relance automatique garde les leads tièdes engagés jusqu'à ce qu'ils soient prêts à réserver." },
      { q: "Délai de mise en ligne ?", a: "Un système complet est généralement livré en 7 jours ouvrés." },
    ],
    ctaHeadline: "Remplissez votre agenda avec les bons clients.",
    ctaSub: "Obtenez un système IA qui qualifie les prospects et réserve vos appels stratégiques. Commencez par un audit gratuit.",
  },
];

/* ─────────────────────────── lookups ─────────────────────────── */

export const SOLUTIONS_FR = solutionsFr;
export const INDUSTRIES_FR = industriesFr;

export const SOLUTION_FR_SLUGS = solutionsFr.map((s) => s.slug);
export const INDUSTRY_FR_SLUGS = industriesFr.map((s) => s.slug);

export function getSolutionFr(slug: string): MarketingContentFr | undefined {
  return solutionsFr.find((s) => s.slug === slug);
}
export function getIndustryFr(slug: string): MarketingContentFr | undefined {
  return industriesFr.find((s) => s.slug === slug);
}
