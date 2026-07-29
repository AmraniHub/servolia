import { ShieldCheck, AlertTriangle, HelpCircle } from "lucide-react";
import type { ComplianceReport } from "@/lib/zeroMiss";
import { ZERO_MISS_THRESHOLD_MS } from "@/lib/zeroMiss";

/**
 * The client's own view of the Zero-Miss guarantee.
 *
 * This panel is a CONTRACTUAL OBLIGATION, not a feature: CGV section 4 bis
 * says response times are "measured from Servolia's own server-side
 * timestamps, which the client can consult at any time in their client
 * portal". It reads the same function the founder's watchdog uses, so both
 * sides always see identical numbers — which is the entire point of offering
 * a guarantee somebody can check.
 *
 * It must therefore be honest in the uncomfortable direction too: when a month
 * has breaches it says so plainly and states that a refund is owed, rather
 * than waiting for the client to ask.
 */

const COPY = {
  en: {
    title: "Response-time guarantee",
    sub: (s: number) => `Every enquiry answered within ${s} seconds, or this month is free.`,
    compliant: "On track this month",
    compliantBody: (n: number, slowest: string) =>
      `${n} ${n === 1 ? "reply" : "replies"} measured, slowest ${slowest}. No misses.`,
    breach: "We missed the guarantee this month",
    breachBody: (n: number, worst: string) =>
      `${n} ${n === 1 ? "reply" : "replies"} took longer than the promised window (worst: ${worst}). Under our terms this month's plan fee is refunded to you — we'll process it without you having to ask.`,
    none: "No enquiries yet this month",
    noneBody: "Nothing to measure so far. This panel fills in as visitors talk to your assistant.",
    unmeasured: (n: number) =>
      `${n} earlier ${n === 1 ? "reply predates" : "replies predate"} response-time recording and can't be verified either way.`,
    slowest: "Slowest reply",
    measured: "Replies measured",
    terms: "Full terms: CGV section 4 bis",
    termsHref: "/legal/cgv",
  },
  fr: {
    title: "Garantie de temps de réponse",
    sub: (s: number) => `Chaque demande répondue en moins de ${s} secondes, ou le mois est offert.`,
    compliant: "Respectée ce mois-ci",
    compliantBody: (n: number, slowest: string) =>
      `${n} ${n === 1 ? "réponse mesurée" : "réponses mesurées"}, la plus lente à ${slowest}. Aucun manquement.`,
    breach: "Nous avons manqué la garantie ce mois-ci",
    breachBody: (n: number, worst: string) =>
      `${n} ${n === 1 ? "réponse a dépassé" : "réponses ont dépassé"} le délai promis (la pire : ${worst}). Selon nos conditions, l'abonnement de ce mois vous est remboursé — nous le traitons sans que vous ayez à le demander.`,
    none: "Aucune demande ce mois-ci",
    noneBody: "Rien à mesurer pour l'instant. Ce panneau se remplit dès que des visiteurs parlent à votre assistante.",
    unmeasured: (n: number) =>
      `${n} ${n === 1 ? "réponse antérieure est antérieure" : "réponses antérieures sont antérieures"} à l'enregistrement des temps de réponse et ne peuvent être vérifiées.`,
    slowest: "Réponse la plus lente",
    measured: "Réponses mesurées",
    terms: "Conditions complètes : CGV article 4 bis",
    termsHref: "/fr/legal/cgv",
  },
};

const fmt = (ms: number | null) => (ms == null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export default function ZeroMissPanel({
  report,
  lang = "en",
}: {
  report: ComplianceReport;
  lang?: "en" | "fr";
}) {
  const t = COPY[lang === "fr" ? "fr" : "en"];
  const breached = report.misses.length > 0;
  const nothing = report.measured === 0 && report.unmeasured === 0;

  const Icon = breached ? AlertTriangle : nothing ? HelpCircle : ShieldCheck;
  const tone = breached
    ? { bg: "var(--p-bad-bg)", fg: "var(--p-bad-fg)" }
    : nothing
      ? { bg: "var(--p-neutral-bg)", fg: "var(--p-neutral-fg)" }
      : { bg: "var(--p-ok-bg)", fg: "var(--p-ok-fg)" };

  const worst = breached
    ? fmt(report.misses.reduce((a, b) => (b.ms > a.ms ? b : a)).ms)
    : fmt(report.slowestMs);

  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-card)] p-5">
      <div className="flex items-start gap-3 mb-4">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: tone.bg, color: tone.fg }}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-black text-[var(--p-text)]">{t.title}</h3>
          <p className="text-xs text-[var(--p-muted)] mt-0.5">
            {t.sub(ZERO_MISS_THRESHOLD_MS / 1000)}
          </p>
        </div>
      </div>

      <p className="text-sm font-bold" style={{ color: tone.fg }}>
        {breached ? t.breach : nothing ? t.none : t.compliant}
      </p>
      <p className="text-xs text-[var(--p-muted)] leading-relaxed mt-1">
        {breached
          ? t.breachBody(report.misses.length, worst)
          : nothing
            ? t.noneBody
            : t.compliantBody(report.measured, worst)}
      </p>

      {report.measured > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-[var(--p-raised)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--p-muted)]">{t.measured}</p>
            <p className="text-lg font-black text-[var(--p-text)] tabular-nums">{report.measured}</p>
          </div>
          <div className="rounded-xl bg-[var(--p-raised)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--p-muted)]">{t.slowest}</p>
            <p className="text-lg font-black text-[var(--p-text)] tabular-nums">{fmt(report.slowestMs)}</p>
          </div>
        </div>
      )}

      {report.unmeasured > 0 && (
        <p className="text-[11px] text-[var(--p-muted)] mt-3">{t.unmeasured(report.unmeasured)}</p>
      )}

      <a
        href={t.termsHref}
        className="inline-block text-[11px] font-bold text-[var(--p-accent)] hover:underline mt-3"
      >
        {t.terms} →
      </a>
    </div>
  );
}
