import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import { SOLUTIONS, INDUSTRIES } from "@/lib/content/pages";
import { Globe, Bot, Calendar, LayoutDashboard, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Solutions — AI Client Systems for Service Businesses | Servolia",
  description: "Explore Servolia's AI client acquisition systems: AI websites, AI receptionist, booking systems, and CRM dashboards. Fixed price, delivered in days.",
  alternates: { canonical: "https://servolia.com/solutions" },
};

const ICONS = [Globe, Bot, Calendar, LayoutDashboard];

export default function SolutionsHub() {
  return (
    <>
      <Navbar heroDark />
      <main className="bg-[#FAFAF7]">
        {/* HERO */}
        <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-20 bg-[#0A1F14] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#36671E] opacity-60 rounded-full blur-[120px]" />
            <div className="absolute inset-0 grain opacity-30" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#BEF264]/40 bg-[#BEF264]/10 text-[#ABDF90] text-xs font-bold uppercase tracking-widest mb-6">
              Our Solutions
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#FAFAF7] leading-[1.05] tracking-tight mb-6">
              One platform.{" "}
              <span className="bg-gradient-to-r from-[#BEF264] to-[#ABDF90] bg-clip-text text-transparent">Every part of client acquisition.</span>
            </h1>
            <p className="text-[#ABDF90]/80 text-lg max-w-2xl mx-auto leading-relaxed">
              From the first visit to the booked appointment and the monthly report — each Servolia system handles one part of turning strangers into paying clients.
            </p>
          </div>
        </section>

        {/* SOLUTIONS */}
        <section className="py-20 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-5">
              {SOLUTIONS.map((s, i) => {
                const Icon = ICONS[i % ICONS.length];
                return (
                  <Link key={s.slug} href={`/solutions/${s.slug}`}
                    className="group bg-white rounded-2xl p-7 border border-[#E8E6E0] hover:border-[#36671E]/30 hover:shadow-card transition-all duration-300 flex flex-col">
                    <div className="w-11 h-11 rounded-xl bg-[#36671E] flex items-center justify-center text-[#FAFAF7] mb-5 shadow-lg shadow-[#36671E]/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-[#18181B] mb-2">{s.title} {s.highlight}</h2>
                    <p className="text-sm text-[#71717A] leading-relaxed mb-5 flex-1">{s.sub}</p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#36671E] group-hover:gap-2.5 transition-all">
                      Explore {s.eyebrow.split("·")[1]?.trim() ?? "solution"} <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* INDUSTRIES */}
        <section className="py-16 lg:py-20 bg-white border-y border-[#E8E6E0]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">By industry</p>
              <h2 className="text-2xl sm:text-3xl font-black text-[#18181B]">Built for your specific business</h2>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { label: "Dentists", href: "/dentists" },
                { label: "Aesthetic clinics", href: "/niches/aesthetic-clinics" },
                { label: "Real estate", href: "/niches/real-estate" },
                { label: "Home services", href: "/niches/home-services" },
                ...INDUSTRIES.map((i) => ({ label: i.highlight.replace(".", ""), href: `/niches/${i.slug}` })),
              ].map((n) => (
                <Link key={n.href} href={n.href}
                  className="px-4 py-2.5 rounded-xl border border-[#E8E6E0] bg-[#FAFAF7] text-[#18181B] text-sm font-semibold hover:border-[#36671E] hover:text-[#36671E] transition-colors capitalize">
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-black text-[#18181B] mb-4">Not sure which system you need?</h2>
            <p className="text-[#71717A] mb-8">Start with a free audit — we'll recommend the right system for your business, no charge and no call required.</p>
            <Link href="/free-audit"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#36671E] text-[#FAFAF7] font-black hover:bg-[#295115] transition-colors">
              Book a Free System Audit <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
