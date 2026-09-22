"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The interactive pieces of the public receptionist trial
 * (src/lib/receptionistTrial.ts, /fr/essai and /fr/essai/confirmer).
 * Every one posts to /api/receptionist-trial and says what happened in
 * plain words — never a spinner that ends in silence.
 */

type Lang = "fr" | "en";

async function post(action: string, body: Record<string, unknown>) {
  const res = await fetch("/api/receptionist-trial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.ok !== false, json };
}

const input = "w-full h-12 px-4 rounded-xl border border-[#D4D4D8] bg-white text-[15px] text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E]";
const primary = "inline-flex items-center justify-center h-12 px-6 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-[15px] font-bold hover:opacity-90 transition disabled:opacity-50";
const errorBox = "mt-3 text-[13.5px] text-[#B42318]";

/* ── 1. Her site ─────────────────────────────────────────────────────── */

export function DraftForm({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [practice, setPractice] = useState<"dental" | "aesthetic">("dental");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, json } = await post("draft", { domain, practice, lang });
    if (ok && json.slug) {
      router.push(`/fr/essai?site=${encodeURIComponent(json.slug)}`);
      return;
    }
    setBusy(false);
    setError(
      json.reason === "invalid-domain"
        ? (fr ? "Ce n'est pas une adresse de site — essayez par exemple cabinet-dupont.fr" : "That is not a website address — try e.g. yourpractice.com")
        : json.reason === "shared-platform"
          ? (fr ? "C'est une page sur une plateforme (Doctolib, Google, Facebook…). Il nous faut l'adresse de votre propre site." : "That is a page on a platform (Doctolib, Google, Facebook…). We need your own website's address.")
        : json.reason === "rate"
          ? (fr ? "Trop d'essais d'affilée — réessayez dans une minute." : "Too many tries in a row — try again in a minute.")
          : (fr ? "Une erreur de notre côté. Réessayez, ou écrivez à hello@servolia.com." : "Something failed on our side. Try again, or write to hello@servolia.com."),
    );
  }

  return (
    <form onSubmit={go} className="mt-8" data-testid="essai-draft-form">
      <label className="block text-[13px] font-bold text-[#18181B] mb-2" htmlFor="essai-domain">
        {fr ? "L'adresse de votre site" : "Your website address"}
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input id="essai-domain" className={input} value={domain} onChange={(e) => setDomain(e.target.value)}
          placeholder={fr ? "cabinet-dupont.fr" : "yourpractice.com"} autoComplete="url" inputMode="url" required />
        <button className={primary} disabled={busy || !domain.trim()}>
          {busy ? (fr ? "Lecture de votre site…" : "Reading your site…") : (fr ? "Voir ma réceptionniste" : "Show me mine")}
        </button>
      </div>
      <div className="mt-3 flex gap-5 text-[13.5px] text-[#3F3F46]">
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="practice" checked={practice === "dental"} onChange={() => setPractice("dental")} />
          {fr ? "Cabinet dentaire" : "Dental practice"}
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="practice" checked={practice === "aesthetic"} onChange={() => setPractice("aesthetic")} />
          {fr ? "Médecine esthétique" : "Medical aesthetics"}
        </label>
      </div>
      {error ? <p className={errorBox} role="alert">{error}</p> : null}
    </form>
  );
}

/* ── 2. Her address ──────────────────────────────────────────────────── */

