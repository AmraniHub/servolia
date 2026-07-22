"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, ArrowRight, ChevronRight, MessageCircle } from "lucide-react";
import { businessWaLink } from "@/lib/whatsapp";
import { BUILD_PLANS } from "@/lib/pricing";

type Lang = "en" | "fr";

/** Plan names are shown to the client, so they follow the page language — the `plan` key sent to the API stays canonical. */
const planLabel = (plan: string, lang: Lang) => {
  const p = BUILD_PLANS[plan];
  if (!p) return lang === "fr" ? "Système Servolia" : "Servolia System";
  return lang === "fr" ? p.nameFr : p.name;
};

/**
 * Every visible string, in both languages. Values that end up in the database
 * (select options, preferred language) are stored canonically in English so the
 * site generator and the admin CRM keep reading one vocabulary.
 */
const COPY = {
  en: {
    steps: ["Business", "Branding", "Services", "Goals", "Technical"],
    banner: (plan: string) => `Payment received — ${plan} deposit confirmed. Complete your intake below.`,
    title: (plan: string) => `Set up your ${plan}`,
    subtitle: "5 quick steps — takes about 8 minutes. This is everything we need to start building.",
    s0: {
      heading: "Your business",
      businessName: "Business name *", businessNamePh: "Cabinet Dentaire Martin",
      ownerName: "Your name *", ownerNamePh: "Dr. Sophie Martin",
      phone: "Phone / WhatsApp *",
      city: "City *", cityPh: "Paris",
      country: "Country *", countryPh: "France",
      address: "Full address", addressPh: "12 Rue de la Paix, 75001 Paris",
    },
    s1: {
      heading: "Your brand",
      colors: "Brand colors", colorsHint: "(hex codes or description)",
      colorsPh: "#2563EB and white, or 'dark green and gold'",
      logo: "Logo — paste a Google Drive or Dropbox link",
      logoHelp: "No logo yet? Leave blank — we can help with direction.",
      hero: "Hero photo", heroHint: "(optional — a real photo of your team, space, or work)",
      heroHelp: "Makes your homepage feel real, not generic. Leave blank and we'll use a clean color-based design instead.",
      style: "Style preference", stylePlaceholder: "Select a style",
      styles: [
        "Premium & minimalist (like Apple)",
        "Clean & clinical (like a modern clinic)",
        "Bold & trustworthy (like a law firm)",
        "Warm & approachable (like a family practice)",
        "High-tech & modern (like a SaaS product)",
      ],
      inspiration: "Websites you like", inspirationHint: "(paste 1–3 URLs)",
    },
    s2: {
      heading: "Your services & clients",
      services: "Services you offer *",
      servicesPh: "e.g. Dental implants €2,000 / Teeth whitening €350 / General checkup €80\nOr: Real estate sales (primary residences, Paris 16th)",
      servicesHelp: "Include prices if you can — it helps us build the right copy.",
      target: "Describe your ideal client *",
      targetPh: "e.g. Adults 25–55 in Paris who care about aesthetics, want fast bookings, and have a €500+ budget per visit.",
      value: "Average revenue per new client", valuePlaceholder: "Select range",
      values: ["Under €200", "€200 – €500", "€500 – €1,500", "€1,500 – €5,000", "€5,000+"],
    },
    s3: {
      heading: "Your goals",
      goal: "What is your #1 goal with this system? *", goalPlaceholder: "Select your goal",
      goals: [
        "Get more online bookings / appointments",
        "Capture and convert more leads",
        "Stop losing clients to competitors",
        "Look more professional online",
        "Run paid ads profitably",
        "Automate follow-up with leads",
        "All of the above",
      ],
      competitors: "3 competitors in your area", competitorsHint: "(website URLs)",
      competitorsHelp: "We study their sites to make yours better.",
      special: "Any special requirements or notes?",
      specialPh: "e.g. We need a form in French AND English. We have 3 locations. Please don't use stock photos.",
    },
    s4: {
      heading: "Technical setup",
      domain: "Your domain name", domainPh: "yourclinic.fr (or leave blank)",
      existing: "Existing website URL", existingPh: "https://old-site.com (if any)",
      social: "Social media handles", socialPh: "Instagram: @yourclinic / Facebook: yourclinic",
      ga: "Existing Google Analytics ID", gaHint: "(G-XXXXXXXX, if any)",
      language: "Preferred language for the system",
      languages: [["English", "English"], ["French", "French"], ["Both", "Both"]] as [string, string][],
    },
    back: "← Back",
    continue: "Continue",
    submit: "Submit intake & start build",
    submitting: "Submitting…",
    progress: (a: number, b: number) => `Step ${a} of ${b} · Your answers are saved as you go`,
    done: {
      title: "We're building your system.",
      body: "Your intake has been received. We'll send a Loom walkthrough within",
      bodyStrong: "48 hours",
      bodyEnd: "showing your first draft.",
      timeline: [
        ["Within 24h", "We review your intake and start building"],
        ["Day 3–5", "You receive a Loom walkthrough of the draft"],
        ["After approval", "Final payment → live in 24h"],
        ["Day 30", "Your monthly care plan activates automatically"],
      ] as [string, string][],
      wa: (biz: string, plan: string) => `Hi! I just completed my intake for ${biz} (${plan}).`,
      waFallbackBiz: "my business",
      waLabel: "Message us on WhatsApp",
      questions: "Questions?",
    },
  },
  fr: {
    steps: ["Entreprise", "Marque", "Services", "Objectifs", "Technique"],
    banner: (plan: string) => `Paiement reçu — acompte ${plan} confirmé. Complétez votre brief ci-dessous.`,
    title: (plan: string) => `Configurons votre ${plan}`,
    subtitle: "5 étapes rapides — environ 8 minutes. C'est tout ce dont nous avons besoin pour commencer.",
    s0: {
      heading: "Votre entreprise",
      businessName: "Nom de l'entreprise *", businessNamePh: "Cabinet Dentaire Martin",
      ownerName: "Votre nom *", ownerNamePh: "Dr Sophie Martin",
      phone: "Téléphone / WhatsApp *",
      city: "Ville *", cityPh: "Paris",
      country: "Pays *", countryPh: "France",
      address: "Adresse complète", addressPh: "12 rue de la Paix, 75001 Paris",
    },
    s1: {
      heading: "Votre marque",
      colors: "Couleurs de votre marque", colorsHint: "(codes hex ou description)",
      colorsPh: "#2563EB et blanc, ou « vert foncé et doré »",
      logo: "Logo — collez un lien Google Drive ou Dropbox",
      logoHelp: "Pas encore de logo ? Laissez vide — nous pouvons vous guider.",
      hero: "Photo principale", heroHint: "(facultatif — une vraie photo de votre équipe, de vos locaux ou de votre travail)",
      heroHelp: "Cela rend votre page d'accueil authentique plutôt que générique. Laissez vide et nous utiliserons un design épuré basé sur vos couleurs.",
      style: "Style souhaité", stylePlaceholder: "Choisissez un style",
      styles: [
        "Premium & minimaliste (façon Apple)",
        "Épuré & clinique (façon cabinet moderne)",
        "Affirmé & rassurant (façon cabinet d'avocats)",
        "Chaleureux & accessible (façon cabinet de famille)",
        "High-tech & moderne (façon produit SaaS)",
      ],
      inspiration: "Des sites que vous aimez", inspirationHint: "(collez 1 à 3 URLs)",
    },
    s2: {
      heading: "Vos prestations & vos clients",
      services: "Les prestations que vous proposez *",
      servicesPh: "ex. Implants dentaires 2 000 € / Blanchiment 350 € / Consultation 80 €\nOu : Transactions immobilières (résidences principales, Paris 16e)",
      servicesHelp: "Indiquez les prix si possible — cela nous aide à écrire les bons textes.",
      target: "Décrivez votre client idéal *",
      targetPh: "ex. Adultes de 25 à 55 ans à Paris, sensibles à l'esthétique, qui veulent réserver vite, avec un budget de 500 €+ par visite.",
      value: "Chiffre d'affaires moyen par nouveau client", valuePlaceholder: "Choisissez une fourchette",
      values: ["Moins de 200 €", "200 € – 500 €", "500 € – 1 500 €", "1 500 € – 5 000 €", "5 000 €+"],
    },
    s3: {
      heading: "Vos objectifs",
      goal: "Quel est votre objectif n°1 avec ce système ? *", goalPlaceholder: "Choisissez votre objectif",
      goals: [
        "Obtenir plus de réservations / rendez-vous en ligne",
        "Capter et convertir plus de prospects",
        "Arrêter de perdre des clients au profit des concurrents",
        "Avoir une image plus professionnelle en ligne",
        "Rentabiliser mes campagnes publicitaires",
        "Automatiser la relance des prospects",
        "Tout ce qui précède",
      ],
      competitors: "3 concurrents dans votre secteur", competitorsHint: "(URLs de leurs sites)",
      competitorsHelp: "Nous étudions leurs sites pour rendre le vôtre meilleur.",
      special: "Des exigences ou remarques particulières ?",
      specialPh: "ex. Il nous faut un formulaire en français ET en anglais. Nous avons 3 cabinets. Merci d'éviter les photos de banque d'images.",
    },
    s4: {
      heading: "Configuration technique",
      domain: "Votre nom de domaine", domainPh: "voncabinet.fr (ou laissez vide)",
      existing: "URL de votre site actuel", existingPh: "https://ancien-site.fr (le cas échéant)",
      social: "Vos comptes réseaux sociaux", socialPh: "Instagram : @votrecabinet / Facebook : votrecabinet",
      ga: "Identifiant Google Analytics existant", gaHint: "(G-XXXXXXXX, le cas échéant)",
      language: "Langue souhaitée pour le système",
      languages: [["French", "Français"], ["English", "Anglais"], ["Both", "Les deux"]] as [string, string][],
    },
    back: "← Retour",
    continue: "Continuer",
    submit: "Envoyer le brief & lancer la production",
    submitting: "Envoi…",
    progress: (a: number, b: number) => `Étape ${a} sur ${b} · Vos réponses sont enregistrées au fur et à mesure`,
    done: {
      title: "Nous construisons votre système.",
      body: "Votre brief est bien reçu. Vous recevrez une vidéo Loom de présentation sous",
      bodyStrong: "48 heures",
      bodyEnd: "avec votre première version.",
      timeline: [
        ["Sous 24 h", "Nous étudions votre brief et lançons la production"],
        ["Jour 3–5", "Vous recevez une vidéo Loom de la première version"],
        ["Après validation", "Solde réglé → en ligne sous 24 h"],
        ["Jour 30", "Votre forfait de suivi mensuel s'active automatiquement"],
      ] as [string, string][],
      wa: (biz: string, plan: string) => `Bonjour ! Je viens de compléter mon brief pour ${biz} (${plan}).`,
      waFallbackBiz: "mon entreprise",
      waLabel: "Écrivez-nous sur WhatsApp",
      questions: "Une question ?",
    },
  },
} as const;

