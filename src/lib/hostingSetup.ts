import { HOSTING_TIERS, resolveHostingPlan } from "@/lib/hosting";

/**
 * THE HOSTING SETUP CHECKLIST — one source, computed from facts.
 *
 * Between paying and being hosted a client used to hear nothing, and the one
 * page they could open said "Nothing needs your attention. Your site is online
 * and up to date" while its own status tile read "Checking" and the setup form
 * had never been sent. Both could not be true; the second was measured.
 *
 * So every line here is either MEASURED or TICKED BY A PERSON, and says which:
 *
 *   paid      auto  the hosting_clients row (it exists only after payment)
 *   details   auto  the setup form was submitted (or we already host them)
 *   onboard   HAND  their site is set up on our hosting (the founder ticks it,
 *                   and can only once the Vercel project is recorded)
 *   dns       auto  a live DNS lookup: the domain answers from Vercel
 *   https     auto  a TLS handshake with a valid certificate, once DNS points
 *   live      auto  HTTP 200 over https, served by Vercel, AND Vercel's API
 *                   confirms the host is on the project recorded for them
 *   forms     HAND  their forms (and tracking, on plans that include it) tested
 *   mailbox   HAND  Business only: the mailbox and SPF/DKIM/DMARC set up
 *
 * PURE. No database, no network, no clock: the caller hands in the row, what
 * it knows about the client, and the last probe. That is what lets the tests
 * walk every state, and what lets the portal, the admin page, the cron and the
 * "Check again" button all show the same thing.
 *
 * The one rule this file exists to keep: nothing is called "live" or
 * "online" until `live` has passed. See noticedQuiet().
 */

export type StepId = "paid" | "details" | "onboard" | "dns" | "https" | "live" | "forms" | "mailbox";
export type HandStep = "onboard" | "forms" | "mailbox";
export const HAND_STEPS: readonly HandStep[] = ["onboard", "forms", "mailbox"];
export type Milestone = "dns" | "live";
export const MILESTONES: readonly Milestone[] = ["dns", "live"];

export type Lang = "en" | "fr";

/**
 * THE CUTOVER. Every real hosting row created before this moment belongs to
 * an ESTABLISHED client: the owner's rule is that existing subscribers'
 * records are not changed, so for them the tracker is not used at all — no
 * checklist on their page (their measured status only), no row writes, no
 * milestone email, no founder notice, skipped by the cron, read-only on the
 * admin page.
 *
 * Deliberately wider than "active or past_due": a suspended or churned client
 * from before the cutover is an existing subscriber too, and nothing here has
 * any business writing to their row. Test rows are never established.
 */
export const SETUP_TRACKER_SINCE = "2026-09-25T00:00:00Z";

export function isEstablished(row: { is_test?: boolean | null; created_at?: string | null; started_at?: string | null }): boolean {
  if (row.is_test === true) return false;
  const born = Date.parse(row.created_at ?? row.started_at ?? "");
  // No date at all: treat as existing. Leaving a real row alone is the safe mistake.
  return !Number.isFinite(born) || born < Date.parse(SETUP_TRACKER_SINCE);
}

/** One DNS record the domain needs, and what it answered with just now. */
export interface RecordCheck {
  type: "A" | "CNAME";
  /** As a registrar's form asks for it: "@", "www", "shop". */
  name: string;
  /** The full host this record is for. */
  host: string;
  /** The value to enter. */
  value: string;
  /** This host already answers from us. */
  ok: boolean;
  /** What the host answered with, for the client to compare. */
  found: string[];
}

/** What a live check measured. Written by src/lib/hostingSetupProbe.ts. */
export interface Probe {
  at: string;
  /** The host the checks ran against (the apex, or the subdomain given). */
  host: string;
  dns: {
    pointed: boolean;
    /** The domain's nameservers are Vercel's: there is nothing to add by hand. */
    viaNameservers: boolean;
    records: RecordCheck[];
    error?: string;
  };
  /** Null when not attempted (DNS does not point to us yet). */
  tls: { ok: boolean; validTo?: string; issuer?: string; error?: string } | null;
  /** Null when not attempted. */
  http: {
    status: number | null;
    /** The answer carried Vercel's own headers (server: Vercel / x-vercel-id). */
    servedByUs: boolean;
    /** Vercel's API says the host is on the project recorded for this client.
     *  Null when it could not be asked (no project recorded, API not set). */
    attached: boolean | null;
    finalHost: string | null;
    error?: string;
  } | null;
}

