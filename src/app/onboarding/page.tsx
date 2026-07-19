"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, ArrowRight, ChevronRight, MessageCircle } from "lucide-react";
import { businessWaLink } from "@/lib/whatsapp";

const PLAN_NAMES: Record<string, string> = {
  starter: "Website System",
  growth:  "Booking System",
  pro:     "Client System",
  landing: "Landing Page System",
  mobile:  "Mobile App",
  webapp:  "Web App / SaaS",
};

const STEPS = ["Business", "Branding", "Services", "Goals", "Technical"];

function OnboardingForm() {
  const params = useSearchParams();
  const plan = params.get("plan") ?? "growth";
  const planName = PLAN_NAMES[plan] ?? "Servolia System";
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
    preferredLanguage: "English",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, plan, planName, type: "intake", sessionId }),
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-[#E8E6E0] text-sm text-[#080E1C] placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent transition-all bg-white";
  const labelClass = "block text-sm font-bold text-[#080E1C] mb-1.5";

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#EEF5EA] flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-[#36671E]" />
          </div>
          <h1 className="text-3xl font-black text-[#18181B] mb-3">We&apos;re building your system.</h1>
          <p className="text-[#52525B] mb-4 leading-relaxed">
            Your intake has been received. We&apos;ll send a Loom walkthrough within <strong className="text-[#18181B]">48 hours</strong> showing your first draft.
          </p>
          <div className="mt-8 p-5 rounded-2xl bg-[#F5F4EF] border border-[#D4D2CC] text-left space-y-3">
            {[
              ["Within 24h", "We review your intake and start building"],
              ["Day 3–5", "You receive a Loom walkthrough of the draft"],
              ["After approval", "Final payment → live in 24h"],
              ["Day 30", "Your monthly care plan activates automatically"],
            ].map(([time, desc], i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs font-black text-[#36671E] mt-0.5 shrink-0 w-20">{time}</span>
                <span className="text-sm text-[#52525B]">{desc}</span>
              </div>
            ))}
          </div>
          {(() => {
            const wa = businessWaLink(`Hi! I just completed my intake for ${form.businessName || "my business"} (${planName}).`);
            return wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#1EBE57] transition-colors shadow-sm">
                <MessageCircle className="w-4 h-4" /> Message us on WhatsApp
              </a>
            ) : null;
          })()}
          <p className="text-xs text-[#A1A1AA] mt-6">Questions? <a href="mailto:hello@servolia.com" className="text-[#36671E] hover:underline">hello@servolia.com</a></p>
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
          Payment received — {planName} deposit confirmed. Complete your intake below.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#080E1C] mb-2">Set up your {planName}</h1>
          <p className="text-[#71717A] text-sm">5 quick steps — takes about 8 minutes. This is everything we need to start building.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black transition-all ${
                i < step ? "bg-[#36671E] text-[#FAFAF7]"
                : i === step ? "bg-[#FAFAF7] text-[#18181B]"
                : "bg-[#E2E8F0] text-[#52525B]"
              }`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-[#080E1C]" : "text-[#52525B]"}`}>{s}</span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-[#3F3F46] ml-1" />}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-[#E8E6E0] shadow-sm p-8">

          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">Your business</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelClass}>Business name *</label><input required value={form.businessName} onChange={e => set("businessName", e.target.value)} placeholder="Cabinet Dentaire Martin" className={inputClass} /></div>
                <div><label className={labelClass}>Your name *</label><input required value={form.ownerName} onChange={e => set("ownerName", e.target.value)} placeholder="Dr. Sophie Martin" className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelClass}>Phone / WhatsApp *</label><input required value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+33 6 12 34 56 78" className={inputClass} /></div>
                <div><label className={labelClass}>City *</label><input required value={form.city} onChange={e => set("city", e.target.value)} placeholder="Paris" className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelClass}>Country *</label><input required value={form.country} onChange={e => set("country", e.target.value)} placeholder="France" className={inputClass} /></div>
                <div><label className={labelClass}>Full address</label><input value={form.address} onChange={e => set("address", e.target.value)} placeholder="12 Rue de la Paix, 75001 Paris" className={inputClass} /></div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">Your brand</h2>
              <div>
                <label className={labelClass}>Brand colors <span className="text-[#52525B] font-normal">(hex codes or description)</span></label>
                <input value={form.primaryColor} onChange={e => set("primaryColor", e.target.value)} placeholder="#2563EB and white, or 'dark green and gold'" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Logo — paste a Google Drive or Dropbox link</label>
                <input value={form.logoUrl} onChange={e => set("logoUrl", e.target.value)} placeholder="https://drive.google.com/..." className={inputClass} />
                <p className="text-xs text-[#52525B] mt-1">No logo yet? Leave blank — we can help with direction.</p>
              </div>
              <div>
                <label className={labelClass}>Hero photo <span className="text-[#52525B] font-normal">(optional — a real photo of your team, space, or work)</span></label>
                <input value={form.heroImageUrl} onChange={e => set("heroImageUrl", e.target.value)} placeholder="https://drive.google.com/..." className={inputClass} />
                <p className="text-xs text-[#52525B] mt-1">Makes your homepage feel real, not generic. Leave blank and we'll use a clean color-based design instead.</p>
              </div>
              <div>
                <label className={labelClass}>Style preference</label>
                <select value={form.stylePreference} onChange={e => set("stylePreference", e.target.value)} className={inputClass}>
                  <option value="">Select a style</option>
                  <option>Premium & minimalist (like Apple)</option>
                  <option>Clean & clinical (like a modern clinic)</option>
                  <option>Bold & trustworthy (like a law firm)</option>
                  <option>Warm & approachable (like a family practice)</option>
                  <option>High-tech & modern (like a SaaS product)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Websites you like <span className="text-[#52525B] font-normal">(paste 1–3 URLs)</span></label>
                <textarea value={form.inspirationUrls} onChange={e => set("inspirationUrls", e.target.value)} rows={3} placeholder="https://example.com&#10;https://another.com" className={`${inputClass} resize-none`} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">Your services & clients</h2>
              <div>
                <label className={labelClass}>Services you offer *</label>
                <textarea required value={form.services} onChange={e => set("services", e.target.value)} rows={4} placeholder="e.g. Dental implants €2,000 / Teeth whitening €350 / General checkup €80&#10;Or: Real estate sales (primary residences, Paris 16th)" className={`${inputClass} resize-none`} />
                <p className="text-xs text-[#52525B] mt-1">Include prices if you can — it helps us build the right copy.</p>
              </div>
              <div>
                <label className={labelClass}>Describe your ideal client *</label>
                <textarea required value={form.targetClient} onChange={e => set("targetClient", e.target.value)} rows={3} placeholder="e.g. Adults 25–55 in Paris who care about aesthetics, want fast bookings, and have a €500+ budget per visit." className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className={labelClass}>Average revenue per new client</label>
                <select value={form.avgClientValue} onChange={e => set("avgClientValue", e.target.value)} className={inputClass}>
                  <option value="">Select range</option>
                  <option>Under €200</option>
                  <option>€200 – €500</option>
                  <option>€500 – €1,500</option>
                  <option>€1,500 – €5,000</option>
                  <option>€5,000+</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">Your goals</h2>
              <div>
                <label className={labelClass}>What is your #1 goal with this system? *</label>
                <select required value={form.mainGoal} onChange={e => set("mainGoal", e.target.value)} className={inputClass}>
                  <option value="">Select your goal</option>
                  <option>Get more online bookings / appointments</option>
                  <option>Capture and convert more leads</option>
                  <option>Stop losing clients to competitors</option>
                  <option>Look more professional online</option>
                  <option>Run paid ads profitably</option>
                  <option>Automate follow-up with leads</option>
                  <option>All of the above</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>3 competitors in your area <span className="text-[#52525B] font-normal">(website URLs)</span></label>
                <textarea value={form.competitors} onChange={e => set("competitors", e.target.value)} rows={3} placeholder="https://competitor1.com&#10;https://competitor2.com&#10;https://competitor3.com" className={`${inputClass} resize-none`} />
                <p className="text-xs text-[#52525B] mt-1">We study their sites to make yours better.</p>
              </div>
              <div>
                <label className={labelClass}>Any special requirements or notes?</label>
                <textarea value={form.specialRequirements} onChange={e => set("specialRequirements", e.target.value)} rows={3} placeholder="e.g. We need a form in French AND English. We have 3 locations. Please don't use stock photos." className={`${inputClass} resize-none`} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-black text-[#080E1C] mb-5">Technical setup</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Your domain name</label>
                  <input value={form.domain} onChange={e => set("domain", e.target.value)} placeholder="yourclinic.fr (or leave blank)" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Existing website URL</label>
                  <input value={form.existingWebsite} onChange={e => set("existingWebsite", e.target.value)} placeholder="https://old-site.com (if any)" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Social media handles</label>
                <input value={form.socialHandles} onChange={e => set("socialHandles", e.target.value)} placeholder="Instagram: @yourclinic / Facebook: yourclinic" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Existing Google Analytics ID <span className="text-[#52525B] font-normal">(G-XXXXXXXX, if any)</span></label>
                <input value={form.googleAnalyticsId} onChange={e => set("googleAnalyticsId", e.target.value)} placeholder="G-1234567890" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Preferred language for the system</label>
                <div className="flex gap-3">
                  {["English", "French", "Both"].map(lang => (
                    <button key={lang} type="button" onClick={() => set("preferredLanguage", lang)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${form.preferredLanguage === lang ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E]" : "border-[#E8E6E0] text-[#71717A] hover:border-[#CBD5E1]"}`}>
                      {lang}
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
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? "Submitting…" : <><CheckCircle className="w-4 h-4" /> Submit intake &amp; start build</>}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#52525B] mt-5">
          Step {step + 1} of {STEPS.length} · Your answers are saved as you go
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7]" />}>
        <OnboardingForm />
      </Suspense>
      <Footer />
    </>
  );
}
