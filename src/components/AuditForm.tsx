"use client";

import { useState } from "react";
import { CheckCircle, ArrowRight, Shield, Clock, TrendingUp } from "lucide-react";

type Lang = "en" | "fr";

const DICT = {
  en: {
    badge: "100% Free — No pitch call required",
    titleA: "Get a free audit of your",
    titleB: "online client acquisition",
    sub: "Tell us about your business. We'll audit your current website, booking flow, and online presence — then send you a personalised report with exactly what's costing you clients.",
    chips: ["Delivered in 24h", "No commitment", "Actionable insights"],
    businessName: "Business name",
    businessPh: "Dr. Martin Dental Clinic",
    website: "Current website URL",
    websiteHint: "(leave blank if none)",
    country: "Country",
    countryPh: "France, UK, Netherlands…",
    industry: "Your industry",
    problems: "Biggest problems",
    problemsHint: "(select all that apply)",
    problemsSub: "This helps us focus the audit on what matters most to you.",
    clientValue: "Average client value (revenue per new client)",
    email: "Email",
    emailPh: "you@yourclinic.com",
    phone: "Phone / WhatsApp",
    optional: "(optional)",
    langLabel: "Preferred language for the audit",
    submit: "Send my audit request",
    sending: "Sending…",
    footnote: "We audit within 24 hours. No calls, no spam. GDPR compliant.",
    errorMsg: "Something went wrong sending your request. Please try again, or email us directly at",
    errorTail: "— we'll run your audit either way.",
    successTitle: "Audit request received.",
    successBody: "We'll review your website and send your free audit within",
    successHours: "24 hours",
    successInbox: "Check your inbox at",
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
    badge: "100% gratuit — Aucun appel commercial requis",
    titleA: "Recevez un audit gratuit de votre",
    titleB: "acquisition de clients en ligne",
    sub: "Parlez-nous de votre activité. Nous auditons votre site actuel, votre parcours de réservation et votre présence en ligne — puis nous vous envoyons un rapport personnalisé montrant exactement ce qui vous coûte des clients.",
    chips: ["Livré en 24h", "Sans engagement", "Recommandations concrètes"],
    businessName: "Nom de l'entreprise",
    businessPh: "Cabinet Dentaire Martin",
    website: "URL de votre site actuel",
    websiteHint: "(laissez vide si aucun)",
    country: "Pays",
    countryPh: "France, Belgique, Suisse…",
    industry: "Votre secteur",
    problems: "Vos plus gros problèmes",
    problemsHint: "(sélectionnez tout ce qui s'applique)",
    problemsSub: "Cela nous aide à concentrer l'audit sur ce qui compte le plus pour vous.",
    clientValue: "Valeur moyenne d'un client (revenu par nouveau client)",
    email: "Email",
    emailPh: "vous@votreclinique.fr",
    phone: "Téléphone / WhatsApp",
    optional: "(optionnel)",
    langLabel: "Langue souhaitée pour l'audit",
    submit: "Envoyer ma demande d'audit",
    sending: "Envoi…",
    footnote: "Audit sous 24 heures. Pas d'appels, pas de spam. Conforme RGPD.",
    errorMsg: "Une erreur est survenue lors de l'envoi. Réessayez, ou écrivez-nous directement à",
    errorTail: "— nous réaliserons votre audit dans tous les cas.",
    successTitle: "Demande d'audit reçue.",
    successBody: "Nous analysons votre site et vous envoyons votre audit gratuit sous",
    successHours: "24 heures",
    successInbox: "Surveillez votre boîte mail :",
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

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#D4D2CC] text-sm text-[#080E1C] placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent";

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
          <p className="text-[#52525B] mb-6">
            {L.successBody} <strong className="text-[#18181B]">{L.successHours}</strong>.
          </p>
          <p className="text-sm text-[#71717A]">{L.successInbox} <span className="text-[#52525B]">{form.email}</span></p>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* HERO */}
      <section className="pt-28 pb-12 lg:pt-36 lg:pb-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF5EA] border border-[#D6E2CF] text-[#36671E] text-xs font-bold uppercase tracking-widest mb-6">
            {L.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] leading-tight mb-4">
            {L.titleA}{" "}
            <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
              {L.titleB}
            </span>
          </h1>
          <p className="text-[#52525B] text-base max-w-xl mx-auto mb-8">{L.sub}</p>
          <div className="flex flex-wrap gap-4 justify-center text-sm text-[#71717A]">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#36671E]" /> {L.chips[0]}</span>
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#36671E]" /> {L.chips[1]}</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#36671E]" /> {L.chips[2]}</span>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="py-12 lg:py-16 bg-[#FAFAF7]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-[#E8E6E0] shadow-sm p-8 space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.businessName} <span className="text-red-500">*</span></label>
              <input required value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                placeholder={L.businessPh} className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.website} <span className="text-[#52525B] font-normal">{L.websiteHint}</span></label>
              <input value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                placeholder="https://votresite.com" type="url" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.country} <span className="text-red-500">*</span></label>
              <input required value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder={L.countryPh} className={inputCls} />
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
              <label className="block text-sm font-bold text-[#080E1C] mb-1">{L.problems} <span className="text-[#52525B] font-normal">{L.problemsHint}</span></label>
              <p className="text-xs text-[#52525B] mb-2">{L.problemsSub}</p>
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
              <label className="block text-sm font-bold text-[#080E1C] mb-2">{L.clientValue} <span className="text-red-500">*</span></label>
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
              <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.email} <span className="text-red-500">*</span></label>
              <input required type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={L.emailPh} className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#080E1C] mb-1.5">{L.phone} <span className="text-[#52525B] font-normal">{L.optional}</span></label>
              <input value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+33 6 12 34 56 78" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#080E1C] mb-2">{L.langLabel}</label>
              <div className="flex flex-wrap gap-2">
                {["English", "French", "Arabic"].map((l) => (
                  <button key={l} type="button"
                    onClick={() => setForm((f) => ({ ...f, language: l }))}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                      form.language === l
                        ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E] font-bold"
                        : "border-[#E8E6E0] text-[#71717A] hover:border-[#D4D2CC] hover:bg-[#FAFAF7]"
                    }`}>
                    {l === "English" && lang === "fr" ? "Anglais" : l === "French" && lang === "fr" ? "Français" : l === "Arabic" && lang === "fr" ? "Arabe" : l}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 text-sm text-[#991B1B]">
                {L.errorMsg}{" "}
                <a href="mailto:hello@servolia.com" className="font-bold underline">hello@servolia.com</a> {L.errorTail}
              </div>
            )}

            <button type="submit"
              disabled={loading || !form.businessName || !form.email || !form.country || !form.niche || !form.clientValue}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? L.sending : (<>{L.submit} <ArrowRight className="w-5 h-5" /></>)}
            </button>

            <p className="text-center text-xs text-[#52525B]">{L.footnote}</p>
          </form>
        </div>
      </section>
    </>
  );
}
