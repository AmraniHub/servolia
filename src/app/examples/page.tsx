import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle, ArrowRight, ExternalLink, Clock, Sparkles } from "lucide-react";
import { SITE_TEMPLATES } from "@/lib/templates";
import { SETUP_PLAN } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Live Website Examples by Specialty — Servolia",
  description:
    "Pick your specialty and click through a live demo site — AI receptionist included. Every Servolia template is a real, working site you can test before choosing a plan.",
  alternates: {
    canonical: "https://servolia.com/examples",
    languages: {
      "en-US": "https://servolia.com/examples",
      "fr-FR": "https://servolia.com/fr/exemples",
      "x-default": "https://servolia.com/examples",
    },
  },
};

export default function ExamplesPage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#FAFAF7] pt-28 pb-14 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#EEF5EA] rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#36671E]/30 bg-[#EEF5EA] text-sm text-[#36671E]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-semibold">Live examples — click, browse, talk to the AI</span>
            </div>
          </div>
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-black text-[#18181B] leading-tight mb-5">
            See the finished product <span className="gradient-text">before you buy.</span>
          </h1>
          <p className="text-center text-lg text-[#52525B] max-w-2xl mx-auto mb-4">
            Pick your specialty below and open a live demo site — a real, working
            Servolia system, AI receptionist included. Not screenshots. Not mockups.
          </p>
          <p className="text-center text-sm text-[#71717A] max-w-2xl mx-auto">
            Every template is delivered in {SETUP_PLAN.delivery} as the €{SETUP_PLAN.totalEur} installation,
            then runs on a monthly plan.
          </p>
        </div>
      </section>

      {/* Template cards — driven entirely by the template registry */}
      <section className="py-14 lg:py-16 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SITE_TEMPLATES.map((t) => (
              <div key={t.key} className="bg-white rounded-2xl border border-[#E8E6E0] p-6 flex flex-col hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{t.emoji}</div>
                <h2 className="text-lg font-black text-[#18181B] mb-1.5">{t.name.en}</h2>
                <p className="text-sm text-[#71717A] leading-relaxed mb-5">{t.audience.en}</p>
                <ul className="flex flex-col gap-2 mb-6">
                  {t.includes.en.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#3F3F46]">
                      <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <div className="rounded-xl border border-[#36671E]/20 bg-[#EEF5EA]/40 p-4">
                    <p className="text-xs font-semibold text-[#18181B] mb-2.5">
                      {t.demoBusiness} · {t.demoCity}
                    </p>
                    <a
                      href={`/sites/${t.demoSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold text-sm hover:opacity-90 glow-button transition-opacity"
                    >
                      Open the live demo <ExternalLink className="w-4 h-4" />
                    </a>
                    <p className="text-[11px] text-[#71717A] leading-relaxed mt-2.5">
                      Fictional practice — a live demo you can click and test, including the AI receptionist.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How a template becomes YOUR site */}
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-4">
            From template to your practice
          </p>
          <p className="text-lg text-[#18181B] font-medium leading-relaxed mb-3">
            Your site is generated from this template, then written specifically for
            your practice — your services, your prices, your tone.
          </p>
          <div className="inline-flex items-center gap-1.5 text-sm text-[#52525B]">
            <Clock className="w-3.5 h-3.5 text-[#36671E]" />
            Delivered in {SETUP_PLAN.delivery} as the €{SETUP_PLAN.totalEur} installation — then it runs on a monthly plan.
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black text-[#18181B] mb-4">
            Found the template for <span className="gradient-text">your practice?</span>
          </h2>
          <p className="text-[#52525B] mb-6">
            Choose your monthly plan — or start with a free audit and we&apos;ll show you exactly what your current site is missing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 glow-button flex items-center gap-2"
            >
              View pricing <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/free-audit"
              className="px-6 py-3.5 rounded-xl border-2 border-[#36671E]/30 text-[#36671E] font-bold hover:bg-[#EEF5EA] transition-colors"
            >
              Get a free audit
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
