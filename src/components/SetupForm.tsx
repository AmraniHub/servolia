"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";

/**
 * WHAT WE NEED BEFORE ANYTHING CAN BE HOSTED.
 *
 * A self-serve payment tells us an amount and an email and nothing else. The
 * site is on somebody else's server, the domain is at a registrar we cannot
 * see, and until the client says where both are, the money has bought a
 * promise nobody can act on. This is the shortest form that closes that.
 *
 * IT DOES NOT ASK FOR A PASSWORD, AND IT SAYS SO IN BOLD.
 *
 * Asking a client for their login is the single worst habit in this trade. It
 * teaches the person to hand credentials to whoever asks — which is exactly
 * the behaviour every phishing attack depends on — it puts us in possession of
 * something we cannot secure, and it makes us liable for anything that breaks
 * while we hold it. Every platform worth hosting has delegated access instead:
 * a Shopify collaborator request, a WordPress user, a GitHub collaborator, DNS
 * access at the registrar. Those are revocable, attributable, and scoped. A
 * password is none of the three.
 *
 * So the form asks WHERE things are and offers to send the right invitation
 * request. It never has a password field to fill in by accident.
 */

const PLATFORMS = [
  { id: "wordpress", en: "WordPress", fr: "WordPress" },
  { id: "shopify", en: "Shopify", fr: "Shopify" },
  { id: "wix", en: "Wix", fr: "Wix" },
  { id: "squarespace", en: "Squarespace", fr: "Squarespace" },
  { id: "custom", en: "Custom-built site", fr: "Site sur mesure" },
  { id: "none", en: "Not built yet", fr: "Pas encore créé" },
];

const T = {
  en: {
    siteUrl: "Your website address",
    siteUrlPlaceholder: "yourdomain.com",
    platform: "What is it built with?",
    registrar: "Where is your domain registered?",
    registrarPlaceholder: "GoDaddy, Namecheap, OVH…",
    registrarHelp: "The company you pay for the domain name each year.",
    notes: "Anything else we should know",
    notesPlaceholder: "Who currently manages the site, deadlines, anything unusual…",
    submit: "Send these details",
    working: "Sending…",
    doneTitle: "Got it — that's everything we need",
    doneBody:
      "We will get in touch from this address within one working day to arrange access. Nothing changes on your site until you have approved it.",
    noPasswords: "Never send us a password.",
    noPasswordsBody:
      "We will ask for proper access instead — a collaborator invitation, a user account, or DNS access — which you can withdraw at any time and which shows exactly what we did. Anyone asking you for your password, including us, should be refused.",
    required: "Please fill in your website address and platform",
    error: "That did not send. Try again in a moment.",
    ref: "Your reference",
  },
  fr: {
    siteUrl: "L'adresse de votre site",
    siteUrlPlaceholder: "votredomaine.com",
    platform: "Avec quoi est-il construit ?",
    registrar: "Où votre domaine est-il enregistré ?",
    registrarPlaceholder: "GoDaddy, Namecheap, OVH…",
    registrarHelp: "La société à qui vous payez le nom de domaine chaque année.",
    notes: "Autre chose à savoir",
    notesPlaceholder: "Qui gère le site aujourd'hui, vos échéances, tout élément inhabituel…",
    submit: "Envoyer ces informations",
    working: "Envoi…",
    doneTitle: "C'est noté — nous avons tout ce qu'il faut",
    doneBody:
      "Nous vous écrivons à cette adresse sous un jour ouvré pour organiser les accès. Rien ne change sur votre site avant votre accord.",
    noPasswords: "Ne nous envoyez jamais de mot de passe.",
    noPasswordsBody:
      "Nous demanderons un accès en bonne et due forme — une invitation collaborateur, un compte utilisateur, ou l'accès DNS — que vous pouvez retirer à tout moment et qui montre exactement ce que nous avons fait. Quiconque vous demande votre mot de passe, nous compris, doit être refusé.",
    required: "Indiquez l'adresse de votre site et la plateforme",
    error: "L'envoi a échoué. Réessayez dans un instant.",
    ref: "Votre référence",
  },
};

