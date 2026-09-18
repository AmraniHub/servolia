/**
 * THINGS THE CLIENT SHOULD SEE WHEN THEY NEXT OPEN THE PANEL.
 *
 * Two kinds, and the difference matters.
 *
 * DERIVED notices are computed from state we already hold — an assistant built
 * and waiting, a domain just registered, a payment that failed. They need no
 * storage and cannot go stale: when the condition stops being true the notice
 * stops existing. That is the right default, because a notice queue nobody
 * clears is how a panel ends up shouting about something fixed last month.
 *
 * SENT notices are ones Servolia raises by hand for this client. Those are
 * stored, because there is nothing to derive them from.
 *
 * Both are read the same way and both can be dismissed. Dismissal is stored by
 * id, so a derived notice the client has already read does not come back every
 * time they sign in — while still returning if the underlying thing changes.
 *
 * THE TEXT IS NEVER STORED. Only an id and a kind. Prose in a notes column
 * cannot be translated, cannot be corrected, and would put one client's
 * language in front of another's.
 */

const SENT = "servolia-notice:";
const READ = "servolia-notice-read:";

export type NoticeKind =
  | "assistant-trial"
  | "domain-live"
  | "copy-ready"
  | "payment-due"
  | "site-down";

export interface Notice {
  id: string;
  kind: NoticeKind;
  /** ISO. When it became true, or when it was sent. */
  at: string;
  /** Filled in from the copy table, never from storage. */
  title: string;
  body: string;
  href?: string;
  cta?: string;
  tone: "info" | "good" | "warn";
}

const COPY: Record<NoticeKind, Record<"en" | "fr", { title: string; body: string; cta?: string; tone: Notice["tone"] }>> = {
  "assistant-trial": {
    en: {
      title: "Your AI assistant is built and waiting",
      body: "It is already trained on your pages, in your colours. Run it on your own site free for 7 days and see what it catches — nothing is charged unless you keep it.",
      cta: "Start the 7 days",
      tone: "good",
    },
    fr: {
      title: "Votre assistant IA est prêt et vous attend",
      body: "Il est déjà formé sur vos pages, à vos couleurs. Essayez-le gratuitement 7 jours sur votre site et voyez ce qu'il récupère — rien n'est facturé si vous ne le gardez pas.",
      cta: "Démarrer les 7 jours",
      tone: "good",
    },
  },
  "domain-live": {
    en: { title: "Your new domain is registered", body: "We are pointing it at your website. It can take a few minutes to start working.", cta: "See your domains", tone: "good" },
    fr: { title: "Votre nouveau domaine est enregistré", body: "Nous le dirigeons vers votre site. Cela peut prendre quelques minutes.", cta: "Voir vos domaines", tone: "good" },
  },
  "copy-ready": {
    en: { title: "Your copy of the website is ready", body: "The download is on your files page for the next few days.", cta: "Download it", tone: "good" },
    fr: { title: "Votre copie du site est prête", body: "Le téléchargement est disponible sur la page Fichiers pendant quelques jours.", cta: "Télécharger", tone: "good" },
  },
  "payment-due": {
    en: { title: "A payment did not go through", body: "Your site is still online. Updating your card takes a minute and stops it being interrupted.", cta: "Update my card", tone: "warn" },
    fr: { title: "Un paiement n'est pas passé", body: "Votre site est toujours en ligne. Mettre votre carte à jour prend une minute et évite toute interruption.", cta: "Mettre à jour ma carte", tone: "warn" },
  },
  "site-down": {
    en: { title: "We cannot reach your website", body: "We are looking at it now. You do not need to do anything.", cta: "See details", tone: "warn" },
    fr: { title: "Nous n'arrivons pas à joindre votre site", body: "Nous regardons cela. Vous n'avez rien à faire.", cta: "Voir le détail", tone: "warn" },
  },
};

/* ── storage: sent notices, and what has been read ───────────────────────── */

export function readSentNotices(notes: string | null | undefined): { id: string; kind: NoticeKind; at: string }[] {
  return (notes ?? "")
    .split("\n")
    .filter((l) => l.startsWith(SENT))
    .map((l) => {
      const kv: Record<string, string> = {};
      for (const part of l.slice(SENT.length).split("|")) {
        const i = part.indexOf(":");
        if (i > 0) kv[part.slice(0, i).trim()] = part.slice(i + 1).trim();
      }
      return kv.id && kv.kind in COPY
        ? { id: kv.id, kind: kv.kind as NoticeKind, at: kv.at ?? "" }
        : null;
    })
    .filter((n): n is { id: string; kind: NoticeKind; at: string } => n !== null);
}

export function writeSentNotice(notes: string | null | undefined, id: string, kind: NoticeKind, atISO: string): string {
  const keep = (notes ?? "").split("\n").filter((l) => l.trim() !== "" && !l.startsWith(`${SENT} id: ${id} `));
  return [...keep, `${SENT} id: ${id} | kind: ${kind} | at: ${atISO}`].join("\n");
}

export function readDismissed(notes: string | null | undefined): Set<string> {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(READ));
  if (!line) return new Set();
  return new Set(line.slice(READ.length).split(",").map((s) => s.trim()).filter(Boolean));
}

/** Dismissal is one line holding every id, so it cannot grow a line per notice. */
export function writeDismissed(notes: string | null | undefined, ids: Set<string>): string {
  const keep = (notes ?? "").split("\n").filter((l) => l.trim() !== "" && !l.startsWith(READ));
  /* Capped, oldest dropped. A client who has dismissed two hundred notices over
     three years does not need the first hundred remembered, and an unbounded
     line in a shared column eventually breaks something else. */
  const kept = [...ids].slice(-60);
  if (!kept.length) return keep.join("\n");
  return [...keep, `${READ} ${kept.join(", ")}`].join("\n");
}

/* ── putting the two together ────────────────────────────────────────────── */

export interface NoticeState {
  notes: string | null;
  lang: "en" | "fr";
  /** Built for them, not yet bought, no trial running. */
  assistantWaiting: boolean;
  /** A download they can take right now. */
  copyReady: boolean;
  paymentDue: boolean;
  /** Null means we could not check, which is not the same as down. */
  siteUp: boolean | null;
  /** A domain registered in the last week. */
  newDomain?: string | null;
  linkFor: (page: string) => string;
  assistantTrialHref?: string | null;
  billingHref?: string | null;
}

export function noticesFor(state: NoticeState): Notice[] {
  const dismissed = readDismissed(state.notes);
  const out: Notice[] = [];

  const add = (id: string, kind: NoticeKind, at: string, href?: string) => {
    if (dismissed.has(id)) return;
    const c = COPY[kind][state.lang];
    out.push({ id, kind, at, title: c.title, body: c.body, cta: c.cta, tone: c.tone, href });
  };

  /* Warnings first: a client who has to scroll past an offer to find out their
     payment failed will remember the offer for the wrong reason. */
  if (state.paymentDue) add("payment-due", "payment-due", "", state.billingHref ?? state.linkFor("billing"));
  if (state.siteUp === false) add("site-down", "site-down", "", state.linkFor("overview"));

  if (state.copyReady) add("copy-ready", "copy-ready", "", state.linkFor("files"));
  if (state.newDomain) add(`domain-${state.newDomain}`, "domain-live", "", state.linkFor("domains"));
  if (state.assistantWaiting && state.assistantTrialHref) {
    add("assistant-trial", "assistant-trial", "", state.assistantTrialHref);
  }

  for (const sent of readSentNotices(state.notes)) {
    add(sent.id, sent.kind, sent.at, state.linkFor("overview"));
  }
  return out;
}
