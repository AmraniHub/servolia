import { SETUP_PLAN, PLANS } from "@/lib/pricing";

/**
 * AUDIT ENGINE — the scored teardown a prospect gets in ~20 seconds.
 *
 * Two jobs, in this order:
 *
 *  1. SCORE what is actually on their site, from the fetched HTML. Every
 *     finding below is a deterministic check against real markup — never an
 *     opinion, never an AI guess. A clinician can verify any of them in ten
 *     seconds, which is what makes the number credible.
 *
 *  2. FRAME the result as the value equation:
 *
 *         Value = (Dream Outcome × Perceived Likelihood)
 *                 ÷ (Time Delay × Effort)
 *
 *     The score alone is a diagnosis; the framing is what makes it a decision.
 *     Each of the four levers is computed from THEIR numbers and OUR published
 *     terms — see valueEquation.ts for the same discipline applied to copy.
 *
 * HONESTY RULES — load-bearing, same as src/lib/valueEquation.ts:
 *  1. Every finding cites what was (or wasn't) found in their HTML. No finding
 *     may be asserted when the check could not run — it returns "unknown" and
 *     is excluded from the score rather than counted as a failure.
 *  2. The money figure is THEIR arithmetic from THEIR inputs, always framed as
 *     a range with the assumption stated inline. It is never a promise, never
 *     "we generated", and never presented without the word "estimated".
 *  3. Likelihood lines may only cite what the CGV actually grant.
 *  4. A site that scores well must be told so. An audit that always says
 *     "you're broken" is a sales script, and prospects can smell it.
 */

export type Lang = "en" | "fr";

/** One scored dimension of the teardown. */
export interface AuditDimension {
  key: string;
  /** Share of the total score, 0–1. Must sum to 1. */
  weight: number;
  label: { en: string; fr: string };
}

/**
 * Weighted rubric, adapted to what actually decides whether a French clinic
 * converts a visitor. Weights front-load the two things that lose the most
 * patients: no way to book, and nothing answering out of hours.
 */
export const AUDIT_DIMENSIONS: AuditDimension[] = [
  { key: "capture",   weight: 0.25, label: { en: "Booking & enquiry capture", fr: "Prise de RDV et captation" } },
  { key: "afterHours",weight: 0.20, label: { en: "Answers outside opening hours", fr: "Réponse hors horaires" } },
  { key: "mobile",    weight: 0.15, label: { en: "Mobile experience", fr: "Expérience mobile" } },
  { key: "trust",     weight: 0.15, label: { en: "Trust & credibility signals", fr: "Signaux de confiance" } },
  { key: "clarity",   weight: 0.10, label: { en: "Clarity in 5 seconds", fr: "Clarté en 5 secondes" } },
  { key: "speed",     weight: 0.10, label: { en: "Page weight & speed", fr: "Poids et vitesse de page" } },
  { key: "compliance",weight: 0.05, label: { en: "GDPR & legal pages", fr: "RGPD et pages légales" } },
];

export interface Finding {
  dimension: string;
  /** 0–10 for this dimension, or null when the check could not run. */
  score: number | null;
  /** What we actually observed, in the prospect's language. */
  observation: { en: string; fr: string };
  /** The concrete fix. Empty when the dimension already passes. */
  fix: { en: string; fr: string };
  severity: "critical" | "warning" | "ok" | "unknown";
}

export interface AuditInput {
  url: string;
  html: string;
  /** Bytes of the fetched document — a proxy for page weight. */
  bytes: number;
  /** Milliseconds to first byte + download. */
  fetchMs: number;
  niche?: string | null;
  /** Average value of one new patient/client, from the prospect. */
  patientValueEur?: number | null;
  /** Enquiries they estimate they receive monthly. */
  monthlyEnquiries?: number | null;
}

export interface AuditResult {
  url: string;
  /** 0–10, weighted across the dimensions that could be scored. */
  score: number;
  verdict: "critical" | "weak" | "fair" | "strong";
  findings: Finding[];
  value: ValueFraming;
}

/* ───────────────────────── deterministic checks ───────────────────────── */

const has = (h: string, re: RegExp) => re.test(h);