/**
 * What is stored on hosting_clients.setup (supabase/2026-09-25-hosting-setup.sql).
 * Every writer bumps `rev` and writes only if `rev` is still what it read, so
 * a cron run, a "Check again" and a founder's tick cannot overwrite each other.
 */
export interface SetupState {
  rev?: number;
  /** The first check that actually MEASURED something (see isMeasured).
   *  Before it, every check is silent; at it, what is already done is
   *  stamped as baseline; after it, a milestone reached is emailed. */
  baselineAt?: string;
  /** When the setup form arrived. */
  detailsAt?: string;
  /** The founder's ticks: step -> when. */
  hand?: Partial<Record<HandStep, string>>;
  /** The first time each step was observed done. */
  seen?: Partial<Record<StepId, string>>;
  /**
   * The client's milestone emails:
   *   "claim:<n>:<iso>"   being sent now (attempt n); a claim older than ten
   *                       minutes is a crashed send and may be taken again
   *   "<iso>"             sent — written only AFTER the send succeeded
   *   "failed:<n>:<iso>"  attempt n failed; retried on the next check, up to 5
   *   "baseline:<iso>"    already done at the first measured check: not news
   *   "covered:<iso>"     a bigger milestone's email said it at the same moment
   *   "no-address:<iso>"  nobody to send it to
   */
  mail?: Partial<Record<Milestone, string>>;
  /** Same stamps for the founder's notification. */
  owner?: Partial<Record<Milestone, string>>;
  checkedAt?: string;
  probe?: Probe;
  completeAt?: string;
}

/** The columns this needs from hosting_clients. */
export interface SetupRow {
  id: string;
  plan: string | null;
  status: string | null;
  email: string | null;
  business: string | null;
  site_url: string | null;
  repo: string | null;
  vercel_project: string | null;
  notes: string | null;
  started_at: string | null;
  created_at?: string | null;
  subscription_id: string | null;
  is_test?: boolean | null;
  setup?: SetupState | null;
}

/** What the server knows about the client beyond the row. */
export interface SetupContext {
  /** In CLIENT_REFS: we already know where their site lives. */
  knownClient: boolean;
  /** CLIENT_REFS records the repository we deploy for them. */
  knownRepo: boolean;
  /** The host the checks run against, or null when we do not know it yet. */
  host: string | null;
  /** The domain was registered by Servolia (it sits on Vercel DNS). */
  domainOurs: boolean;
  /** The setup form, for the step that asks the client for it. */
  setupHref?: string | null;
}

export type StepState = "done" | "action" | "doing" | "waiting";

export interface ChecklistStep {
  id: StepId;
  kind: "auto" | "hand";
  state: StepState;
  title: string;
  /** One line under the title: what is true right now, in plain words. */
  detail: string;
  doneAt: string | null;
  /** For a step we are working on: when it started. */
  startedAt: string | null;
  /** The timeframe we have ALREADY promised in writing, if there is one. */
  promise: string | null;
  cta: { label: string; href: string } | null;
}

export interface Checklist {
  /** False for anything that is not a hosting tier (the AI assistant, SEO). */
  applies: boolean;
  steps: ChecklistStep[];
  done: number;
  total: number;
  complete: boolean;
  current: StepId | null;
  /** (e) passed: the site answered 200 from our hosting. */
  liveVerified: boolean;
  checkedAt: string | null;
  host: string | null;
  /** The records to show, while the DNS step is the one in front of them. */
  records: RecordCheck[];
  /** Who adds the records: the client, either of us, or nobody (our DNS). */
  recordsBy: "client" | "either" | "none";
}

/* ── Copy ──────────────────────────────────────────────────────────────── */

