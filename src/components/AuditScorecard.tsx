"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, Loader2, AlertTriangle, AlertCircle, CheckCircle2,
  TrendingUp, ShieldCheck, Clock, Feather, ArrowRight,
} from "lucide-react";
import { AUDIT_DIMENSIONS, type AuditResult } from "@/lib/auditEngine";

/**
 * The instant scored teardown — Servolia's lead magnet.
 *
 * Structure follows the value equation deliberately: the score and findings
 * establish the gap, then the four lever cards answer the four questions a
 * buyer actually has — what's it worth, will it work for me, how long, how
 * much of my time. Nothing here claims a result Servolia has produced; the
 * money range is the visitor's own arithmetic and says so.
 */

const T = {
  en: {
    eyebrow: "Free instant audit",
    title: "Score your practice website in 20 seconds.",
    sub: "We read your live page and score seven things that decide whether a visitor books or leaves. No call, no signup to see the result.",
    url: "Your website address",
    urlPh: "cabinet-exemple.fr",
    value: "Average value of one new patient (€)",
    valuePh: "800",
    enq: "Enquiries you get in a month",
    enqPh: "60",
    optional: "Optional — used only to estimate what the gaps cost you",
    run: "Score my website",
    running: "Reading your site…",
    scoreOf: "/ 10",
    verdicts: {
      critical: "Losing patients daily",
      weak: "Leaking enquiries",
      fair: "Works, but not converting",
      strong: "Solid — small gains left",
    },
    findings: "What we found",
    fixLabel: "Why it matters",
    levers: "What fixing it is worth",
    outcome: "The money on the table",
    likelihood: "Why it'll work for you",
    time: "How fast",
    effort: "What it costs you in time",
    noNumbers: "Add your two numbers above for an estimate.",
    perMonth: "/month",
    cta: "See what your site would look like",
    ctaSub: "Three live demo practices — click one and talk to its AI receptionist.",
    disclaimer: "Scored from your live page at the moment you ran this. Every finding is something you can check yourself in ten seconds.",
    retry: "Score another site",
  },
  fr: {
    eyebrow: "Audit instantané gratuit",
    title: "Notez le site de votre cabinet en 20 secondes.",
    sub: "Nous lisons votre page en direct et notons sept éléments qui décident si un visiteur réserve ou repart. Sans appel, sans inscription pour voir le résultat.",
    url: "Adresse de votre site",
    urlPh: "cabinet-exemple.fr",
    value: "Valeur moyenne d'un nouveau patient (€)",
    valuePh: "800",
    enq: "Demandes reçues par mois",
    enqPh: "60",
    optional: "Facultatif — sert uniquement à estimer ce que les manques vous coûtent",
    run: "Noter mon site",
    running: "Lecture de votre site…",
    scoreOf: "/ 10",
    verdicts: {
      critical: "Vous perdez des patients chaque jour",
      weak: "Des demandes s'échappent",
      fair: "Fonctionne, mais ne convertit pas",
      strong: "Solide — quelques gains restants",
    },
    findings: "Ce que nous avons trouvé",
    fixLabel: "Pourquoi c'est important",
    levers: "Ce que vaut la correction",
    outcome: "L'argent en jeu",
    likelihood: "Pourquoi cela marchera pour vous",
    time: "En combien de temps",
    effort: "Ce que cela vous coûte en temps",
    noNumbers: "Ajoutez vos deux chiffres ci-dessus pour une estimation.",
    perMonth: "/mois",
    cta: "Voir à quoi ressemblerait votre site",
    ctaSub: "Trois cabinets de démonstration en ligne — cliquez et parlez à leur réceptionniste IA.",
    disclaimer: "Noté à partir de votre page en direct au moment du test. Chaque constat est vérifiable par vous en dix secondes.",
    retry: "Noter un autre site",
  },
};

