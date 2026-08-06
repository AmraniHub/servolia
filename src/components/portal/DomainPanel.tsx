import { Globe, ShieldCheck, AlertTriangle } from "lucide-react";
import type { DomainRow } from "@/lib/domains";
import { RENEWAL_URGENT_DAYS } from "@/lib/domains";

/**
 * "Your domain" — proof, shown to the client, that they own it.
 *
 * This panel is the visible half of CGV 7 bis. Saying "the domain is yours"
 * in a contract nobody reads is worth little; showing the client their own
 * name as registrant, in their own portal, is what makes it true in the only
 * place that matters — their head. It is also a selling point in a market
 * where a previous web agency has often held a practice hostage.
 *
 * It states the exit route plainly, on purpose. A client who can see how to
 * leave is a client who doesn't feel trapped, and doesn't go looking.
 */

const COPY = {
  en: {
    title: "Your domain",
    yours: "Registered in your name — you own it",
    sub: "We manage the DNS and pay the renewal while your plan is active. It is your property, not ours.",
    registrant: "Registrant (legal owner)",
    registrar: "Registrar",
    renews: "Renews",
    expiring: (d: number) => `Renews in ${d} day${d === 1 ? "" : "s"} — we handle it`,
    urgent: (d: number) => `Renewal due in ${d} day${d === 1 ? "" : "s"}`,
    exit: "Leaving? We release it — free, within 5 working days of a written request. We never hold a domain as leverage.",
    none: "No domain registered through us yet.",
  },
  fr: {
    title: "Votre nom de domaine",
    yours: "Enregistré à votre nom — il vous appartient",
    sub: "Nous gérons les DNS et payons le renouvellement tant que votre abonnement est actif. C'est votre propriété, pas la nôtre.",
    registrant: "Titulaire (propriétaire légal)",
    registrar: "Bureau d'enregistrement",
    renews: "Renouvellement",
    expiring: (d: number) => `Renouvellement dans ${d} jour${d === 1 ? "" : "s"} — nous nous en occupons`,
    urgent: (d: number) => `Renouvellement dû dans ${d} jour${d === 1 ? "" : "s"}`,
    exit: "Vous partez ? Nous le libérons — gratuitement, sous 5 jours ouvrés après demande écrite. Nous ne retenons jamais un domaine comme moyen de pression.",
    none: "Aucun domaine enregistré par nos soins pour l'instant.",
  },
};

export default function DomainPanel({
  domain,
  lang = "en",
}: {
  domain: DomainRow | null;
  lang?: "en" | "fr";
}) {
  const t = COPY[lang === "fr" ? "fr" : "en"];
  if (!domain) return null;

  const daysLeft = domain.expires_at
    ? Math.ceil((new Date(domain.expires_at).getTime() - Date.now()) / 864e5)
    : null;
  const urgent = daysLeft != null && daysLeft <= RENEWAL_URGENT_DAYS;

  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-card)] p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[var(--p-accent-soft)] text-[var(--p-accent)]">
          <Globe className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[var(--p-text)]">{t.title}</h3>
          <p className="text-sm font-bold text-[var(--p-accent)] truncate">{domain.domain}</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-[var(--p-ok-bg)] p-3 mb-4">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--p-ok-fg)" }} aria-hidden="true" />
        <div>
          <p className="text-xs font-black" style={{ color: "var(--p-ok-fg)" }}>{t.yours}</p>
          <p className="text-[11px] text-[var(--p-muted)] mt-0.5 leading-relaxed">{t.sub}</p>
        </div>
      </div>

      <dl className="space-y-2 text-xs">
        {(domain.registrant_org || domain.registrant_name) && (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--p-muted)]">{t.registrant}</dt>
            <dd className="font-bold text-[var(--p-text)] text-right">
              {domain.registrant_org || domain.registrant_name}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--p-muted)]">{t.registrar}</dt>
          <dd className="font-bold text-[var(--p-text)] capitalize">{domain.registrar}</dd>
        </div>
        {domain.expires_at && (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--p-muted)]">{t.renews}</dt>
            <dd className="font-bold text-[var(--p-text)]">
              {new Date(domain.expires_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </dd>
          </div>
        )}
      </dl>

      {daysLeft != null && daysLeft <= 45 && (
        <p className={`flex items-start gap-1.5 text-[11px] mt-3 ${urgent ? "font-bold" : ""}`}
          style={{ color: urgent ? "var(--p-warn-fg)" : "var(--p-muted)" }}>
          {urgent && <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />}
          {urgent ? t.urgent(daysLeft) : t.expiring(daysLeft)}
        </p>
      )}

      <p className="text-[11px] text-[var(--p-muted)] leading-relaxed mt-3 pt-3 border-t border-[var(--p-border)]">
        {t.exit}
      </p>
    </div>
  );
}