const COPY = {
  en: {
    paid: "Payment received",
    paidDone: "Your plan is paid and your reference is on every email.",
    details: "Your site details",
    detailsDone: "We have where your site and domain live.",
    detailsKnown: "We already host your site, so there was nothing to send.",
    detailsAction: "Tell us where your site and domain live — two minutes, no password.",
    detailsCta: "Send my site details",
    onboard: "Your site set up on our hosting",
    onboardDone: "Your site is on our servers.",
    onboardDoing: "We're doing this: we arrange access with you, then move your site onto our hosting.",
    onboardPromise: "We get in touch within one working day of receiving your details.",
    onboardWaiting: "Starts as soon as your site details arrive.",
    dns: "Domain pointed to us",
    dnsDone: (h: string) => `${h} answers from our servers.`,
    dnsWaitingHost: "Waiting for your site's address.",
    dnsWaitingOnboard: "Not yet — pointing your domain before your site is on our servers would take it offline.",
    dnsActionClient: (h: string) => `Add the records below where ${h} is registered. We check again every 15 minutes.`,
    dnsActionEither: (h: string) => `We point ${h} once we have access to your DNS — or add the records below yourself to go faster. We check every 15 minutes.`,
    dnsDoingOurs: (h: string) => `The DNS for ${h} is with us: it points here as soon as we attach it to your site.`,
    https: "Secure connection (https)",
    httpsDone: (until: string | null) => until ? `Valid certificate (the current one runs to ${until}).` : "Valid certificate.",
    httpsDoing: "The certificate is issued automatically once your domain points to us. We check every 15 minutes.",
    httpsWaiting: "Starts once your domain points to us.",
    live: "Site live on Servolia hosting",
    liveDone: (h: string) => `https://${h} answered from our hosting.`,
    liveDoing: (why: string) => `${why} We check every 15 minutes.`,
    liveWaiting: "Starts once the steps above are done.",
    liveWhyStatus: (s: number) => `Your address answered with an error (HTTP ${s}).`,
    liveWhyElsewhere: "Your address is still answering from another host.",
    liveWhyUnconfirmed: "Your address answers, but we have not yet confirmed it is attached to your site on our hosting.",
    liveWhyNoAnswer: "Your address did not answer our check.",
    forms: "Contact forms tested",
    formsAndTracking: "Contact forms and tracking tested",
    formsDone: "Tested after the move: enquiries reach you.",
    formsDoing: "We're doing this: we send a test enquiry through each form and check it reaches you.",
    formsWaiting: "Starts once your site is live on our hosting.",
    mailbox: "Business email on your domain",
    mailboxDone: "Your mailbox is set up, with SPF, DKIM and DMARC.",
    mailboxDoing: "We're doing this: your mailbox, then the records that keep your mail out of spam.",
    mailboxWaiting: "Starts once your site is set up on our hosting.",
  },
  fr: {
    paid: "Paiement reçu",
    paidDone: "Votre formule est payée et votre référence figure sur chaque email.",
    details: "Les informations de votre site",
    detailsDone: "Nous savons où se trouvent votre site et votre domaine.",
    detailsKnown: "Nous hébergeons déjà votre site : il n'y avait rien à envoyer.",
    detailsAction: "Dites-nous où se trouvent votre site et votre domaine — deux minutes, sans mot de passe.",
    detailsCta: "Envoyer les informations",
    onboard: "Votre site installé sur notre hébergement",
    onboardDone: "Votre site est sur nos serveurs.",
    onboardDoing: "Nous nous en occupons : nous organisons les accès avec vous, puis nous installons votre site sur notre hébergement.",
    onboardPromise: "Nous vous écrivons sous un jour ouvré après réception de vos informations.",
    onboardWaiting: "Commence dès réception des informations de votre site.",
    dns: "Domaine dirigé vers nous",
    dnsDone: (h: string) => `${h} répond depuis nos serveurs.`,
    dnsWaitingHost: "En attente de l'adresse de votre site.",
    dnsWaitingOnboard: "Pas encore — diriger votre domaine avant que votre site soit sur nos serveurs le mettrait hors ligne.",
    dnsActionClient: (h: string) => `Ajoutez les enregistrements ci-dessous là où ${h} est enregistré. Nous vérifions toutes les 15 minutes.`,
    dnsActionEither: (h: string) => `Nous dirigeons ${h} dès que nous avons accès à vos DNS — ou ajoutez vous-même les enregistrements ci-dessous pour aller plus vite. Nous vérifions toutes les 15 minutes.`,
    dnsDoingOurs: (h: string) => `Les DNS de ${h} sont chez nous : il pointe ici dès que nous le rattachons à votre site.`,
    https: "Connexion sécurisée (https)",
    httpsDone: (until: string | null) => until ? `Certificat valide (l'actuel court jusqu'au ${until}).` : "Certificat valide.",
    httpsDoing: "Le certificat est émis automatiquement dès que votre domaine pointe vers nous. Nous vérifions toutes les 15 minutes.",
    httpsWaiting: "Commence dès que votre domaine pointe vers nous.",
    live: "Site en ligne sur l'hébergement Servolia",
    liveDone: (h: string) => `https://${h} a répondu depuis notre hébergement.`,
    liveDoing: (why: string) => `${why} Nous vérifions toutes les 15 minutes.`,
    liveWaiting: "Commence une fois les étapes ci-dessus terminées.",
    liveWhyStatus: (s: number) => `Votre adresse a répondu par une erreur (HTTP ${s}).`,
    liveWhyElsewhere: "Votre adresse répond encore depuis un autre hébergeur.",
    liveWhyUnconfirmed: "Votre adresse répond, mais nous n'avons pas encore confirmé qu'elle est rattachée à votre site sur notre hébergement.",
    liveWhyNoAnswer: "Votre adresse n'a pas répondu à notre vérification.",
    forms: "Formulaires de contact testés",
    formsAndTracking: "Formulaires de contact et suivi testés",
    formsDone: "Testés après le transfert : les demandes vous parviennent.",
    formsDoing: "Nous nous en occupons : nous envoyons une demande test par chaque formulaire et vérifions qu'elle vous parvient.",
    formsWaiting: "Commence dès que votre site est en ligne sur notre hébergement.",
    mailbox: "Messagerie à votre nom de domaine",
    mailboxDone: "Votre boîte est en place, avec SPF, DKIM et DMARC.",
    mailboxDoing: "Nous nous en occupons : votre boîte, puis les enregistrements qui gardent vos emails hors des spams.",
    mailboxWaiting: "Commence dès que votre site est installé sur notre hébergement.",
  },
};

