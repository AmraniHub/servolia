"use client";

import { useState } from "react";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";

/**
 * The brief: everything the assistant is allowed to say about the business.
 *
 * Plain fields, in the owner's language, with the two lists (services, Q&A)
 * as free text in a format a person would write anyway — one line per
 * service, a question and its answer per paragraph. The server parses them
 * leniently; nothing here is validated so strictly that a busy owner gives
 * up halfway.
 *
 * The rule the assistant lives by is stated on the page: it only says what
 * is written here. An owner who understands that writes better answers.
 */
export interface BriefInitial {
  businessName: string;
  about: string;
  city: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  bookingUrl: string;
  languages: ("ar" | "fr" | "en")[];
  services: string;
  faqs: string;
  tone: string;
  accent: string;
  position: "left" | "right";
  domains: string;
}

const T = {
  en: {
    installedTitle: "Installed on your site",
    installedBody: "The assistant is on every page and answering now. Refine what it knows below.",
    pendingTitle: "Being added to your site",
    pendingBody: "Your payment just landed; the assistant is being placed on your pages. Give it a minute, then reload this page.",
    snippetTitle: "Add this line to your site",
    snippetBody: "Paste it just before </body> on every page — or send it to the person who looks after your site.",
    copy: "Copy",
    copied: "Copied",
    mail: "Email it to my developer",
    mailSubject: "One line to add to our website",
    mailBody: (s: string) => `Hi,\n\nPlease add this line just before </body> on every page of our website:\n\n${s}\n\nThanks!`,
    tryIt: "Try the assistant",
    name: "Business name",
    about: "What you do, in a few sentences",
    aboutPh: "Who you are, what you offer, who it is for. This is the assistant's understanding of your business.",
    city: "City",
    phone: "Phone",
    whatsapp: "WhatsApp number (digits only, with country code)",
    email: "Where enquiries are sent",
    emailHelp: "Every captured enquiry is emailed here with a one-tap WhatsApp reply.",
    hours: "Opening hours",
    hoursPh: "Mon–Fri 9:00–18:00, Sat 9:00–13:00",
    booking: "Booking or registration link (optional)",
    languages: "Languages it answers in",
    services: "Services",
    servicesHelp: "One per line. Add a dash for a short description: Teeth whitening — from €190, 45 minutes",
    faqs: "Questions it should answer, with your answers",
    faqsHelp: "A question, then its answer on the next line. Leave an empty line between pairs.",
    faqsPh: "Do you take new patients?\nYes — first consultation within the week.\n\nDo you accept card payments?\nCard, cash and bank transfer.",
    tone: "Tone",
    tones: [["", "Warm and professional"], ["friendly and upbeat", "Friendly and upbeat"], ["calm and precise", "Calm and precise"], ["direct and efficient", "Direct and efficient"]],
    accent: "Widget colour",
    position: "Corner",
    right: "Bottom right",
    left: "Bottom left",
    domains: "Your website addresses",
    domainsHelp: "Comma-separated. The assistant only answers on these sites.",
    rule: "It only says what is written here. If a visitor asks something not covered, it offers to take their details — it never invents a price or a promise.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved — applies from the next conversation.",
    notReady: "Your payment is still being recorded. Try again in a minute.",
    error: "That did not save. Try again in a moment.",
    required: "The business name and the email for enquiries are required.",
  },
  fr: {
    installedTitle: "Installé sur votre site",
    installedBody: "L'assistant est sur toutes vos pages et répond dès maintenant. Affinez ce qu'il sait ci-dessous.",
    pendingTitle: "En cours d'ajout sur votre site",
    pendingBody: "Votre paiement vient d'arriver ; l'assistant est en train d'être placé sur vos pages. Patientez une minute, puis rechargez cette page.",
    snippetTitle: "Ajoutez cette ligne à votre site",
    snippetBody: "Collez-la juste avant </body> sur chaque page — ou envoyez-la à la personne qui gère votre site.",
    copy: "Copier",
    copied: "Copié",
    mail: "L'envoyer à mon développeur",
    mailSubject: "Une ligne à ajouter à notre site",
    mailBody: (s: string) => `Bonjour,\n\nMerci d'ajouter cette ligne juste avant </body> sur chaque page de notre site :\n\n${s}\n\nMerci !`,
    tryIt: "Essayer l'assistant",
    name: "Nom de l'entreprise",
    about: "Ce que vous faites, en quelques phrases",
    aboutPh: "Qui vous êtes, ce que vous proposez, pour qui. C'est ainsi que l'assistant comprend votre activité.",
    city: "Ville",
    phone: "Téléphone",
    whatsapp: "Numéro WhatsApp (chiffres uniquement, avec l'indicatif)",
    email: "Où arrivent les demandes",
    emailHelp: "Chaque demande captée est envoyée ici, avec une réponse WhatsApp en un clic.",
    hours: "Horaires",
    hoursPh: "Lun–Ven 9h–18h, Sam 9h–13h",
    booking: "Lien de réservation ou d'inscription (optionnel)",
    languages: "Langues de réponse",
    services: "Services",
    servicesHelp: "Un par ligne. Ajoutez un tiret pour une courte description : Blanchiment — à partir de 190 €, 45 minutes",
    faqs: "Questions auxquelles il doit répondre, avec vos réponses",
    faqsHelp: "Une question, puis sa réponse à la ligne suivante. Une ligne vide entre chaque paire.",
    faqsPh: "Acceptez-vous de nouveaux patients ?\nOui — première consultation dans la semaine.\n\nAcceptez-vous la carte ?\nCarte, espèces et virement.",
    tone: "Ton",
    tones: [["", "Chaleureux et professionnel"], ["friendly and upbeat", "Amical et enjoué"], ["calm and precise", "Calme et précis"], ["direct and efficient", "Direct et efficace"]],
    accent: "Couleur du widget",
    position: "Coin",
    right: "En bas à droite",
    left: "En bas à gauche",
    domains: "Adresses de votre site",
    domainsHelp: "Séparées par des virgules. L'assistant ne répond que sur ces sites.",
    rule: "Il ne dit que ce qui est écrit ici. Si un visiteur pose une question non couverte, il propose de prendre ses coordonnées — il n'invente jamais un prix ni une promesse.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Enregistré — s'applique dès la prochaine conversation.",
    notReady: "Votre paiement est encore en cours d'enregistrement. Réessayez dans une minute.",
    error: "L'enregistrement a échoué. Réessayez dans un instant.",
    required: "Le nom de l'entreprise et l'email des demandes sont obligatoires.",
  },
};