const SEV_STYLE = {
  critical: { icon: AlertTriangle, ring: "border-[#FECACA] bg-[#FEF2F2]", dot: "text-[#B91C1C]", chip: "bg-[#FEE2E2] text-[#991B1B]" },
  warning:  { icon: AlertCircle,   ring: "border-[#FDE68A] bg-[#FFFBEB]", dot: "text-[#92400E]", chip: "bg-[#FEF3C7] text-[#92400E]" },
  ok:       { icon: CheckCircle2,  ring: "border-[#D6E2CF] bg-[#EEF5EA]", dot: "text-[#36671E]", chip: "bg-[#D1FAE5] text-[#065F46]" },
  unknown:  { icon: AlertCircle,   ring: "border-[#E8E6E0] bg-[#FAFAF7]", dot: "text-[#71717A]", chip: "bg-[#F5F4EF] text-[#71717A]" },
} as const;

function scoreColor(score: number) {
  if (score < 4) return "#B91C1C";
  if (score < 6) return "#D97706";
  if (score < 8) return "#36671E";
  return "#059669";
}

export default function AuditScorecard({ lang = "en" }: { lang?: "en" | "fr" }) {
  const l = lang === "fr" ? ("fr" as const) : ("en" as const);
  const t = T[l];

  const [url, setUrl] = useState("");
  const [value, setValue] = useState("");
  const [enq, setEnq] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, patientValueEur: value, monthlyEnquiries: enq }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setResult(data as AuditResult);
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  const dimLabel = (key: string) =>
    AUDIT_DIMENSIONS.find((d) => d.key === key)?.label[l] ?? key;

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Input ── */}
      {!result && (
        <form onSubmit={run} className="bg-white rounded-2xl border border-[#E8E6E0] p-6 sm:p-8 shadow-card">
          <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">{t.eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] mb-3">{t.title}</h2>
          <p className="text-sm text-[#71717A] leading-relaxed mb-6">{t.sub}</p>

          <label htmlFor="audit-url" className="block text-xs font-bold text-[#71717A] uppercase tracking-widest mb-1.5">{t.url}</label>
          <input
            id="audit-url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder={t.urlPh} inputMode="url" autoComplete="url" required
            className="w-full px-4 py-3 rounded-xl border border-[#E8E6E0] text-[#18181B] focus:outline-none focus:border-[#36671E] mb-5"
          />

          <div className="grid sm:grid-cols-2 gap-4 mb-2">
            <div>
              <label htmlFor="audit-value" className="block text-xs font-bold text-[#71717A] uppercase tracking-widest mb-1.5">{t.value}</label>
              <input id="audit-value" value={value} onChange={(e) => setValue(e.target.value)}
                placeholder={t.valuePh} inputMode="numeric"
                className="w-full px-4 py-3 rounded-xl border border-[#E8E6E0] text-[#18181B] focus:outline-none focus:border-[#36671E]" />
            </div>
            <div>
              <label htmlFor="audit-enq" className="block text-xs font-bold text-[#71717A] uppercase tracking-widest mb-1.5">{t.enq}</label>
              <input id="audit-enq" value={enq} onChange={(e) => setEnq(e.target.value)}
                placeholder={t.enqPh} inputMode="numeric"
                className="w-full px-4 py-3 rounded-xl border border-[#E8E6E0] text-[#18181B] focus:outline-none focus:border-[#36671E]" />
            </div>
          </div>
          <p className="text-xs text-[#A1A1AA] mb-6">{t.optional}</p>

          {error && <p className="text-sm font-semibold text-[#B91C1C] mb-4">{error}</p>}

          <button type="submit" disabled={loading || !url.trim()}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#36671E] text-[#FAFAF7] font-black hover:bg-[#295115] transition-colors disabled:opacity-60">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.running}</> : <><Search className="w-4 h-4" /> {t.run}</>}
          </button>
        </form>
      )}

      {/* ── Result ── */}
      {result && (
        <div className="space-y-5">
          {/* Score */}
          <div className="bg-white rounded-2xl border border-[#E8E6E0] p-6 sm:p-8 shadow-card text-center">
            <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3 break-all">{result.url}</p>
            <div className="flex items-end justify-center gap-1 mb-2">
              <span className="text-6xl font-black tabular-nums" style={{ color: scoreColor(result.score) }}>
                {result.score.toFixed(1)}
              </span>
              <span className="text-xl font-black text-[#A1A1AA] mb-2">{t.scoreOf}</span>
            </div>
            <p className="text-lg font-black" style={{ color: scoreColor(result.score) }}>
              {t.verdicts[result.verdict]}
            </p>
            <div className="mt-5 h-2 rounded-full bg-[#F5F4EF] overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${result.score * 10}%`, background: scoreColor(result.score) }} />
            </div>
          </div>

          {/* Findings, worst first */}
          <div className="bg-white rounded-2xl border border-[#E8E6E0] p-6 sm:p-8 shadow-card">
            <h3 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-5">{t.findings}</h3>
            <div className="space-y-3">
              {result.findings.map((f) => {
                const s = SEV_STYLE[f.severity];
                const Icon = s.icon;
                return (
                  <div key={f.dimension} className={`rounded-xl border p-4 ${s.ring}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.dot}`} aria-hidden="true" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                          <p className="text-sm font-black text-[#18181B]">{dimLabel(f.dimension)}</p>
                          {f.score != null && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${s.chip}`}>
                              {f.score}/10
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#3F3F46] leading-relaxed">{f.observation[l]}</p>
                        {f.fix[l] && (
                          <p className="text-xs text-[#71717A] mt-2">
                            <span className="font-bold">{t.fixLabel}: </span>{f.fix[l]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[#A1A1AA] mt-5 leading-relaxed">{t.disclaimer}</p>
          </div>

          {/* The value equation, one card per lever */}
          <div className="bg-[#0A1F14] rounded-2xl p-6 sm:p-8">
            <h3 className="text-sm font-black text-[#BEF264] uppercase tracking-widest mb-5">{t.levers}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/[0.05] border border-white/10 p-5 sm:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#BEF264]" aria-hidden="true" />
                  <p className="text-xs font-black text-[#BEF264] uppercase tracking-widest">{t.outcome}</p>
                </div>
                {result.value.outcomeLowEur != null && result.value.outcomeHighEur != null ? (
                  <p className="text-3xl font-black text-[#FAFAF7] mb-2">
                    €{result.value.outcomeLowEur.toLocaleString()}–{result.value.outcomeHighEur.toLocaleString()}
                    <span className="text-base font-bold text-[#ABDF90]/70">{t.perMonth}</span>
                  </p>
                ) : (
                  <p className="text-sm text-[#ABDF90] mb-2">{t.noNumbers}</p>
                )}
                <p className="text-xs text-[#FAFAF7]/60 leading-relaxed">{result.value.outcomeBasis[l]}</p>
              </div>

              {[
                { icon: ShieldCheck, label: t.likelihood, body: result.value.likelihood[l] },
                { icon: Clock, label: t.time, body: result.value.timeDelay[l] },
                { icon: Feather, label: t.effort, body: result.value.effort[l] },
              ].map((c) => (
                <div key={c.label} className="rounded-xl bg-white/[0.05] border border-white/10 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <c.icon className="w-4 h-4 text-[#BEF264]" aria-hidden="true" />
                    <p className="text-xs font-black text-[#BEF264] uppercase tracking-widest">{c.label}</p>
                  </div>
                  <p className="text-sm text-[#FAFAF7]/80 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <Link href={l === "fr" ? "/fr/exemples" : "/examples"}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#BEF264] text-[#0A1F14] font-black text-sm hover:bg-[#ABDF90] transition-colors">
                {t.cta} <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs text-[#FAFAF7]/50 mt-3">{t.ctaSub}</p>
            </div>
          </div>

          <div className="text-center">
            <button onClick={() => { setResult(null); setUrl(""); }}
              className="text-sm font-bold text-[#36671E] hover:underline">
              {t.retry}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