/** Copy shared with the tracker components and the emails. */
export const TRACKER_COPY = {
  en: {
    heading: "Setting up your hosting",
    headingDone: "Your hosting is set up",
    progress: (d: number, t: number) => `${d} of ${t} done`,
    checkedAt: (when: string) => `Last checked ${when}`,
    checkAgain: "Check again",
    checking: "Checking…",
    tooSoon: "Checked a moment ago — try again in a few minutes.",
    failed: "The check did not run. Try again in a moment.",
    doing: "We're doing this",
    yourStep: "Your step",
    waiting: "Next",
    done: "Done",
    started: (d: string) => `started ${d}`,
    recordsTitle: "The records to add",
    recordsNone: "Your domain's DNS is with us — there is nothing to add.",
    type: "Type",
    name: "Name",
    value: "Value",
    copy: "Copy",
    copied: "Copied",
    answersNow: "Answers now",
    answersOk: "correct",
    answersNothing: "nothing yet",
    completeLine: (d: string) => `Every step is done — finished ${d}.`,
  },
  fr: {
    heading: "Mise en place de votre hébergement",
    headingDone: "Votre hébergement est en place",
    progress: (d: number, t: number) => `${d} sur ${t} terminées`,
    checkedAt: (when: string) => `Dernière vérification ${when}`,
    checkAgain: "Vérifier à nouveau",
    checking: "Vérification…",
    tooSoon: "Vérifié à l'instant — réessayez dans quelques minutes.",
    failed: "La vérification n'a pas pu se faire. Réessayez dans un instant.",
    doing: "Nous nous en occupons",
    yourStep: "À vous",
    waiting: "Ensuite",
    done: "Fait",
    started: (d: string) => `commencé le ${d}`,
    recordsTitle: "Les enregistrements à ajouter",
    recordsNone: "Les DNS de votre domaine sont chez nous — il n'y a rien à ajouter.",
    type: "Type",
    name: "Nom",
    value: "Valeur",
    copy: "Copier",
    copied: "Copié",
    answersNow: "Répond actuellement",
    answersOk: "correct",
    answersNothing: "rien pour l'instant",
    completeLine: (d: string) => `Toutes les étapes sont faites — terminé le ${d}.`,
  },
};

/* ── Small helpers ─────────────────────────────────────────────────────── */

/** "Submitted 2026-09-25" — the line /api/hosting-setup has always written. */
export function submittedFromNotes(notes: string | null | undefined): string | null {
  const text = String(notes ?? "");
  if (!/^Platform: .+$/m.test(text)) return null;
  const m = text.match(/^Submitted (\d{4}-\d{2}-\d{2})$/m);
  return m ? `${m[1]}T00:00:00.000Z` : null;
}

/** True when the setup form has been submitted, by the stamp or by the notes. */
export function detailsReceived(row: Pick<SetupRow, "notes" | "setup">): boolean {
  return Boolean(row.setup?.detailsAt) || /^Platform: .+$/m.test(String(row.notes ?? ""));
}

