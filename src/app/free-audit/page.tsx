"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, ArrowRight, Shield, Clock, TrendingUp } from "lucide-react";

const NICHES = [
  "Dental Clinic",
  "Aesthetic Clinic",
  "Real Estate",
  "Home Services (HVAC, plumbing…)",
  "Law / Notary",
  "Accounting / Finance",
  "Fitness / Wellness",
  "Other",
];

const PROBLEMS = [
  "Not enough online visibility",
  "Low website conversion rate",
  "No online booking system",
  "Missing follow-up on leads",
  "No tracking of what's working",
  "Website looks unprofessional",
  "No AI / chatbot on my site",
  "Competitors outrank me on Google",
];

const CLIENT_VALUES = [
  "Under €200",
  "€200 – €500",
  "€500 – €1,000",
  "€1,000 – €3,000",
  "€3,000+",
];

export default function FreeAuditPage() {
  const [form, setForm] = useState({
    businessName: "",
    websiteUrl: "",
    country: "",
    niche: "",
    problems: [] as string[],
    clientValue: "",
    email: "",
    phone: "",
    language: "English",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleProblem = (p: string) => {
    setForm((f) => ({
      ...f,
      problems: f.problems.includes(p) ? f.problems.filter((x) => x !== p) : [...f.problems, p],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "free-audit" }),
      });
    } catch {
      // best-effort
    }
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-black text-[#18181B] mb-3">Audit request received.</h1>
            <p className="text-[#52525B] mb-6">
              We&apos;ll review your website and send your free audit within <strong className="text-[#18181B]">24 hours</strong>.
            </p>
            <p className="text-sm text-[#71717A]">Check your inbox at <span className="text-[#52525B]">{form.email}</span></p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-12 lg:pt-36 lg:pb-16 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold uppercase tracking-widest mb-6">
              100% Free — No pitch call required
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] leading-tight mb-4">
              Get a free audit of your{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">
                online client acquisition
              </span>
            </h1>
            <p className="text-[#52525B] text-base max-w-xl mx-auto mb-8">
              Tell us about your business. We&apos;ll audit your current website, booking flow, and online presence — then send you a personalised report with exactly what&apos;s costing you clients.
            </p>
            <div className="flex flex-wrap gap-4 justify-center text-sm text-[#71717A]">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#36671E]" /> Delivered in 24h</span>
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#36671E]" /> No commitment</span>
              <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#36671E]" /> Actionable insights</span>
            </div>
          </div>
        </section>

        {/* FORM */}
        <section className="py-12 lg:py-16 bg-[#FAFAF7]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-[#E8E6E0] shadow-sm p-8 space-y-6">

              {/* Business Name */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-1.5">Business name <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.businessName}
                  onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                  placeholder="Dr. Martin Dental Clinic"
                  className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] text-sm text-[#080E1C] placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent"
                />
              </div>

              {/* Website URL */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-1.5">Current website URL <span className="text-[#52525B] font-normal">(leave blank if none)</span></label>
                <input
                  value={form.websiteUrl}
                  onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://yoursite.com"
                  type="url"
                  className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] text-sm text-[#080E1C] placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-1.5">Country <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  placeholder="France, UK, Netherlands…"
                  className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] text-sm text-[#080E1C] placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent"
                />
              </div>

              {/* Niche */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-2">Your industry <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {NICHES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, niche: n }))}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                        form.niche === n
                          ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E] font-bold"
                          : "border-[#E8E6E0] text-[#71717A] hover:border-[#CBD5E1] hover:bg-[#FAFAF7]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Problems */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-1">Biggest problems <span className="text-[#52525B] font-normal">(select all that apply)</span></label>
                <p className="text-xs text-[#52525B] mb-2">This helps us focus the audit on what matters most to you.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PROBLEMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleProblem(p)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all flex items-center gap-2 ${
                        form.problems.includes(p)
                          ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E] font-bold"
                          : "border-[#E8E6E0] text-[#71717A] hover:border-[#CBD5E1] hover:bg-[#FAFAF7]"
                      }`}
                    >
                      {form.problems.includes(p) && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Average client value */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-2">Average client value (revenue per new client) <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {CLIENT_VALUES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, clientValue: v }))}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        form.clientValue === v
                          ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E] font-bold"
                          : "border-[#E8E6E0] text-[#71717A] hover:border-[#CBD5E1] hover:bg-[#FAFAF7]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-1.5">Email <span className="text-red-500">*</span></label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@yourclinic.com"
                  className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] text-sm text-[#080E1C] placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent"
                />
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-1.5">Phone / WhatsApp <span className="text-[#52525B] font-normal">(optional)</span></label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+33 6 12 34 56 78"
                  className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] text-sm text-[#080E1C] placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-[#36671E] focus:border-transparent"
                />
              </div>

              {/* Language preference */}
              <div>
                <label className="block text-sm font-bold text-[#080E1C] mb-2">Preferred language for the audit</label>
                <div className="flex flex-wrap gap-2">
                  {["English", "French", "Arabic"].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, language: lang }))}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        form.language === lang
                          ? "border-[#36671E] bg-[#EEF5EA] text-[#36671E] font-bold"
                          : "border-[#E8E6E0] text-[#71717A] hover:border-[#CBD5E1] hover:bg-[#FAFAF7]"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !form.businessName || !form.email || !form.country || !form.niche || !form.clientValue}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Sending…" : (<>Send my audit request <ArrowRight className="w-5 h-5" /></>)}
              </button>

              <p className="text-center text-xs text-[#52525B]">
                We audit within 24 hours. No calls, no spam. GDPR compliant.
              </p>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