/** Strip script/style so text checks don't match code. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

const BOOKING_RE = /doctolib|planity|resalib|calendly|rendez-?vous en ligne|prendre rendez-?vous|book (an )?appointment|réserver/i;
// Third-party widget vendors plus the generic markup conventions a custom
// widget uses. Deliberately matches markup tokens, not the word "chat" in
// prose — a page that merely mentions live chat has not installed one.
const CHAT_RE = /crisp|tawk\.to|intercom|drift|livechat|hubspot-messages|zendesk|smartsupp|chatra|messenger|chat-?widget|chat_widget|data-chat|id=["'][^"']*chat|class=["'][^"']*chat-/i;
const WHATSAPP_RE = /wa\.me|whatsapp/i;
const FORM_RE = /<form[\s\S]*?>/i;
const TEL_RE = /href=["']tel:/i;
const VIEWPORT_RE = /<meta[^>]+name=["']viewport["']/i;
const RGPD_RE = /politique de confidentialit|mentions l[ée]gales|privacy policy|rgpd|gdpr/i;
const COOKIE_RE = /cookie|tarteaucitron|axeptio|didomi/i;
const REVIEW_RE = /avis google|google reviews|témoignage|testimonial|⭐|note de \d|\d[.,]\d\s*\/\s*5/i;
const HOURS_RE = /horaires|opening hours|lundi|mardi|monday|tuesday/i;
const ADDRESS_RE = /\b\d{5}\b|adresse|address/i;

function scoreCapture(h: string, t: string): Finding {
  const booking = has(h, BOOKING_RE) || has(t, BOOKING_RE);
  const form = has(h, FORM_RE);
  const tel = has(h, TEL_RE);
  if (booking && (form || tel)) {
    return {
      dimension: "capture", score: 9, severity: "ok",
      observation: { en: "Online booking is present and reachable, with a direct contact route alongside it.", fr: "La prise de rendez-vous en ligne est présente et joignable, avec un contact direct à côté." },
      fix: { en: "", fr: "" },
    };
  }
  if (booking) {
    return {
      dimension: "capture", score: 6, severity: "warning",
      observation: { en: "Online booking exists, but there's no form or tappable phone number as a fallback for people who don't want to use it.", fr: "La prise de rendez-vous en ligne existe, mais aucun formulaire ni numéro cliquable ne sert de solution de repli." },
      fix: { en: "Add a short enquiry form and a tap-to-call number beside the booking link.", fr: "Ajoutez un formulaire court et un numéro cliquable à côté du lien de réservation." },
    };
  }
  if (form || tel) {
    return {
      dimension: "capture", score: 4, severity: "warning",
      observation: { en: "There's a way to make contact, but no online booking — so every request becomes manual work for your desk.", fr: "Il existe un moyen de vous contacter, mais aucune réservation en ligne — chaque demande devient donc du travail manuel pour le secrétariat." },
      fix: { en: "Add online booking so a patient can confirm a slot without anyone picking up.", fr: "Ajoutez la réservation en ligne pour qu'un patient confirme un créneau sans que personne ne décroche." },
    };
  }
  return {
    dimension: "capture", score: 1, severity: "critical",
    observation: { en: "No booking system, no enquiry form and no tappable phone number were found on the page.", fr: "Aucun système de réservation, aucun formulaire et aucun numéro cliquable n'ont été trouvés sur la page." },
    fix: { en: "This is the single biggest leak: a visitor who is ready to book has nothing to click.", fr: "C'est la fuite la plus importante : un visiteur prêt à réserver n'a rien sur quoi cliquer." },
  };
}

function scoreAfterHours(h: string, t: string): Finding {
  const chat = has(h, CHAT_RE);
  const wa = has(h, WHATSAPP_RE);
  const booking = has(h, BOOKING_RE) || has(t, BOOKING_RE);
  if (chat) {
    return {
      dimension: "afterHours", score: 7, severity: "ok",
      observation: { en: "A chat widget is installed — though most are staffed only in office hours, so it's worth checking what happens at 22:00.", fr: "Un widget de chat est installé — mais la plupart ne sont tenus qu'aux heures de bureau ; vérifiez ce qui se passe à 22 h." },
      fix: { en: "", fr: "" },
    };
  }
  if (wa || booking) {
    return {
      dimension: "afterHours", score: 4, severity: "warning",
      observation: { en: "Out of hours a visitor can leave a message or book a slot, but nothing answers them, qualifies them, or reassures them until the practice reopens.", fr: "Hors horaires, un visiteur peut laisser un message ou réserver un créneau, mais rien ne lui répond, ne le qualifie ni ne le rassure avant la réouverture." },
      fix: { en: "An assistant that replies in seconds at 22:00 turns a silent form into a booked appointment.", fr: "Un assistant qui répond en quelques secondes à 22 h transforme un formulaire silencieux en rendez-vous confirmé." },
    };
  }
  return {
    dimension: "afterHours", score: 0, severity: "critical",
    observation: { en: "Nothing on the site responds outside opening hours. Evening and weekend visitors — when most people research a practice — leave with no answer.", fr: "Rien sur le site ne répond en dehors des horaires. Les visiteurs du soir et du week-end — le moment où l'on cherche un praticien — repartent sans réponse." },
    fix: { en: "This is the enquiry volume your competitors are capturing while you're closed.", fr: "C'est le volume de demandes que vos concurrents captent pendant votre fermeture." },
  };
}

function scoreMobile(h: string): Finding {
  const viewport = has(h, VIEWPORT_RE);
  const tel = has(h, TEL_RE);
  if (viewport && tel) {
    return {
      dimension: "mobile", score: 9, severity: "ok",
      observation: { en: "The page is set up for mobile and the phone number is tappable.", fr: "La page est configurée pour le mobile et le numéro est cliquable." },
      fix: { en: "", fr: "" },
    };
  }
  if (viewport) {
    return {
      dimension: "mobile", score: 6, severity: "warning",
      observation: { en: "The page adapts to mobile, but the phone number isn't a tap-to-call link — on a phone that costs you the easiest conversion there is.", fr: "La page s'adapte au mobile, mais le numéro n'est pas un lien d'appel — sur téléphone, cela vous coûte la conversion la plus simple qui soit." },
      fix: { en: "Make every phone number a tel: link.", fr: "Transformez chaque numéro en lien tel:." },
    };
  }
  return {
    dimension: "mobile", score: 2, severity: "critical",
    observation: { en: "No mobile viewport tag was found, so the page is likely rendering desktop-width on phones — where most of your traffic is.", fr: "Aucune balise viewport mobile trouvée : la page s'affiche probablement en largeur bureau sur téléphone — là où se trouve l'essentiel de votre trafic." },
    fix: { en: "Rebuild mobile-first. Most patients find you on a phone.", fr: "Reconstruisez en mobile-first. La plupart des patients vous trouvent sur téléphone." },
  };
}

function scoreTrust(h: string, t: string): Finding {
  const signals = [has(t, REVIEW_RE), has(t, HOURS_RE), has(t, ADDRESS_RE)].filter(Boolean).length;
  if (signals >= 3) {
    return {
      dimension: "trust", score: 9, severity: "ok",
      observation: { en: "Reviews, opening hours and address are all visible — the basics of local credibility are covered.", fr: "Avis, horaires et adresse sont visibles — les bases de la crédibilité locale sont couvertes." },
      fix: { en: "", fr: "" },
    };
  }
  if (signals === 2) {
    return {
      dimension: "trust", score: 6, severity: "warning",
      observation: { en: "Some credibility signals are present, but at least one of reviews, opening hours or address is missing from the page.", fr: "Certains signaux de crédibilité sont présents, mais il manque au moins l'un des trois : avis, horaires ou adresse." },
      fix: { en: "Surface all three above the fold — they're the first things a new patient checks.", fr: "Affichez les trois dès le premier écran — ce sont les premières choses qu'un nouveau patient vérifie." },
    };
  }
  return {
    dimension: "trust", score: 3, severity: "critical",
    observation: { en: "Few credibility signals found: no clear reviews, opening hours or address on the page.", fr: "Peu de signaux de crédibilité : ni avis, ni horaires, ni adresse clairement présents sur la page." },
    fix: { en: "A first-time patient decides on trust before they decide on treatment.", fr: "Un nouveau patient décide sur la confiance avant de décider sur le soin." },
  };
}

function scoreClarity(t: string): Finding {
  const words = t.trim().split(/\s+/).length;
  if (words < 80) {
    return {
      dimension: "clarity", score: 3, severity: "warning",
      observation: { en: "Very little readable text was found — the page may be image-only or built in a way search engines and AI assistants can't read.", fr: "Très peu de texte lisible : la page est peut-être uniquement en images, ou construite d'une façon illisible pour les moteurs et les assistants IA." },
      fix: { en: "Real text is what Google and AI assistants quote when someone asks for a practice in your city.", fr: "Le vrai texte est ce que Google et les assistants IA citent quand on cherche un praticien dans votre ville." },
    };
  }
  if (words > 4000) {
    return {
      dimension: "clarity", score: 5, severity: "warning",
      observation: { en: "The page is very long. A visitor deciding in five seconds has to work to find what you treat and how to book.", fr: "La page est très longue. Un visiteur qui décide en cinq secondes doit chercher ce que vous soignez et comment réserver." },
      fix: { en: "Lead with what you treat, where, and one clear next step.", fr: "Commencez par ce que vous soignez, où, et une seule action claire." },
    };
  }
  return {
    dimension: "clarity", score: 8, severity: "ok",
    observation: { en: "The page has a readable amount of real text.", fr: "La page contient une quantité lisible de vrai texte." },
    fix: { en: "", fr: "" },
  };
}

function scoreSpeed(bytes: number, fetchMs: number): Finding {
  const kb = Math.round(bytes / 1024);
  if (bytes > 1_500_000 || fetchMs > 4000) {
    return {
      dimension: "speed", score: 3, severity: "critical",
      observation: { en: `The page document is ${kb} KB and took ${(fetchMs / 1000).toFixed(1)}s to fetch from a fast server — on a 4G phone in a waiting room it is considerably slower.`, fr: `Le document fait ${kb} Ko et a mis ${(fetchMs / 1000).toFixed(1)} s à charger depuis un serveur rapide — sur un téléphone en 4G, c'est nettement plus lent.` },
      fix: { en: "Every second of load costs a share of visitors before they see anything.", fr: "Chaque seconde de chargement coûte une part des visiteurs avant même qu'ils voient quoi que ce soit." },
    };
  }
  if (bytes > 600_000 || fetchMs > 1800) {
    return {
      dimension: "speed", score: 6, severity: "warning",
      observation: { en: `The page document is ${kb} KB and took ${(fetchMs / 1000).toFixed(1)}s — acceptable, with room to improve on mobile data.`, fr: `Le document fait ${kb} Ko et a mis ${(fetchMs / 1000).toFixed(1)} s — acceptable, avec une marge de progrès en données mobiles.` },
      fix: { en: "Compress images and drop unused scripts.", fr: "Compressez les images et supprimez les scripts inutilisés." },
    };
  }
  return {
    dimension: "speed", score: 9, severity: "ok",
    observation: { en: `The page document is ${kb} KB and responded in ${(fetchMs / 1000).toFixed(1)}s.`, fr: `Le document fait ${kb} Ko et a répondu en ${(fetchMs / 1000).toFixed(1)} s.` },
    fix: { en: "", fr: "" },
  };
}

function scoreCompliance(h: string, t: string): Finding {
  const legal = has(h, RGPD_RE) || has(t, RGPD_RE);
  const cookie = has(h, COOKIE_RE);
  if (legal && cookie) {
    return {
      dimension: "compliance", score: 9, severity: "ok",
      observation: { en: "Legal pages and a cookie mechanism are both present.", fr: "Les pages légales et un mécanisme de cookies sont présents." },
      fix: { en: "", fr: "" },
    };
  }
  if (legal) {
    return {
      dimension: "compliance", score: 6, severity: "warning",
      observation: { en: "Legal pages are present, but no cookie consent mechanism was detected.", fr: "Les pages légales sont présentes, mais aucun mécanisme de consentement cookies n'a été détecté." },
      fix: { en: "Add cookie consent if any analytics or tracking runs.", fr: "Ajoutez le consentement cookies si un outil de mesure ou de suivi tourne." },
    };
  }
  return {
    dimension: "compliance", score: 2, severity: "critical",
    observation: { en: "No mentions légales, privacy policy or cookie mechanism were found — both are mandatory for a French practice website.", fr: "Ni mentions légales, ni politique de confidentialité, ni mécanisme de cookies trouvés — les deux sont obligatoires pour le site d'un cabinet en France." },
    fix: { en: "Mandatory in France, and free to fix.", fr: "Obligatoire en France, et gratuit à corriger." },
  };
}

/* ───────────────────────── value-equation framing ───────────────────────── */