/** Plans that host a site. The checklist is about hosting and nothing else. */
export function checklistApplies(plan: string | null | undefined): boolean {
  return HOSTING_TIERS.includes(String(plan ?? "").toLowerCase());
}

function planIncludes(plan: string | null | undefined, needle: RegExp): boolean {
  const p = resolveHostingPlan(plan);
  return Boolean(p?.includes.some((line) => needle.test(line)));
}

const dayOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

/* ── The checklist ─────────────────────────────────────────────────────── */

/**
 * The checklist for one hosting client.
 *
 * `probe` is the latest live check (null when none has run: the DNS, https and
 * live steps then stay open — an unchecked step is never counted as done).
 */
export function computeChecklist(
  row: SetupRow,
  ctx: SetupContext,
  probe: Probe | null,
  lang: Lang = "en",
): Checklist {
  const t = COPY[lang];
  const state = row.setup ?? {};
  const seen = state.seen ?? {};
  const hand = state.hand ?? {};
  const applies = checklistApplies(row.plan);
  const plan = String(row.plan ?? "").toLowerCase();
  const host = ctx.host;
  /* A probe about a different host (the client changed their address) says
     nothing about this one. */
  const p = probe && host && probe.host === host ? probe : null;

  const steps: ChecklistStep[] = [];
  const add = (s: Omit<ChecklistStep, "doneAt" | "startedAt" | "promise" | "cta"> & Partial<ChecklistStep>) =>
    steps.push({ doneAt: null, startedAt: null, promise: null, cta: null, ...s });

  // (a) Paid — a row with a subscription on it exists only after payment.
  const paid = Boolean(row.subscription_id) && ["active", "past_due", "trialing", "suspended"].includes(String(row.status ?? ""));
  const paidAt = row.started_at ?? row.created_at ?? null;
  add({ id: "paid", kind: "auto", state: paid ? "done" : "waiting", title: t.paid, detail: paid ? t.paidDone : "", doneAt: paid ? paidAt : null });

  // (b) Site details.
  const formAt = state.detailsAt ?? submittedFromNotes(row.notes);
  const alreadyOurs = ctx.knownClient || ctx.knownRepo || Boolean(row.repo || row.vercel_project);
  const details = detailsReceived(row) || alreadyOurs;
  const detailsAt = formAt ?? (details ? paidAt : null);
  add({
    id: "details", kind: "auto",
    state: details ? "done" : paid ? "action" : "waiting",
    title: t.details,
    detail: details ? (formAt || !alreadyOurs ? t.detailsDone : t.detailsKnown) : t.detailsAction,
    doneAt: details ? detailsAt : null,
    cta: !details && ctx.setupHref ? { label: t.detailsCta, href: ctx.setupHref } : null,
  });

  // (c-hand) Their site on our hosting: the founder's tick, which the admin
  // endpoint accepts only once the Vercel project is recorded — and which
  // stops counting if that project is ever cleared, because "live" is then
  // checked against it.
  const onboard = Boolean(hand.onboard && row.vercel_project);
  const onboardStart = !onboard && details ? detailsAt : null;
  add({
    id: "onboard", kind: "hand",
    state: onboard ? "done" : details ? "doing" : "waiting",
    title: t.onboard,
    detail: onboard ? t.onboardDone : details ? t.onboardDoing : t.onboardWaiting,
    doneAt: onboard ? (hand.onboard ?? seen.onboard ?? null) : null,
    startedAt: onboardStart,
    // The promise is shown only beside the date it runs from; /admin/today
    // marks the row OVERDUE once a working day has passed (onboardOverdue).
    promise: onboardStart ? t.onboardPromise : null,
  });

  // (c) DNS — measured. Only counted once their site is on our hosting: a
  // domain that already answers from Vercel (their own account, say) before
  // we have set anything up is not "pointed to us".
  const dnsOk = onboard && Boolean(p?.dns.pointed);
  const recordsBy: Checklist["recordsBy"] = ctx.domainOurs || p?.dns.viaNameservers
    ? "none"
    : plan === "hosting_lite" ? "client" : "either";
  let dnsState: StepState;
  let dnsDetail: string;
  if (dnsOk) { dnsState = "done"; dnsDetail = t.dnsDone(host ?? ""); }
  else if (!host) { dnsState = "waiting"; dnsDetail = t.dnsWaitingHost; }
  else if (!onboard) { dnsState = "waiting"; dnsDetail = t.dnsWaitingOnboard; }
  else if (recordsBy === "none") { dnsState = "doing"; dnsDetail = t.dnsDoingOurs(host); }
  else if (recordsBy === "client") { dnsState = "action"; dnsDetail = t.dnsActionClient(host); }
  else { dnsState = "doing"; dnsDetail = t.dnsActionEither(host); }
  add({ id: "dns", kind: "auto", state: dnsState, title: t.dns, detail: dnsDetail, doneAt: dnsOk ? (seen.dns ?? p?.at ?? null) : null });

  // (d) https — measured, and only meaningful once DNS points here: a valid
  // certificate on the OLD host is not our secure connection.
  const tlsOk = dnsOk && Boolean(p?.tls?.ok);
  add({
    id: "https", kind: "auto",
    state: tlsOk ? "done" : dnsOk ? "doing" : "waiting",
    title: t.https,
    detail: tlsOk ? t.httpsDone(dayOnly(p?.tls?.validTo)) : dnsOk ? t.httpsDoing : t.httpsWaiting,
    doneAt: tlsOk ? (seen.https ?? p?.at ?? null) : null,
  });

  // (e) Live — measured: 200, from Vercel, on their own address, AND
  // Vercel's API confirms the host is on the project recorded for them.
  // Vercel's headers alone would also pass for a site on somebody else's
  // Vercel account, so an unconfirmed attachment is never live.
  const h = p?.http ?? null;
  const sameSite = Boolean(h?.finalHost && host && h.finalHost.replace(/^www\./, "") === host.replace(/^www\./, ""));
  const liveOk = tlsOk && onboard && h?.status === 200 && h.servedByUs && h.attached === true && sameSite;
  let liveDetail: string;
  if (liveOk) liveDetail = t.liveDone(host ?? "");
  else if (!(tlsOk && onboard)) liveDetail = t.liveWaiting;
  else if (!h || h.status === null) liveDetail = t.liveDoing(t.liveWhyNoAnswer);
  else if (!h.servedByUs || h.attached === false || !sameSite) liveDetail = t.liveDoing(t.liveWhyElsewhere);
  else if (h.status !== 200) liveDetail = t.liveDoing(t.liveWhyStatus(h.status));
  else liveDetail = t.liveDoing(t.liveWhyUnconfirmed);
  add({
    id: "live", kind: "auto",
    state: liveOk ? "done" : tlsOk && onboard ? "doing" : "waiting",
    title: t.live, detail: liveDetail,
    doneAt: liveOk ? (seen.live ?? p?.at ?? null) : null,
  });

  // (f-hand) Forms, and tracking where the plan includes it. No code can see
  // a client's WordPress form deliver an email, so a person ticks this.
  if (planIncludes(row.plan, /forms/i)) {
    const tracking = planIncludes(row.plan, /tracking/i);
    const formsDone = Boolean(hand.forms);
    add({
      id: "forms", kind: "hand",
      state: formsDone ? "done" : liveOk ? "doing" : "waiting",
      title: tracking ? t.formsAndTracking : t.forms,
      detail: formsDone ? t.formsDone : liveOk ? t.formsDoing : t.formsWaiting,
      doneAt: formsDone ? hand.forms ?? null : null,
      startedAt: !formsDone && liveOk ? (seen.live ?? p?.at ?? null) : null,
    });
  }

  // (g-hand) Business: the mailbox.
  if (plan === "hosting_business") {
    const mailDone = Boolean(hand.mailbox);
    add({
      id: "mailbox", kind: "hand",
      state: mailDone ? "done" : onboard ? "doing" : "waiting",
      title: t.mailbox,
      detail: mailDone ? t.mailboxDone : onboard ? t.mailboxDoing : t.mailboxWaiting,
      doneAt: mailDone ? hand.mailbox ?? null : null,
      startedAt: !mailDone && onboard ? (hand.onboard ?? seen.onboard ?? detailsAt) : null,
    });
  }

  const done = steps.filter((s) => s.state === "done").length;
  const current = steps.find((s) => s.state !== "done")?.id ?? null;
  return {
    applies,
    steps,
    done,
    total: steps.length,
    complete: applies && done === steps.length,
    current,
    liveVerified: liveOk,
    checkedAt: p?.at ?? null,
    host,
    records: current === "dns" && recordsBy !== "none" ? (p?.dns.records ?? []) : [],
    recordsBy,
  };
}

