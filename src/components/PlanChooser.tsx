"use client";

import { useState } from "react";
import { Check, Minus, Lock, ShieldCheck, ArrowLeft, X } from "lucide-react";
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
  /** What the line means in plain words, shown under it in the comparison. */
  hint?: string;
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
  /** Who this tier is for, one line, under its name in the comparison. */
  bestFor?: string;
  /** What it includes, listed on step two so the buyer confirms before paying. */
  includes?: string[];
  /** A one-time charge on the first payment (Business: mailbox setup). */
  setupUsd?: number;
}

type Quote = {
  domain: string;
  sellable: boolean;
  reason: string | null;
  yearlyUsd: number;
  alternatives: { domain: string; yearlyUsd: number }[];
};

/** The browser's copy of the server's normaliser, so a quote can be matched
 *  to what is in the box. The server checks again before charging. */
function cleanDomain(input: string): string | null {
  let s = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0].replace(/\.+$/, "");
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(s) ? s : null;
}

const T = {
  en: {
    haveDomain: "I have a domain",
    needDomain: "I need a domain",
    newDomain: "The domain you want",
    domainPlaceholder: "yourbusiness.com",
    check: "Check",
    checking: "Checking…",
    domainNote: "Domains are billed yearly. Registered by Servolia for you — yours to keep, transferable anywhere on request.",
    priceLine: (price: number) => `$${usd(price)} / year`,
    availableTag: "Available",
    domainBilledYearly: "Billed yearly. Registered by Servolia for you — yours to keep, transferable anywhere on request.",
    taken: "Taken — one of these instead, or another name:",
    takenNoAlt: "Taken — try another name.",
    unsupported: "We don't sell that ending. Bring it from another registrar and choose \"I have a domain\".",
    tooExpensive: "That ending costs too much for this plan — try .com, .org or .net.",
    checkFailed: "Could not check right now — try again in a moment.",
    today: "today",
    thenMonthly: (n: number) => `then $${usd(n)} / month`,
    payToday: (n: number) => `Pay $${usd(n)} today`,
    setupOnce: (n: number) => `+ $${usd(n)} once — mailboxes set up`,
    setupWord: "mailbox setup",
    once: "once",
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
    groupAll: "In every plan",
    groupAdds: (tier: string) => `${tier} adds`,
    everythingIn: (tier: string) => `Everything in ${tier}, plus:`,
    billedYearly: "Billed once a year",
    billedMonthly: "Billed monthly",
    included: "What's included",
    almost: "Almost there",
    yourSite: "Your website",
    sitePlaceholder: "yourdomain.com",
    yourEmail: "Your email",
    emailPlaceholder: "name@email.com",
    whyAsking: "Personal or business, either is fine — it's where your invoices and your sign-in link go.",
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
    haveDomain: "J'ai un domaine",
    needDomain: "Il me faut un domaine",
    newDomain: "Le domaine que vous voulez",
    domainPlaceholder: "votreentreprise.com",
    check: "Vérifier",
    checking: "Vérification…",
    domainNote: "Les domaines sont facturés à l'année. Enregistré par Servolia pour vous — il vous appartient, transférable où vous voulez sur demande.",
    priceLine: (price: number) => `${usd(price)} $ / an`,
    availableTag: "Disponible",
    domainBilledYearly: "Facturé à l'année. Enregistré par Servolia pour vous — il vous appartient, transférable où vous voulez sur demande.",
    taken: "Déjà pris — l'une de ces options, ou un autre nom :",
    takenNoAlt: "Déjà pris — essayez un autre nom.",
    unsupported: "Nous ne vendons pas cette extension. Apportez-la d'un autre registrar et choisissez « J'ai un domaine ».",
    tooExpensive: "Cette extension coûte trop cher pour cette formule — essayez .com, .org ou .net.",
    checkFailed: "Vérification impossible pour le moment — réessayez dans un instant.",
    today: "aujourd'hui",
    thenMonthly: (n: number) => `puis ${usd(n)} $ / mois`,
    payToday: (n: number) => `Payer ${usd(n)} $ aujourd'hui`,
    setupOnce: (n: number) => `+ ${usd(n)} $ une fois — boîtes email mises en place`,
    setupWord: "mise en place email",
    once: "une fois",
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
    groupAll: "Dans chaque formule",
    groupAdds: (tier: string) => `${tier} ajoute`,
    everythingIn: (tier: string) => `Tout ce qu'inclut ${tier}, plus :`,
    billedYearly: "Facturé une fois par an",
    billedMonthly: "Facturé chaque mois",
    included: "Ce qui est inclus",
    almost: "Dernière étape",
    yourSite: "Votre site web",
    sitePlaceholder: "votredomaine.com",
    yourEmail: "Votre email",
    emailPlaceholder: "nom@email.com",
    whyAsking: "Personnelle ou professionnelle, peu importe — c'est là qu'arrivent vos factures et votre lien de connexion.",
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
  domainsOffered = false,
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
  /** Only the server knows whether the registrar is configured. */
  domainsOffered?: boolean;
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
  const [domainMode, setDomainMode] = useState<"have" | "need">("have");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [checking, setChecking] = useState(false);

  /** Check the box's name, or a suggested one (which also goes into the box). */
  async function checkDomain(suggested?: string) {
    const name = cleanDomain(suggested ?? site);
    if (!name) { setQuote(null); return; }
    if (suggested) setSite(suggested);
    setChecking(true); setQuote(null); setError(null);
    try {
      const res = await fetch(`/api/domain-quote?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!data.ok) {
        setQuote({ domain: name, sellable: false, reason: data.reason ?? "error", yearlyUsd: 0, alternatives: [] });
        return;
      }
      setQuote({
        domain: data.domain, sellable: data.sellable, reason: data.reason,
        yearlyUsd: data.yearlyUsd, alternatives: Array.isArray(data.alternatives) ? data.alternatives : [],
      });
    } catch {
      setQuote({ domain: name, sellable: false, reason: "error", yearlyUsd: 0, alternatives: [] });
    } finally {
      setChecking(false);
    }
  }

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
          // The server quotes the domain again before charging for it.
          buyDomain: domainsOffered && domainMode === "need",
          domain: site.trim(),
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
    const buying = domainsOffered && domainMode === "need";
    // A quote counts only for the exact name in the box: editing the box
    // after checking must not carry the old price into the payment.
    const quoteMatches = buying && quote !== null && quote.sellable && quote.domain === cleanDomain(site);
    // A domain is a year, whatever the plan's rhythm. On a monthly plan the
    // first payment is this month plus the domain's year.
    const domainAmount = quoteMatches && quote ? quote.yearlyUsd : 0;
    const setupAmount = picked.setupUsd ?? 0;
    const total = amount + domainAmount + setupAmount;
    // "today" wording whenever the first payment differs from what repeats:
    // a one-time setup, or a domain's year on a monthly plan.
    const firstDiffers = setupAmount > 0 || (!annual && domainAmount > 0);
    const money = (n: number) => (lang === "fr" ? `${usd(n)} $` : `$${usd(n)}`);
    const ready = site.trim().length > 3 && /.+@.+\..+/.test(email) && (!buying || quoteMatches);
    const fieldCls = "w-full h-11 px-3.5 text-[15px] border border-[#E2E6DD] rounded-lg bg-white outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/15";
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
            {picked.setupUsd ? (
              <p className="mt-1 text-[12.5px] font-semibold opacity-85">{t.setupOnce(picked.setupUsd)}</p>
            ) : null}
          </div>

          {/* What they are about to pay for, on the screen where they pay for
              it. Nobody should have to scroll back up to check. */}
          {picked.includes?.length ? (
            <div className="px-7 pt-5 pb-4 border-b border-[#F2F1ED] bg-[#FBFBF8]">
              <p className="text-[11px] font-black text-[#8A8A80] uppercase tracking-[0.14em] mb-2">{t.included}</p>
              <ul className="space-y-1.5">
                {picked.includes.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[13px] text-[#3F3F46] leading-snug">
                    <Check className="w-3.5 h-3.5 mt-[3px] text-[#36671E] shrink-0" strokeWidth={3} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="px-7 py-6">
            {domainsOffered ? (
              <div className="flex gap-1 p-1 rounded-lg bg-[#EAEFE4] mb-4">
                {(["have", "need"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setDomainMode(m); setQuote(null); }}
                    className={`flex-1 h-8 rounded-md text-[12.5px] font-bold transition ${
                      domainMode === m ? "bg-white text-[#295115] shadow-[0_1px_2px_rgba(22,26,21,0.10)]" : "text-[#5E6659] hover:text-[#295115]"
                    }`}
                  >
                    {m === "have" ? t.haveDomain : t.needDomain}
                  </button>
                ))}
              </div>
            ) : null}

            <label htmlFor="pc-site" className="block text-[11px] font-black text-[#8A8A80] uppercase tracking-[0.14em] mb-1.5">
              {buying ? t.newDomain : t.yourSite}
            </label>
            <div className={buying ? "flex gap-2" : ""}>
              <input
                id="pc-site"
                value={site}
                onChange={(e) => { setSite(e.target.value); if (buying) setQuote(null); }}
                onKeyDown={(e) => { if (buying && e.key === "Enter") { e.preventDefault(); checkDomain(); } }}
                placeholder={buying ? t.domainPlaceholder : t.sitePlaceholder}
                className={`${fieldCls} ${buying ? "flex-1" : "mb-4"}`}
              />
              {buying ? (
                <button
                  type="button"
                  onClick={() => checkDomain()}
                  disabled={checking || cleanDomain(site) === null}
                  className="h-11 px-4 shrink-0 rounded-lg border border-[#CBD8BE] text-[#295115] font-bold text-[14px] hover:border-[#36671E] hover:bg-[#F7FBF4] disabled:opacity-45 transition"
                >
                  {checking ? t.checking : t.check}
                </button>
              ) : null}
            </div>
            {buying && quote ? (
              <div
                className={`mt-2 mb-4 rounded-xl border p-3.5 text-[13px] leading-relaxed ${
                  quote.sellable
                    ? "border-[#CBE3BC] bg-[#F3F9EE]"
                    : quote.reason === "taken"
                      ? "border-[#FDE68A] bg-[#FFFBEB]"
                      : "border-[#E2E6DD] bg-[#FAFAF7]"
                }`}
              >
                {quote.sellable ? (
                  <>
                    <p className="flex items-center gap-2 font-bold text-[#295115]">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] bg-[#DDEFCB] rounded-full px-2 py-0.5">
                        <Check className="w-3 h-3" /> {t.availableTag}
                      </span>
                      <span className="truncate">{quote.domain}</span>
                      <span className="ml-auto tabular-nums whitespace-nowrap">{t.priceLine(quote.yearlyUsd)}</span>
                    </p>
                    <p className="mt-1.5 text-[#5E6659]">{t.domainBilledYearly}</p>
                  </>
                ) : quote.reason === "taken" ? (
                  <>
                    <p className="flex items-center gap-2 font-bold text-[#92400E]">
                      <X className="w-4 h-4 shrink-0" />
                      <span className="truncate">{quote.domain}</span>
                    </p>
                    <p className="mt-1 text-[#78350F]">{quote.alternatives.length ? t.taken : t.takenNoAlt}</p>
                    {quote.alternatives.length ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {quote.alternatives.map((a) => (
                          <button
                            key={a.domain}
                            type="button"
                            onClick={() => checkDomain(a.domain)}
                            className="h-8 px-3 rounded-lg border border-[#CBD8BE] bg-white text-[12.5px] font-bold text-[#295115] hover:border-[#36671E] hover:bg-[#F7FBF4] transition tabular-nums"
                          >
                            {a.domain} · {t.priceLine(a.yearlyUsd)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[#5E6659]">
                    {quote.reason === "unsupported" ? t.unsupported : quote.reason === "too-expensive" ? t.tooExpensive : t.checkFailed}
                  </p>
                )}
              </div>
            ) : buying ? (
              <p className="mt-2 mb-4 text-[12.5px] leading-relaxed text-[#8A8A80]">{t.domainNote}</p>
            ) : null}

            <label htmlFor="pc-email" className="block text-[11px] font-black text-[#8A8A80] uppercase tracking-[0.14em] mb-1.5">
              {t.yourEmail}
            </label>
            <input
              id="pc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className={fieldCls}
            />
            <p className="mt-2.5 text-[12px] text-[#8A8A80] leading-relaxed">{t.whyAsking}</p>

            {(quoteMatches && quote) || setupAmount > 0 ? (
              <p className="mt-5 text-[13px] text-[#5E6659] text-center tabular-nums leading-relaxed">
                {picked.tier} {money(amount)} {annual ? t.perYear : t.perMonth}
                {quoteMatches && quote ? <> + {quote.domain} {money(domainAmount)} {t.perYear}</> : null}
                {setupAmount > 0 ? <> + {t.setupWord} {money(setupAmount)} {t.once}</> : null}
                {" = "}
                <strong className="text-[#18181B]">{money(total)}</strong>{" "}
                {firstDiffers ? t.today : t.perYear}
                {!annual && firstDiffers ? <>, {t.thenMonthly(amount)}</> : null}
              </p>
            ) : null}

            <button
              onClick={() => pay(picked.planKey)}
              disabled={!ready || busy}
              className="mt-6 w-full h-12 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 disabled:opacity-45 transition"
            >
              {busy ? t.working : ready ? (firstDiffers ? t.payToday(total) : t.pay(total)) : t.needDetails}
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
              {/* Same fixed height on every card, so a one-time line on one
                  tier does not push its blurb below the others'. */}
              <p className="mt-0.5 h-[16px] text-[11.5px] text-[#8A8A80]">
                {p.setupUsd ? t.setupOnce(p.setupUsd) : ""}
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

      {/* THE COMPARISON IS A DECISION TOOL, NOT A GRID.
          Rows are grouped by the tier that first includes them -- "In every
          plan", then "Complete adds", then "Business adds" -- so the ladder
          reads at a glance; the grouping is derived from the data, never
          typed. Each line carries its plain-words meaning, each column says
          who it is for, and the last row prices and chooses, so comparing
          ends in choosing without a scroll back to the cards. Nothing of
          varying height sits beside a figure: the tier names align at the
          top of the header, and the price row is one line. */}
      <div className="mt-14">
        <p className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-[#8A8A80] mb-5">
          {t.compare}
        </p>

        {/* PHONE: the same ladder, stacked. A 640px table on a 375px screen
            shows one column and a scrollbar, which is no comparison at all.
            Each tier is a block with its price and its own Choose; the base
            tier lists everything, each step up says what it adds. */}
        <div className="sm:hidden space-y-3">
          {tiers.map((p, i) => {
            const added = features.filter((f) => f.on.findIndex(Boolean) === i);
            return (
              <div
                key={p.planKey}
                className={`rounded-2xl bg-white p-4 ${p.featured ? "border border-[#36671E]" : "border border-[#E2E6DD]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#295115]">{p.tier}</p>
                    {p.bestFor ? <p className="mt-1 text-[12px] leading-snug text-[#8A8A80]">{p.bestFor}</p> : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[16px] font-black tracking-tight text-[#161A15] tabular-nums leading-none">
                      ${usd(priceOf(p))}
                      <span className="ml-1 text-[11px] font-medium text-[#71717A]">{annual ? t.perYear : t.perMonth}</span>
                    </p>
                    {p.setupUsd ? <p className="mt-1 text-[10.5px] text-[#8A8A80]">{t.setupOnce(p.setupUsd)}</p> : null}
                    <button
                      onClick={() => choose(p.planKey)}
                      disabled={busy}
                      className="mt-2 h-8 px-3.5 rounded-lg text-[12.5px] font-bold text-[#295115] bg-white border border-[#CBD8BE] hover:border-[#36671E] disabled:opacity-55"
                    >
                      {t.choose}
                    </button>
                  </div>
                </div>
                {i > 0 ? (
                  <p className="mt-3 text-[12.5px] font-semibold text-[#3F3F46]">{t.everythingIn(tiers[i - 1].tier)}</p>
                ) : null}
                <ul className="mt-2.5 space-y-2">
                  {added.map((f) => (
                    <li key={f.label} className="flex items-start gap-2">
                      <Check className="w-[15px] h-[15px] mt-[2px] text-[#36671E] shrink-0" strokeWidth={3} />
                      <div>
                        <span className="block text-[13.5px] leading-snug text-[#3F3F46]">{f.label}</span>
                        {f.hint ? <span className="mt-0.5 block text-[12px] leading-snug text-[#8A8A80]">{f.hint}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* DESKTOP: the matrix. */}
        <div className="hidden sm:block overflow-x-auto rounded-2xl border border-[#E2E6DD] bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E8E6E0]">
                <th className="w-[40%] px-5 py-4 align-top" />
                {tiers.map((p) => (
                  <th
                    key={p.planKey}
                    className={`px-4 py-4 text-center align-top ${p.featured ? "bg-[#F7FBF4]" : ""}`}
                  >
                    <span className={`block text-[11px] font-black uppercase tracking-[0.13em] ${
                      p.featured ? "text-[#295115]" : "text-[#5E6659]"
                    }`}>
                      {p.tier}
                    </span>
                    {p.bestFor ? (
                      <span className="mt-1.5 block text-[12px] font-medium normal-case tracking-normal leading-snug text-[#8A8A80]">
                        {p.bestFor}
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f, idx) => {
                const firstOn = f.on.findIndex(Boolean);
                const prevFirstOn = idx === 0 ? -1 : features[idx - 1].on.findIndex(Boolean);
                const newGroup = firstOn !== prevFirstOn;
                return [
                  newGroup ? (
                    <tr key={`g-${f.label}`} className="border-b border-[#F2F1ED]">
                      <td colSpan={tiers.length + 1}
                          className="px-5 pt-4 pb-2 text-[10.5px] font-black uppercase tracking-[0.14em] text-[#36671E]">
                        {firstOn <= 0 ? t.groupAll : t.groupAdds(tiers[firstOn].tier)}
                      </td>
                    </tr>
                  ) : null,
                  <tr key={f.label} className="border-b border-[#F2F1ED]">
                    <td className="px-5 py-3.5 align-top">
                      <span className="block text-[13.5px] text-[#3F3F46] leading-snug">{f.label}</span>
                      {f.hint ? <span className="mt-0.5 block text-[12px] text-[#8A8A80] leading-snug">{f.hint}</span> : null}
                    </td>
                    {tiers.map((p, i) => (
                      <td
                        key={p.planKey}
                        className={`px-4 py-3.5 text-center align-middle ${p.featured ? "bg-[#F7FBF4]" : ""}`}
                      >
                        <Mark on={f.on[i] === true} />
                      </td>
                    ))}
                  </tr>,
                ];
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E8E6E0]">
                <td className="px-5 py-4 text-[12px] text-[#8A8A80] align-middle">
                  {annual ? t.billedYearly : t.billedMonthly}
                </td>
                {tiers.map((p) => (
                  <td key={p.planKey} className={`px-4 py-4 text-center align-middle ${p.featured ? "bg-[#F7FBF4]" : ""}`}>
                    <span className="block text-[18px] font-black tracking-tight text-[#161A15] tabular-nums leading-none">
                      ${usd(priceOf(p))}
                      <span className="ml-1 text-[11px] font-medium text-[#71717A] tracking-normal">
                        {annual ? t.perYear : t.perMonth}
                      </span>
                    </span>
                    {p.setupUsd ? <span className="block mt-1 text-[10.5px] text-[#8A8A80]">{t.setupOnce(p.setupUsd)}</span> : null}
                    <button
                      onClick={() => choose(p.planKey)}
                      disabled={busy}
                      className={`mt-2.5 h-9 px-5 rounded-lg font-bold text-[13px] disabled:opacity-55 transition ${
                        p.featured
                          ? "bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] hover:opacity-90"
                          : "bg-white text-[#295115] border border-[#CBD8BE] hover:border-[#36671E] hover:bg-[#F7FBF4]"
                      }`}
                    >
                      {t.choose}
                    </button>
                  </td>
                ))}
              </tr>
            </tfoot>
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
