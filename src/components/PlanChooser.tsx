"use client";

import { useState } from "react";
import { Check, Minus, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import { usd } from "@/lib/hosting";

/**
 * CARDS TO CHOOSE, TABLE TO COMPARE.
 *
 * The previous version put the price, the badge and the blurb inside table
 * header cells, which cannot be made to line up: the "Most chosen" pill pushed
 * one price a row lower than the other two, and three blurbs of different
 * lengths wrapped to three different heights. A table aligns columns, not the
 * contents of a cell — so the header belongs outside it.
 *
 * Now the two jobs are separate, which is also how a reader uses the page.
 * Choosing is a glance at three prices, so that is three equal cards with the
 * figures on one baseline: a reserved badge slot on every card keeps the
 * prices level whether or not a badge is shown, and the buttons are pushed to
 * the bottom so they align however long the copy runs. Comparing is a
 * different question asked once, so the matrix sits below, quiet, with nothing
 * in it but labels and marks.
 *
 * CHOOSE FIRST, IDENTIFY SECOND. The details panel appears only after a tier
 * is picked, and never at all for a client on their own link — asking for a
 * domain we put in the link would be theatre. Nobody fills a form to find out
 * a price.
 */

export interface Feature {
  label: string;
  /** One flag per tier, in the same order as `tiers`. */
  on: boolean[];
}

export interface Tier {
  planKey: string;
  tier: string;
  blurb: string;
  monthlyUsd: number;
  annualUsd: number;
  /** The recommended column: ring, badge, filled button. At most one. */
  featured?: boolean;
}

const T = {
  en: {
    eyebrow: "Servolia hosting",
    /* The heading follows the step. "Choose your plan" above a form for a
       plan already chosen told the reader the page had lost track of them. */
    h1Choose: ["Choose your ", "plan"],
    subChoose:
      "Hosting, SSL and monitoring are the same on all three. What changes is whether we handle your domain, and whether you get email on it.",
    h1Details: ["Your ", "details"],
    subDetails:
      "Your domain, and the email for your account and invoices. You pay on the next screen, with Stripe.",
    yearly: "Yearly", monthly: "Monthly",
    perYear: "/ year", perMonth: "/ month",
    save: (n: number) => `Save $${usd(n)} a year`,
    popular: "Most chosen",
    choose: "Choose",
    compare: "Compare plans",
    almost: "Almost there",
    yourSite: "Your website",
    sitePlaceholder: "yourdomain.com",
    yourEmail: "Your email",
    emailPlaceholder: "you@company.com",
    whyAsking: "Your account, invoices and sign-in link all use this address.",
    changePlan: "Change plan",
    pay: (n: number) => `Pay $${usd(n)}`,
    needDetails: "Fill in both fields to continue",
    working: "Redirecting to Stripe…",
    forLabel: "For",
    secured: "Secured by Stripe",
    cancelAnytime: "Cancel anytime",
    cardNote: "Card details are handled by Stripe and never reach our servers.",
    genericError: "Something went wrong",
    startError: "Could not start checkout",
  },
  fr: {
    eyebrow: "Hébergement Servolia",
    h1Choose: ["Choisissez votre ", "formule"],
    subChoose:
      "L'hébergement, le SSL et la surveillance sont identiques sur les trois. Ce qui change : si nous gérons votre domaine, et si vous avez une messagerie à votre nom.",
    h1Details: ["Vos ", "coordonnées"],
    subDetails:
      "Votre domaine, et l'email de votre compte et de vos factures. Le paiement se fait à l'écran suivant, avec Stripe.",
    yearly: "Annuel", monthly: "Mensuel",
    perYear: "/ an", perMonth: "/ mois",
    save: (n: number) => `Économisez ${usd(n)} $ par an`,
    popular: "Le plus choisi",
    choose: "Choisir",
    compare: "Comparer les formules",
    almost: "Dernière étape",
    yourSite: "Votre site web",
    sitePlaceholder: "votredomaine.com",
    yourEmail: "Votre email",
    emailPlaceholder: "vous@societe.com",
    whyAsking: "Votre compte, vos factures et votre lien de connexion utilisent cette adresse.",
    changePlan: "Changer de formule",
    pay: (n: number) => `Payer ${usd(n)} $`,
    needDetails: "Remplissez les deux champs pour continuer",
    working: "Redirection vers Stripe…",
    forLabel: "Pour",
    secured: "Sécurisé par Stripe",
    cancelAnytime: "Résiliable à tout moment",
    cardNote:
      "Vos coordonnées bancaires sont traitées par Stripe et n'atteignent jamais nos serveurs.",
    genericError: "Une erreur est survenue",
    startError: "Impossible de démarrer le paiement",
  },
};

export default function PlanChooser({
  tiers,
  features,
  refCode,
  siteLabel,
  maskedEmail = "",
  lang = "en",
  initialPlan = null,
}: {
  tiers: Tier[];
  features: Feature[];
  refCode: string;
  siteLabel: string;
  maskedEmail?: string;
  lang?: "en" | "fr";
  /** A plan already agreed in conversation: opens on step two with it chosen,
   *  "Change plan" still available. */
  initialPlan?: string | null;
}) {
  const t = T[lang];
  const [billing, setBilling] = useState<"annual" | "monthly">("annual");
  const [chosen, setChosen] = useState<string | null>(
    initialPlan && tiers.some((p) => p.planKey === initialPlan) ? initialPlan : null,
  );
  const [site, setSite] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const known = Boolean(siteLabel);
  const annual = billing === "annual";
  const priceOf = (p: Tier) => (annual ? p.annualUsd : p.monthlyUsd);

  async function pay(planKey: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/hosting-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A plan KEY, never a price. The server reads the figure.
        body: JSON.stringify({
          plan: planKey, billing, ref: refCode,
          business: siteLabel || site.trim(), email: email.trim(), lang,
        }),
      });
      const data = await res.json();
      // assign() rather than `location.href = …`: identical navigation, but the
      // compiler's immutability rule rejects assigning to an outside value.
      if (data.url) { window.location.assign(data.url); return; }
      throw new Error(data.error || t.startError);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
      setBusy(false);
    }
  }

  function choose(planKey: string) {
    if (known) { pay(planKey); return; }
    setChosen(planKey);
    setError(null);
  }

  const picked = tiers.find((p) => p.planKey === chosen) ?? null;

  /* One heading, owned here rather than by the page, because only this
     component knows which step is showing. */
  const heading = (h1: string[], sub: string) => (
    <div className="max-w-3xl mx-auto text-center mb-10">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3">{t.eyebrow}</p>
      <h1 className="text-3xl sm:text-[38px] font-black tracking-tight mb-3 text-[#18181B]">
        {h1[0]}
        <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">{h1[1]}</span>
      </h1>
      <p className="text-[#52525B] leading-relaxed max-w-xl mx-auto">{sub}</p>
    </div>
  );

  /* ── STEP TWO ─────────────────────────────────────────────────────────── */
  if (picked) {
    const amount = priceOf(picked);
    const ready = site.trim().length > 3 && /.+@.+\..+/.test(email);
    return (
      <div className="max-w-md mx-auto">
        {heading(t.h1Details, t.subDetails)}
        <button
          onClick={() => setChosen(null)}
          className="inline-flex items-center gap-1.5 text-sm text-[#71717A] hover:text-[#36671E] mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" /> {t.changePlan}
        </button>

        <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(22,26,21,0.05),0_12px_32px_-24px_rgba(22,26,21,0.35)] overflow-hidden">
          <div className="px-7 py-5 bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{t.almost}</p>
            <p className="text-[20px] font-black mt-1 tabular-nums">
              {picked.tier} · ${usd(amount)}
              <span className="font-medium opacity-80 text-[15px]"> {annual ? t.perYear : t.perMonth}</span>
            </p>
          </div>

          <div className="px-7 py-6">
            <label htmlFor="pc-site" className="block text-[11px] font-black text-[#8A8A80] uppercase tracking-[0.14em] mb-1.5">
              {t.yourSite}
            </label>
            <input
              id="pc-site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder={t.sitePlaceholder}
              className="w-full h-11 px-3.5 mb-4 text-[15px] border border-[#E2E6DD] rounded-lg bg-white outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/15"
            />
            <label htmlFor="pc-email" className="block text-[11px] font-black text-[#8A8A80] uppercase tracking-[0.14em] mb-1.5">
              {t.yourEmail}
            </label>
            <input
              id="pc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="w-full h-11 px-3.5 text-[15px] border border-[#E2E6DD] rounded-lg bg-white outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/15"
            />
            <p className="mt-2.5 text-[12px] text-[#8A8A80] leading-relaxed">{t.whyAsking}</p>

            <button
              onClick={() => pay(picked.planKey)}
              disabled={!ready || busy}
              className="mt-6 w-full h-12 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 disabled:opacity-45 transition"
            >
              {busy ? t.working : ready ? t.pay(amount) : t.needDetails}
            </button>
            {error ? <p className="mt-3 text-sm text-[#B91C1C] text-center">{error}</p> : null}
          </div>
        </div>

        <Trust t={t} />
      </div>
    );
  }

  /* ── STEP ONE ─────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto">
      {heading(t.h1Choose, t.subChoose)}
      {known ? (
        <p className="text-center text-sm text-[#71717A] mb-6">
          {t.forLabel} <span className="font-bold text-[#18181B]">{siteLabel}</span>
          {maskedEmail ? <span className="text-[#A8A8A0]"> · {maskedEmail}</span> : null}
        </p>
      ) : null}

      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EAEFE4] mb-8 w-[248px] mx-auto">
        {(["annual", "monthly"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBilling(b)}
            className={`flex-1 h-9 rounded-lg text-[13.5px] font-bold transition ${
              billing === b
                ? "bg-white text-[#295115] shadow-[0_1px_2px_rgba(22,26,21,0.10)]"
                : "text-[#5E6659] hover:text-[#295115]"
            }`}
          >
            {b === "annual" ? t.yearly : t.monthly}
          </button>
        ))}
      </div>

      {/* Equal-height cards. The badge sits in a slot every card reserves, so
          the prices share a baseline whether or not a badge is rendered. */}
      <div className="grid sm:grid-cols-3 gap-4">
        {tiers.map((p) => {
          const amount = priceOf(p);
          const saving = p.monthlyUsd * 12 - p.annualUsd;
          const hot = p.featured === true;
          return (
            <div
              key={p.planKey}
              className={`flex flex-col rounded-2xl bg-white p-6 transition ${
                hot
                  ? "border border-[#36671E] shadow-[0_1px_2px_rgba(22,26,21,0.06),0_18px_40px_-28px_rgba(41,81,21,0.55)]"
                  : "border border-[#E2E6DD] hover:border-[#CBD8BE]"
              }`}
            >
              <div className="h-[22px] mb-3">
                {hot ? (
                  <span className="inline-block text-[10px] font-black uppercase tracking-[0.12em] text-[#295115] bg-[#DDEFCB] rounded-full px-2.5 py-1">
                    {t.popular}
                  </span>
                ) : null}
              </div>

              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5E6659]">{p.tier}</p>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[40px] leading-none font-black tracking-tight text-[#161A15] tabular-nums">
                  ${usd(amount)}
                </span>
                <span className="text-[14px] text-[#71717A] font-medium">
                  {annual ? t.perYear : t.perMonth}
                </span>
              </div>

              <p className="mt-2 h-[18px] text-[12.5px] font-semibold text-[#36671E]">
                {annual && saving > 0 ? t.save(saving) : ""}
              </p>

              {/* flex-1 pushes every button to the bottom, so three blurbs of
                  different lengths still produce one row of aligned buttons. */}
              <p className="mt-4 flex-1 text-[13.5px] leading-relaxed text-[#5E6659]">{p.blurb}</p>

              <button
                onClick={() => choose(p.planKey)}
                disabled={busy}
                className={`mt-6 w-full h-11 rounded-xl font-bold text-[14px] disabled:opacity-55 transition ${
                  hot
                    ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90"
                    : "bg-white text-[#295115] border border-[#CBD8BE] hover:border-[#36671E] hover:bg-[#F7FBF4]"
                }`}
              >
                {busy ? t.working : t.choose}
              </button>
            </div>
          );
        })}
      </div>

      {error ? <p className="mt-4 text-sm text-[#B91C1C] text-center">{error}</p> : null}

      {/* The matrix: labels and marks only. Everything that varies in height
          was moved into the cards above. */}
      <div className="mt-14">
        <p className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-[#8A8A80] mb-5">
          {t.compare}
        </p>
        <div className="overflow-x-auto rounded-2xl border border-[#E2E6DD] bg-white">
          <table className="w-full min-w-[600px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E8E6E0]">
                <th className="w-[46%] px-5 py-3.5" />
                {tiers.map((p) => (
                  <th
                    key={p.planKey}
                    className={`px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.13em] ${
                      p.featured ? "bg-[#F7FBF4] text-[#295115]" : "text-[#5E6659]"
                    }`}
                  >
                    {p.tier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.label} className="border-b border-[#F2F1ED] last:border-0">
                  <td className="px-5 py-3.5 text-[13.5px] text-[#3F3F46] leading-snug">{f.label}</td>
                  {tiers.map((p, i) => (
                    <td
                      key={p.planKey}
                      className={`px-4 py-3.5 text-center ${p.featured ? "bg-[#F7FBF4]" : ""}`}
                    >
                      <Mark on={f.on[i] === true} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Trust t={t} />
    </div>
  );
}

function Mark({ on }: { on: boolean }) {
  return on ? (
    <Check className="w-[17px] h-[17px] text-[#36671E] mx-auto" strokeWidth={3} aria-label="included" />
  ) : (
    <Minus className="w-[17px] h-[17px] text-[#CDD2C6] mx-auto" aria-label="not included" />
  );
}

function Trust({ t }: { t: (typeof T)["en"] }) {
  return (
    <>
      <div className="mt-8 flex items-center justify-center gap-5 text-[11px] text-[#8A8A80]">
        <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t.secured}</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {t.cancelAnytime}</span>
      </div>
      <p className="mt-2.5 text-[11px] text-[#A8A8A0] text-center">{t.cardNote}</p>
    </>
  );
}