/** The ids of the steps that are done. */
export function doneSteps(list: Checklist): StepId[] {
  return list.steps.filter((s) => s.state === "done").map((s) => s.id);
}

/* ── What changed since the last check ─────────────────────────────────── */

/**
 * Did this check actually MEASURE the address? DNS answered without a
 * resolver error AND the site gave an HTTP status. A timed-out lookup or a
 * fetch that never connected measured nothing, so it can neither set the
 * baseline nor be read as "not pointed yet".
 */
export function isMeasured(probe: Probe | null | undefined): boolean {
  return Boolean(probe && !probe.dns.error && typeof probe.http?.status === "number");
}

export const MAX_MAIL_TRIES = 5;
const CLAIM_STALE_MS = 10 * 60_000;

/** "claim:<n>:<iso>" / "failed:<n>:<iso>" -> { kind, n, at }. */
function parseStamp(s: string | undefined): { kind: string; n: number; at: number } | null {
  if (!s) return null;
  const m = s.match(/^(claim|failed):(\d+):(.+)$/);
  return m ? { kind: m[1], n: Number(m[2]), at: Date.parse(m[3]) } : { kind: "final", n: 0, at: NaN };
}

/**
 * May this milestone's email be sent now, and as which attempt? Null when it
 * is settled (sent, baseline, covered, no address, or out of tries) or is
 * being sent by someone else right now.
 */
