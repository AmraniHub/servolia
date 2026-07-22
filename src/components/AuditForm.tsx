"use client";

import { useState } from "react";
import {
  CheckCircle, ArrowRight, Shield, Clock, PhoneOff, CalendarX, MailQuestion,
  ExternalLink, ChevronDown, Sparkles,
} from "lucide-react";

type Lang = "en" | "fr";

const DICT = {
  en: {
    badge: "100% free — no sales call",
    h1a: "How many patients are you",
    h1b: "losing every month?",
    sub: "Missed calls after hours. No-shows that leave the chair empty. Enquiries nobody follows up. We audit your site, your booking flow and your online presence — and send you exactly what's costing you patients, within 24 hours.",
    heroCta: "Get my free audit",
    chips: ["Delivered in 24h", "No commitment", "No sales call"],

    leaksTitle: "The three leaks that cost the most",
    leaks: [
      { t: "Missed calls", b: "A patient who reaches voicemail at 8pm calls the next clinic. Nobody ever rings them back." },
      { t: "No-shows", b: "An empty slot can't be made up later — rent and salaries run either way." },
      { t: "Enquiries with no follow-up", b: "A form filled in on Friday, answered on Tuesday — if it's answered at all." },
    ],

    proofTitle: "See a real system, live",
    proofBody: "Not a mockup. A complete demo site — with its AI receptionist, booking and dashboard — that you can try right now.",
    proofCta: "Open the live demo",

    getTitle: "What you actually receive",
    gets: [
      "A page-by-page read of your site: what's blocking conversion.",
      "Your booking flow tested exactly like a real patient would.",
      "What local competitors do — and where they're beating you.",
      "A clear, prioritised action plan — usable with or without us.",
    ],

    faqTitle: "Before you ask",
    faqs: [
      { q: "Is it really free?", a: "Yes. No card, no sales call. You get the audit by email and do whatever you want with it." },
      { q: "Will you call me to sell something?", a: "No. We send the audit. If you want to go further, you contact us." },
      { q: "How long does it take?", a: "The form: under 2 minutes. The audit: delivered within 24 hours." },
      { q: "What if I don't have a website yet?", a: "That's the most common case. We audit your current visibility and how patients book with you today." },
    ],

    formTitle: "Your free audit",
    formSub: "Under 2 minutes — 3 fields.",
    businessName: "Clinic / business name",
    businessPh: "Dr. Martin Dental Clinic",
    industry: "Your field",
    email: "Email",
    emailPh: "you@yourclinic.com",
    moreToggle: "Add details so we can target the audit (optional)",
    website: "Current website URL",
    websiteHint: "(leave blank if none)",
    country: "Country",
    countryPh: "France, Belgium, Switzerland…",
    problems: "Biggest problems",
    clientValue: "Average value of a new client",
    phone: "Phone / WhatsApp",
    optional: "(optional)",
    submit: "Send my audit request",
    sending: "Sending…",
    footnote: "Audit within 24 hours. No calls, no spam. GDPR compliant.",
    errorMsg: "Something went wrong sending your request. Please try again, or email us directly at",
    errorTail: "— we'll run your audit either way.",
    successTitle: "Audit request received.",
    successBody: "We'll review your site and send your free audit within",
    successHours: "24 hours",
    successInbox: "Check your inbox at",
    successNext: "While you wait, open the live demo to see what your system could look like.",
    niches: ["Dental Clinic", "Aesthetic Clinic", "Real Estate", "Home Services (HVAC, plumbing…)", "Law / Notary", "Accounting / Finance", "Fitness / Wellness", "Other"],
    problemOptions: [
      "Not enough online visibility",
      "Low website conversion rate",
      "No online booking system",
      "Missing follow-up on leads",
      "No tracking of what's working",
      "Website looks unprofessional",
      "No AI / chatbot on my site",
      "Competitors outrank me on Google",
    ],
    values: ["Under €200", "€200 – €500", "€500 – €1,000", "€1,000 – €3,000", "€3,000+"],
  },
  fr: {
    badge: "100% gratuit — aucun appel commercial",
    h1a: "Combien de patients",
    h1b: "perdez-vous chaque mois ?",
    sub: "Les appels manqués le soir. Les rendez-vous non honorés qui laissent le fauteuil vide. Les demandes que personne ne relance. On analyse votre site, votre parcours de réservation et votre présence en ligne — et on vous envoie, sous 24h, exactement ce qui vous coûte des patients.",
    heroCta: "Recevoir mon audit gratuit",
    chips: ["Livré en 24h", "Sans engagement", "Aucun appel commercial"],

    leaksTitle: "Les trois fuites qui coûtent le plus cher",
    leaks: [
      { t: "Les appels manqués", b: "Un patient qui tombe sur la messagerie à 20h appelle le cabinet suivant. Personne ne le rappelle jamais." },
      { t: "Les rendez-vous non honorés", b: "Un créneau vide ne se rattrape pas — le loyer et les salaires tournent quand même." },
      { t: "Les demandes sans suite", b: "Un formulaire rempli le vendredi, traité le mardi — quand il l'est." },
    ],

    proofTitle: "Voyez un système réel, en ligne",
    proofBody: "Pas une maquette. Un site de démonstration complet — avec sa réceptionniste IA, sa réservation et son tableau de bord — que vous pouvez tester tout de suite.",
    proofCta: "Ouvrir la démo",

    getTitle: "Ce que vous recevez concrètement",
    gets: [
      "Une lecture de votre site, page par page : ce qui bloque la conversion.",
      "Votre parcours de réservation testé exactement comme un vrai patient.",
      "Ce que font vos concurrents locaux — et où ils vous devancent.",
      "Un plan d'action clair et priorisé — utilisable avec ou sans nous.",
    ],

    faqTitle: "Avant de demander",
    faqs: [
      { q: "C'est vraiment gratuit ?", a: "Oui. Pas de carte bancaire, pas d'appel commercial. Vous recevez l'audit par email et vous en faites ce que vous voulez." },
      { q: "Vous allez m'appeler pour me vendre quelque chose ?", a: "Non. On envoie l'audit. Si vous voulez aller plus loin, c'est vous qui nous recontactez." },
      { q: "Combien de temps ça prend ?", a: "Le formulaire : moins de 2 minutes. L'audit : livré sous 24 heures." },
      { q: "Et si je n'ai pas encore de site ?", a: "C'est le cas le plus fréquent. On audite alors votre visibilité et la façon dont vos patients prennent rendez-vous aujourd'hui." },
    ],

    formTitle: "Votre audit gratuit",
    formSub: "Moins de 2 minutes — 3 champs.",
    businessName: "Nom du cabinet / de l'entreprise",
    businessPh: "Cabinet Dentaire Martin",
    industry: "Votre secteur",
    email: "Email",
    emailPh: "vous@votreclinique.fr",
    moreToggle: "Ajouter des détails pour cibler l'audit (optionnel)",
    website: "URL de votre site actuel",
    websiteHint: "(laissez vide si aucun)",
    country: "Pays",
    countryPh: "France, Belgique, Suisse…",
    problems: "Vos plus gros problèmes",
    clientValue: "Valeur moyenne d'un nouveau client",
    phone: "Téléphone / WhatsApp",
    optional: "(optionnel)",
    submit: "Envoyer ma demande d'audit",
    sending: "Envoi…",
    footnote: "Audit sous 24 heures. Pas d'appels, pas de spam. Conforme RGPD.",
    errorMsg: "Une erreur est survenue lors de l'envoi. Réessayez, ou écrivez-nous directement à",
    errorTail: "— nous réaliserons votre audit dans tous les cas.",
    successTitle: "Demande d'audit reçue.",
    successBody: "Nous analysons votre site et vous envoyons votre audit gratuit sous",
    successHours: "24 heures",
    successInbox: "Surveillez votre boîte mail :",
    successNext: "En attendant, ouvrez la démo pour voir à quoi votre système pourrait ressembler.",
    niches: ["Cabinet dentaire", "Clinique esthétique", "Immobilier", "Services à domicile (CVC, plomberie…)", "Droit / Notariat", "Comptabilité / Finance", "Fitness / Bien-être", "Autre"],
    problemOptions: [
      "Pas assez de visibilité en ligne",
      "Faible taux de conversion du site",
      "Pas de réservation en ligne",
      "Pas de suivi des prospects",
      "Aucun tracking de ce qui fonctionne",
      "Site peu professionnel",
      "Pas d'IA / chatbot sur mon site",
      "Les concurrents me devancent sur Google",
    ],
    values: ["Moins de 200 €", "200 – 500 €", "500 – 1 000 €", "1 000 – 3 000 €", "3 000 €+"],
  },
} as const;