export default function SetupForm({
  token,
  reference,
  lang = "en",
  initialSiteUrl = "",
}: {
  token: string;
  reference: string;
  lang?: "en" | "fr";
  initialSiteUrl?: string;
}) {
  const t = T[lang];
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl);
  const [platform, setPlatform] = useState("");
  const [registrar, setRegistrar] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = siteUrl.trim().length > 3 && platform !== "";

  async function submit() {
    if (!ready) { setError(t.required); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/hosting-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          siteUrl: siteUrl.trim(),
          platform,
          registrar: registrar.trim(),
          notes: notes.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError(t.error);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[#CBE3BC] bg-[#F3F9EE] p-7 text-center">
        <CheckCircle2 className="w-11 h-11 text-[#36671E] mx-auto mb-4" />
        <h2 className="text-[19px] font-black text-[#161A15] mb-2">{t.doneTitle}</h2>
        <p className="text-[15px] text-[#3F3F46] leading-relaxed">{t.doneBody}</p>
        <p className="mt-5 text-[12px] text-[#5E6659]">
          {t.ref} <span className="font-bold tabular-nums">{reference}</span>
        </p>
      </div>
    );
  }

  const field = "w-full h-11 px-3.5 text-[15px] border border-[#E2E6DD] rounded-lg bg-white outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/15";
  const label = "block text-[11px] font-black text-[#8A8A80] uppercase tracking-[0.14em] mb-1.5";

  return (
    <div>
      {/* Said before the fields, not after: by the time someone has typed a
          password into a box, telling them not to is too late. */}
      <div className="flex gap-3 rounded-xl border border-[#F0DFA8] bg-[#FEF9EC] p-4 mb-6">
        <ShieldAlert className="w-5 h-5 text-[#92700E] shrink-0 mt-0.5" />
        <p className="text-[13px] leading-relaxed text-[#6B5309]">
          <strong className="font-bold">{t.noPasswords}</strong> {t.noPasswordsBody}
        </p>
      </div>

      <div className="rounded-2xl border border-[#E2E6DD] bg-white p-7">
        <label htmlFor="s-url" className={label}>{t.siteUrl}</label>
        <input id="s-url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)}
               placeholder={t.siteUrlPlaceholder} className={field + " mb-5"} />

        <label htmlFor="s-plat" className={label}>{t.platform}</label>
        <div id="s-plat" className="flex flex-wrap gap-2 mb-5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold border transition ${
                platform === p.id
                  ? "bg-[#36671E] text-[#FAFAF7] border-[#36671E]"
                  : "bg-white text-[#3F3F46] border-[#E2E6DD] hover:border-[#CBD8BE]"
              }`}
            >
              {lang === "fr" ? p.fr : p.en}
            </button>
          ))}
        </div>

        <label htmlFor="s-reg" className={label}>{t.registrar}</label>
        <input id="s-reg" value={registrar} onChange={(e) => setRegistrar(e.target.value)}
               placeholder={t.registrarPlaceholder} className={field} />
        <p className="mt-1.5 mb-5 text-[12px] text-[#8A8A80]">{t.registrarHelp}</p>

        <label htmlFor="s-notes" className={label}>{t.notes}</label>
        <textarea id="s-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder} rows={3}
                  className="w-full px-3.5 py-2.5 text-[15px] border border-[#E2E6DD] rounded-lg bg-white outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/15 resize-y" />

        <button
          onClick={submit}
          disabled={busy}
          className="mt-6 w-full h-12 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 disabled:opacity-50 transition"
        >
          {busy ? t.working : t.submit}
        </button>
        {error ? <p className="mt-3 text-sm text-[#B91C1C] text-center">{error}</p> : null}
      </div>
    </div>
  );
}