export function mailAttempt(stamp: string | undefined, nowMs: number): number | null {
  const s = parseStamp(stamp);
  if (!s) return 1;
  if (s.kind === "claim") return nowMs - s.at > CLAIM_STALE_MS ? s.n + 1 : null;
  if (s.kind === "failed") return s.n < MAX_MAIL_TRIES ? s.n + 1 : null;
  return null;
}

export interface Transition {
  next: SetupState;
  /** Milestone emails to send now. Each is CLAIMED in `next`, never marked sent. */
  send: Milestone[];
  /** The claim written for each milestone in `send`, to settle after the send. */
  claims: Partial<Record<Milestone, string>>;
  /** Milestones to tell the founder about now. */
  notify: Milestone[];
}

/**
 * The state to store after a check, and which milestone messages it earns.
 *
 * A MILESTONE IS NEWS ONLY WHEN IT FLIPS AFTER A REAL MEASUREMENT. Until a
 * check has measured the address (isMeasured), every check is silent and no
 * baseline is set — a failed first probe is never taken as the starting
 * point. The first measured check is the baseline: milestones already done
 * then are stamped "baseline", not sent. After it, a milestone that is done
 * and not yet settled is claimed for sending.
 *
 * NOTHING IS STAMPED "SENT" HERE. The caller writes `next` (with the claims)
 * as a compare-and-swap, sends, and only then settles each claim: the send
 * time on success, "failed:<n>" on failure (retried next check, up to
 * MAX_MAIL_TRIES). Of two checks racing, only the one whose write lands holds
 * the claim, so one email goes out.
 *
 * Both milestones due at once send ONE email, the live one; the domain
 * milestone is marked covered by it.
 */
export function planTransition(prev: SetupState | null | undefined, list: Checklist, nowIso: string, measured: boolean): Transition {
  const before = prev ?? {};
  const nowMs = Date.parse(nowIso);
  const done = doneSteps(list);
  const seen = { ...(before.seen ?? {}) };
  for (const id of done) if (!seen[id]) seen[id] = nowIso;
  const mail = { ...(before.mail ?? {}) };
  const owner = { ...(before.owner ?? {}) };
  const next: SetupState = { ...before, rev: (before.rev ?? 0) + 1, seen, mail, owner, checkedAt: nowIso };

  const send: Milestone[] = [];
  const claims: Partial<Record<Milestone, string>> = {};
  const notify: Milestone[] = [];

  if (!before.baselineAt) {
    if (measured) {
      next.baselineAt = nowIso;
      for (const m of MILESTONES) {
        if (!done.includes(m) || mail[m]) continue;
        mail[m] = `baseline:${nowIso}`;
        owner[m] = owner[m] ?? `baseline:${nowIso}`;
      }
    }
  } else {
    const due = MILESTONES.filter((m) => done.includes(m) && mailAttempt(mail[m], nowMs) !== null);
    const pick: Milestone | null = due.includes("live") ? "live" : due.includes("dns") ? "dns" : null;
    if (pick) {
      const n = mailAttempt(mail[pick], nowMs) ?? 1;
      claims[pick] = `claim:${n}:${nowIso}`;
      mail[pick] = claims[pick];
      send.push(pick);
      // Any domain email still pending (never sent, failed, or a stale claim)
      // is said by the live email; sending it afterwards would read backwards.
      if (pick === "live" && due.includes("dns")) {
        mail.dns = `covered:${nowIso}`;
        owner.dns = owner.dns ?? `covered:${nowIso}`;
      }
      if (!owner[pick]) {
        notify.push(pick);
        owner[pick] = nowIso;
      }
    }
  }

  if (list.complete && !before.completeAt) next.completeAt = nowIso;
  if (!list.complete && before.completeAt) delete next.completeAt; // a step was undone
  return { next, send, claims, notify };
}

