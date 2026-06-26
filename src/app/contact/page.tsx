"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, Clock, Shield, CheckCircle, ArrowRight, Zap } from "lucide-react";

const plans = ["Not sure yet — audit first", "Website System (€790)", "Booking System (€1,490)", "Client System (€2,900)", "Custom / Add-on"];
const industries = ["Dental Clinic", "Aesthetic / Med Spa", "Real Estate", "Home Services (HVAC, Roofing…)", "Restaurant / Food", "Legal / Accounting", "Other"];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", business: "", industry: "", plan: "", website: "", problem: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "contact" }),
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      <section className="bg-[#080E1C] pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">Get Started</p>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Get your{" "}
            <span className="gradient-text">free business audit</span>
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
            Tell us about your business. We'll analyze your online presence and send you a PDF report showing exactly what's costing you clients — within 24 hours.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-[#F5F5F5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Info sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-xl font-black text-[#080E1C] mb-5">What happens next</h2>
                <div className="flex flex-col gap-5">
                  {[
                    { icon: <Mail className="w-4 h-4 text-[#95BF47]" />, title: "You submit this form", desc: "5 minutes. No payment required." },
                    { icon: <Clock className="w-4 h-4 text-[#6BA52A]" />, title: "We audit your business", desc: "Within 24 hours we send a PDF audit showing your gaps and our recommendations." },
                    { icon: <Zap className="w-4 h-4 text-[#10B981]" />, title: "Optional 15-min call", desc: "If you want, we hop on a quick call to walk through the audit together." },
                    { icon: <CheckCircle className="w-4 h-4 text-[#10B981]" />, title: "We build your system", desc: "If you're ready, we propose a fixed-price package. Deposit via Stripe. Build starts immediately." },
                  ].map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center flex-shrink-0 shadow-sm">{s.icon}</div>
                      <div>
                        <p className="font-bold text-[#080E1C] text-sm">{s.title}</p>
                        <p className="text-[#64748B] text-xs mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 rounded-xl bg-white border border-[#E2E8F0]">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-[#10B981]" />
                    <span className="text-sm font-bold text-[#080E1C]">Our guarantees</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {["GDPR compliant handling", "No spam. Ever.", "Free audit, no commitment", "Fixed price before we start", "7-day delivery guarantee"].map((g, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-[#64748B]">
                        <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />{g}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 p-4 rounded-xl border border-[#95BF47]/20 bg-[#95BF47]/5">
                  <p className="text-sm font-bold text-[#95BF47] mb-1">Prefer email?</p>
                  <a href="mailto:hello@servolia.com" className="text-sm text-[#94A3B8] hover:text-[#95BF47] transition-colors">
                    hello@servolia.com
                  </a>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2">
              {submitted ? (
                <div className="bg-white rounded-2xl border border-[#10B981]/30 p-10 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-[#10B981]" />
                  </div>
                  <h2 className="text-2xl font-black text-[#080E1C] mb-3">We've got your request!</h2>
                  <p className="text-[#64748B] mb-6 leading-relaxed">
                    Your free audit is being prepared. You'll receive a detailed PDF report at <strong>{form.email}</strong> within 24 hours.
                  </p>
                  <div className="p-4 rounded-xl bg-[#F5F5F5] border border-[#E2E8F0] text-sm text-[#64748B]">
                    <p className="font-semibold text-[#080E1C] mb-1">What to expect:</p>
                    <ul className="flex flex-col gap-1 text-left">
                      <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#10B981]" /> PDF audit sent within 24h</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#10B981]" /> No pressure, no spam</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#10B981]" /> Reply to schedule a free call if you'd like</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E2E8F0] p-8 shadow-sm">
                  <h2 className="text-xl font-black text-[#080E1C] mb-6">Tell us about your business</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1.5">Your name *</label>
                      <input name="name" required value={form.name} onChange={handleChange}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#080E1C] focus:outline-none focus:border-[#95BF47] focus:ring-2 focus:ring-[#95BF47]/20 transition-all"
                        placeholder="Sophie Laurent" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1.5">Email address *</label>
                      <input name="email" type="email" required value={form.email} onChange={handleChange}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#080E1C] focus:outline-none focus:border-[#95BF47] focus:ring-2 focus:ring-[#95BF47]/20 transition-all"
                        placeholder="sophie@clinique.fr" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1.5">Business name *</label>
                      <input name="business" required value={form.business} onChange={handleChange}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#080E1C] focus:outline-none focus:border-[#95BF47] focus:ring-2 focus:ring-[#95BF47]/20 transition-all"
                        placeholder="Cabinet Dentaire Martin" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1.5">Industry *</label>
                      <select name="industry" required value={form.industry} onChange={handleChange}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#080E1C] focus:outline-none focus:border-[#95BF47] focus:ring-2 focus:ring-[#95BF47]/20 transition-all bg-white">
                        <option value="">Select industry</option>
                        {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs font-bold text-[#374151] mb-1.5">Current website URL (if any)</label>
                    <input name="website" value={form.website} onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#080E1C] focus:outline-none focus:border-[#95BF47] focus:ring-2 focus:ring-[#95BF47]/20 transition-all"
                      placeholder="https://yourwebsite.com (or leave blank)" />
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs font-bold text-[#374151] mb-1.5">Interested in</label>
                    <select name="plan" value={form.plan} onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#080E1C] focus:outline-none focus:border-[#95BF47] focus:ring-2 focus:ring-[#95BF47]/20 transition-all bg-white">
                      <option value="">Select a plan</option>
                      {plans.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-bold text-[#374151] mb-1.5">What's your biggest challenge right now? *</label>
                    <textarea name="problem" required value={form.problem} onChange={handleChange} rows={4}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#080E1C] focus:outline-none focus:border-[#95BF47] focus:ring-2 focus:ring-[#95BF47]/20 transition-all resize-none"
                      placeholder="e.g. We have no online booking system, clients can't find us on Google, our website looks outdated..." />
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] font-black text-base hover:opacity-90 transition-opacity glow-button flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? "Sending…" : (<>Send My Free Audit Request <ArrowRight className="w-4 h-4" /></>)}
                  </button>

                  <p className="text-center text-xs text-[#94A3B8] mt-3">
                    By submitting you agree to our <a href="/legal/privacy" className="underline hover:text-[#95BF47]">privacy policy</a>. No spam. Unsubscribe anytime.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