export function RequestForm({ slug, lang, domain }: { slug: string; lang: Lang; domain: string }) {
  const fr = lang === "fr";
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const { ok, json } = await post("request", { slug, email, lang, company });
    if (ok) { setState("sent"); return; }
    setState("error");
    setError(
      json.reason === "invalid-email" ? (fr ? "Cette adresse email ne semble pas valide." : "That email address does not look valid.")
      : json.reason === "taken" ? (fr ? `Un essai est déjà en cours pour ${domain} — le lien est dans la boîte mail de la personne qui l'a lancé. S'il n'est pas installé sur le site sous 48 h, vous pourrez le reprendre.` : `A trial is already running for ${domain} — the link is in the inbox of whoever started it. If it is not on the site within 48 hours, you can take it over.`)
      : json.reason === "rate" ? (fr ? "Trop de demandes — réessayez dans quelques minutes." : "Too many requests — try again in a few minutes.")
      : (fr ? "L'email n'a pas pu partir. Réessayez, ou écrivez à hello@servolia.com." : "The email could not be sent. Try again, or write to hello@servolia.com."),
    );
  }

  if (state === "sent") {
    return (
      <div className="mt-6 rounded-2xl border border-[#36671E]/30 bg-[#EEF5EA] p-5" data-testid="essai-request-sent" role="status">
        <p className="font-bold text-[#18181B]">{fr ? "Regardez votre boîte mail." : "Check your inbox."}</p>
        <p className="mt-1 text-[14px] text-[#3F3F46]">
          {fr
            ? `Nous venons d'envoyer un lien à ${email}. Il confirme que l'adresse est la vôtre — c'est là qu'arriveront les demandes de vos patients. Pas reçu dans deux minutes ? Regardez les indésirables.`
            : `We just sent a link to ${email}. It confirms the address is yours — it is where your patients' enquiries will arrive. Nothing after two minutes? Check spam.`}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={go} className="mt-6" data-testid="essai-request-form">
      <label className="block text-[13px] font-bold text-[#18181B] mb-2" htmlFor="essai-email">
        {fr ? "Votre email professionnel — les demandes des patients y arriveront" : "Your work email — patients' enquiries will arrive there"}
      </label>
      {/* Invisible to people, irresistible to bots. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={company} onChange={(e) => setCompany(e.target.value)} name="company" />
      <div className="flex flex-col sm:flex-row gap-3">
        <input id="essai-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={fr ? "contact@cabinet-dupont.fr" : "hello@yourpractice.com"} autoComplete="email" required />
        <button className={primary} disabled={state === "busy" || !email.trim()}>
          {state === "busy" ? (fr ? "Envoi…" : "Sending…") : (fr ? "La mettre sur mon site" : "Put it on my site")}
        </button>
      </div>
      <p className="mt-2 text-[12.5px] text-[#71717A]">
        {fr ? "7 jours gratuits, sans carte. Rien ne change sur votre site sans vous." : "7 free days, no card. Nothing changes on your site without you."}
      </p>
      {state === "error" ? <p className={errorBox} role="alert">{error}</p> : null}
    </form>
  );
}

/* ── 3. What it says, and her click ──────────────────────────────────── */

export interface DetailsInit { phone?: string; hours?: string; address?: string; bookingUrl?: string; instructions?: string }

export function DetailsForm({ token, lang, init, mode }: { token: string; lang: Lang; init: DetailsInit; mode: "start" | "edit" }) {
  const fr = lang === "fr";
  const router = useRouter();
  const [d, setD] = useState<DetailsInit>(init);
  const [consent, setConsent] = useState(mode === "edit");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof DetailsInit) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const { ok, json } = await post(mode, { token, details: d });
    if (ok) {
      setState("saved");
      router.refresh();
      return;
    }
    setState("error");
    setError(
      json.reason === "taken" ? (fr ? "Cette réceptionniste a déjà été lancée depuis une autre adresse." : "This receptionist was already started from another address.")
      : json.reason === "used" ? (fr ? "Cette adresse a déjà eu son essai gratuit. Écrivez-nous à hello@servolia.com." : "This address has already had its free trial. Write to hello@servolia.com.")
      : json.reason === "ended" ? (fr ? "L'essai de ce site est terminé." : "This site's trial is over.")
      : json.reason === "invalid-link" ? (fr ? "Ce lien a expiré. Recommencez depuis servolia.com/fr/essai." : "This link has expired. Start again from servolia.com/fr/essai.")
      : (fr ? "Une erreur de notre côté. Réessayez." : "Something failed on our side. Try again."),
    );
  }

  const field = (k: keyof DetailsInit, label: string, placeholder: string) => (
    <div>
      <label className="block text-[13px] font-bold text-[#18181B] mb-1.5" htmlFor={`rt-${k}`}>{label}</label>
      <input id={`rt-${k}`} className={input} value={d[k] ?? ""} onChange={set(k)} placeholder={placeholder} />
    </div>
  );

  return (
    <form onSubmit={go} className="flex flex-col gap-4" data-testid={`essai-${mode}-form`}>
      {field("phone", fr ? "Téléphone du cabinet" : "Practice phone", "01 23 45 67 89")}
      {field("hours", fr ? "Horaires" : "Opening hours", fr ? "Lun–Ven 9h–19h, Sam 9h–13h" : "Mon–Fri 9am–7pm")}
      {field("address", fr ? "Adresse" : "Address", fr ? "12 rue de la République, 69002 Lyon" : "12 High Street, London")}
      {field("bookingUrl", fr ? "Lien de prise de rendez-vous (Doctolib…), si vous en avez un" : "Booking link (Doctolib…), if you have one", "https://www.doctolib.fr/…")}
      <div>
        <label className="block text-[13px] font-bold text-[#18181B] mb-1.5" htmlFor="rt-instructions">
          {fr ? "Ce qu'elle doit toujours dire, proposer ou éviter" : "What it should always say, offer or avoid"}
        </label>
        <textarea id="rt-instructions" className={`${input} h-24 py-3`} value={d.instructions ?? ""} onChange={set("instructions")}
          placeholder={fr ? "Ex. : proposer les urgences le samedi matin, rappeler que le parking est gratuit…" : "E.g. offer Saturday-morning emergencies, mention free parking…"} />
        <p className="mt-1 text-[12px] text-[#71717A]">
          {fr ? "Elle ne donnera jamais de prix ni d'avis médical : cette règle reste, quoi que vous écriviez." : "It never gives a price or medical advice: that rule stays whatever you write."}
        </p>
      </div>
      {mode === "start" ? (
        <label className="flex items-start gap-2.5 text-[13.5px] text-[#3F3F46]">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span>
            {fr
              ? "Je suis responsable de ce site (ou j'agis pour son compte). Les conversations sont traitées par Servolia pour le compte du cabinet."
              : "I run this website (or act for whoever does). Conversations are processed by Servolia on the practice's behalf."}
          </span>
        </label>
      ) : null}
      <div>
        <button className={primary} disabled={state === "busy" || !consent}>
          {state === "busy"
            ? (fr ? "Un instant…" : "One moment…")
            : mode === "start" ? (fr ? "Démarrer mes 7 jours gratuits" : "Start my 7 free days") : (fr ? "Enregistrer" : "Save")}
        </button>
        {state === "saved" && mode === "edit" ? <span className="ml-3 text-[13.5px] font-bold text-[#36671E]" role="status">{fr ? "Enregistré — c'est pris en compte dès la prochaine conversation." : "Saved — it applies from the next conversation."}</span> : null}
      </div>
      {state === "error" ? <p className={errorBox} role="alert">{error}</p> : null}
    </form>
  );
}

/* ── 4. The line, and whether it is there ────────────────────────────── */

export function SnippetBox({ snippet, lang }: { snippet: string; lang: Lang }) {
  const fr = lang === "fr";
  const [copied, setCopied] = useState(false);
  return (
    <div data-testid="essai-snippet">
      <pre className="p-4 rounded-xl bg-[#18181B] text-[#E4E4E7] text-[12.5px] leading-relaxed whitespace-pre-wrap break-all">{snippet}</pre>
      <button
        type="button"
        className="mt-3 inline-flex items-center h-10 px-4 rounded-lg border border-[#D4D4D8] bg-white text-[13.5px] font-bold text-[#18181B] hover:border-[#36671E]"
        onClick={() => { navigator.clipboard?.writeText(snippet).then(() => setCopied(true), () => setCopied(false)); }}
      >
        {copied ? (fr ? "Copié ✓" : "Copied ✓") : (fr ? "Copier la ligne" : "Copy the line")}
      </button>
    </div>
  );
}

export function InstallCheck({ token, lang, domain }: { token: string; lang: Lang; domain: string }) {
  const fr = lang === "fr";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "found" | "missing" | "error">("idle");

  async function go() {
    setState("busy");
    const { ok, json } = await post("check", { token });
    if (ok && json.found) { setState("found"); router.refresh(); return; }
    setState(ok ? "missing" : "error");
  }

  return (
    <div className="mt-4" data-testid="essai-install-check">
      <button type="button" className={primary} onClick={go} disabled={state === "busy"}>
        {state === "busy" ? (fr ? `Lecture de ${domain}…` : `Reading ${domain}…`) : (fr ? "J'ai collé la ligne — vérifier" : "I pasted the line — check")}
      </button>
      {state === "found" ? <p className="mt-3 text-[14px] font-bold text-[#36671E]" role="status">{fr ? "Trouvée ✓ Elle est sur votre site." : "Found ✓ It is on your site."}</p> : null}
      {state === "missing" ? (
        <p className="mt-3 text-[13.5px] text-[#3F3F46]" role="status">
          {fr
            ? `Pas encore visible sur la page d'accueil de ${domain}. Si vous venez de la coller, videz le cache de votre site (ou attendez quelques minutes) et réessayez. Nous vérifions aussi chaque matin.`
            : `Not visible on ${domain}'s homepage yet. If you just pasted it, clear your site's cache (or wait a few minutes) and try again. We also check every morning.`}
        </p>
      ) : null}
      {state === "error" ? <p className={errorBox} role="alert">{fr ? `Impossible de lire ${domain} pour l'instant — réessayez dans une minute.` : `Could not read ${domain} right now — try again in a minute.`}</p> : null}
    </div>
  );
}

/* ── 5. Keep it ──────────────────────────────────────────────────────── */

export interface PlanChoice { key: string; name: string; monthlyEur: number; annualEur: number; conversations: number; audience: string; popular: boolean }

export function KeepPlans({ token, lang, plans, setupEur }: { token: string; lang: Lang; plans: PlanChoice[]; setupEur: number }) {
  const fr = lang === "fr";
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function keep(plan: string) {
    setBusy(plan);
    setError("");
    const res = await fetch("/api/checkout-receptionist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, plan, billing: annual ? "annual" : "monthly" }),
    });
    const json = await res.json().catch(() => ({}));
    // assign(), the house pattern (PlanChooser): same navigation, lint-clean.
    if (res.ok && json.url) { window.location.assign(json.url); return; }
    setBusy("");
    setError(fr ? "Le paiement n'a pas pu s'ouvrir. Réessayez, ou écrivez à hello@servolia.com." : "Checkout could not open. Try again, or write to hello@servolia.com.");
  }

  return (
    <div data-testid="essai-keep">
      <div className="inline-flex rounded-xl border border-[#E8E6E0] bg-white p-1 text-[13px] font-bold">
        <button type="button" onClick={() => setAnnual(false)} className={`px-4 h-9 rounded-lg ${!annual ? "bg-[#18181B] text-white" : "text-[#52525B]"}`}>{fr ? "Mensuel" : "Monthly"}</button>
        <button type="button" onClick={() => setAnnual(true)} className={`px-4 h-9 rounded-lg ${annual ? "bg-[#18181B] text-white" : "text-[#52525B]"}`}>{fr ? "Annuel — 2 mois offerts" : "Yearly — 2 months free"}</button>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {plans.map((p) => (
          <div key={p.key} className={`rounded-2xl border-2 bg-white p-4 flex flex-col ${p.popular ? "border-[#36671E]" : "border-[#E8E6E0]"}`}>
            <p className="font-black text-[#18181B]">{p.name}</p>
            <p className="mt-1 text-2xl font-black text-[#18181B]">
              {annual ? p.annualEur : p.monthlyEur}&nbsp;€<span className="text-[13px] font-semibold text-[#71717A]">{annual ? (fr ? "/an" : "/year") : (fr ? "/mois" : "/month")}</span>
            </p>
            <p className="mt-1 text-[12.5px] font-semibold text-[#059669]">{p.conversations} {fr ? "conversations/mois" : "conversations/month"}</p>
            <p className="mt-1 mb-3 text-[12.5px] text-[#71717A]">{p.audience}</p>
            <button type="button" className={`${primary} mt-auto h-11 text-[14px]`} onClick={() => keep(p.key)} disabled={Boolean(busy)}>
              {busy === p.key ? (fr ? "Ouverture…" : "Opening…") : (fr ? "La garder" : "Keep it")}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-[#71717A]">
        {fr
          ? `Prix HT. Mise en place (${setupEur} €) offerte : elle est déjà installée. Résiliable à tout moment. Si le mois est chargé, elle continue de répondre — nous vous prévenons à 80 % et à 100 %.`
          : `Prices excl. VAT. Installation (€${setupEur}) waived: it is already installed. Cancel anytime. In a busy month it keeps answering — you are told at 80% and 100%.`}
      </p>
      {error ? <p className={errorBox} role="alert">{error}</p> : null}
    </div>
  );
}