const LANGS: { id: "ar" | "fr" | "en"; label: string }[] = [
  { id: "ar", label: "العربية" },
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
];

export default function AssistantBriefForm({
  token,
  lang = "en",
  initial,
  snippet,
  hosted,
  installed,
  tryUrl,
}: {
  token: string;
  lang?: "en" | "fr";
  initial: BriefInitial;
  snippet: string;
  /** True when the site is one we deploy: the tag is added by us. */
  hosted: boolean;
  /** Read from the repository: true, false, or null when it could not be read. */
  installed: boolean | null;
  tryUrl: string;
}) {
  const t = T[lang];
  const [f, setF] = useState<BriefInitial>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof BriefInitial>(k: K, v: BriefInitial[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleLang = (id: "ar" | "fr" | "en") =>
    set("languages", f.languages.includes(id) ? f.languages.filter((l) => l !== id) : [...f.languages, id]);

  async function copy() {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* no clipboard */ }
  }

  async function save() {
    if (!f.businessName.trim() || !/.+@.+\..+/.test(f.email)) { setMsg({ ok: false, text: t.required }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/assistant-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...f }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) { setMsg({ ok: false, text: t.notReady }); return; }
      if (!res.ok || !data.ok) throw new Error(data.error || "failed");
      setMsg({ ok: true, text: t.saved });
    } catch {
      setMsg({ ok: false, text: t.error });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full h-11 px-3.5 text-[15px] border border-[#E2E6DD] rounded-lg bg-white outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/15";
  const area = "w-full px-3.5 py-2.5 text-[15px] border border-[#E2E6DD] rounded-lg bg-white outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/15 resize-y";
  const label = "block text-[11px] font-black text-[#8A8A80] uppercase tracking-[0.14em] mb-1.5";
  const help = "mt-1.5 mb-5 text-[12px] text-[#8A8A80]";
  const mailto = `mailto:?subject=${encodeURIComponent(t.mailSubject)}&body=${encodeURIComponent(t.mailBody(snippet))}`;

  return (
    <div>
      {/* Where it is. Installed is a fact read from the site, not a hope. */}
      {hosted && installed ? (
        <div className="flex gap-3 rounded-2xl border border-[#CBE3BC] bg-[#F3F9EE] p-5 mb-6">
          <CheckCircle2 className="w-5 h-5 text-[#36671E] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#161A15]">{t.installedTitle}</p>
            <p className="text-[14px] text-[#3F3F46] leading-relaxed mt-1">{t.installedBody}</p>
            <a href={tryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-[14px] font-bold text-[#36671E] hover:underline">
              {t.tryIt} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : hosted ? (
        <div className="rounded-2xl border border-[#F0DFA8] bg-[#FEF9EC] p-5 mb-6">
          <p className="font-bold text-[#6B5309]">{t.pendingTitle}</p>
          <p className="text-[14px] text-[#6B5309] leading-relaxed mt-1">{t.pendingBody}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E2E6DD] bg-white p-5 mb-6">
          <p className="font-bold text-[#161A15]">{t.snippetTitle}</p>
          <p className="text-[14px] text-[#3F3F46] leading-relaxed mt-1 mb-3">{t.snippetBody}</p>
          <pre className="text-[12.5px] leading-relaxed bg-[#FAFAF7] border border-[#E8E6E0] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[#18181B]">{snippet}</pre>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#18181B] text-white text-[13px] font-bold hover:bg-[#27272A]">
              <Copy className="w-3.5 h-3.5" /> {copied ? t.copied : t.copy}
            </button>
            <a href={mailto} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#E2E6DD] bg-white text-[13px] font-bold text-[#3F3F46] hover:border-[#CBD8BE]">
              {t.mail}
            </a>
            <a href={tryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#E2E6DD] bg-white text-[13px] font-bold text-[#36671E] hover:border-[#CBD8BE]">
              {t.tryIt} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#E2E6DD] bg-white p-7">
        <p className="text-[13px] leading-relaxed text-[#5E6659] mb-6 pb-6 border-b border-[#F0EFEA]">{t.rule}</p>

        <label htmlFor="b-name" className={label}>{t.name}</label>
        <input id="b-name" value={f.businessName} onChange={(e) => set("businessName", e.target.value)} className={field + " mb-5"} />

        <label htmlFor="b-about" className={label}>{t.about}</label>
        <textarea id="b-about" value={f.about} onChange={(e) => set("about", e.target.value)} rows={4} placeholder={t.aboutPh} className={area + " mb-5"} />

        <div className="grid sm:grid-cols-2 gap-x-4">
          <div>
            <label htmlFor="b-city" className={label}>{t.city}</label>
            <input id="b-city" value={f.city} onChange={(e) => set("city", e.target.value)} className={field + " mb-5"} />
          </div>
          <div>
            <label htmlFor="b-hours" className={label}>{t.hours}</label>
            <input id="b-hours" value={f.hours} onChange={(e) => set("hours", e.target.value)} placeholder={t.hoursPh} className={field + " mb-5"} />
          </div>
          <div>
            <label htmlFor="b-phone" className={label}>{t.phone}</label>
            <input id="b-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={field + " mb-5"} />
          </div>
          <div>
            <label htmlFor="b-wa" className={label}>{t.whatsapp}</label>
            <input id="b-wa" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="212600000000" className={field + " mb-5"} />
          </div>
        </div>

        <label htmlFor="b-email" className={label}>{t.email}</label>
        <input id="b-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={field} />
        <p className={help}>{t.emailHelp}</p>

        <label htmlFor="b-book" className={label}>{t.booking}</label>
        <input id="b-book" value={f.bookingUrl} onChange={(e) => set("bookingUrl", e.target.value)} placeholder="https://" className={field + " mb-5"} />

        <p className={label}>{t.languages}</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => toggleLang(l.id)}
              className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold border transition ${
                f.languages.includes(l.id)
                  ? "bg-[#36671E] text-[#FAFAF7] border-[#36671E]"
                  : "bg-white text-[#3F3F46] border-[#E2E6DD] hover:border-[#CBD8BE]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <label htmlFor="b-services" className={label}>{t.services}</label>
        <textarea id="b-services" value={f.services} onChange={(e) => set("services", e.target.value)} rows={5} className={area} />
        <p className={help}>{t.servicesHelp}</p>

        <label htmlFor="b-faqs" className={label}>{t.faqs}</label>
        <textarea id="b-faqs" value={f.faqs} onChange={(e) => set("faqs", e.target.value)} rows={8} placeholder={t.faqsPh} className={area} />
        <p className={help}>{t.faqsHelp}</p>

        <div className="grid sm:grid-cols-3 gap-x-4">
          <div>
            <label htmlFor="b-tone" className={label}>{t.tone}</label>
            <select id="b-tone" value={f.tone} onChange={(e) => set("tone", e.target.value)} className={field + " mb-5"}>
              {t.tones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-accent" className={label}>{t.accent}</label>
            <div className="flex items-center gap-2 mb-5">
              <input id="b-accent" type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.accent) ? f.accent : "#36671E"} onChange={(e) => set("accent", e.target.value)} className="h-11 w-14 rounded-lg border border-[#E2E6DD] bg-white p-1" />
              <span className="text-[13px] font-mono text-[#5E6659]">{f.accent}</span>
            </div>
          </div>
          <div>
            <label htmlFor="b-pos" className={label}>{t.position}</label>
            <select id="b-pos" value={f.position} onChange={(e) => set("position", e.target.value === "left" ? "left" : "right")} className={field + " mb-5"}>
              <option value="right">{t.right}</option>
              <option value="left">{t.left}</option>
            </select>
          </div>
        </div>

        <label htmlFor="b-domains" className={label}>{t.domains}</label>
        <input id="b-domains" value={f.domains} onChange={(e) => set("domains", e.target.value)} placeholder="example.com, www.example.com" className={field} />
        <p className={help}>{t.domainsHelp}</p>

        <button
          onClick={save}
          disabled={busy}
          className="mt-2 w-full h-12 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 disabled:opacity-50 transition"
        >
          {busy ? t.saving : t.save}
        </button>
        {msg ? (
          <p className={`mt-3 text-sm text-center ${msg.ok ? "text-[#36671E] font-semibold" : "text-[#B91C1C]"}`}>{msg.text}</p>
        ) : null}
      </div>
    </div>
  );
}