export interface ValueFraming {
  /** Estimated monthly euros at stake, as a range. Null when they gave no numbers. */
  outcomeLowEur: number | null;
  outcomeHighEur: number | null;
  /** The assumption, stated inline so the number is auditable, never a claim. */
  outcomeBasis: { en: string; fr: string };
  likelihood: { en: string; fr: string };
  timeDelay: { en: string; fr: string };
  effort: { en: string; fr: string };
}

/**
 * The value equation, computed rather than asserted.
 *
 * Outcome uses the prospect's OWN two numbers and a deliberately conservative
 * recovery band (10–25% of enquiries currently going unanswered). The band is
 * wide on purpose: a single confident figure would be a fabricated promise,
 * and a clinician who spots one invented number discards the whole audit.
 */
export function frameValue(score: number, input: AuditInput): ValueFraming {
  const value = input.patientValueEur ?? null;
  const enquiries = input.monthlyEnquiries ?? null;

  let low: number | null = null;
  let high: number | null = null;
  if (value && enquiries && value > 0 && enquiries > 0) {
    // The worse the site scores, the larger the share plausibly being lost.
    const gap = Math.min(1, Math.max(0, (10 - score) / 10));
    low = Math.round(enquiries * 0.10 * gap * value);
    high = Math.round(enquiries * 0.25 * gap * value);
  }

  const firstYear = SETUP_PLAN.totalEur + PLANS.croissance.monthlyEur * 12;

  return {
    outcomeLowEur: low,
    outcomeHighEur: high,
    outcomeBasis: {
      en: value && enquiries
        ? `Your figures: ${enquiries} enquiries a month at €${value.toLocaleString()} per new patient, assuming 10–25% currently go unanswered — the share scales with the gaps found above. Estimated, not promised.`
        : "Add your average patient value and monthly enquiries to see what the gaps above are plausibly costing you.",
      fr: value && enquiries
        ? `Vos chiffres : ${enquiries} demandes par mois à ${value.toLocaleString()} € par nouveau patient, en supposant que 10 à 25 % restent aujourd'hui sans réponse — la proportion suit les manques relevés ci-dessus. Estimation, pas une promesse.`
        : "Indiquez la valeur moyenne d'un patient et vos demandes mensuelles pour estimer ce que les manques ci-dessus vous coûtent.",
    },
    likelihood: {
      en: "Every gap above is fixed by the same system, and the terms are in writing: live in 7 days or 10% back per day late, every enquiry answered within 60 seconds or that month is free, and full refund of the installation if we don't deliver.",
      fr: "Chaque manque ci-dessus est corrigé par le même système, et les conditions sont écrites : en ligne en 7 jours ou 10 % remboursés par jour de retard, chaque demande répondue en moins de 60 secondes ou le mois est offert, et remboursement intégral de la mise en place si nous ne livrons pas.",
    },
    timeDelay: {
      en: `Live in ${SETUP_PLAN.delivery}. Not a quote in two weeks and a project in three months.`,
      fr: `En ligne en ${SETUP_PLAN.deliveryFr ?? "7 jours"}. Pas un devis dans deux semaines et un projet dans trois mois.`,
    },
    effort: {
      en: "A 10-minute form. We write the copy, train the assistant, set up the domain and email, and hand it over. No calls, no meetings, no homework.",
      fr: "Un formulaire de 10 minutes. Nous rédigeons les textes, entraînons l'assistante, configurons le domaine et l'email, puis nous vous remettons le tout. Aucun appel, aucune réunion, aucun devoir.",
    },
  };
}

