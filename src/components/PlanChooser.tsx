"use client";

import { useState } from "react";
import { Check, Minus, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import { usd } from "@/lib/hosting";

/**
 * CHOOSE FIRST, IDENTIFY SECOND.
 *
 * The first version put the domain and email box above the plans, which is the
 * wrong order twice over: it asks for personal details before the visitor
 * knows what they are buying, and it makes the page open on a form rather than
 * on the thing being sold. Nobody fills a form to find out a price.
 *
 * So the page opens on the comparison, and the details panel only appears once
 * a tier has been chosen — and never at all for a client arriving on their own
 * link, since we already know who they are.
 *
 * A TABLE, not parallel lists of ticks. The tiers share most of their lines,
 * and side-by-side bullet lists make a reader compare by scanning back and
 * forth and hoping they did not miss one. A row per feature with a tick or a
 * dash in every column answers "what do I actually lose" in one glance, which
 * is the only question a cheaper tier ever raises — and it keeps working when
 * a third column is added, which two bullet lists do not.
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
  /** The recommended column: darker button, tint, badge. At most one. */
  featured?: boolean;
}

const T = {
  en: {
    yearly: "Yearly", monthly: "Monthly",
    perYear: "/ year", perMonth: "/ month",
    save: (n: number) => `Save $${usd(n)} a year`,
    popular: "Most chosen",
    choose: "Choose",
    chosen: "Chosen",
    included: "What's included",
    // details step
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
    yearly: "Annuel", monthly: "Mensuel",
    perYear: "/ an", perMonth: "/ mois",
    save: (n: number) => `Économisez ${usd(n)} $ par an`,
    popular: "Le plus choisi",
    choose: "Choisir",
    chosen: "Choisi",
    included: "Ce qui est inclus",
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
}: {
  tiers: Tier[];
  features: Feature[];
  refCode: string;
  siteLabel: string;
  maskedEmail?: string;
  lang?: "en" | "fr";
}) {
  const t = T[lang];
  const [billing, setBilling] = useState<"annual" | "monthly">("annual");
  const [chosen, setChosen] = useState<string | null>(null);
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

  /* A client on their own link is already identified, so choosing IS paying.
     Making them retype a domain we put in the link would be theatre. */
  function choose(planKey: string) {
    if (known) { pay(planKey); return; }
    setChosen(planKey);
    setError(null);
  }

  const picked = tiers.find((p) => p.planKey === chosen) ?? null;

  /* ── STEP TWO ─────────────────────────────────────────────────────────── */
  if (picked) {
    const amount = priceOf(picked);
    const ready = site.trim().length > 3 && /.+@.+\..+/.test(email);
    return (
      <div className="max-w-md mx-auto">
        <button
          onClick={() => setChosen(null)}
          className="inline-flex items-center gap-1.5 text-sm text-[#71717A] hover:text-[#36671E] mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" /> {t.changePlan}
        </button>

        <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-7 py-5 bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-75">{t.almost}</p>
            <p className="text-[19px] font-black mt-0.5">
              {picked.tier} · ${usd(amount)} <span className="font-medium opacity-80">{annual ? t.perYear : t.perMonth}</span>
            </p>
          </div>

          <div className="px-7 py-6">
            <label htmlFor="pc-site" className="block text-[11px] font-black text-[#8A8A80] uppercase tracking-widest mb-1.5">
              {t.yourSite}
            </label>
            <input
              id="pc-site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder={t.sitePlaceholder}
              className="w-full h-11 px-3 mb-4 text-sm border border-[#E8E6E0] rounded-lg bg-white focus:outline-none focus:border-[#36671E] focus:ring-1 focus:ring-[#36671E]"
            />
            <label htmlFor="pc-email" className="block text-[11px] font-black text-[#8A8A80] uppercase tracking-widest mb-1.5">
              {t.yourEmail}
            </label>
            <input
              id="pc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="w-full h-11 px-3 text-sm border border-[#E8E6E0] rounded-lg bg-white focus:outline-none focus:border-[#36671E] focus:ring-1 focus:ring-[#36671E]"
            />
            <p className="mt-2 text-[11px] text-[#8A8A80] leading-relaxed">{t.whyAsking}</p>

            <button
              onClick={() => pay(picked.planKey)}
              disabled={!ready || busy}
              className="mt-6 w-full h-12 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 disabled:opacity-50 transition"
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

  /* ── STEP ONE: the comparison ─────────────────────────────────────────── */
  return (
    <div className="max-w-3xl mx-auto">
      {known ? (
        <p className="text-center text-sm text-[#71717A] mb-6">
          {t.forLabel} <span className="font-bold text-[#18181B]">{siteLabel}</span>
          {maskedEmail ? <span className="text-[#A8A8A0]"> · {maskedEmail}</span> : null}
        </p>
      ) : null}

      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EDF1E8] mb-7 max-w-[260px] mx-auto">
        {(["annual", "monthly"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBilling(b)}
            className={`flex-1 h-9 rounded-lg text-sm font-bold transition ${
              billing === b ? "bg-white text-[#295115] shadow-sm" : "text-[#5E6659] hover:text-[#295115]"
            }`}
          >
            {b === "annual" ? t.yearly : t.monthly}
          </button>
        ))}
      </div>

      {/* Wide content scrolls inside its own box rather than the page. */}
      <div className="overflow-x-auto rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className="w-[34%] p-0" />
              {tiers.map((p) => {
                const upper = p.featured === true;
                const amount = priceOf(p);
                const saving = p.monthlyUsd * 12 - p.annualUsd;
                return (
                  <th
                    key={p.planKey}
                    className={`align-top p-0 border-l border-[#F0EFEA] ${upper ? "bg-[#F7FBF4]" : ""}`}
                  >
                    <div className="px-4 pt-6 pb-5 text-left">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#5E6659]">{p.tier}</span>
                        {upper ? (
                          <span className="text-[10px] font-bold text-[#295115] bg-[#DDEFCB] rounded-full px-2 py-0.5">
                            {t.popular}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[30px] leading-none font-black tracking-tight bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                          ${usd(amount)}
                        </span>
                        <span className="text-[13px] text-[#71717A] font-medium">{annual ? t.perYear : t.perMonth}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] font-semibold text-[#36671E] min-h-[18px]">
                        {annual && saving > 0 ? t.save(saving) : " "}
                      </p>
                      <p className="mt-3 text-[12.5px] leading-relaxed text-[#71717A]">{p.blurb}</p>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan={tiers.length + 1} className="px-5 py-2.5 bg-[#FAFAF7] border-y border-[#F0EFEA]">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8A80]">{t.included}</span>
              </td>
            </tr>
            {features.map((f) => (
              <tr key={f.label} className="border-b border-[#F4F3EF] last:border-0">
                <td className="px-5 py-3.5 text-[13.5px] text-[#3F3F46] leading-snug">{f.label}</td>
                {tiers.map((p, i) => (
                  <td
                    key={p.planKey}
                    className={`px-5 py-3.5 text-center border-l border-[#F0EFEA] ${
                      p.featured ? "bg-[#F7FBF4]" : ""
                    }`}
                  >
                    <Mark on={f.on[i] === true} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td className="p-0" />
              {tiers.map((p) => {
                const upper = p.featured === true;
                return (
                  <td key={p.planKey} className={`p-0 border-l border-[#F0EFEA] ${upper ? "bg-[#F7FBF4]" : ""}`}>
                    <div className="px-4 py-5">
                      <button
                        onClick={() => choose(p.planKey)}
                        disabled={busy}
                        className={`w-full h-11 rounded-xl font-bold text-sm disabled:opacity-60 transition ${
                          upper
                            ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90"
                            : "bg-white text-[#295115] border border-[#CBD8BE] hover:border-[#36671E]"
                        }`}
                      >
                        {busy ? t.working : t.choose}
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {error ? <p className="mt-4 text-sm text-[#B91C1C] text-center">{error}</p> : null}
      <Trust t={t} />
    </div>
  );
}

function Mark({ on }: { on: boolean }) {
  return on ? (
    <Check className="w-[18px] h-[18px] text-[#36671E] mx-auto" strokeWidth={2.75} aria-label="included" />
  ) : (
    <Minus className="w-[18px] h-[18px] text-[#C9CDC3] mx-auto" aria-label="not included" />
  );
}

function Trust({ t }: { t: (typeof T)["en"] }) {
  return (
    <>
      <div className="mt-7 flex items-center justify-center gap-5 text-[11px] text-[#8A8A80]">
        <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {t.secured}</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {t.cancelAnytime}</span>
      </div>
      <p className="mt-2.5 text-[11px] text-[#A8A8A0] text-center">{t.cardNote}</p>
    </>
  );
}