function Form({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const params = useSearchParams();
  const plan = params.get("plan") ?? "growth";
  const planName = planLabel(plan, lang);
  const sessionId = params.get("session_id");

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    // Step 0 – Business
    businessName: "",
    ownerName: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    // Step 1 – Branding
    primaryColor: "",
    stylePreference: "",
    logoUrl: "",
    heroImageUrl: "",
    inspirationUrls: "",
    // Step 2 – Services
    services: "",
    targetClient: "",
    avgClientValue: "",
    // Step 3 – Goals
    mainGoal: "",
    competitors: "",
    launchDeadline: "",
    specialRequirements: "",
    // Step 4 – Technical
    domain: "",
    existingWebsite: "",
    socialHandles: "",
    googleAnalyticsId: "",
    preferredLanguage: lang === "fr" ? "French" : "English",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `lang` tells the team (and the generator) which language this client
        // filled the intake in — French answers in, French site out.
        body: JSON.stringify({ ...form, plan, planName, type: "intake", sessionId, lang }),
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-[#E8E6E0] text-sm text-[#080E1C] placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent transition-all bg-white";
  const labelClass = "block text-sm font-bold text-[#080E1C] mb-1.5";

  if (submitted) {
    const d = t.done;
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#EEF5EA] flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-[#36671E]" />
          </div>
          <h1 className="text-3xl font-black text-[#18181B] mb-3">{d.title}</h1>
          <p className="text-[#52525B] mb-4 leading-relaxed">
            {d.body} <strong className="text-[#18181B]">{d.bodyStrong}</strong> {d.bodyEnd}
          </p>
          <div className="mt-8 p-5 rounded-2xl bg-[#F5F4EF] border border-[#D4D2CC] text-left space-y-3">
            {d.timeline.map(([time, desc], i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs font-black text-[#36671E] mt-0.5 shrink-0 w-20">{time}</span>
                <span className="text-sm text-[#52525B]">{desc}</span>
              </div>
            ))}
          </div>
          {(() => {
            const wa = businessWaLink(d.wa(form.businessName || d.waFallbackBiz, planName));
            return wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#1EBE57] transition-colors shadow-sm">
                <MessageCircle className="w-4 h-4" /> {d.waLabel}
              </a>
            ) : null;
          })()}
          <p className="text-xs text-[#A1A1AA] mt-6">{d.questions} <a href="mailto:hello@servolia.com" className="text-[#36671E] hover:underline">hello@servolia.com</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Top confirmation bar */}
      <div className="bg-[#36671E] py-3 text-center">
        <p className="text-[#FAFAF7] text-sm font-black flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {t.banner(planName)}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#080E1C] mb-2">{t.title(planName)}</h1>
          <p className="text-[#71717A] text-sm">{t.subtitle}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {t.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black transition-all ${
                i < step ? "bg-[#36671E] text-[#FAFAF7]"
                : i === step ? "bg-[#FAFAF7] text-[#18181B]"
                : "bg-[#E2E8F0] text-[#52525B]"
              }`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-[#080E1C]" : "text-[#52525B]"}`}>{s}</span>
              {i < t.steps.length - 1 && <ChevronRight className="w-3 h-3 text-[#3F3F46] ml-1" />}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-[#E8E6E0] shadow-sm p-8">

          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">{t.s0.heading}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelClass}>{t.s0.businessName}</label><input required value={form.businessName} onChange={e => set("businessName", e.target.value)} placeholder={t.s0.businessNamePh} className={inputClass} /></div>
                <div><label className={labelClass}>{t.s0.ownerName}</label><input required value={form.ownerName} onChange={e => set("ownerName", e.target.value)} placeholder={t.s0.ownerNamePh} className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelClass}>{t.s0.phone}</label><input required value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+33 6 12 34 56 78" className={inputClass} /></div>
                <div><label className={labelClass}>{t.s0.city}</label><input required value={form.city} onChange={e => set("city", e.target.value)} placeholder={t.s0.cityPh} className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelClass}>{t.s0.country}</label><input required value={form.country} onChange={e => set("country", e.target.value)} placeholder={t.s0.countryPh} className={inputClass} /></div>
                <div><label className={labelClass}>{t.s0.address}</label><input value={form.address} onChange={e => set("address", e.target.value)} placeholder={t.s0.addressPh} className={inputClass} /></div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">{t.s1.heading}</h2>
              <div>
                <label className={labelClass}>{t.s1.colors} <span className="text-[#52525B] font-normal">{t.s1.colorsHint}</span></label>
                <input value={form.primaryColor} onChange={e => set("primaryColor", e.target.value)} placeholder={t.s1.colorsPh} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t.s1.logo}</label>
                <input value={form.logoUrl} onChange={e => set("logoUrl", e.target.value)} placeholder="https://drive.google.com/..." className={inputClass} />
                <p className="text-xs text-[#52525B] mt-1">{t.s1.logoHelp}</p>
              </div>
              <div>
                <label className={labelClass}>{t.s1.hero} <span className="text-[#52525B] font-normal">{t.s1.heroHint}</span></label>
                <input value={form.heroImageUrl} onChange={e => set("heroImageUrl", e.target.value)} placeholder="https://drive.google.com/..." className={inputClass} />
                <p className="text-xs text-[#52525B] mt-1">{t.s1.heroHelp}</p>
              </div>
              <div>
                <label className={labelClass}>{t.s1.style}</label>
                <select value={form.stylePreference} onChange={e => set("stylePreference", e.target.value)} className={inputClass}>
                  <option value="">{t.s1.stylePlaceholder}</option>
                  {t.s1.styles.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.s1.inspiration} <span className="text-[#52525B] font-normal">{t.s1.inspirationHint}</span></label>
                <textarea value={form.inspirationUrls} onChange={e => set("inspirationUrls", e.target.value)} rows={3} placeholder="https://example.com&#10;https://another.com" className={`${inputClass} resize-none`} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">{t.s2.heading}</h2>
              <div>
                <label className={labelClass}>{t.s2.services}</label>
                <textarea required value={form.services} onChange={e => set("services", e.target.value)} rows={4} placeholder={t.s2.servicesPh} className={`${inputClass} resize-none`} />
                <p className="text-xs text-[#52525B] mt-1">{t.s2.servicesHelp}</p>
              </div>
              <div>
                <label className={labelClass}>{t.s2.target}</label>
                <textarea required value={form.targetClient} onChange={e => set("targetClient", e.target.value)} rows={3} placeholder={t.s2.targetPh} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className={labelClass}>{t.s2.value}</label>
                <select value={form.avgClientValue} onChange={e => set("avgClientValue", e.target.value)} className={inputClass}>
                  <option value="">{t.s2.valuePlaceholder}</option>
                  {t.s2.values.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">{t.s3.heading}</h2>
              <div>
                <label className={labelClass}>{t.s3.goal}</label>
                <select required value={form.mainGoal} onChange={e => set("mainGoal", e.target.value)} className={inputClass}>
                  <option value="">{t.s3.goalPlaceholder}</option>
                  {t.s3.goals.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.s3.competitors} <span className="text-[#52525B] font-normal">{t.s3.competitorsHint}</span></label>
                <textarea value={form.competitors} onChange={e => set("competitors", e.target.value)} rows={3} placeholder="https://competitor1.com&#10;https://competitor2.com&#10;https://competitor3.com" className={`${inputClass} resize-none`} />
                <p className="text-xs text-[#52525B] mt-1">{t.s3.competitorsHelp}</p>
              </div>
              <div>
                <label className={labelClass}>{t.s3.special}</label>
                <textarea value={form.specialRequirements} onChange={e => set("specialRequirements", e.target.value)} rows={3} placeholder={t.s3.specialPh} className={`${inputClass} resize-none`} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">{t.s4.heading}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{t.s4.domain}</label>
                  <input value={form.domain} onChange={e => set("domain", e.target.value)} placeholder={t.s4.domainPh} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t.s4.existing}</label>
                  <input value={form.existingWebsite} onChange={e => set("existingWebsite", e.target.value)} placeholder={t.s4.existingPh} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t.s4.social}</label>
                <input value={form.socialHandles} onChange={e => set("socialHandles", e.target.value)} placeholder={t.s4.socialPh} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t.s4.ga} <span className="text-[#52525B] font-normal">{t.s4.gaHint}</span></label>
                <input value={form.googleAnalyticsId} onChange={e => set("googleAnalyticsId", e.target.value)} placeholder="G-1234567890" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t.s4.language}</label>
                <div className="flex gap-3">
                  {t.s4.languages.map(([value, label]) => (
                    <button key={value} type="button" onClick={() => set("preferredLanguage", value)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${form.preferredLanguage === value ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E]" : "border-[#E8E6E0] text-[#71717A] hover:border-[#CBD5E1]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-[#F1F5F9]">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 rounded-xl border border-[#E8E6E0] text-[#080E1C] font-bold text-sm hover:bg-[#FAFAF7] transition-colors">
                {t.back}
              </button>
            )}
            {step < t.steps.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                {t.continue} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? t.submitting : <><CheckCircle className="w-4 h-4" /> {t.submit}</>}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#52525B] mt-5">
          {t.progress(step + 1, t.steps.length)}
        </p>
      </div>
    </div>
  );
}

/** Paid-client intake form. Same flow in both languages — see COPY above. */
export default function OnboardingForm({ lang }: { lang: Lang }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7]" />}>
      <Form lang={lang} />
    </Suspense>
  );
}
