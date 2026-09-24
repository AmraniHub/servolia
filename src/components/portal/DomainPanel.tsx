import { Globe, ShieldCheck, Clock } from "lucide-react";

/**
 * "Your domain" — shown to the client, in her own portal.
 *
 * Since C2 (2026-09-22) a practice usually keeps her domain at her own
 * registrar (OVH, IONOS, Gandi…), but CGV 7 bis also lets Servolia register a
 * new one in its own name on her behalf. She is the owner either way. So this
 * panel states what is true and nothing more: the domain, that it is hers
 * (in both of those cases), and whether her site is answering on it yet. It no longer reads the Cloudflare `client_domains`
 * table, which no code wrote to (the Cloudflare registrar was never enabled).
 *
 * It still states the exit plainly, on purpose. A client who can see how to
 * leave is a client who doesn't feel trapped, and doesn't go looking.
 */

export interface PortalDomain {
  name: string;
  live: boolean;
}

/* BOTH CASES OF CGV 7 bis, because the panel cannot tell them apart. It used
   to say "in your name, at your own registrar — nothing to transfer", which
   is true for a domain she already owned and false for one Servolia
   registered for her: that one is in Servolia's name, on her behalf, and
   leaving means a transfer. Nothing on the site row records which case
   applies (a domain we register is attached by the same path), so the panel
   states both rather than guess. */
const COPY = {
  en: {
    title: "Your domain",
    yours: "It is yours, either way",
    cases:
      "A domain you already owned stays in your name, at your own registrar. A domain we registered for you is held in Servolia's name on your behalf, renewed by us while your plan runs, and moved into your name whenever you ask.",
    live: "Your site is live on it",
    waiting: "Waiting for its DNS lines — your site appears here as soon as they are in place",
    exit: "Leaving? Your own domain needs nothing: point it wherever you like. One we registered for you, we transfer to you or your registrar at no charge, within 5 business days of your written request.",
  },
  fr: {
    title: "Votre nom de domaine",
    yours: "Il vous appartient, dans tous les cas",
    cases:
      "Un domaine que vous possédiez déjà reste à votre nom, chez votre propre bureau d'enregistrement. Un domaine que nous avons enregistré pour vous est détenu au nom de Servolia pour votre compte, renouvelé par nous tant que votre formule court, et passé à votre nom dès que vous le demandez.",
    live: "Votre site est en ligne à cette adresse",
    waiting: "En attente de ses lignes DNS — votre site y apparaît dès qu'elles sont en place",
    exit: "Vous partez ? Votre propre domaine n'a besoin de rien : faites-le pointer où vous voulez. Un domaine que nous avons enregistré pour vous, nous vous le transférons, ou à votre bureau d'enregistrement, sans frais, dans les 5 jours ouvrés suivant votre demande écrite.",
  },
};

export default function DomainPanel({ domain, lang = "en" }: { domain: PortalDomain | null; lang?: "en" | "fr" }) {
  const t = COPY[lang === "fr" ? "fr" : "en"];
  if (!domain) return null;
  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-card)] p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[var(--p-accent-soft)] text-[var(--p-accent)]">
          <Globe className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[var(--p-text)]">{t.title}</h3>
          <p className="text-sm font-bold text-[var(--p-accent)] truncate">{domain.name}</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-[var(--p-ok-bg)] p-3 mb-3">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--p-ok-fg)" }} aria-hidden="true" />
        <p className="text-xs font-black" style={{ color: "var(--p-ok-fg)" }}>{t.yours}</p>
      </div>
      <p className="text-[11px] text-[var(--p-muted)] leading-relaxed mb-3">{t.cases}</p>

      <p className="flex items-start gap-1.5 text-[11px]" style={{ color: domain.live ? "var(--p-ok-fg)" : "var(--p-muted)" }}>
        {domain.live ? null : <Clock className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />}
        {domain.live ? t.live : t.waiting}
      </p>

      <p className="text-[11px] text-[var(--p-muted)] leading-relaxed mt-3 pt-3 border-t border-[var(--p-border)]">
        {t.exit}
      </p>
    </div>
  );
}