/** First-year cost of the anchor tier — what the outcome range is weighed against. */
export function firstYearCostEur(): number {
  return SETUP_PLAN.totalEur + PLANS.croissance.monthlyEur * 12;
}

/* ───────────────────────────── orchestration ───────────────────────────── */

export function runAudit(input: AuditInput): AuditResult {
  const h = input.html;
  const t = visibleText(h);

  const findings: Finding[] = [
    scoreCapture(h, t),
    scoreAfterHours(h, t),
    scoreMobile(h),
    scoreTrust(h, t),
    scoreClarity(t),
    scoreSpeed(input.bytes, input.fetchMs),
    scoreCompliance(h, t),
  ];

  // Weighted mean over the dimensions that could actually be scored, so an
  // unrunnable check never masquerades as a failure.
  let weighted = 0;
  let totalWeight = 0;
  for (const f of findings) {
    if (f.score == null) continue;
    const dim = AUDIT_DIMENSIONS.find((d) => d.key === f.dimension);
    if (!dim) continue;
    weighted += f.score * dim.weight;
    totalWeight += dim.weight;
  }
  const score = totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : 0;

  const verdict: AuditResult["verdict"] =
    score < 4 ? "critical" : score < 6 ? "weak" : score < 8 ? "fair" : "strong";

  // Worst first — the constraint is what they should act on, per the
  // theory-of-constraints logic in the funnel skills.
  findings.sort((a, b) => (a.score ?? 99) - (b.score ?? 99));

  return { url: input.url, score, verdict, findings, value: frameValue(score, input) };
}