const DEMO_URL = "/sites/demo-metay";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#D4D2CC] text-sm text-[#080E1C] placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent";

const LEAK_ICONS = [PhoneOff, CalendarX, MailQuestion];

export default function AuditForm({ lang = "en" }: { lang?: Lang }) {
  const L = DICT[lang];
  const [form, setForm] = useState({
    businessName: "",
    websiteUrl: "",
    country: "",
    niche: "",
    problems: [] as string[],
    clientValue: "",
    email: "",
    phone: "",
    language: lang === "fr" ? "French" : "English",
  });
  const [showMore, setShowMore] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const toggleProblem = (p: string) => {
    setForm((f) => ({
      ...f,
      problems: f.problems.includes(p) ? f.problems.filter((x) => x !== p) : [...f.problems, p],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "free-audit" }),
      });
      if (!res.ok) throw new Error("contact API failed");
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <section className="min-h-[60vh] bg-[#FAFAF7] flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-[#EEF5EA] flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-[#36671E]" />
          </div>
          <h1 className="text-2xl font-black text-[#18181B] mb-3">{L.successTitle}</h1>
          <p className="text-[#52525B] mb-4">
            {L.successBody} <strong className="text-[#18181B]">{L.successHours}</strong>.
          </p>
          <p className="text-sm text-[#71717A] mb-8">{L.successInbox} <span className="text-[#52525B]">{form.email}</span></p>
          <p className="text-sm text-[#52525B] mb-4">{L.successNext}</p>
          <a href={DEMO_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#D4D2CC] bg-white text-[#18181B] font-bold text-sm hover:border-[#36671E] hover:text-[#36671E] transition-colors">
            {L.proofCta} <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* HERO — pain-led, one clear CTA */}
      <section className="pt-28 pb-14 lg:pt-36 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF5EA] border border-[#D6E2CF] text-[#36671E] text-xs font-bold uppercase tracking-widest mb-6">
            {L.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] leading-tight mb-5">
            {L.h1a}{" "}
            <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
              {L.h1b}
            </span>
          </h1>
          <p className="text-[#52525B] text-base max-w-2xl mx-auto mb-8 leading-relaxed">{L.sub}</p>
          <a href="#audit-form"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-base hover:opacity-90 transition-opacity">
            {L.heroCta} <ArrowRight className="w-5 h-5" />
          </a>
          <div className="flex flex-wrap gap-4 justify-center text-sm text-[#71717A] mt-7">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#36671E]" /> {L.chips[0]}</span>
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#36671E]" /> {L.chips[1]}</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#36671E]" /> {L.chips[2]}</span>
          </div>
        </div>
      </section>

      {/* THE LEAKS — name the pain before asking */}
      <section className="py-14 bg-white border-y border-[#E8E6E0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] text-center mb-10">{L.leaksTitle}</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {L.leaks.map((l, i) => {
              const Icon = LEAK_ICONS[i] ?? PhoneOff;
              return (
                <div key={i} className="rounded-2xl border border-[#E8E6E0] bg-[#FAFAF7] p-6">
                  <div className="w-10 h-10 rounded-xl bg-[#EEF5EA] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#36671E]" />
                  </div>
                  <h3 className="font-black text-[#18181B] mb-2">{l.t}</h3>
                  <p className="text-sm text-[#52525B] leading-relaxed">{l.b}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PROOF — the live demo is the strongest asset we have */}
      <section className="py-14 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border-2 border-[#36671E]/25 bg-white p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#EEF5EA] flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-[#36671E]" />
            </div>
            <h2 className="text-2xl font-black text-[#18181B] mb-3">{L.proofTitle}</h2>
            <p className="text-[#52525B] text-sm max-w-xl mx-auto mb-6 leading-relaxed">{L.proofBody}</p>
            <a href={DEMO_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors">
              {L.proofCta} <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET — make the free offer tangible */}
      <section className="py-14 bg-white border-y border-[#E8E6E0]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] text-center mb-8">{L.getTitle}</h2>
          <div className="space-y-3">
            {L.gets.map((g, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[#E8E6E0] bg-[#FAFAF7] p-4">
                <CheckCircle className="w-5 h-5 text-[#36671E] shrink-0 mt-0.5" />
                <p className="text-sm text-[#18181B] leading-relaxed">{g}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORM — 3 required fields, everything else progressive */}
      <section id="audit-form" className="py-14 lg:py-16 bg-[#FAFAF7] scroll-mt-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] mb-2">{L.formTitle}</h2>
            <p className="text-sm text-[#52525B]">{L.formSub}</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-[#E8E6E0] shadow-sm p-8 space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.businessName} <span className="text-red-500">*</span></label>
              <input required value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                placeholder={L.businessPh} className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#080E1C] mb-2">{L.industry} <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {L.niches.map((n) => (
                  <button key={n} type="button"
                    onClick={() => setForm((f) => ({ ...f, niche: n }))}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                      form.niche === n
                        ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E] font-bold"
                        : "border-[#E8E6E0] text-[#71717A] hover:border-[#D4D2CC] hover:bg-[#FAFAF7]"
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.email} <span className="text-red-500">*</span></label>
              <input required type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={L.emailPh} className={inputCls} />
            </div>

            {/* Progressive disclosure — keeps the form short for cold traffic */}
            <button type="button" onClick={() => setShowMore((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-dashed border-[#D4D2CC] text-sm font-bold text-[#52525B] hover:border-[#36671E] hover:text-[#36671E] transition-colors">
              {L.moreToggle}
              <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
            </button>

            {showMore && (
              <div className="space-y-6 pt-2">
                <div>
                  <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.website} <span className="text-[#52525B] font-normal">{L.websiteHint}</span></label>
                  <input value={form.websiteUrl}
                    onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                    placeholder="https://votresite.com" type="url" className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.country}</label>
                  <input value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    placeholder={L.countryPh} className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#080E1C] mb-2">{L.problems}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {L.problemOptions.map((p) => (
                      <button key={p} type="button" onClick={() => toggleProblem(p)}
                        className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all flex items-center gap-2 ${
                          form.problems.includes(p)
                            ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E] font-bold"
                            : "border-[#E8E6E0] text-[#71717A] hover:border-[#D4D2CC] hover:bg-[#FAFAF7]"
                        }`}>
                        {form.problems.includes(p) && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#080E1C] mb-2">{L.clientValue}</label>
                  <div className="flex flex-wrap gap-2">
                    {L.values.map((v) => (
                      <button key={v} type="button"
                        onClick={() => setForm((f) => ({ ...f, clientValue: v }))}
                        className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                          form.clientValue === v
                            ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E] font-bold"
                            : "border-[#E8E6E0] text-[#71717A] hover:border-[#D4D2CC] hover:bg-[#FAFAF7]"
                        }`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.phone} <span className="text-[#52525B] font-normal">{L.optional}</span></label>
                  <input value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+33 6 12 34 56 78" className={inputCls} />
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 text-sm text-[#991B1B]">
                {L.errorMsg}{" "}
                <a href="mailto:hello@servolia.com" className="font-bold underline">hello@servolia.com</a> {L.errorTail}
              </div>
            )}

            <button type="submit"
              disabled={loading || !form.businessName || !form.email || !form.niche}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? L.sending : (<>{L.submit} <ArrowRight className="w-5 h-5" /></>)}
            </button>

            <p className="text-center text-xs text-[#52525B]">{L.footnote}</p>
          </form>
        </div>
      </section>

      {/* FAQ — kill the objections that stop the click */}
      <section className="py-14 bg-white border-t border-[#E8E6E0]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-[#18181B] text-center mb-8">{L.faqTitle}</h2>
          <div className="space-y-3">
            {L.faqs.map((f, i) => (
              <details key={i} className="group bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                  <span className="font-bold text-sm text-[#18181B]">{f.q}</span>
                  <span className="text-[#71717A] transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-[#52525B] leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="#audit-form"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-base hover:opacity-90 transition-opacity">
              {L.heroCta} <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