/** What a claim becomes once the send has resolved. */
export function settleClaim(claim: string, sent: boolean | null, nowIso: string): string {
  if (sent === null) return `no-address:${nowIso}`;
  if (sent) return nowIso;
  const n = parseStamp(claim)?.n ?? 1;
  return `failed:${n}:${nowIso}`;
}

/**
 * The only timeframe promised in writing for setup: SetupForm's "we get in
 * touch within one working day". Overdue once the whole of the next working
 * day (UTC, Monday to Friday) after the details arrived has passed.
 */
export function onboardOverdue(startIso: string | null | undefined, nowMs: number): boolean {
  const start = Date.parse(String(startIso ?? ""));
  if (!Number.isFinite(start)) return false;
  const d = new Date(start);
  d.setUTCHours(0, 0, 0, 0);
  let working = 0;
  while (working < 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) working += 1;
  }
  d.setUTCDate(d.getUTCDate() + 1); // end of that working day
  return nowMs >= d.getTime();
}

/* ── "What we noticed", said only from measurements ────────────────────── */

const QUIET = {
  en: {
    setup: "Nothing else to report while your hosting is being set up — the checklist above shows each step as it is checked.",
    up: "Nothing needs your attention. Your site is online — it answered when this page loaded.",
    down: (s: number | null) => `Your site did not answer properly when this page loaded${s ? ` (HTTP ${s})` : ""}. Reply to any email from us and we fix it.`,
    unknown: "Nothing to report. We could not reach your site to check it just now.",
  },
  fr: {
    setup: "Rien d'autre à signaler pendant la mise en place de votre hébergement — la liste ci-dessus montre chaque étape au fil des vérifications.",
    up: "Rien ne demande votre attention. Votre site est en ligne — il a répondu à l'ouverture de cette page.",
    down: (s: number | null) => `Votre site n'a pas répondu correctement à l'ouverture de cette page${s ? ` (HTTP ${s})` : ""}. Répondez à l'un de nos emails et nous réparons.`,
    unknown: "Rien à signaler. Nous n'avons pas pu joindre votre site pour le vérifier à l'instant.",
  },
};

/**
 * The line under "What we noticed" when there is nothing to recommend.
 *
 * "Online" only when BOTH are true: the hosting setup has passed its live
 * check (or there is no hosting setup — an add-on client), and the site
 * answered on this very page load. Anything short of that says what was
 * actually measured.
 */
export function noticedQuiet(input: {
  lang: Lang;
  checklist: Checklist | null;
  health: { up: boolean | null; status: number | null };
}): string {
  const t = QUIET[input.lang];
  const list = input.checklist;
  if (list?.applies && !list.liveVerified) return t.setup;
  if (input.health.up === true) return t.up;
  if (input.health.up === false) return t.down(input.health.status);
  return t.unknown;
}

/** The status tile: "Online" only on the same two conditions. */
export function siteTile(input: {
  lang: Lang;
  checklist: Checklist | null;
  health: { up: boolean | null };
}): { value: string; live: boolean; hint: string | null } {
  const fr = input.lang === "fr";
  const list = input.checklist;
  if (list?.applies && !list.liveVerified) {
    return { value: fr ? "En cours d'installation" : "Setting up", live: false, hint: TRACKER_COPY[input.lang].progress(list.done, list.total) };
  }
  if (input.health.up === true) return { value: fr ? "En ligne" : "Online", live: true, hint: null };
  if (input.health.up === false) return { value: fr ? "Ne répond pas" : "Not responding", live: false, hint: null };
  return { value: fr ? "Vérification" : "Checking", live: false, hint: null };
}
